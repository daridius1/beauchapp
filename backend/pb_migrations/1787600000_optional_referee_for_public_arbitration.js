/// <reference path="../pb_data/types.d.ts" />

// El arbitraje pasa a poder hacerse sin sesión: el código del partido siempre fue la
// autorización real, y exigir además una cuenta solo estorbaba a quien está en la
// cancha con el teléfono de otra persona.
//
// `referee` era obligatorio, así que un informe anónimo no se podía crear. Pasa a
// opcional: vacío significa "lo abrió alguien sin sesión, con el código". Nada más
// depende de ese campo salvo la traza de autoría, que para el caso anónimo simplemente
// no existe — el código sigue siendo lo que se exige para escribir.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("match_reports");
    const field = collection.fields.getByName("referee");
    field.required = false;
    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("match_reports");
    const field = collection.fields.getByName("referee");
    field.required = true;
    app.save(collection);
});
