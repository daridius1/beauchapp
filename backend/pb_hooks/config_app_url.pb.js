/// <reference path="../pb_data/types.d.ts" />

// Hook onBootstrap para PocketBase
// Configura automáticamente settings.meta.appURL basándose en la variable de entorno APP_URL / SITE_URL
// Esto garantiza que todas las plantillas de correo de verificación y contraseña usen el dominio real en producción.

onBootstrap((e) => {
    e.next();
    try {
        const envAppUrl = $os.getenv("APP_URL") || $os.getenv("SITE_URL");
        if (envAppUrl) {
            const settings = $app.settings();
            const cleanUrl = envAppUrl.replace(/\/$/, "");
            if (settings.meta.appURL !== cleanUrl) {
                settings.meta.appURL = cleanUrl;
                $app.save(settings);
                console.log(`[Config Hook] PocketBase settings.meta.appURL actualizado automáticamente a: ${cleanUrl}`);
            }
        }
    } catch (err) {
        console.log("[Config Hook] Error configurando appURL desde entorno:", err);
    }
});
