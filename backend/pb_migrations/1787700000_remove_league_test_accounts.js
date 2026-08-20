/// <reference path="../pb_data/types.d.ts" />

// Limpieza única: borra las tres cuentas que se crearon para probar las ligas en
// producción antes de abrir la funcionalidad al público — la liga "Copa CDI 2026" y
// sus dos equipos de mentira. Con ellas se van, por cascada de PocketBase, la etapa,
// los dos partidos de prueba, sus informes arbitrales y la membresía asociada.
//
// Va como migración y no como una consulta suelta a la base porque las cascadas de
// PocketBase (`cascadeDelete` de cada relación) viven en la capa de aplicación: un
// DELETE en SQLite dejaría huérfanos los partidos, los informes y la etapa. Esto usa
// `app.delete()`, que es exactamente lo que hace el panel de administración.
//
// Cada cuenta se identifica por id Y por username a la vez. El id es de producción, así
// que en cualquier otra base (local, de un colaborador, restaurada de cero) no calza
// nada y la migración no borra absolutamente nada.
migrate((app) => {
    const OBJETIVOS = [
        { id: "rvwa2qisaikhft3", username: "copacdi2026" },
        { id: "5i0s7j3ayigzl2z", username: "equipoa" },
        { id: "48j2fcbkjypsnsa", username: "equipo2" },
    ];

    // Los posts guardan a qué partido apuntan en un campo de texto (`targetId`), no en
    // una relación, así que la cascada no los toca: quedarían como tarjetas rotas en el
    // muro apuntando a un partido que ya no existe. Se marcan como borrados (borrado
    // suave, la convención del foro) antes de borrar las cuentas.
    const idsDePartidos = [];
    for (const objetivo of OBJETIVOS) {
        let cuenta;
        try {
            cuenta = app.findRecordById("users", objetivo.id);
        } catch (err) {
            continue;
        }
        if (cuenta.getString("username") !== objetivo.username) continue;
        let partidos = [];
        try {
            partidos = app.findRecordsByFilter("league_matches", "league = {:id}", "", 0, 0, { id: objetivo.id });
        } catch (err) {
            partidos = [];
        }
        for (const partido of partidos) idsDePartidos.push(partido.id);
    }

    for (const idPartido of idsDePartidos) {
        let posts = [];
        try {
            posts = app.findRecordsByFilter(
                "posts",
                "targetType = 'league_match' && targetId = {:id} && deleted = false",
                "", 0, 0, { id: idPartido }
            );
        } catch (err) {
            posts = [];
        }
        for (const post of posts) {
            post.set("deleted", true);
            app.save(post);
            console.log("[limpieza] Post " + post.id + " marcado como borrado (apuntaba al partido de prueba " + idPartido + ").");
        }
    }

    for (const objetivo of OBJETIVOS) {
        let cuenta;
        try {
            cuenta = app.findRecordById("users", objetivo.id);
        } catch (err) {
            console.log("[limpieza] No existe la cuenta " + objetivo.username + " (" + objetivo.id + ") — nada que borrar.");
            continue;
        }
        // La doble comprobación es la red de seguridad: si el id existe pero es de otra
        // cuenta, no se toca nada y queda registrado en el log.
        const username = cuenta.getString("username");
        if (username !== objetivo.username) {
            console.log("[limpieza] SALTADA: el id " + objetivo.id + " pertenece a '" + username + "', no a '" + objetivo.username + "'.");
            continue;
        }
        app.delete(cuenta);
        console.log("[limpieza] Cuenta de prueba borrada: " + objetivo.username + " (" + objetivo.id + ").");
    }
}, (app) => {
    // Sin vuelta atrás: los datos borrados solo se recuperan desde el respaldo de
    // pb_data que deja el deploy en ~/red-social/backups/ (ver DEPLOY.md, "rollback").
    console.log("[limpieza] Esta migración no se puede revertir: restaura pb_data desde backups/ si hace falta.");
});
