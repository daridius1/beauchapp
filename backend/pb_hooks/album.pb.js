/// <reference path="../pb_data/types.d.ts" />

// Álbum de figuritas: un álbum puede abarcar varias ligas a la vez (ej. Copa CDI
// masculina/femenina/mixta comparten un álbum — se elige desde /admin/album, ver
// admin_album.pb.js). Las figuritas son directamente los team_players de esas ligas,
// sin duplicar esos datos en una colección propia (PRINCIPLES.md §7.2).
//
// Numeración de figuritas: "0119" = equipo 01, slot 19. Cada equipo reserva los slots
// 00-04 para cartas especiales (escudo, foto de equipo izquierda, DT, capitán — el
// 03/capitán quedó abandonado, ver más abajo —, foto de equipo derecha) y 05-09
// quedan libres para las que vengan después; los jugadores arrancan en el 10,
// numerados por su team_players.slotNumber PERMANENTE (asignado una sola vez en
// team_players.pb.js). El número de equipo también es permanente por álbum
// (album_team_numbers) — ninguno de los dos se recalcula nunca, así que altas/bajas
// de plantel o cambios en las ligas del álbum no corren la numeración de nadie más.
//
// Escudo y foto de equipo son figuritas coleccionables como cualquier jugador —
// tienen su propio código y SÍ entran al sorteo de sobres (ver buy-pack), con
// `count`/`pasted` en `album_stickers` igual que un jugador. La foto de equipo es
// panorámica y se reparte en 2 láminas FÍSICAMENTE distintas (izquierda/derecha, slots
// 01/04 — ver lib/album.js), cada una su propia figurita: hay que conseguir y pegar
// las 2 por separado para completar la foto, no alcanza con una copia de una sola
// mitad (a diferencia de antes, cuando compartían un único código y pegar cualquiera
// de las 2 mitades en pantalla completaba la otra sola). El escudo sigue siendo una
// única figurita (slot 00). El DT es coleccionable igual que cualquier jugador —
// código propio, entra al pool del sobre, cuenta count/pasted en album_stickers — si
// el equipo no tiene uno asignado, directamente no aparece ninguna carta en su lugar
// (ni para tener ni para faltar). El CAPITÁN **no tiene carta propia**: es
// directamente el jugador que tenga `isCaptain=true`, con su código de jugador normal
// — el frontend lo identifica vía `players[].isCaptain` y lo reordena visualmente al
// frente de la lista (ver LeagueAlbumScreen.tsx), pero por atrás es una figurita de
// jugador como cualquier otra. Esto evita el problema que tenía la carta de capitán
// separada: equipos sin DT o que asignan capitán después dejaban esa carta especial
// "vacía" para siempre, y quien fuera capitán tenía dos figuritas (la de jugador y la
// de capitán) por la misma persona.
//
// Cada routerAdd corre en su propia VM aislada (CLAUDE.md §2.1): todo require() va
// DENTRO del handler, y por eso la asignación de números de equipo se repite en los
// dos handlers en vez de vivir en una función compartida (mismo motivo documentado en
// team_players.pb.js: una función compartida que hace más de un $app.* combinada con
// otra llamada en quien la invoca revienta con un 400 genérico en esta versión de
// PocketBase).

