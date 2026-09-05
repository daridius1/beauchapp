/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Mascotas deja de ser "hasta 5 mascotas, cada una con sus fotos" (colección `pets`) y
  // pasa a ser un solo perfil por persona, mismo patrón que tinder_profiles: un nombre
  // libre (para poner el nombre de una o varias mascotas si tiene más de una), una
  // descripción, y hasta 10 fotos. La colección `pets` no se borra —quotes/citas viejas
  // desde el feed siguen apuntando a mascotas puntuales ahí— pero deja de recibir
  // creaciones nuevas desde la app.
  const coll = app.findCollectionByNameOrId("pet_profiles");
  if (!coll) return;

  if (!coll.fields.find((f) => f.name === "name")) {
    coll.fields.add(new Field({ name: "name", type: "text", required: false }));
  }
  if (!coll.fields.find((f) => f.name === "photos")) {
    coll.fields.add(new Field({
      name: "photos",
      type: "file",
      maxSelect: 10,
      maxSize: 15728640, // 15MB por foto, igual que tinder_profiles/pets
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      required: false,
    }));
  }
  app.save(coll);
}, (app) => {
  const coll = app.findCollectionByNameOrId("pet_profiles");
  if (!coll) return;
  coll.fields.removeByName("name");
  coll.fields.removeByName("photos");
  app.save(coll);
});
