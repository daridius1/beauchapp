/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // Reemplaza el arbitraje en vivo (código de 6 caracteres + reloj, ver
    // match_arbitration.pb.js, que queda archivado tal cual): ahora el resultado se
    // registra DESPUÉS del partido, con un link de un solo uso que la liga le manda al
    // árbitro. Mismo patrón que users.registrationToken/tokenExpiresAt
    // (1783400000_unverified_users_rules.js) — un token largo y una fecha de
    // vencimiento, sin colección aparte. hidden:true en el token porque, igual que
    // league_matches.code, nunca tiene que viajar en una lectura normal de la
    // colección: solo lo devuelve la ruta que lo genera.
    const matches = app.findCollectionByNameOrId("league_matches");
    matches.fields.add(new Field({
        name: "resultToken",
        type: "text",
        required: false,
        hidden: true,
    }));
    matches.fields.add(new Field({
        name: "resultTokenExpiresAt",
        type: "date",
        required: false,
    }));
    app.save(matches);
}, (app) => {
    const matches = app.findCollectionByNameOrId("league_matches");
    matches.fields.removeByName("resultTokenExpiresAt");
    matches.fields.removeByName("resultToken");
    app.save(matches);
});
