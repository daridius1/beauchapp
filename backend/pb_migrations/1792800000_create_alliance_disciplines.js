/// <reference path="../pb_data/types.d.ts" />

// Disciplinas y resultados oficiales de Alianzas. Las colecciones quedan cerradas a
// la API directa: la cuenta @cei administra todo mediante los endpoints del hook y
// las demás personas solo reciben la vista pública ya acotada.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const subtypeField = users.fields.getByName("subtype");
    if (subtypeField && !subtypeField.values.includes("alliance")) {
        subtypeField.values = subtypeField.values.concat(["alliance"]);
        app.save(users);
    }

    // En producción @cei ya existe. El subtipo es la autorización estable del panel,
    // igual que subtype=league para Copa CDI; no se confía solo en un username editable.
    try {
        const existingCei = app.findFirstRecordByFilter("users", "username = {:username}", { username: "cei" });
        if (existingCei.getString("type") === "organization") {
            existingCei.set("subtype", "alliance");
            app.save(existingCei);
        }
    } catch (notFound) { /* en una base local nueva se crea más abajo */ }

    const disciplines = new Collection({
        id: "alliancediscipl",
        name: "alliance_disciplines",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            { name: "name", type: "text", required: true, min: 2, max: 80 },
            { name: "normalized_name", type: "text", required: true, min: 2, max: 80 },
            { name: "deleted", type: "bool", required: false },
            { name: "created", type: "autodate", onCreate: true },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_alliance_discipline_name ON alliance_disciplines (normalized_name) WHERE deleted = false",
            "CREATE INDEX idx_alliance_discipline_active ON alliance_disciplines (deleted, created)",
        ],
    });
    app.save(disciplines);

    const placements = new Collection({
        id: "allianceplaces1",
        name: "alliance_placements",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "discipline",
                type: "relation",
                collectionId: disciplines.id,
                cascadeDelete: false,
                maxSelect: 1,
                required: true,
            },
            {
                name: "alliance",
                type: "select",
                values: ["urbana", "pop", "gotico", "hiphop", "punk", "rock"],
                maxSelect: 1,
                required: true,
            },
            { name: "place", type: "number", min: 1, max: 6, noDecimal: true, required: true },
            { name: "deleted", type: "bool", required: false },
            { name: "created", type: "autodate", onCreate: true },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_alliance_place_team ON alliance_placements (discipline, alliance) WHERE deleted = false",
            "CREATE UNIQUE INDEX idx_alliance_place_number ON alliance_placements (discipline, place) WHERE deleted = false",
            "CREATE INDEX idx_alliance_place_discipline ON alliance_placements (discipline, deleted)",
        ],
    });
    app.save(placements);

    // La cuenta real ya existe en producción. Este bloque solo prepara la base local
    // cuando APP_URL apunta inequívocamente a loopback; nunca crea ni cambia claves en
    // un despliegue público.
    const appUrl = String($os.getenv("APP_URL") || $os.getenv("SITE_URL") || "").toLowerCase();
    const isLocal = appUrl.includes("127.0.0.1") || appUrl.includes("localhost");
    if (isLocal) {
        try {
            app.findFirstRecordByFilter("users", "username = {:username}", { username: "cei" });
        } catch (notFound) {
            const cei = new Record(users);
            cei.set("username", "cei");
            cei.set("email", "cei@beauchapp.local");
            cei.set("emailVisibility", false);
            cei.set("name", "Centro de Estudiantes de Ingeniería");
            cei.set("type", "organization");
            cei.set("subtype", "alliance");
            cei.set("verified", true);
            cei.set("password", "cei-local-2026");
            app.save(cei);
        }
    }
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("alliance_placements")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("alliance_disciplines")); } catch (e) {}

    const appUrl = String($os.getenv("APP_URL") || $os.getenv("SITE_URL") || "").toLowerCase();
    const isLocal = appUrl.includes("127.0.0.1") || appUrl.includes("localhost");
    if (isLocal) {
        try {
            const cei = app.findFirstRecordByFilter(
                "users", "username = {:username} && email = {:email}",
                { username: "cei", email: "cei@beauchapp.local" }
            );
            app.delete(cei);
        } catch (e) {}
    }

    const users = app.findCollectionByNameOrId("users");
    try {
        const existingCei = app.findFirstRecordByFilter("users", "username = {:username}", { username: "cei" });
        if (existingCei.getString("subtype") === "alliance") {
            existingCei.set("subtype", "center");
            app.save(existingCei);
        }
    } catch (e) {}
    const subtypeField = users.fields.getByName("subtype");
    if (subtypeField && subtypeField.values.includes("alliance")) {
        subtypeField.values = subtypeField.values.filter((value) => value !== "alliance");
        app.save(users);
    }
});
