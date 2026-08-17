/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    // horario_availability — la disponibilidad de UN equipo, marcada como felicidad
    // (0 = No disponible .. 4 = Excelente) por bloque de fecha-hora, para la ventana
    // móvil de 3 semanas (semana actual + 2) que define teamSchedule.js. Sin concepto
    // de "ronda": una fila por equipo, se actualiza en el lugar a medida que la ventana
    // avanza (mismo patrón de upsert que poll_votes/horario_availability anterior).
    const horarioAvailability = new Collection({
        name: "horario_availability",
        type: "base",
        listRule: "@request.auth.id = team",
        viewRule: "@request.auth.id = team",
        createRule: "@request.auth.id != '' && @request.auth.id = team",
        updateRule: "@request.auth.id = team",
        deleteRule: null,
        fields: [
            {
                name: "team",
                type: "relation",
                required: true,
                collectionId: usersColl.id,
                cascadeDelete: true,
                maxSelect: 1
            },
            {
                // { "2026-08-17-09": 3, ... } — una entrada por cada bloque de la ventana
                // marcable vigente al momento de guardar (lo valida team_schedule.pb.js,
                // las reglas declarativas no pueden expresar completitud de claves).
                name: "happiness",
                type: "json",
                required: true,
                maxSize: 8000
            },
            { id: "hav_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "hav_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_horario_availability_team ON horario_availability (team)"
        ]
    });
    app.save(horarioAvailability);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("horario_availability")); } catch (e) {}
});
