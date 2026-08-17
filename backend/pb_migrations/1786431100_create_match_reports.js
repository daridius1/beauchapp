/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");
    const matchesColl = app.findCollectionByNameOrId("league_matches");

    // match_reports — la relación entre "arbitrar" y "partido" es muchos a muchos:
    // cualquier cantidad de personas distintas puede arbitrar el mismo partido, cada
    // una con su propio informe independiente (su propia bitácora de eventos). La
    // restricción real está en la validación: el organizador de la liga aprueba UN
    // solo informe por partido y ese es el que se hace oficial (ver
    // /api/liga/matches/approve en match_arbitration.pb.js).
    const matchReports = new Collection({
        name: "match_reports",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "match",
                type: "relation",
                required: true,
                collectionId: matchesColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                name: "referee",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                // Bitácora completa y ordenada de todo lo que pasó en ESTE informe — ver
                // lib/matchEvents.js. Nunca se guarda el marcador/tarjetas sueltos.
                name: "events",
                type: "json",
                required: false,
                maxSize: 500000
            },
            {
                name: "status",
                type: "select",
                required: true,
                maxSelect: 1,
                values: ["in_progress", "submitted", "approved", "rejected"]
            },
            { id: "mrp_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "mrp_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            // Un informe por (partido, árbitro) — se actualiza en el lugar (upsert) en vez
            // de crear duplicados, mismo patrón que horario_availability/poll_votes.
            "CREATE UNIQUE INDEX idx_match_reports_unique ON match_reports (match, referee)",
            "CREATE INDEX idx_match_reports_match ON match_reports (match)"
        ]
    });
    app.save(matchReports);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("match_reports")); } catch (e) {}
});
