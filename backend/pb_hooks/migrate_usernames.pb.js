/// <reference path="../pb_data/types.d.ts" />

// Migración one-shot: Actualizar usernames de estudiantes existentes
// Cambia el username al prefijo del correo institucional (email.split("@")[0])
// Solo afecta cuentas de tipo "student" con email @ing.uchile.cl
//
// USO: Copiar este archivo a pb_hooks/, reiniciar PocketBase, y la migración
// se ejecutará automáticamente al arrancar. Luego ELIMINAR este archivo.

onBootstrap((e) => {
    e.next();

    console.log("[MIGRATE] Iniciando migración de usernames para estudiantes...");

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    try {
        const students = $app.findRecordsByFilter(
            "users",
            'type = "student" && email ~ "@ing.uchile.cl"',
            "",  // sort
            0,   // limit (0 = all)
            0    // offset
        );

        console.log("[MIGRATE] Encontrados", students.length, "estudiantes para migrar.");

        for (let i = 0; i < students.length; i++) {
            const record = students[i];
            const email = record.getString("email");
            const currentUsername = record.getString("username");
            const newUsername = email.split("@")[0];

            if (currentUsername === newUsername) {
                skipped++;
                continue;
            }

            try {
                record.set("username", newUsername);
                $app.save(record);
                console.log("[MIGRATE] ✓", currentUsername, "→", newUsername, "(", email, ")");
                updated++;
            } catch (err) {
                console.log("[MIGRATE] ✗ Error actualizando", currentUsername, "→", newUsername, ":", err.message);
                errors++;
            }
        }
    } catch (err) {
        console.log("[MIGRATE] Error fatal buscando estudiantes:", err.message);
    }

    console.log("[MIGRATE] Migración completada. Actualizados:", updated, "| Omitidos:", skipped, "| Errores:", errors);
    console.log("[MIGRATE] ⚠️  RECUERDA eliminar este archivo (migrate_usernames.pb.js) después de ejecutar la migración.");
});
