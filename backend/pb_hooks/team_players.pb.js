/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Validación de team_players — lo que las reglas declarativas de PocketBase no
// pueden expresar: que `team` sea realmente una cuenta de equipo, y que `user` (si
// viene) sea un integrante ACTIVO de esa organización (no alcanza con "pending" —
// mismo motivo que el resto del sistema: nadie puede vincularse a un roster antes de
// haber aceptado la invitación a la organización). Mismo estilo que la validación de
// organization_members en auth.pb.js.
//
// NOTA IMPORTANTE (encontrado a mano, no documentado en ningún lado): en esta versión
// de PocketBase, llamar a una función JS COMPARTIDA que hace `$app.findRecordById`/
// `findFirstRecordByFilter` (con un try/catch adentro) y LUEGO hacer otra llamada a
// `$app.*` en quien la invoca — sea `e.record.original()` u otro `findRecordById` —
// revienta con un 400 genérico ("Something went wrong..."), sin importar el orden. Se
// probó cada combinación (con/sin try/catch, con/sin función separada, con/sin
// `.original()`) — lo único que funciona de forma confiable es escribir TODA la
// validación de un mismo handler en línea, sin factorizarla en una función aparte que
// después se combine con más llamadas a `$app`. Por eso acá se duplica la validación
// en vez de compartir una función entre create y update — es fea pero es la única
// forma que no revienta.
// ---------------------------------------------------------------------------------

onRecordCreateRequest((e) => {
    const teamId = e.record.getString("team");
    if (!teamId) {
        throw new BadRequestError("Falta el equipo.");
    }

    let team;
    try {
        team = $app.findRecordById("users", teamId);
    } catch (err) {
        throw new BadRequestError("Ese equipo no existe.");
    }
    if (team.getString("type") !== "organization" || team.getString("subtype") !== "team") {
        throw new BadRequestError("Solo una cuenta de equipo puede tener un roster de jugadores.");
    }

    const userId = e.record.getString("user");
    if (userId) {
        let isActiveMember = false;
        try {
            $app.findFirstRecordByFilter(
                "organization_members",
                "organization = {:team} && user = {:user} && status = 'active'",
                { team: teamId, user: userId }
            );
            isActiveMember = true;
        } catch (err) {
            isActiveMember = false;
        }
        if (!isActiveMember) {
            throw new BadRequestError("Solo se puede vincular a un integrante activo de la organización.");
        }
    }

    return e.next();
}, "team_players");

onRecordUpdateRequest((e) => {
    const teamId = e.record.getString("team");
    if (!teamId) {
        throw new BadRequestError("Falta el equipo.");
    }

    let team;
    try {
        team = $app.findRecordById("users", teamId);
    } catch (err) {
        throw new BadRequestError("Ese equipo no existe.");
    }
    if (team.getString("type") !== "organization" || team.getString("subtype") !== "team") {
        throw new BadRequestError("Solo una cuenta de equipo puede tener un roster de jugadores.");
    }

    const userId = e.record.getString("user");
    if (userId) {
        let isActiveMember = false;
        try {
            $app.findFirstRecordByFilter(
                "organization_members",
                "organization = {:team} && user = {:user} && status = 'active'",
                { team: teamId, user: userId }
            );
            isActiveMember = true;
        } catch (err) {
            isActiveMember = false;
        }
        if (!isActiveMember) {
            throw new BadRequestError("Solo se puede vincular a un integrante activo de la organización.");
        }
    }

    return e.next();
}, "team_players");