// GET /api/album?id=ALBUM_ID — checklist del álbum (auth opcional: sin sesión se ven
// las figuritas pero todas en 0).
routerAdd("GET", "/api/album", (e) => {
    try {
        const { publicAccount, buildFieldFilter } = require(`${__hooks}/lib/publicLeague.js`);
        const { PACK_SIZE, PACK_PRICE, FREE_PACKS_PER_DAY, BOUGHT_PACKS_PER_DAY, stickerCode, SLOT_CREST, SLOT_TEAM_PHOTO_LEFT, SLOT_TEAM_PHOTO_RIGHT, SLOT_DT } = require(`${__hooks}/lib/album.js`);

        const albumId = String(e.requestInfo().query["id"] || "");
        if (!albumId) throw new BadRequestError("Falta el id del álbum.");

        let album;
        try {
            album = $app.findRecordById("albums", albumId);
        } catch (err) {
            throw new BadRequestError("Ese álbum no existe.");
        }
        if (!album.getBool("enabled")) {
            throw new BadRequestError("Ese álbum no está disponible.");
        }

        const albumLeagueRows = $app.findRecordsByFilter("album_leagues", "album = {:a}", "created", 200, 0, { a: albumId });
        const leagueIds = albumLeagueRows.map((r) => r.getString("league"));
        // Orden en que se eligieron las ligas al armar el álbum (POST
        // /api/admin/album/set-leagues) — es el orden que usa `teams` más abajo para
        // agruparlas, así el álbum no intercala equipos de ligas distintas aunque los
        // números permanentes (que nunca se recalculan, ver comentario grande arriba)
        // se hayan repartido en cualquier orden.
        const leagueOrder = {};
        leagueIds.forEach((id, idx) => { leagueOrder[id] = idx; });
        // Categoría (masc/fem/mixto) elegida en /admin/album para cada liga del álbum —
        // el frontend la muestra en el cuadrado de la esquina superior derecha de la
        // lámina de plantel (ver buildTeamSlots en LeagueAlbumScreen.tsx); "" si el
        // superusuario todavía no la eligió.
        const categoryByLeague = {};
        albumLeagueRows.forEach((r) => { categoryByLeague[r.getString("league")] = r.getString("category"); });

        const leagueFilter = buildFieldFilter("league", leagueIds, "l");
        const leagueTeamRecords = leagueFilter
            ? $app.findRecordsByFilter("league_teams", `(${leagueFilter.filter}) && deleted = false`, "", 500, 0, leagueFilter.bind)
            : [];
        const teamIds = [...new Set(leagueTeamRecords.map((r) => r.getString("team")))];

        // A qué liga pertenece cada equipo — un álbum puede juntar varias (ver el
        // comentario grande al inicio del archivo), y el frontend usa esto para
        // agrupar visualmente el selector "ir a una página" por liga (ver
        // buildAlbumSections en LeagueAlbumScreen.tsx). Un equipo hoy vive en una sola
        // liga (cada cuenta de equipo se crea para una liga puntual), así que la
        // primera fila que aparezca alcanza — sin `find`/`filter` aparte.
        const leagueIdByTeam = {};
        leagueTeamRecords.forEach((r) => {
            const teamId = r.getString("team");
            if (!leagueIdByTeam[teamId]) leagueIdByTeam[teamId] = r.getString("league");
        });
        const leagueNameById = {};
        leagueIds.forEach((id) => {
            try { leagueNameById[id] = $app.findRecordById("users", id).getString("name"); } catch (err) { /* liga borrada */ }
        });

        // Números de equipo: permanentes, asignados la primera vez que se ven (ver
        // 1790600200_create_album_team_numbers.js). El índice único (album, team)
        // protege contra una carrera entre dos requests concurrentes: si el insert
        // choca, ya se lo asignó otra request, así que se relee. Los que faltan por
        // asignar se recorren agrupados por liga (mismo `leagueOrder` de arriba) para
        // que un álbum nuevo salga numerado en bloques por liga desde el principio, sin
        // depender del orden arbitrario en que la query de `league_teams` haya
        // devuelto las filas.
        const numberByTeam = {};
        $app.findRecordsByFilter("album_team_numbers", "album = {:a}", "", 500, 0, { a: albumId })
            .forEach((r) => { numberByTeam[r.getString("team")] = r.getInt("number"); });
        let nextTeamNumber = Object.values(numberByTeam).reduce((max, n) => Math.max(max, n), 0) + 1;
        const teamIdsByLeague = [...teamIds].sort(
            (a, b) => (leagueOrder[leagueIdByTeam[a]] ?? 0) - (leagueOrder[leagueIdByTeam[b]] ?? 0)
        );
        teamIdsByLeague.forEach((teamId) => {
            if (numberByTeam[teamId]) return;
            try {
                const row = new Record($app.findCollectionByNameOrId("album_team_numbers"));
                row.set("album", albumId);
                row.set("team", teamId);
                row.set("number", nextTeamNumber);
                $app.save(row);
                numberByTeam[teamId] = nextTeamNumber;
                nextTeamNumber++;
            } catch (err) {
                try {
                    const existing = $app.findFirstRecordByFilter("album_team_numbers", "album = {:a} && team = {:t}", { a: albumId, t: teamId });
                    if (existing) numberByTeam[teamId] = existing.getInt("number");
                } catch (err2) { /* no debería pasar */ }
            }
        });

        const teamFilter = buildFieldFilter("team", teamIds, "t");
        const players = teamFilter
            ? $app.findRecordsByFilter(
                "team_players",
                `(${teamFilter.filter}) && deleted = false && role = 'player'`,
                "slotNumber", 1000, 0, teamFilter.bind
            )
            : [];
        const dts = teamFilter
            ? $app.findRecordsByFilter(
                "team_players",
                `(${teamFilter.filter}) && deleted = false && role = 'coach'`,
                "", 500, 0, teamFilter.bind
            )
            : [];
        const teamPlayersCollectionId = $app.findCollectionByNameOrId("team_players").id;
        const teamById = {};
        teamIds.forEach((id) => {
            try { teamById[id] = publicAccount($app.findRecordById("users", id)); } catch (err) { /* equipo borrado */ }
        });
        const dtByTeam = {};
        dts.forEach((d) => { dtByTeam[d.getString("team")] = d; });

        // `pasted` viaja junto con `count` desde las mismas filas — GET /api/album es
        // la única fuente de verdad de "qué código está pegado" para el frontend, que
        // la usa tanto para las 3 estados de la vista Álbum (pegada/no la tienes/pegable)
        // como para calcular láminas sueltas (looseCount) en la vista Láminas, sin
        // pedirle nada más al backend.
        const countByCode = {};
        const pastedByCode = {};
        if (e.auth) {
            $app.findRecordsByFilter(
                "album_stickers", "album = {:a} && user = {:u}", "", 1000, 0, { a: albumId, u: e.auth.id }
            ).forEach((r) => {
                countByCode[r.getString("code")] = r.getInt("count");
                pastedByCode[r.getString("code")] = r.getBool("pasted");
            });
        }

        const playersByTeam = {};
        players.forEach((p) => {
            const teamId = p.getString("team");
            if (!playersByTeam[teamId]) playersByTeam[teamId] = [];
            const number = numberByTeam[teamId];
            const code = stickerCode(number, p.getInt("slotNumber"));
            playersByTeam[teamId].push({
                id: p.id,
                collectionId: teamPlayersCollectionId,
                name: p.getString("name"),
                photo: p.getString("photo"),
                position: p.getString("position"),
                isCaptain: p.getBool("isCaptain"),
                count: countByCode[code] || 0,
                pasted: pastedByCode[code] || false,
                code,
            });
        });

        const teams = teamIds
            .filter((id) => teamById[id])
            .sort((a, b) => {
                const la = leagueOrder[leagueIdByTeam[a]] ?? 0;
                const lb = leagueOrder[leagueIdByTeam[b]] ?? 0;
                if (la !== lb) return la - lb;
                return (numberByTeam[a] || 0) - (numberByTeam[b] || 0);
            })
            .map((id) => {
                const number = numberByTeam[id];
                const dtRecord = dtByTeam[id];
                const crestCode = stickerCode(number, SLOT_CREST);
                const photoLeftCode = stickerCode(number, SLOT_TEAM_PHOTO_LEFT);
                const photoRightCode = stickerCode(number, SLOT_TEAM_PHOTO_RIGHT);
                const dtCode = stickerCode(number, SLOT_DT);
                const leagueId = leagueIdByTeam[id];
                return {
                    team: teamById[id],
                    number,
                    league: leagueId ? { id: leagueId, name: leagueNameById[leagueId] || "", category: categoryByLeague[leagueId] || "" } : null,
                    crestCode,
                    crestCount: countByCode[crestCode] || 0,
                    crestPasted: pastedByCode[crestCode] || false,
                    photoLeftCode,
                    photoLeftCount: countByCode[photoLeftCode] || 0,
                    photoLeftPasted: pastedByCode[photoLeftCode] || false,
                    photoRightCode,
                    photoRightCount: countByCode[photoRightCode] || 0,
                    photoRightPasted: pastedByCode[photoRightCode] || false,
                    dtCode,
                    dtCount: countByCode[dtCode] || 0,
                    dtPasted: pastedByCode[dtCode] || false,
                    dt: dtRecord
                        ? { id: dtRecord.id, collectionId: teamPlayersCollectionId, name: dtRecord.getString("name"), photo: dtRecord.getString("photo") }
                        : null,
                    players: playersByTeam[id] || [],
                };
            });

        // Cupos diarios de sobres (ver 1791600000_create_album_pack_claims.js): 3
        // gratis + 3 comprables por álbum, más 1 bono si el usuario ya completó el
        // Beaudle de hoy (gane o pierda, mismo criterio que su premio de BeauTokens —
        // ver beaudle.pb.js). "Hoy" en huso America/Santiago, calculado inline como en
        // beaudle.pb.js (cada routerAdd corre en su propia VM, CLAUDE.md §2.1). Sin
        // sesión, todo queda en null: no hay a quién cobrarle cupo.
        let freeRemaining = null;
        let boughtRemaining = null;
        let beaudleBonusAvailable = null;
        // Declaradas afuera del if (e.auth), no adentro: el frontend las necesita por
        // separado en el return de más abajo, que queda fuera del bloque del if.
        let beaudleDoneToday = null;
        let beaudleBonusOpened = null;
        if (e.auth) {
            const t = new DateTime().time().in(new Timezone("America/Santiago"));
            const pad = (n) => String(n).padStart(2, "0");
            const today = `${t.year()}-${pad(Number(t.month()))}-${pad(t.day())}`;

            let freeOpened = 0;
            let boughtOpened = 0;
            beaudleBonusOpened = false;
            try {
                const claims = $app.findFirstRecordByFilter(
                    "album_pack_claims", "album = {:a} && user = {:u} && day = {:d}",
                    { a: albumId, u: e.auth.id, d: today }
                );
                freeOpened = claims.getInt("freeOpened");
                boughtOpened = claims.getInt("boughtOpened");
                beaudleBonusOpened = claims.getBool("beaudleBonusOpened");
            } catch (nf) { /* sin sobres abiertos hoy todavía */ }
            freeRemaining = Math.max(0, FREE_PACKS_PER_DAY - freeOpened);
            boughtRemaining = Math.max(0, BOUGHT_PACKS_PER_DAY - boughtOpened);

            beaudleDoneToday = false;
            try {
                $app.findFirstRecordByFilter(
                    "beaudle_games", "user = {:u} && day = {:d} && on_time = true && status != 'in_progress'",
                    { u: e.auth.id, d: today }
                );
                beaudleDoneToday = true;
            } catch (nf) { /* todavía no completó el Beaudle de hoy */ }
            beaudleBonusAvailable = beaudleDoneToday && !beaudleBonusOpened;
        }

        return e.json(200, {
            album: {
                id: album.id,
                collectionId: album.collection().id,
                name: album.getString("name"),
                cover: album.getString("cover"),
                palette: [
                    album.getString("paletteColor1"),
                    album.getString("paletteColor2"),
                    album.getString("paletteColor3"),
                ],
            },
            packPrice: PACK_PRICE,
            packSize: PACK_SIZE,
            freePacksPerDay: FREE_PACKS_PER_DAY,
            boughtPacksPerDay: BOUGHT_PACKS_PER_DAY,
            freeRemaining,
            boughtRemaining,
            beaudleBonusAvailable,
            // Por separado del booleano combinado de arriba, para que el frontend
            // pueda mostrar SIEMPRE el botón del bono y explicar por qué está
            // deshabilitado: "todavía no completaste el Beaudle" no es lo mismo que
            // "ya lo reclamaste hoy".
            beaudleDoneToday,
            beaudleBonusOpened,
            beautokens: e.auth ? e.auth.getFloat("beautokens") : null,
            teams,
        });
    } catch (err) {
        console.error("[album.pb.js] Error en GET /api/album:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar el álbum." });
    }
});

