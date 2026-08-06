/// <reference path="../pb_data/types.d.ts" />

// Bloqueo de usuarios: la exclusión de contenido/señales/relaciones se hace
// a nivel de listRule/viewRule en cada colección (ver migración
// 1784200100_add_blocking_rules.js y PRINCIPLES.md) — este hook solo se
// encarga de la parte que una regla de lectura no puede hacer: el bloqueo es
// retroactivo, así que hay que borrar sincrónicamente las relaciones
// bidireccionales que ya existían entre el par (follows, tinder_likes,
// tinder_matches) en el momento de crear el bloqueo.
onRecordCreateRequest((e) => {
    try {
        const blocker = e.record.getString("blocker");
        const blocked = e.record.getString("blocked");

        // Snapshot de nombre/username: una vez creado el bloqueo, users.viewRule ya
        // excluye a "blocked" para "blocker", así que el cliente no podría volver a
        // pedirlo (ni con expand) para mostrarlo en "Usuarios bloqueados". $app sí
        // tiene acceso completo, así que se guarda acá antes de e.next().
        try {
            const blockedUserRec = $app.findRecordById("users", blocked);
            e.record.set("blocked_name", blockedUserRec.getString("name"));
            e.record.set("blocked_username", blockedUserRec.getString("username"));
        } catch (err) {
            console.error("[blocking.pb.js] Error obteniendo datos del usuario bloqueado:", err);
        }

        try {
            const follows = $app.findRecordsByFilter(
                "follows",
                "(follower = {:blocker} && following = {:blocked}) || (follower = {:blocked} && following = {:blocker})",
                "", 0, 0,
                { blocker: blocker, blocked: blocked }
            );
            for (const f of follows) {
                try { $app.delete(f); } catch (err) {
                    console.error("[blocking.pb.js] Error borrando follow:", f.id, err);
                }
            }
        } catch (err) {
            // Sin follows entre ambos
        }

        try {
            const likes = $app.findRecordsByFilter(
                "tinder_likes",
                "(fromUser = {:blocker} && toUser = {:blocked}) || (fromUser = {:blocked} && toUser = {:blocker})",
                "", 0, 0,
                { blocker: blocker, blocked: blocked }
            );
            for (const l of likes) {
                try { $app.delete(l); } catch (err) {
                    console.error("[blocking.pb.js] Error borrando tinder_like:", l.id, err);
                }
            }
        } catch (err) {
            // Sin likes entre ambos
        }

        try {
            const matches = $app.findRecordsByFilter(
                "tinder_matches",
                "(userA = {:blocker} && userB = {:blocked}) || (userA = {:blocked} && userB = {:blocker})",
                "", 0, 0,
                { blocker: blocker, blocked: blocked }
            );
            for (const m of matches) {
                try { $app.delete(m); } catch (err) {
                    console.error("[blocking.pb.js] Error borrando tinder_match:", m.id, err);
                }
            }
        } catch (err) {
            // Sin match entre ambos
        }
    } catch (outerErr) {
        console.error("[blocking.pb.js] Outer error in blocked_users create:", outerErr);
    }
    return e.next();
}, "blocked_users");

// Copia del avatar del bloqueado a nivel de storage. Va en un hook aparte
// (After*Success, async) porque copiar un archivo a un campo tipo "file" solo
// funciona sobre un registro ya persistido — asignar el nombre del archivo
// directo en onRecordCreateRequest falla la validación (PocketBase solo
// acepta ahí archivos efectivamente subidos en esa misma request). Es
// aceptable que sea async: es puramente cosmético para "Usuarios bloqueados",
// no algo de lo que dependa la exclusión de contenido en sí.
onRecordAfterCreateSuccess((e) => {
    try {
        const blocked = e.record.getString("blocked");
        const blockedUserRec = $app.findRecordById("users", blocked);
        const avatarFilename = blockedUserRec.getString("avatar");
        if (avatarFilename) {
            // Se arma la URL pública directa de R2 (mismo bucket que usa
            // PocketBase para todo el storage, mismo patrón que getFileUrl() en
            // el frontend) y se descarga con $filesystem.fileFromURL — evita
            // tener que leer bytes a mano vía $app.newFilesystem()/blob.Reader,
            // cuyo read() en la JSVM no entrega el archivo completo de forma
            // confiable (se cortaba a los ~128KiB en pruebas contra R2 real).
            const r2Url = $os.getenv("EXPO_PUBLIC_R2_URL");
            if (r2Url) {
                const sourceUrl = r2Url.replace(/\/$/, "") + "/" + blockedUserRec.baseFilesPath() + "/" + avatarFilename;
                const file = $filesystem.fileFromURL(sourceUrl);

                const rec = $app.findRecordById("blocked_users", e.record.id);
                rec.set("blocked_avatar", file);
                $app.save(rec);
            }
        }
    } catch (err) {
        console.error("[blocking.pb.js] Error copiando avatar del usuario bloqueado:", err);
    }
    return e.next();
}, "blocked_users");
