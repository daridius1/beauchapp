/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const postsCollection = app.findCollectionByNameOrId("posts");
    postsCollection.fields.add(new Field({
        // La ubicación es una instantánea del lugar elegido (nombre, origen y, si
        // corresponde, coordenadas). No se relaciona a otra colección porque los puntos
        // libres de los alrededores no son registros persistentes.
        name: "location",
        type: "json",
        required: false,
        maxSize: 1000,
    }));

    // La regla permite que otros usuarios actualicen los likes, pero no los adjuntos.
    // Se anexa a la expresión vigente para no perder las restricciones anteriores.
    const locationFreeze = " && (@request.body.location:isset = false || @request.body.location = location)";
    if (postsCollection.updateRule.indexOf("@request.body.location:isset") === -1) {
        postsCollection.updateRule += locationFreeze;
    }
    app.save(postsCollection);
}, (app) => {
    const postsCollection = app.findCollectionByNameOrId("posts");
    postsCollection.fields.removeByName("location");
    postsCollection.updateRule = postsCollection.updateRule.replace(
        " && (@request.body.location:isset = false || @request.body.location = location)",
        ""
    );
    app.save(postsCollection);
});
