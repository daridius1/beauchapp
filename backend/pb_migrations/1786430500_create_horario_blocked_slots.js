/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // horario_blocked_slots — bloques de fecha-hora (dentro de la ventana marcable de
    // 3 semanas) que el admin cerró desde /admin/horarios: la cancha/lugar no está
    // disponible ahí, independiente de la felicidad que cualquier equipo le ponga.
    // Un row por bloque bloqueado, se administra solo desde /admin/horarios (toggle),
    // nunca vía create/update/delete directo de la colección.
    const horarioBlockedSlots = new Collection({
        name: "horario_blocked_slots",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "blockCode",
                type: "text",
                required: true,
                max: 20
            },
            { id: "hbs_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "hbs_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_horario_blocked_slots_block ON horario_blocked_slots (blockCode)"
        ]
    });
    app.save(horarioBlockedSlots);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("horario_blocked_slots")); } catch (e) {}
});
