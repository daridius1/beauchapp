/// <reference path="../pb_data/types.d.ts" />

// Bootstrap hook: configura SMTP desde variables de entorno.
// Se ejecuta ANTES de que PocketBase arranque completamente.
// Para que funcione, levanta PocketBase con ./start.sh (que carga .env).

onBeforeBootstrap((e) => {
    const apiKey = $os.getenv("RESEND_API_KEY");
    if (!apiKey) return; // Si no hay key, no tocar la config (se usará lo que esté en la DB)

    const settings = e.app.settings();

    settings.smtp.enabled = true;
    settings.smtp.host = "smtp.resend.com";
    settings.smtp.port = 465;
    settings.smtp.username = "resend";
    settings.smtp.password = apiKey;
    settings.smtp.tls = true;

    settings.meta.senderName = $os.getenv("SENDER_NAME") || "Beauchapp";
    settings.meta.senderAddress = $os.getenv("SENDER_ADDRESS") || "onboarding@resend.dev";

    e.app.save(settings);
});
