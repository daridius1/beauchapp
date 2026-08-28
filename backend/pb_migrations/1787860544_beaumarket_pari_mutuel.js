/// <reference path="../pb_data/types.d.ts" />

// Beaumarket pasa de LMSR (market maker automático) a pari-mutuel: cada apuesta va
// directo al pozo del resultado elegido, el porcentaje mostrado es proporcional a lo
// apostado, y al resolver el pozo total se reparte entre quienes acertaron a prorrata de
// su apuesta. Ver lib/beaumarket.js para las fórmulas nuevas.
//
// Momento elegido a propósito: no hay ningún mercado abierto en producción (los dos que
// existían se cerraron antes de este cambio), así que no hay plata en juego que migrar.
// Es la única vez que renombrar los campos sale gratis en vez de tener que arrastrar
// nombres de un modelo que ya no existe (ver CLAUDE.md §2.2/2.4 sobre el costo de eso).
//
// required:false en los campos nuevos/existentes por el motivo de siempre en este
// proyecto: un number/date required en su valor "vacío" (0, "") falla la validación de
// PocketBase con "cannot be blank" aunque sea un valor perfectamente válido en el
// dominio. Lo obligatorio de verdad (closesAt en el futuro, outcomes entre 2 y 10) se
// valida en la ruta de creación, no en el esquema — mismo patrón que "outcomes" ya usaba.
migrate((app) => {
    const beaumarkets = app.findCollectionByNameOrId("beaumarkets");

    beaumarkets.fields.add(new Field({
        // Fecha de cierre automático — reemplaza el cierre 100% manual de antes. Un cron
        // (ver beaumarket.pb.js) pasa a "closed" cualquier mercado abierto que ya la
        // cumplió; el botón "Cerrar operaciones" del panel admin sigue existiendo para
        // cerrar ANTES de esa fecha si hace falta, nunca para extenderla.
        name: "closesAt",
        type: "date",
        required: false,
    }));

    beaumarkets.fields.removeByName("b");

    const poolField = beaumarkets.fields.find((f) => f.name === "q");
    if (poolField) poolField.name = "pool"; // ahora es directamente ℬ apostados por resultado, no acciones netas LMSR

    app.save(beaumarkets);

    const positions = app.findCollectionByNameOrId("beaumarket_positions");
    const amountField = positions.fields.find((f) => f.name === "shares");
    if (amountField) amountField.name = "amount";
    app.save(positions);

    const trades = app.findCollectionByNameOrId("beaumarket_trades");
    const amountDeltaField = trades.fields.find((f) => f.name === "sharesDelta");
    if (amountDeltaField) amountDeltaField.name = "amountDelta";
    // "cost" no tiene equivalente pari-mutuel: lo que cambia de manos es exactamente
    // amountDelta, nunca un costo distinto calculado por una curva de precio.
    trades.fields.removeByName("cost");
    app.save(trades);
}, (app) => {
    const trades = app.findCollectionByNameOrId("beaumarket_trades");
    trades.fields.add(new Field({ name: "cost", type: "number", required: false, noDecimal: true }));
    const sharesDeltaField = trades.fields.find((f) => f.name === "amountDelta");
    if (sharesDeltaField) sharesDeltaField.name = "sharesDelta";
    app.save(trades);

    const positions = app.findCollectionByNameOrId("beaumarket_positions");
    const sharesField = positions.fields.find((f) => f.name === "amount");
    if (sharesField) sharesField.name = "shares";
    app.save(positions);

    const beaumarkets = app.findCollectionByNameOrId("beaumarkets");
    const qField = beaumarkets.fields.find((f) => f.name === "pool");
    if (qField) qField.name = "q";
    beaumarkets.fields.add(new Field({ name: "b", type: "number", required: false, min: 1, noDecimal: true }));
    beaumarkets.fields.removeByName("closesAt");
    app.save(beaumarkets);
});