// POST /api/album/buy-pack — body {albumId, kind}. `kind` es "free" (uno de los 3
// gratis del día), "bought" (uno de los 3 comprables a PACK_PRICE) o "beaudle-bonus"
// (el extra por haber completado el Beaudle de hoy) — ver
// 1791600000_create_album_pack_claims.js. Descuenta BeauTokens (solo si kind="bought")
// y crea/incrementa las figuritas dentro de la misma transacción, mismo patrón que
// POST /api/beaumarket/bet (beaumarket.pb.js): nunca queda un cobro sin figuritas ni
// figuritas sin cobro; el cupo diario se consume con el mismo guard atómico
// (`UPDATE ... WHERE campo < tope`) que ya usa el descuento de BeauTokens, así que dos
// requests simultáneas nunca pueden pasarse del cupo. El sobre sortea jugadores Y las
// cartas especiales coleccionables de cada equipo (escudo + las 2 mitades de la foto
// de equipo + el DT si el equipo tiene uno asignado — hasta 4 códigos más al pool por
// equipo, ver el comentario grande al inicio del archivo). El capitán no entra por
// separado (es un jugador más).
routerAdd("POST", "/api/album/buy-pack", (e) => {
    try {
        const { buildFieldFilter } = require(`${__hooks}/lib/publicLeague.js`);
        const { PACK_SIZE, PACK_PRICE, FREE_PACKS_PER_DAY, BOUGHT_PACKS_PER_DAY, pickPack, stickerCode, SLOT_CREST, SLOT_TEAM_PHOTO_LEFT, SLOT_TEAM_PHOTO_RIGHT, SLOT_DT } = require(`${__hooks}/lib/album.js`);

        const body = e.requestInfo().body || {};
        const albumId = String(body.albumId || "");
        if (!albumId) throw new BadRequestError("Falta el id del álbum.");
        const kind = String(body.kind || "");
        if (!["free", "bought", "beaudle-bonus"].includes(kind)) {
            throw new BadRequestError("Tipo de sobre inválido.");
        }

        let album;
        try {
            album = $app.findRecordById("albums", albumId);
        } catch (err) {
            throw new BadRequestError("Ese álbum no existe.");
        }
        if (!album.getBool("enabled")) {
            throw new BadRequestError("Ese álbum no está disponible.");
        }

        // "Hoy" en huso America/Santiago, mismo cálculo inline que GET /api/album y
        // que beaudle.pb.js (CLAUDE.md §2.1: cada routerAdd corre en su propia VM, no
        // se puede compartir una función de nivel de archivo entre handlers).
        const t = new DateTime().time().in(new Timezone("America/Santiago"));
        const pad = (n) => String(n).padStart(2, "0");
        const today = `${t.year()}-${pad(Number(t.month()))}-${pad(t.day())}`;

        // Busca-o-crea la fila de cupos de hoy (mismo patrón que album_team_numbers más
        // abajo: si el insert choca contra el índice único es que otra request ya la
        // creó primero, así que se relee en vez de fallar).
        let claims;
        try {
            claims = $app.findFirstRecordByFilter(
                "album_pack_claims", "album = {:a} && user = {:u} && day = {:d}",
                { a: albumId, u: e.auth.id, d: today }
            );
        } catch (nf) {
            try {
                const row = new Record($app.findCollectionByNameOrId("album_pack_claims"));
                row.set("album", albumId);
                row.set("user", e.auth.id);
                row.set("day", today);
                row.set("freeOpened", 0);
                row.set("boughtOpened", 0);
                row.set("beaudleBonusOpened", false);
                $app.save(row);
                claims = row;
            } catch (err2) {
                try {
                    claims = $app.findFirstRecordByFilter(
                        "album_pack_claims", "album = {:a} && user = {:u} && day = {:d}",
                        { a: albumId, u: e.auth.id, d: today }
                    );
                } catch (err3) {
                    throw new BadRequestError("No se pudo cargar tu cupo de sobres de hoy.");
                }
            }
        }

        // Chequeo rápido (no atómico, solo para fallar temprano con buen mensaje antes
        // de armar todo el pool de figuritas) — el guard real, a prueba de carreras,
        // es el UPDATE...WHERE dentro de la transacción más abajo.
        if (kind === "free" && claims.getInt("freeOpened") >= FREE_PACKS_PER_DAY) {
            throw new BadRequestError("Ya usaste tus sobres gratis de hoy.");
        }
        if (kind === "bought" && claims.getInt("boughtOpened") >= BOUGHT_PACKS_PER_DAY) {
            throw new BadRequestError("Ya compraste tus sobres extra de hoy.");
        }
        if (kind === "beaudle-bonus") {
            if (claims.getBool("beaudleBonusOpened")) {
                throw new BadRequestError("Ya reclamaste el sobre del Beaudle de hoy.");
            }
            try {
                $app.findFirstRecordByFilter(
                    "beaudle_games", "user = {:u} && day = {:d} && on_time = true && status != 'in_progress'",
                    { u: e.auth.id, d: today }
                );
            } catch (nf) {
                throw new BadRequestError("Todavía no completaste el Beaudle de hoy.");
            }
        }

        const albumLeagueRows = $app.findRecordsByFilter("album_leagues", "album = {:a}", "created", 200, 0, { a: albumId });
        const leagueIds = albumLeagueRows.map((r) => r.getString("league"));
        // Mismo orden que GET /api/album usa para agrupar la vista — acá se usa para
        // que los números nuevos también salgan agrupados por liga (ver más abajo).
        const leagueOrder = {};
        leagueIds.forEach((id, idx) => { leagueOrder[id] = idx; });
        // Misma categoría que GET /api/album — acá hace falta para que el sobre
        // ("Tu sobre") muestre el mismo badge de categoría en la mitad de plantel que
        // sale sorteada, en vez de una versión sin ese dato.
        const categoryByLeague = {};
        albumLeagueRows.forEach((r) => { categoryByLeague[r.getString("league")] = r.getString("category"); });

        const leagueFilter = buildFieldFilter("league", leagueIds, "l");
        const leagueTeamRecords = leagueFilter
            ? $app.findRecordsByFilter("league_teams", `(${leagueFilter.filter}) && deleted = false`, "", 500, 0, leagueFilter.bind)
            : [];
        const teamIds = [...new Set(leagueTeamRecords.map((r) => r.getString("team")))];
        const leagueIdByTeam = {};
        leagueTeamRecords.forEach((r) => {
            const teamId = r.getString("team");
            if (!leagueIdByTeam[teamId]) leagueIdByTeam[teamId] = r.getString("league");
        });

        // Mismo esquema de numeración que GET /api/album (agrupados por liga, ver el
        // comentario ahí) — ver el comentario grande de arriba sobre por qué se repite
        // en vez de compartirse.
        const numberByTeam = {};
        $app.findRecordsByFilter("album_team_numbers", "album = {:a}", "", 500, 0, { a: albumId })
            .forEach((r) => { numberByTeam[r.getString("team")] = r.getInt("number"); });
        let nextTeamNumber = Object.values(numberByTeam).reduce((max, n) => Math.max(max, n), 0) + 1;
        const teamIdsByLeague = [...teamIds].sort(
            (a, b) => (leagueOrder[leagueIdByTeam[a]] ?? 0) - (leagueOrder[leagueIdByTeam[b]] ?? 0)
        );
        teamIdsByLeague.forEach((teamId) => {
            if (numberByTeam[teamId]) return;
            try {
                const row = new Record($app.findCollectionByNameOrId("album_team_numbers"));
                row.set("album", albumId);
                row.set("team", teamId);
                row.set("number", nextTeamNumber);
                $app.save(row);
                numberByTeam[teamId] = nextTeamNumber;
                nextTeamNumber++;
            } catch (err) {
                try {
                    const existing = $app.findFirstRecordByFilter("album_team_numbers", "album = {:a} && team = {:t}", { a: albumId, t: teamId });
                    if (existing) numberByTeam[teamId] = existing.getInt("number");
                } catch (err2) { /* no debería pasar */ }
            }
        });

        const teamFilter = buildFieldFilter("team", teamIds, "t");
        const players = teamFilter
            ? $app.findRecordsByFilter(
                "team_players",
                `(${teamFilter.filter}) && deleted = false && role = 'player'`,
                "", 1000, 0, teamFilter.bind
            )
            : [];
        if (players.length === 0) {
            throw new BadRequestError("Esta liga todavía no tiene jugadores registrados.");
        }
        const dts = teamFilter
            ? $app.findRecordsByFilter(
                "team_players",
                `(${teamFilter.filter}) && deleted = false && role = 'coach'`,
                "", 500, 0, teamFilter.bind
            )
            : [];
        const dtByTeam = {};
        dts.forEach((d) => { dtByTeam[d.getString("team")] = d; });

        const teamPlayersCollectionId = $app.findCollectionByNameOrId("team_players").id;
        const usersCollectionId = $app.findCollectionByNameOrId("users").id;
        const teamNameById = {};
        const teamColorById = {};
        const teamCategoryById = {};
        const teamCrestFileById = {};
        const teamPhotoFileById = {};
        teamIds.forEach((id) => {
            try {
                const teamRecord = $app.findRecordById("users", id);
                teamNameById[id] = teamRecord.getString("name");
                teamColorById[id] = teamRecord.getString("teamColor");
                teamCategoryById[id] = categoryByLeague[leagueIdByTeam[id]] || "";
                // Mismo fallback que buildTeamSlots en el frontend (LeagueAlbumScreen):
                // el escudo puede venir de matchPhoto o, a falta de eso, del avatar.
                teamCrestFileById[id] = teamRecord.getString("matchPhoto") || teamRecord.getString("avatar") || "";
                teamPhotoFileById[id] = teamRecord.getString("teamPhoto") || "";
            } catch (err) { /* equipo borrado */ }
        });

        // Info por código: uno por jugador — el capitán no tiene código propio, sale
        // como el jugador que es (ver comentario grande al inicio del archivo) — más
        // escudo + las 2 mitades de la foto por equipo, marcados con `special` en vez
        // de `refId` porque no salen de team_players. Las 2 mitades comparten el mismo
        // archivo de foto (teamPhotoFileById) pero son códigos distintos: cada una
        // entra sola al pool, así que salen del sobre (y se pegan) de forma
        // independiente. El DT también entra con `special: "dt"` cuando el equipo tiene
        // uno asignado, pero a diferencia de escudo/foto sí sale de team_players (por
        // eso lleva su propio `refId`, no solo `team`).
        const infoByCode = {};
        const pool = [];
        players.forEach((p) => {
            const code = stickerCode(numberByTeam[p.getString("team")], p.getInt("slotNumber"));
            infoByCode[code] = { name: p.getString("name"), photo: p.getString("photo"), position: p.getString("position"), team: p.getString("team"), refId: p.id };
            pool.push(code);
        });
        teamIds.forEach((teamId) => {
            if (!teamNameById[teamId]) return; // equipo borrado
            const number = numberByTeam[teamId];
            const crestCode = stickerCode(number, SLOT_CREST);
            const photoLeftCode = stickerCode(number, SLOT_TEAM_PHOTO_LEFT);
            const photoRightCode = stickerCode(number, SLOT_TEAM_PHOTO_RIGHT);
            const dtRecord = dtByTeam[teamId];
            if (dtRecord) {
                const dtCode = stickerCode(number, SLOT_DT);
                infoByCode[dtCode] = { special: "dt", team: teamId, name: dtRecord.getString("name"), photo: dtRecord.getString("photo"), refId: dtRecord.id };
                pool.push(dtCode);
            }
            infoByCode[crestCode] = { special: "crest", team: teamId };
            infoByCode[photoLeftCode] = { special: "photo-left", team: teamId };
            infoByCode[photoRightCode] = { special: "photo-right", team: teamId };
            pool.push(crestCode, photoLeftCode, photoRightCode);
        });

        const drawnCodes = pickPack(pool, PACK_SIZE);

        let newBalance = 0;
        const isNewByCode = {};

        $app.runInTransaction((txApp) => {
            if (kind === "bought") {
                const res = txApp.db()
                    .newQuery("UPDATE users SET beautokens = beautokens - {:amt} WHERE id = {:id} AND beautokens >= {:amt}")
                    .bind({ amt: PACK_PRICE, id: e.auth.id })
                    .execute();
                if (res.rowsAffected() === 0) {
                    throw new BadRequestError("BeauTokens insuficientes.");
                }
            }

            // Guard atómico del cupo diario, mismo patrón que el UPDATE de arriba: si
            // otra request ya lo gastó entremedio, esta pierde la carrera y no se le
            // cobra nada (el sobre nunca se entrega sin haber consumido cupo).
            const claimQuery = kind === "free"
                ? { sql: "UPDATE album_pack_claims SET freeOpened = freeOpened + 1 WHERE id = {:id} AND freeOpened < {:cap}", bind: { id: claims.id, cap: FREE_PACKS_PER_DAY }, err: "Ya usaste tus sobres gratis de hoy." }
                : kind === "bought"
                    ? { sql: "UPDATE album_pack_claims SET boughtOpened = boughtOpened + 1 WHERE id = {:id} AND boughtOpened < {:cap}", bind: { id: claims.id, cap: BOUGHT_PACKS_PER_DAY }, err: "Ya compraste tus sobres extra de hoy." }
                    : { sql: "UPDATE album_pack_claims SET beaudleBonusOpened = true WHERE id = {:id} AND beaudleBonusOpened = false", bind: { id: claims.id }, err: "Ya reclamaste el sobre del Beaudle de hoy." };
            const claimRes = txApp.db().newQuery(claimQuery.sql).bind(claimQuery.bind).execute();
            if (claimRes.rowsAffected() === 0) {
                throw new BadRequestError(claimQuery.err);
            }

            const deltaByCode = {};
            drawnCodes.forEach((code) => { deltaByCode[code] = (deltaByCode[code] || 0) + 1; });

            Object.keys(deltaByCode).forEach((code) => {
                const existing = txApp.findRecordsByFilter(
                    "album_stickers", "album = {:a} && user = {:u} && code = {:c}", "", 1, 0,
                    { a: albumId, u: e.auth.id, c: code }
                );
                if (existing.length > 0) {
                    const sticker = existing[0];
                    sticker.set("count", sticker.getInt("count") + deltaByCode[code]);
                    txApp.save(sticker);
                    isNewByCode[code] = false;
                } else {
                    const sticker = new Record(txApp.findCollectionByNameOrId("album_stickers"));
                    sticker.set("album", albumId);
                    sticker.set("user", e.auth.id);
                    sticker.set("code", code);
                    sticker.set("count", deltaByCode[code]);
                    txApp.save(sticker);
                    isNewByCode[code] = true;
                }
            });

            newBalance = txApp.findRecordById("users", e.auth.id).getFloat("beautokens");
        });

        const seenInThisPack = {};
        const drawn = drawnCodes.map((code) => {
            const isNew = isNewByCode[code] && !seenInThisPack[code];
            seenInThisPack[code] = true;
            const info = infoByCode[code];
            if (info.special) {
                // Escudo/foto no salen de team_players — playerId/collectionId apuntan
                // al equipo (colección users) en vez de a un team_players; el DT sí sale
                // de team_players (playerId/collectionId apuntan a esa fila, igual que
                // un jugador). Mismos nombres de campo en los 3 casos para que el
                // frontend (reveal modal) los use tal cual con getFileUrl; `special` es
                // lo que le dice qué ícono/resize usar en cada caso.
                const isCrest = info.special === "crest";
                const isPhotoHalf = info.special === "photo-left" || info.special === "photo-right";
                const isDT = info.special === "dt";
                return {
                    playerId: isDT ? info.refId : info.team,
                    collectionId: isDT ? teamPlayersCollectionId : usersCollectionId,
                    name: isCrest ? "Escudo" : isPhotoHalf ? "Foto de equipo" : info.name,
                    photo: (isCrest ? teamCrestFileById[info.team] : isPhotoHalf ? teamPhotoFileById[info.team] : info.photo) || "",
                    position: "",
                    teamName: teamNameById[info.team] || "",
                    teamColor: teamColorById[info.team] || "",
                    // Mismo escudo que usa el álbum para el badge de esquina de
                    // jugador/DT (ver buildTeamSlots en LeagueAlbumScreen) — el frontend
                    // arma el thumb 100x100f con esto, así el sobre queda con el mismo
                    // escudo/nombre arriba que la grilla del álbum en vez de reinventarlo.
                    teamId: info.team,
                    teamCollectionId: usersCollectionId,
                    teamCrestFile: teamCrestFileById[info.team] || "",
                    // Solo la mitad de plantel la usa (ver el cuadrado de categoría en
                    // StickerCard) — se manda igual para escudo/DT, sin costo, en vez de
                    // condicionar el campo al `special` exacto.
                    teamCategory: teamCategoryById[info.team] || "",
                    code,
                    isNew,
                    special: info.special,
                };
            }
            return {
                playerId: info.refId,
                collectionId: teamPlayersCollectionId,
                name: info.name,
                photo: info.photo,
                position: info.position || "",
                teamName: teamNameById[info.team] || "",
                teamColor: teamColorById[info.team] || "",
                teamId: info.team,
                teamCollectionId: usersCollectionId,
                teamCrestFile: teamCrestFileById[info.team] || "",
                code,
                isNew,
            };
        });

        return e.json(200, { drawn, beautokens: newBalance });
    } catch (err) {
        console.error("[album.pb.js] Error en POST /api/album/buy-pack:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo comprar el sobre." });
    }
}, $apis.requireAuth("users"));

// POST /api/album/paste — body {albumId, code}. Pegar una figurita suelta en el
// álbum: nunca es automático (ni siquiera la primera copia de un código — ver
// buy-pack más arriba, que solo escribe `count` y jamás toca `pasted`), el usuario
// elige explícitamente cuándo. No toca balances ni otras filas, así que no necesita
// transacción — es idempotente: pegar algo que ya estaba pegado simplemente vuelve a
// devolver éxito.
routerAdd("POST", "/api/album/paste", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const albumId = String(body.albumId || "");
        const code = String(body.code || "");
        if (!albumId || !code) throw new BadRequestError("Faltan datos.");

        let sticker;
        try {
            sticker = $app.findFirstRecordByFilter(
                "album_stickers", "album = {:a} && user = {:u} && code = {:c}",
                { a: albumId, u: e.auth.id, c: code }
            );
        } catch (err) {
            throw new BadRequestError("No tienes esa figurita.");
        }

        if (!sticker.getBool("pasted")) {
            sticker.set("pasted", true);
            $app.save(sticker);
        }

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[album.pb.js] Error en POST /api/album/paste:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo pegar la figurita." });
    }
}, $apis.requireAuth("users"));
