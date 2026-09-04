/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("match_statements");
    collection.fields.add(new Field({
        // Si la persona autoriza que la noticia la mencione por su nombre real al citar
        // o resumir SU declaración puntual. Por default no: la declaración sigue sin
        // publicarse tal cual en ningún caso (eso no cambia), pero sin esto la IA nunca
        // debe nombrarla — solo sintetizar (ver lib/newsGen.js). No es "anonimato": quien
        // arma la noticia siempre puede ver de quién es cada declaración, esto solo
        // decide si ESA persona autoriza que su nombre aparezca en el texto publicado.
        name: "wantsMention",
        type: "bool",
        required: false,
        presentable: false,
    }));
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("match_statements");
    collection.fields.removeByName("wantsMention");
    app.save(collection);
});
