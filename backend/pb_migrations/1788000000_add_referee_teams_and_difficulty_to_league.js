/// <reference path="../pb_data/types.d.ts" />

// Dos funcionalidades del sistema de ligas, en una sola migración porque ambas tocan
// colecciones ya existentes del mismo dominio y no hay dependencia entre sí que
// justifique separarlas:
//
// `league_teams.difficulty` — nota de dificultad (1-10) que el ADMIN de la liga le pone
// a un equipo, para el criterio de "equilibrar dificultad" del algoritmo de sugerencia
// de partidos (ver lib/teamSchedule.js, difficultyBalanceGain). Va en league_teams
// (roster liga↔equipo) y NO en league_stages.teams (que es solo un array de ids sin
// datos propios) porque la nota es una propiedad estable del equipo a lo largo de TODA
// la liga — lo que varía por etapa es el ACUMULADO de dificultad enfrentada, no la nota
// en sí. Opcional y sin default: un equipo sin nota simplemente no participa del
// criterio de balance (neutro, ni perjudicado ni favorecido).
//
// `league_teams.contactType` / `.contactValue` — un contacto privado de administración
// que la LIGA le carga a un equipo de su roster (para poder escribirle directo, ej. al
// coordinar un horario o mandar el código de arbitraje). Deliberadamente separado de
// `users.whatsapp/telegram/instagram/signal` — esos son el contacto PÚBLICO del equipo
// en su perfil de la red social, un dato distinto con otro dueño (lo edita el equipo,
// se ve en su perfil) que este (lo edita la liga, es privado de esa liga, nunca se
// expone fuera de /admin/liga). Un solo contacto por equipo, no cuatro campos — el tipo
// (`contactType`, select) más el valor (`contactValue`, texto libre).
//
// `league_matches.refereeTeams` — hasta 2 equipos de la MISMA etapa que tienen el
// compromiso organizativo de arbitrar un partido. Es un dato distinto de
// `match_reports.refereeId` (quién efectivamente está tocando los botones del reloj
// durante el arbitraje en vivo, ver 1787600000_optional_referee_for_public_arbitration.js):
// un equipo asignado acá no necesita que nadie de él abra la vista de arbitraje, y
// viceversa, cualquiera con el código puede arbitrar sin que su equipo esté en este
// campo. Siempre editable después (POST /api/liga/matches/set-referees). No hay ningún
// campo de "cuántos partidos arbitró": se cuenta con una consulta a league_matches
// (status != 'cancelled', deleted = false, refereeTeams contiene el equipo) cada vez
// que hace falta — mismo espíritu de "no hay contadores que mantener" que ya usa
// Beaupolla (ver lib/polla.js), evitando lógica de incremento/decremento cada vez que
// se reasigna un árbitro.
migrate((app) => {
    const usersColl = app.findCollectionByNameOrId("users");

    const leagueTeams = app.findCollectionByNameOrId("league_teams");
    leagueTeams.fields.add(new Field({
        name: "difficulty",
        type: "number",
        required: false,
        presentable: false,
        min: 1,
        max: 10,
        noDecimal: true,
    }));
    leagueTeams.fields.add(new Field({
        name: "contactType",
        type: "select",
        required: false,
        presentable: false,
        maxSelect: 1,
        values: ["whatsapp", "telegram", "instagram", "signal"],
    }));
    leagueTeams.fields.add(new Field({
        name: "contactValue",
        type: "text",
        required: false,
        presentable: false,
        max: 200,
    }));
    app.save(leagueTeams);

    const leagueMatches = app.findCollectionByNameOrId("league_matches");
    leagueMatches.fields.add(new Field({
        name: "refereeTeams",
        type: "relation",
        required: false,
        presentable: false,
        collectionId: usersColl.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 2,
    }));
    app.save(leagueMatches);
}, (app) => {
    const leagueMatches = app.findCollectionByNameOrId("league_matches");
    leagueMatches.fields.removeByName("refereeTeams");
    app.save(leagueMatches);

    const leagueTeams = app.findCollectionByNameOrId("league_teams");
    leagueTeams.fields.removeByName("contactValue");
    leagueTeams.fields.removeByName("contactType");
    leagueTeams.fields.removeByName("difficulty");
    app.save(leagueTeams);
});
