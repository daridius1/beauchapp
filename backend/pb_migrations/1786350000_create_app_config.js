/// <reference path="../pb_data/types.d.ts" />

// app_config: fila única de configuración editable a mano desde el dashboard de admin de
// PocketBase (Collections > app_config > el único registro) — sin necesidad de tocar
// código ni redesplegar para prender/apagar cosas puntuales. Primer uso: cerrar el
// registro de estudiantes nuevos ("botón" = el toggle bool en el editor del admin) con un
// mensaje editable. listRule/viewRule públicos a propósito: la vista de registro se
// consulta ANTES de que exista sesión, así que un usuario anónimo tiene que poder leerla.
migrate((app) => {
    const collection = new Collection({
        name: "app_config",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "registration_open",
                type: "bool"
            },
            {
                name: "registration_closed_message",
                type: "text",
                required: false,
                max: 500
            },
            { id: "apc_crea_01", name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { id: "apc_upd_01", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ]
    });
    app.save(collection);

    const record = new Record(collection);
    record.set("registration_open", true);
    record.set("registration_closed_message", "Estamos teniendo problemas de capacidad para registrarse, inténtalo más tarde.");
    app.save(record);
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("app_config")); } catch (e) {}
});
