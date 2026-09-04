/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.add(new Field({
        // "player" (default) o "coach" (DT) — se agrega EXACTAMENTE igual que un
        // jugador (solo nombre, se puede vincular a una cuenta real después editando),
        // ver EditTeamScreen.tsx. No required a nivel de schema (el backfill de abajo
        // deja las filas viejas en "player"; el cliente siempre manda un valor desde
        // acá en adelante). Varios lugares del código asumían implícitamente que TODO
        // team_players era jugador (convocatoria de arbitraje, rosters públicos,
        // "no convocados" de noticias) — quedan filtrados por role='player' donde
        // corresponde en los hooks/pantallas que los usan.
        name: "role",
        type: "select",
        required: false,
        maxSelect: 1,
        values: ["player", "coach"],
    }));
    app.save(collection);

    // Backfill: todo lo que ya existía es jugador.
    app.db().newQuery("UPDATE team_players SET role = 'player' WHERE role IS NULL OR role = ''").execute();
}, (app) => {
    const collection = app.findCollectionByNameOrId("team_players");
    collection.fields.removeByName("role");
    app.save(collection);
});
