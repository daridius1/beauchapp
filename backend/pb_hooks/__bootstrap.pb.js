/// <reference path="../pb_data/types.d.ts" />

// Bootstrap hook: configura SMTP desde variables de entorno.
onBootstrap((e) => {
    e.next();

    const apiKey = $os.getenv("RESEND_API_KEY");
    if (!apiKey) return; 

    const settings = e.app.settings();

    settings.smtp.enabled = true;
    settings.smtp.host = "smtp.resend.com";
    settings.smtp.port = 465;
    settings.smtp.username = "resend";
    settings.smtp.password = apiKey;
    settings.smtp.tls = true;

    settings.meta.senderName = $os.getenv("SENDER_NAME") || "Beauchapp";
    settings.meta.senderAddress = $os.getenv("SENDER_ADDRESS") || "onboarding@resend.dev";

    try {
        $app.save(settings);
    } catch (err) {
        // Ignorar si hay error al guardar configuracion
    }
});
