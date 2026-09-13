/// <reference path="../pb_data/types.d.ts" />

// Reemplaza el intercambio 1x1 por uno de N láminas con contraoferta. El 1x1 original
// (1790700400_create_album_trades.js) nunca llegó a tener interfaz — quedó como código
// muerto en album_trades.pb.js — y tenía un agujero que su propio comentario admitía:
// proponer exigía nombrar la figurita que se le pedía al otro, sin forma de saber si la
// tenía. El flujo nuevo lo esquiva de raíz: quien propone solo ofrece láminas SUYAS, y
// quien recibe elige de su PROPIO inventario qué devolver, así nadie necesita ver el
// inventario ajeno.
//
// `offerCodes`/`counterCodes` son json (arrays de códigos de 4 dígitos) en vez de los
// dos `text` de antes, y llevan repetidas: ofrecer dos copias de la misma figurita es
// legítimo, la cantidad es parte de la oferta. `counterCodes` viaja vacío hasta que la
// contraparte responde — de ahí el estado nuevo:
//
//   pending   → A ofreció, falta que B elija qué dar
//   countered → B eligió, falta que A confirme
//   accepted  → confirmado, las láminas ya se movieron
//
// Rechazar/cancelar/desistir siguen siendo $app.delete directo en cualquiera de los dos
// primeros estados, así que no hace falta un status para eso (mismo criterio que la
// migración original y que organization_members).
migrate((app) => {
    const collection = app.findCollectionByNameOrId("album_trades");

    // Las filas viejas tienen un solo código por lado y no hay forma sensata de
    // convertirlas — ni vale la pena: sin interfaz que las creara, las únicas que
    // existen son de pruebas manuales.
    app.db().newQuery("DELETE FROM album_trades").execute();

    collection.fields.removeByName("offerCode");
    collection.fields.removeByName("requestCode");
    collection.fields.add(new Field({ name: "offerCodes", type: "json", required: true, maxSize: 2000 }));
    collection.fields.add(new Field({ name: "counterCodes", type: "json", required: false, maxSize: 2000 }));
    collection.fields.getByName("status").values = ["pending", "countered", "accepted"];

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("album_trades");

    app.db().newQuery("DELETE FROM album_trades").execute();

    collection.fields.removeByName("offerCodes");
    collection.fields.removeByName("counterCodes");
    collection.fields.add(new Field({ name: "offerCode", type: "text", required: true, max: 8 }));
    collection.fields.add(new Field({ name: "requestCode", type: "text", required: true, max: 8 }));
    collection.fields.getByName("status").values = ["pending", "accepted"];

    app.save(collection);
});
