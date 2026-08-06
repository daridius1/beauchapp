// Lista única de campos de "users" que necesita UserChipsRow para pintar los chips
// del perfil (Karma, Generación, Departamento, Ladders, Organizaciones) — ver
// frontend/src/components/UserChipsRow.tsx, que exporta la misma lista como
// CHIP_USER_FIELDS del lado del frontend. No hay forma de compartir un único
// archivo entre el runtime de los hooks (Goja) y el bundle de la app, así que se
// mantienen dos copias hermanas; si agregas un chip nuevo que lea un campo de
// "users" que no esté acá, agrégalo en ambos lados.
//
// Cualquier endpoint que arme a mano un objeto "user" reducido para una vista con
// chips (en vez de usar expand, que ya trae el registro completo) debe usar
// pickChipUserFields() en vez de listar campos sueltos — así un chip nuevo no se
// queda fuera silenciosamente en esa vista (pasó con Generación en
// /api/tinder/discover).
const CHIP_USER_FIELDS = [
    "id",
    "name",
    "username",
    "avatar",
    "type",
    "entry_year",
    "department",
    "karma",
    "show_karma_on_profile",
];

function pickChipUserFields(userRecord) {
    const out = {};
    CHIP_USER_FIELDS.forEach((field) => {
        out[field] = userRecord.get(field);
    });
    out.collectionId = userRecord.collection().id;
    out.collectionName = "users";
    return out;
}

module.exports = { CHIP_USER_FIELDS, pickChipUserFields };
