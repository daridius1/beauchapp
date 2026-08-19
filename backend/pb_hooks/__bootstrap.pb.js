/// <reference path="../pb_data/types.d.ts" />

// Bootstrap hook: configura SMTP, S3/R2, APP_URL y Plantillas de Correo Minimalistas Blancas y Negras.
onBootstrap((e) => {
    e.next();

    const settings = e.app.settings();

    // 1. Configuración de Dominio (APP_URL / SITE_URL)
    // Permite cambiar el dominio en .env o por defecto usa beauchap.daridius.cl (o beauchapp.daridius.cl)
    const envAppUrl = $os.getenv("APP_URL") || $os.getenv("SITE_URL") || "https://beauchap.daridius.cl";
    const cleanAppUrl = envAppUrl.replace(/\/$/, "");
    settings.meta.appURL = cleanAppUrl;
    settings.meta.appName = "Beauchapp";

    // 2. Configuración SMTP (Resend)
    const apiKey = $os.getenv("RESEND_API_KEY");
    if (apiKey) {
        settings.smtp.enabled = true;
        settings.smtp.host = "smtp.resend.com";
        settings.smtp.port = 465;
        settings.smtp.username = "resend";
        settings.smtp.password = apiKey;
        settings.smtp.tls = true;

        settings.meta.senderName = $os.getenv("SENDER_NAME") || "Beauchapp";
        settings.meta.senderAddress = $os.getenv("SENDER_ADDRESS") || "onboarding@resend.dev";
    }

    // 3. Configuración S3/R2 para almacenamiento de archivos
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

    // 3.5 Límites de tasa — versionados acá, no configurados a mano en /_/
    //
    // El resto de los settings ya se declaran en este archivo; los rate limits vivían
    // solo en el panel de administración, o sea dentro de pb_data/, que está fuera de
    // git: no eran reproducibles, no eran revisables, y un pb_data nuevo arrancaba sin
    // ninguno. Ver auditoria-2026-08-19.md §4.7.
    //
    // Las reglas van de la más específica a la más general — PocketBase aplica la
    // primera que hace match (findRateLimitRule devuelve la primera coincidencia).
    try {
        settings.rateLimits.enabled = true;
        settings.rateLimits.rules = [
            // Verificar un código de arbitraje es un oráculo: responde distinto según
            // acierto, así que es el punto natural para fuerza bruta sobre los 32^6
            // códigos posibles. 10 intentos por minuto hace inviable el barrido sin
            // molestar a nadie que esté tipeando un código real en cancha.
            { label: "POST /api/league-matches/join", audience: "", duration: 60, maxRequests: 10 },

            // Entradas de credenciales. Cubre tanto el panel oficial como los cinco
            // formularios de login de las páginas de administración embebidas en hooks,
            // que llaman a este mismo endpoint.
            { label: "POST /api/collections/users/auth-with-password", audience: "", duration: 60, maxRequests: 10 },
            { label: "POST /api/collections/_superusers/auth-with-password", audience: "", duration: 60, maxRequests: 5 },

            // Mutaciones de saldo: acotan tanto el abuso como un bucle accidental del
            // cliente que vacíe una cuenta a fuerza de reintentos.
            { label: "POST /api/beaumarket/buy", audience: "@auth", duration: 60, maxRequests: 30 },
            { label: "POST /api/beaumarket/sell", audience: "@auth", duration: 60, maxRequests: 30 },

            // El juego diario: una cantidad razonable de intentos, no un bot.
            { label: "POST /api/beaudle/guess", audience: "@auth", duration: 60, maxRequests: 30 },

            // Escritura de arbitraje: cada evento registrado en cancha es un push, y el
            // cliente reintenta, así que el techo es holgado a propósito.
            { label: "POST /api/league-matches/", audience: "@auth", duration: 60, maxRequests: 120 },

            // Redes de seguridad generales, al final para que no pisen a las anteriores.
            { label: "/api/", audience: "@guest", duration: 60, maxRequests: 120 },
            { label: "/api/", audience: "@auth", duration: 60, maxRequests: 600 },
        ];
    } catch (err) {
        console.log("[Bootstrap Hook] Error configurando rate limits:", err);
    }

    try {
        $app.save(settings);
    } catch (err) {
        console.log("[Bootstrap Hook] Error guardando settings:", err);
    }

    // 4. Configurar plantillas de correo con diseño minimalista blanco y negro
    try {
        const users = $app.findCollectionByNameOrId("users");

        // Desactivar alertas de seguridad para no consumir cuota innecesaria
        if (users.authAlert) {
            users.authAlert.enabled = false;
        }

        const emailContainerStyle = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; padding: 40px 20px; color: #ffffff; min-height: 100%;";
        const cardStyle = "max-width: 500px; margin: 0 auto; background-color: #0c0c0c; border: 1px solid #222222; border-radius: 12px; padding: 36px 28px; text-align: center;";
        const brandStyle = "font-size: 18px; font-weight: 900; letter-spacing: 3px; color: #ffffff; margin-bottom: 28px; text-transform: uppercase;";
        const h2Style = "font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 14px; letter-spacing: -0.5px;";
        const pStyle = "font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 30px;";
        const btnStyle = "display: inline-block; background-color: #ffffff; color: #000000; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 8px; text-decoration: none; border: 1px solid #ffffff;";
        const footerBoxStyle = "margin-top: 36px; padding-top: 20px; border-top: 1px solid #1f1f1f;";
        const footerSubStyle = "font-size: 12px; color: #71717a; margin-bottom: 6px;";
        const linkStyle = "font-size: 12px; color: #ffffff; word-break: break-all; text-decoration: underline;";

        // Verification Template
        users.verificationTemplate.subject = "Verifica tu cuenta en Beauchapp";
        users.verificationTemplate.body = `<div style="${emailContainerStyle}">
  <div style="${cardStyle}">
    <div style="${brandStyle}">BEAUCHAPP</div>
    <h2 style="${h2Style}">Verifica tu cuenta</h2>
    <p style="${pStyle}">Gracias por unirte a Beauchapp. Haz clic en el botón a continuación para confirmar tu correo institucional y activar tu perfil.</p>
    <a href="{APP_URL}/verify?token={TOKEN}" style="${btnStyle}">Verificar cuenta</a>
    <div style="${footerBoxStyle}">
      <p style="${footerSubStyle}">O ingresa usando este enlace directo:</p>
      <a href="{APP_URL}/verify?token={TOKEN}" style="${linkStyle}">{APP_URL}/verify?token={TOKEN}</a>
    </div>
  </div>
</div>`;

        // Password Reset Template
        users.resetPasswordTemplate.subject = "Recupera tu contraseña en Beauchapp";
        users.resetPasswordTemplate.body = `<div style="${emailContainerStyle}">
  <div style="${cardStyle}">
    <div style="${brandStyle}">BEAUCHAPP</div>
    <h2 style="${h2Style}">Recuperar Contraseña</h2>
    <p style="${pStyle}">Recibimos una solicitud para restablecer tu contraseña en Beauchapp. Haz clic en el botón de abajo para definir tu nueva clave.</p>
    <a href="{APP_URL}/reset-password?token={TOKEN}" style="${btnStyle}">Restablecer contraseña</a>
    <div style="${footerBoxStyle}">
      <p style="${footerSubStyle}">O ingresa usando este enlace directo:</p>
      <a href="{APP_URL}/reset-password?token={TOKEN}" style="${linkStyle}">{APP_URL}/reset-password?token={TOKEN}</a>
    </div>
  </div>
</div>`;

        // Confirm Email Change Template
        users.confirmEmailChangeTemplate.subject = "Confirma tu nuevo correo en Beauchapp";
        users.confirmEmailChangeTemplate.body = `<div style="${emailContainerStyle}">
  <div style="${cardStyle}">
    <div style="${brandStyle}">BEAUCHAPP</div>
    <h2 style="${h2Style}">Confirmar Nuevo Correo</h2>
    <p style="${pStyle}">Haz clic en el botón a continuación para confirmar la actualización de tu correo electrónico en Beauchapp.</p>
    <a href="{APP_URL}/verify?token={TOKEN}" style="${btnStyle}">Confirmar cambio de correo</a>
    <div style="${footerBoxStyle}">
      <p style="${footerSubStyle}">O ingresa usando este enlace directo:</p>
      <a href="{APP_URL}/verify?token={TOKEN}" style="${linkStyle}">{APP_URL}/verify?token={TOKEN}</a>
    </div>
  </div>
</div>`;

        $app.save(users);
        console.log(`[Bootstrap Hook] Plantillas de correo minimalistas y appURL (${cleanAppUrl}) aplicadas correctamente.`);
    } catch (err) {
        console.log("[Bootstrap Hook] Error aplicando plantillas de correo:", err);
    }
});
