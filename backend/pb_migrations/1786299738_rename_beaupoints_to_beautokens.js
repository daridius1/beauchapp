/// <reference path="../pb_data/types.d.ts" />

// Renombra la moneda de Beaumarket de "BeauPoints" a "BeauTokens" (símbolo ℬ en el
// front). Se renombra el campo EN VEZ de crear uno nuevo y migrar datos a mano —
// PocketBase preserva el contenido de la columna al cambiar solo su `name`, así que
// nadie pierde su saldo acumulado (incluyendo el cron diario y los mercados de ejemplo
// ya jugados en desarrollo). Las dos migraciones que originalmente crearon el campo
// (1786242551, 1786242552) se dejan intactas con el nombre viejo a propósito: en un
// ambiente nuevo igual terminan creando "beaupoints" primero y esta migración lo
// renombra después, así que el resultado final es el mismo sin importar si el ambiente
// ya las había corrido o no.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    if (!users) return;
    const fields = users.fields || [];
    for (let i = 0; i < fields.length; i++) {
        if (fields[i].name === "beaupoints") {
            fields[i].name = "beautokens";
        }
    }
    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    if (!users) return;
    const fields = users.fields || [];
    for (let i = 0; i < fields.length; i++) {
        if (fields[i].name === "beautokens") {
            fields[i].name = "beaupoints";
        }
    }
    app.save(users);
});
