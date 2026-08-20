/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Vistas públicas de las ligas — lo justo para enterarse de cómo va un torneo sin
// tener cuenta.
//
// POR QUÉ ENDPOINTS Y NO ABRIR LAS REGLAS DE LAS COLECCIONES: para pintar una liga
// hacen falta datos de `users` (nombre y escudo de cada equipo). Abrir `users` a
// lectura anónima expondría TODAS las cuentas de estudiante del sistema, no solo las
// de los equipos — un precio desproporcionado para mostrar una tabla de posiciones.
// Acá se devuelve exactamente lo que la vista pública necesita, con las cuentas
// reducidas a su identidad visible (id, nombre, usuario, avatar, escudo).
//
// Todo es de SOLO LECTURA. Lo único que se puede escribir sin sesión es el arbitraje,
// y eso exige el código del partido (ver match_arbitration.pb.js).
// ---------------------------------------------------------------------------------

// Listado de ligas. Es el único punto de entrada público: desde acá se navega a una
// liga, de ahí a un partido o a un equipo, y no hay nada más.
routerAdd("GET", "/api/public/leagues", (e) => {
    try {
        const { publicAccount, publicMatch, buildIdFilter, buildFieldFilter } = require(`${__hooks}/lib/publicLeague.js`);
        const leagues = $app.findRecordsByFilter(
            "users",
            "type = 'organization' && subtype = 'league' && verified = true",
            "name",
            100,
            0
        );
        return e.json(200, { leagues: leagues.map(publicAccount) });
    } catch (err) {
        console.error("[public_league.pb.js] Error en GET /api/public/leagues:", err);
        return e.json(400, { error: "No se pudieron cargar las ligas." });
    }
});

// Todo lo que necesita la vista de una liga, en una sola respuesta: etapas, equipos,
// partidos y el estado en vivo de los que se están arbitrando.
routerAdd("GET", "/api/public/liga", (e) => {
    try {
        const { publicAccount, publicMatch, buildIdFilter, buildFieldFilter } = require(`${__hooks}/lib/publicLeague.js`);

        // El require y las llamadas a $app van DENTRO del handler (VM aislada por ruta).
        function loadAccounts(ids) {
            const q = buildIdFilter(ids);
            const byId = {};
            if (!q) return byId;
            $app.findRecordsByFilter("users", q.filter, "", q.count, 0, q.bind)
                .forEach((r) => { byId[r.id] = publicAccount(r); });
            return byId;
        }
        const leagueId = String(e.requestInfo().query["id"] || "");
        if (!leagueId) throw new BadRequestError("Falta el id de la liga.");

        let league;
        try {
            league = $app.findRecordById("users", leagueId);
        } catch (err) {
            throw new BadRequestError("Esa liga no existe.");
        }
        if (league.getString("subtype") !== "league") {
            throw new BadRequestError("Esa cuenta no es una liga.");
        }

        const stages = $app.findRecordsByFilter(
            "league_stages", "league = {:l} && deleted = false", "order,created", 200, 0, { l: leagueId }
        );
        const teamRows = $app.findRecordsByFilter(
            "league_teams", "league = {:l} && deleted = false", "created", 200, 0, { l: leagueId }
        );
        const matches = $app.findRecordsByFilter(
            "league_matches", "league = {:l} && deleted = false", "-created", 500, 0, { l: leagueId }
        );

        const ids = teamRows.map((t) => t.getString("team"));
        matches.forEach((m) => { ids.push(m.getString("teamA")); ids.push(m.getString("teamB")); });
        const teamById = loadAccounts(ids);

        // Informes de los partidos de esta liga, para el marcador en vivo y la
        // cronología. Se piden por los ids ya cargados y no por relación anidada.
        const reports = [];
        const reportsQuery = buildFieldFilter("match", matches.map((m) => m.id), "m");
        if (reportsQuery) {
            const rows = $app.findRecordsByFilter(
                "match_reports", `(${reportsQuery.filter}) && deleted = false`, "", reportsQuery.count, 0, reportsQuery.bind
            );
            rows.forEach((r) => {
                let events = [];
                try { events = JSON.parse(r.getString("events") || "[]"); } catch (pErr) { events = []; }
                reports.push({
                    id: r.id,
                    match: r.getString("match"),
                    status: r.getString("status"),
                    events: events,
                    notes: r.getString("notes"),
                });
            });
        }

        return e.json(200, {
            league: publicAccount(league),
            bio: league.getString("bio"),
            stages: stages.map((s) => ({
                id: s.id,
                name: s.getString("name"),
                type: s.getString("type"),
                order: s.getInt("order"),
                teams: s.get("teams") || [],
            })),
            teams: teamRows.map((t) => ({
                id: t.id,
                team: t.getString("team"),
                expand: { team: teamById[t.getString("team")] || null },
            })),
            matches: matches.map((m) => publicMatch(m, teamById)),
            reports: reports,
        });
    } catch (err) {
        console.error("[public_league.pb.js] Error en GET /api/public/liga:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar la liga." });
    }
});

