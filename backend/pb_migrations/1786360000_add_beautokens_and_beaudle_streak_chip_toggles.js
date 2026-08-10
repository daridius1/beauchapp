/// <reference path="../pb_data/types.d.ts" />

// Igual que show_karma_on_profile (ver 1784000600_add_social_and_chips_fields_to_users.js):
// BeauTokens y la racha de Beaudle pasan a ser "ladders" más para efectos de la insignia
// de perfil (UserChipsRow), cada uno con su propio toggle de visibilidad — unificados en
// EditProfileScreen.tsx junto al resto de los ladders de deporte.
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");

    users.fields.add(new Field({
        name: "show_beautokens_on_profile",
        type: "bool"
    }));

    users.fields.add(new Field({
        name: "show_beaudle_streak_on_profile",
        type: "bool"
    }));

    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("show_beautokens_on_profile");
    users.fields.removeByName("show_beaudle_streak_on_profile");
    app.save(users);
});
