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

    // El DT es role='coach' y un equipo admite uno solo (ocupa siempre el slot fijo
    // SLOT_DT del álbum — ver lib/album.js — así que un segundo coach colisionaría
    // ahí). Ídem "capitán" sobre jugadores, salvo que ese sí admite cualquier cantidad
    // de jugadores, solo uno marcado. Un bool no puede expresar "único por equipo"
    // solo, así que al marcar uno se desmarca a cualquier otro del mismo equipo que lo
    // tuviera. Todo inline en el mismo handler (nunca factorizado en una función
    // aparte) — ver la nota grande de arriba sobre por qué una función compartida que
    // hace más de un $app.* revienta acá.
    const role = e.record.getString("role");
    if (e.record.getBool("isCaptain") && role !== "player") {
        throw new BadRequestError("Solo un jugador puede ser el capitán.");
    }
    if (role === "coach") {
        try {
            $app.findFirstRecordByFilter(
                "team_players", "team = {:team} && role = 'coach' && deleted = false", { team: teamId }
            );
            throw new BadRequestError("Este equipo ya tiene un DT.");
        } catch (err) {
            if (err instanceof BadRequestError) throw err;
        }
    }
    if (e.record.getBool("isCaptain")) {
        try {
            $app.findRecordsByFilter(
                "team_players", "team = {:team} && isCaptain = true && id != {:id} && deleted = false", "", 0, 0, { team: teamId, id: e.record.id }
            ).forEach((other) => { other.set("isCaptain", false); $app.save(other); });
        } catch (err) {}
    }

    // Número de figurita del álbum (lib/album.js): permanente, asignado una sola vez
    // acá como MAX(slotNumber)+1 de ESE equipo — incluye jugadores ya borrados
    // (soft-delete) para que un número nunca se reutilice. Los slots 00-03 de cada
    // equipo son las cartas especiales de hoy (escudo, foto de equipo, DT, capitán) y
    // 04-09 quedan reservados para las que vengan después (FIRST_PLAYER_SLOT en
    // lib/album.js), así que el primer jugador arranca en el 10. Un DT (role='coach')
    // no consume slot: ocupa siempre el 02, sin importar cuándo se agregó. El capitán
    // tampoco consume un slot propio — es role='player' como cualquiera, con SU slot
    // normal, y además aparece en la carta especial 03 (misma persona, dos cartas).
    if (role === "player") {
        try {
            // OJO — el WHERE necesita `role = 'player'` (no solo `team`): el DT nunca
            // recibe un slotNumber propio, así que su fila queda en el valor por
            // defecto del campo (0, no NULL) — sin este filtro, agregar el primer
            // jugador DESPUÉS de ya tener un DT hace que MAX(slotNumber) devuelva ese
            // 0 real (COALESCE solo entra en juego con NULL, no con 0), tirando abajo
            // el piso de 9 y arrancando la numeración de jugadores en el 1 en vez del
            // 10 — invadiendo el rango 00-09 reservado para las cartas especiales del
            // álbum. Bug real: encontrado porque un jugador con slotNumber=2 terminó
            // compartiendo código de figurita (y por lo tanto fila de album_stickers)
            // con el DT (SLOT_DT=2 en lib/album.js) — pegar uno pegaba literalmente al
            // otro. Ver 1791400000_fix_player_slot_number_collision.js para el
            // renumerado de los jugadores que ya habían quedado mal numerados.
            const rows = arrayOf(new DynamicModel({ maxSlot: 0 }));
            $app.db()
                .newQuery("SELECT COALESCE(MAX(slotNumber), 9) AS maxSlot FROM team_players WHERE team = {:team} AND role = 'player'")
                .bind({ team: teamId })
                .all(rows);
            e.record.set("slotNumber", (rows[0] ? rows[0].maxSlot : 9) + 1);
        } catch (err) {
            console.error("[team_players.pb.js] Error asignando slotNumber:", err);
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

    const role = e.record.getString("role");
    if (e.record.getBool("isCaptain") && role !== "player") {
        throw new BadRequestError("Solo un jugador puede ser el capitán.");
    }
    if (role === "coach") {
        try {
            $app.findFirstRecordByFilter(
                "team_players", "team = {:team} && role = 'coach' && id != {:id} && deleted = false", { team: teamId, id: e.record.id }
            );
            throw new BadRequestError("Este equipo ya tiene un DT.");
        } catch (err) {
            if (err instanceof BadRequestError) throw err;
        }
    }
    if (e.record.getBool("isCaptain")) {
        try {
            $app.findRecordsByFilter(
                "team_players", "team = {:team} && isCaptain = true && id != {:id} && deleted = false", "", 0, 0, { team: teamId, id: e.record.id }
            ).forEach((other) => { other.set("isCaptain", false); $app.save(other); });
        } catch (err) {}
    }

    return e.next();
}, "team_players");