// Un partido y su informe arbitral.
routerAdd("GET", "/api/public/match", (e) => {
    try {
        const { publicAccount, publicMatch, buildIdFilter, buildFieldFilter } = require(`${__hooks}/lib/publicLeague.js`);

        // El require y las llamadas a $app van DENTRO del handler (VM aislada por ruta).
        function loadAccounts(ids) {
            const q = buildIdFilter(ids);
            const byId = {};
            if (!q) return byId;
            $app.findRecordsByFilter("users", q.filter, "", q.count, 0, q.bind)
                .forEach((r) => { byId[r.id] = publicAccount(r); });
            return byId;
        }
        const matchId = String(e.requestInfo().query["id"] || "");
        if (!matchId) throw new BadRequestError("Falta el id del partido.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("Ese partido no existe.");
        }
        if (match.getBool("deleted")) throw new BadRequestError("Ese partido no existe.");

        const teamById = loadAccounts([match.getString("teamA"), match.getString("teamB"), match.getString("league")]);

        let report = null;
        try {
            const r = $app.findFirstRecordByFilter(
                "match_reports", "match = {:m} && deleted = false", { m: matchId }
            );
            let events = [];
            try { events = JSON.parse(r.getString("events") || "[]"); } catch (pErr) { events = []; }
            report = { id: r.id, match: matchId, status: r.getString("status"), events: events, notes: r.getString("notes") };
        } catch (err) {
            report = null;
        }

        let stageName = "";
        try {
            stageName = $app.findRecordById("league_stages", match.getString("stage")).getString("name");
        } catch (err) {
            stageName = "";
        }

        // Planteles de ambos equipos: la vista de arbitraje los necesita para la
        // convocatoria, y arbitrar no exige sesión.
        function rosterOf(teamId) {
            if (!teamId) return [];
            return $app
                .findRecordsByFilter("team_players", "team = {:t} && deleted = false", "name", 100, 0, { t: teamId })
                .map((p) => ({ id: p.id, collectionId: "team_players", name: p.getString("name"), photo: p.getString("photo") }));
        }

        return e.json(200, {
            match: publicMatch(match, teamById),
            league: teamById[match.getString("league")] || null,
            stageName: stageName,
            report: report,
            rosterA: rosterOf(match.getString("teamA")),
            rosterB: rosterOf(match.getString("teamB")),
        });
    } catch (err) {
        console.error("[public_league.pb.js] Error en GET /api/public/match:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar el partido." });
    }
});

// Un equipo: identidad, plantel y sus partidos.
//
// El plantel NO expone a qué cuenta de estudiante está vinculado cada jugador: en la
// vista pública no se puede navegar a un perfil, así que ese dato sería exposición sin
// ningún uso.
routerAdd("GET", "/api/public/team", (e) => {
    try {
        const { publicAccount, publicMatch, buildIdFilter, buildFieldFilter } = require(`${__hooks}/lib/publicLeague.js`);

        // El require y las llamadas a $app van DENTRO del handler (VM aislada por ruta).
        function loadAccounts(ids) {
            const q = buildIdFilter(ids);
            const byId = {};
            if (!q) return byId;
            $app.findRecordsByFilter("users", q.filter, "", q.count, 0, q.bind)
                .forEach((r) => { byId[r.id] = publicAccount(r); });
            return byId;
        }
        const teamId = String(e.requestInfo().query["id"] || "");
        if (!teamId) throw new BadRequestError("Falta el id del equipo.");

        let team;
        try {
            team = $app.findRecordById("users", teamId);
        } catch (err) {
            throw new BadRequestError("Ese equipo no existe.");
        }
        if (team.getString("subtype") !== "team") {
            throw new BadRequestError("Esa cuenta no es un equipo.");
        }

        const players = $app.findRecordsByFilter(
            "team_players", "team = {:t} && deleted = false", "name", 200, 0, { t: teamId }
        );
        const matches = $app.findRecordsByFilter(
            "league_matches",
            "(teamA = {:t} || teamB = {:t}) && deleted = false",
            "-created", 200, 0, { t: teamId }
        );

        const ids = [];
        matches.forEach((m) => { ids.push(m.getString("teamA")); ids.push(m.getString("teamB")); });
        const teamById = loadAccounts(ids);

        return e.json(200, {
            team: publicAccount(team),
            bio: team.getString("bio"),
            players: players.map((p) => ({
                id: p.id,
                collectionId: "team_players",
                name: p.getString("name"),
                photo: p.getString("photo"),
            })),
            matches: matches.map((m) => publicMatch(m, teamById)),
        });
    } catch (err) {
        console.error("[public_league.pb.js] Error en GET /api/public/team:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar el equipo." });
    }
});
