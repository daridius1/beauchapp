/// <reference path="../pb_data/types.d.ts" />

// Cuenta del bot BeauRok — se crea directo con $app.save() (no vía la ruta pública de
// registro) porque esa ruta valida dominio de correo institucional, cosa que no aplica
// acá. La password es un valor fijo sin uso real: el bot nunca inicia sesión, solo se
// usa como "author" de posts creados server-side desde mentions.pb.js. type:
// "organization" lo deja afuera de todos los rankings de estudiantes (karma, BeauTokens,
// racha de Beaudle) sin tocar ningún filtro existente, porque esos filtros ya excluyen
// "organization". El avatar se sube después, a mano, una sola vez.
migrate((app) => {
    const usersCollection = app.findCollectionByNameOrId("users");

    try {
        app.findFirstRecordByFilter("users", "username = {:u}", { u: "beaurok" });
        return; // ya existe (ej. si la migración se vuelve a correr)
    } catch (nf) { /* no existe todavía, se crea abajo */ }

    const bot = new Record(usersCollection);
    bot.set("username", "beaurok");
    bot.set("email", "beaurok@beauchapp.internal");
    bot.set("emailVisibility", false);
    bot.set("name", "BeauRok");
    bot.set("type", "organization");
    bot.set("password", "no-login-beaurok-bot-account-2026");
    app.save(bot);
}, (app) => {
    try {
        const bot = app.findFirstRecordByFilter("users", "username = {:u}", { u: "beaurok" });
        app.delete(bot);
    } catch (nf) { /* ya no existe */ }
});
