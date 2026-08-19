/// <reference path="../pb_data/types.d.ts" />

// Revierte el aflojamiento de 1783930000_fix_org_members_rules.js (que dejaba
// createRule/updateRule/deleteRule en "cualquier autenticado" — un hueco real, no
// intencional). Ahora que agregar a alguien crea una invitación (status='pending',
// forzado en el hook de auth.pb.js) en vez de una membresía activa directa, además
// tiene sentido que solo la propia organización pueda crear/editar/borrar sus filas de
// membresía — aceptar/rechazar por parte del estudiante invitado NO pasa por estas
// reglas, va por la ruta dedicada /api/org-invites/respond (usa $app, evita las
// reglas y los hooks de request).
migrate((app) => {
    const collection = app.findCollectionByNameOrId("organization_members");
    collection.createRule = "@request.auth.id != '' && @request.auth.id = organization";
    collection.updateRule = "@request.auth.id = organization";
    collection.deleteRule = "@request.auth.id = organization";
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("organization_members");
    collection.createRule = "@request.auth.id != ''";
    collection.updateRule = "@request.auth.id != ''";
    collection.deleteRule = "@request.auth.id != ''";
    app.save(collection);
});
