/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // 1. Desactivar alertas automáticas de inicio de sesión desde nuevas ubicaciones (authAlert)
  // para ahorrar la cuota de correos diarios.
  if (users.authAlert) {
    users.authAlert.enabled = false;
  }

  // 2. Estilos basados en la paleta Flat Dark de Beauchapp
  const baseStyle = "font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #0f172a; color: #f8fafc; border-radius: 8px; border: 1px solid #334155;";
  const h2Style = "font-weight: 600; font-size: 24px; margin-bottom: 20px; color: #ffffff; letter-spacing: -0.5px;";
  const pStyle = "font-size: 16px; line-height: 1.6; color: #94a3b8; margin-bottom: 30px;";
  const btnStyle = "background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; border-radius: 6px; letter-spacing: 0.5px;";
  const footerStyle = "font-size: 13px; color: #94a3b8; margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155;";
  const linkStyle = "color: #38bdf8; text-decoration: none; word-break: break-all; margin-top: 8px; display: inline-block;";

  // Actualizar plantilla de verificación
  users.verificationTemplate.body = `<div style="${baseStyle}">
    <h2 style="${h2Style}">Verifica tu cuenta</h2>
    <p style="${pStyle}">Gracias por registrarte en Beauchapp. Por favor, haz clic en el siguiente botón para verificar tu correo institucional.</p>
    <a href="{APP_URL}/verify?token={TOKEN}" style="${btnStyle}">Verificar cuenta</a>
    <p style="${footerStyle}">
        O ingresa usando este enlace directo:<br>
        <a href="{APP_URL}/verify?token={TOKEN}" style="${linkStyle}">{APP_URL}/verify?token={TOKEN}</a>
    </p>
</div>`;
  users.verificationTemplate.subject = "Verifica tu cuenta en Beauchapp";

  // Actualizar plantilla de recuperación de contraseña
  users.resetPasswordTemplate.body = `<div style="${baseStyle}">
    <h2 style="${h2Style}">Recuperación de contraseña</h2>
    <p style="${pStyle}">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para continuar.</p>
    <a href="{APP_URL}/reset-password?token={TOKEN}" style="${btnStyle}">Restablecer contraseña</a>
    <p style="${footerStyle}">
        O ingresa usando este enlace directo:<br>
        <a href="{APP_URL}/reset-password?token={TOKEN}" style="${linkStyle}">{APP_URL}/reset-password?token={TOKEN}</a>
        <br><br>
        Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.
    </p>
</div>`;
  users.resetPasswordTemplate.subject = "Recupera tu contraseña en Beauchapp";

  // Actualizar plantilla de confirmación de cambio de correo
  users.confirmEmailChangeTemplate.body = `<div style="${baseStyle}">
    <h2 style="${h2Style}">Confirmar cambio de correo</h2>
    <p style="${pStyle}">Haz clic en el botón de abajo para confirmar tu nueva dirección de correo electrónico.</p>
    <a href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" style="${btnStyle}">Confirmar cambio</a>
    <p style="${footerStyle}">
        O ingresa usando este enlace directo:<br>
        <a href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" style="${linkStyle}">{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}</a>
        <br><br>
        Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
    </p>
</div>`;
  users.confirmEmailChangeTemplate.subject = "Confirma tu cambio de correo en Beauchapp";

  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  if (users.authAlert) {
    users.authAlert.enabled = true;
  }
  app.save(users);
});
