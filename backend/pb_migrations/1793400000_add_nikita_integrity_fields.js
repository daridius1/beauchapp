/// <reference path="../pb_data/types.d.ts" />

// Los baneos y las partidas anuladas se conservan como evidencia. El puntaje visible
// queda en cero, pero no se destruye el historial que permite explicar la sancion.
// Tambien se guarda una unica partida activa por jugador para impedir acumular
// semillas firmadas y cobrarlas en paralelo.
migrate((app) => {
    const scores = app.findCollectionByNameOrId("alliance_nikita_scores");
    scores.fields.add(new Field({ name: "nikita_banned", type: "bool", required: false }));
    scores.fields.add(new Field({ name: "nikita_banned_at", type: "date", required: false }));
    scores.fields.add(new Field({ name: "nikita_ban_reason", type: "text", required: false, max: 500 }));
    scores.fields.add(new Field({ name: "nikita_banned_by", type: "text", required: false, max: 32 }));
    scores.fields.add(new Field({ name: "active_run_id", type: "text", required: false, max: 24 }));
    scores.fields.add(new NumberField({
        name: "active_seed", min: 0, max: 4294967295, noDecimal: true, required: false,
    }));
    scores.fields.add(new NumberField({
        name: "active_started_at", min: 0, max: 9999999999999, noDecimal: true, required: false,
    }));
    app.save(scores);

    const runs = app.findCollectionByNameOrId("alliance_nikita_runs");
    runs.fields.add(new NumberField({ name: "seed", min: 0, max: 4294967295, noDecimal: true }));
    runs.fields.add(new NumberField({ name: "started_at", min: 0, max: 9999999999999, noDecimal: true }));
    runs.fields.add(new NumberField({ name: "ticks", min: 0, max: 36000, noDecimal: true }));
    runs.fields.add(new NumberField({ name: "duration_ms", min: 0, max: 1200000, noDecimal: true }));
    runs.fields.add(new NumberField({ name: "claimed_score", min: 0, max: 10000000, noDecimal: true }));
    runs.fields.add(new NumberField({ name: "distance", min: 0, max: 1000000 }));
    runs.fields.add(new Field({ name: "death_reason", type: "text", required: false, max: 32 }));
    // Se persiste como pares [tick, direccion], no como objetos {t,d}. Conserva el
    // replay exacto y reduce cerca de un 40 % el espacio usado por cada evento.
    runs.fields.add(new Field({ name: "replay", type: "json", required: false, maxSize: 70000 }));
    runs.fields.add(new Field({ name: "voided", type: "bool", required: false }));
    runs.fields.add(new Field({ name: "voided_at", type: "date", required: false }));
    runs.fields.add(new Field({ name: "void_reason", type: "text", required: false, max: 500 }));
    runs.fields.add(new Field({ name: "voided_by", type: "text", required: false, max: 32 }));
    runs.indexes = (runs.indexes || []).concat([
        "CREATE INDEX idx_alliance_nikita_runs_voided ON alliance_nikita_runs (user, voided, created)",
    ]);
    app.save(runs);
}, (app) => {
    const runs = app.findCollectionByNameOrId("alliance_nikita_runs");
    if (runs) {
        [
            "seed", "started_at", "ticks", "duration_ms", "claimed_score", "distance",
            "death_reason", "replay", "voided", "voided_at", "void_reason", "voided_by",
        ].forEach((name) => runs.fields.removeByName(name));
        runs.indexes = (runs.indexes || []).filter((index) => !index.includes("idx_alliance_nikita_runs_voided"));
        app.save(runs);
    }

    const scores = app.findCollectionByNameOrId("alliance_nikita_scores");
    if (scores) {
        [
            "nikita_banned", "nikita_banned_at", "nikita_ban_reason", "nikita_banned_by",
            "active_run_id", "active_seed", "active_started_at",
        ].forEach((name) => scores.fields.removeByName(name));
        app.save(scores);
    }
});
