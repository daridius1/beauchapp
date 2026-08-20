/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Beaupolla — apostar quién gana cada partido de una liga. Acertar el ganador vale 1
// punto; acertar el empate, 2 (ver lib/polla.js).
//
// EL SECRETO Y LA VENTANA DE APUESTA SON REGLAS DE COLECCIÓN, no lógica de pantalla:
// `polla_bets` solo deja leer las apuestas ajenas de un partido cuyo
// `bettingClosesAt` ya pasó, y solo deja escribir mientras no haya pasado (ver la
// migración 1787400100). Este archivo agrega lo que una regla declarativa no puede
// expresar: que la liga tenga la polla habilitada, que el partido siga en pie, y que
// `league` se derive del partido en vez de venir del cliente.
//
// El puntaje NO se guarda: se deriva de los marcadores y las apuestas, que el cliente
// ya tiene cargados para pintar la vista (PRINCIPLES.md §1). No hay contadores que
// mantener ni cron que recalcule.
// ---------------------------------------------------------------------------------

const validatePollaBet = (e) => {
    const { isValidPick } = require(`${__hooks}/lib/polla.js`);

    if (e.record.getString("user") !== e.auth.id) {
        throw new BadRequestError("No puedes apostar en nombre de otra persona.");
    }
    if (!isValidPick(e.record.getString("pick"))) {
        throw new BadRequestError("La apuesta debe ser local, empate o visita.");
    }

    const matchId = e.record.getString("match");
    if (!matchId) throw new BadRequestError("Falta el partido.");

    let match;
    try {
        match = $app.findRecordById("league_matches", matchId);
    } catch (err) {
        throw new BadRequestError("Ese partido no existe.");
    }
    if (match.getBool("deleted")) {
        throw new BadRequestError("Ese partido ya no existe.");
    }
    const status = match.getString("status");
    if (status === "cancelled" || status === "suspended") {
        throw new BadRequestError("Ese partido no se va a jugar.");
    }

    const leagueId = match.getString("league");
    let league;
    try {
        league = $app.findRecordById("users", leagueId);
    } catch (err) {
        throw new BadRequestError("La liga de ese partido no existe.");
    }
    if (!league.getBool("pollaEnabled")) {
        throw new BadRequestError("Esta liga no tiene la polla habilitada.");
    }

    // `league` se deriva del partido, nunca se acepta del cliente: es lo que hace
    // confiable filtrar la polla por liga y contar el leaderboard.
    e.record.set("league", leagueId);

    return e.next();
};

onRecordCreateRequest(validatePollaBet, "polla_bets");
onRecordUpdateRequest(validatePollaBet, "polla_bets");

// Apagar la polla es una decisión de la liga y no borra nada: las apuestas ya hechas
// quedan guardadas, simplemente dejan de mostrarse. Si se vuelve a encender, la polla
// aparece tal cual estaba — por eso desactivarla no destruye datos, aunque en la UI se
// pida escribir el nombre para confirmar (es un cambio visible para todos los que
// venían jugando).
onRecordUpdateRequest((e) => {
    const original = e.record.original();
    const antes = original.getBool("pollaEnabled");
    const ahora = e.record.getBool("pollaEnabled");
    if (antes === ahora) return e.next();

    // Solo una cuenta de liga puede tener polla, y solo ella misma (o un superusuario)
    // puede prenderla o apagarla.
    if (e.record.getString("subtype") !== "league" || e.record.getString("type") !== "organization") {
        if (!e.hasSuperuserAuth()) {
            e.record.set("pollaEnabled", antes);
            return e.next();
        }
    }
    if (!e.hasSuperuserAuth() && e.auth && e.auth.id !== e.record.id) {
        e.record.set("pollaEnabled", antes);
    }
    return e.next();
}, "users");
