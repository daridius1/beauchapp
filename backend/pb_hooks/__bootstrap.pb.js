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

    // Configuración S3/R2 para almacenamiento de archivos
    const r2Endpoint = $os.getenv("R2_ENDPOINT");
    if (r2Endpoint) {
        settings.s3.enabled = true;
        settings.s3.endpoint = r2Endpoint;
        settings.s3.bucket = $os.getenv("R2_BUCKET_NAME");
        settings.s3.region = "auto";
        settings.s3.accessKey = $os.getenv("R2_ACCESS_KEY_ID");
        settings.s3.secret = $os.getenv("R2_SECRET_ACCESS_KEY");
        settings.s3.forcePathStyle = true;
    }

    try {
        $app.save(settings);
    } catch (err) {
        // Ignorar si hay error al guardar configuracion
    }
});
