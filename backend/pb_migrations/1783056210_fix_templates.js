/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  
  const baseStyle = "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff; color: #000000;";
  const h2Style = "font-weight: 600; font-size: 24px; margin-bottom: 20px; letter-spacing: -0.5px;";
  const pStyle = "font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 30px;";
  const btnStyle = "background-color: #000000; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: 500; font-size: 15px; display: inline-block; letter-spacing: 0.5px;";
  const footerStyle = "font-size: 13px; color: #666666; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;";

  users.verificationTemplate.body = `<div style="${baseStyle}">
    <h2 style="${h2Style}">Verifica tu cuenta</h2>
    <p style="${pStyle}">Gracias por registrarte. Por favor, haz clic en el siguiente botón para verificar tu correo institucional.</p>
    <a href="{APP_URL}/verify?token={TOKEN}" style="${btnStyle}">Verificar cuenta</a>
    <p style="${footerStyle}">
        O ingresa a este enlace:<br>
        <a href="{APP_URL}/verify?token={TOKEN}" style="color: #666666; word-break: break-all; margin-top: 8px; display: inline-block;">{APP_URL}/verify?token={TOKEN}</a>
    </p>
</div>`;
  users.verificationTemplate.subject = "Verifica tu cuenta en Beauchapp";

  users.resetPasswordTemplate.body = `<div style="${baseStyle}">
    <h2 style="${h2Style}">Recuperación de contraseña</h2>
    <p style="${pStyle}">Haz clic en el botón de abajo para restablecer tu contraseña.</p>
    <a href="{APP_URL}/reset-password?token={TOKEN}" style="${btnStyle}">Restablecer contraseña</a>
    <p style="${footerStyle}">
        O ingresa a este enlace:<br>
        <a href="{APP_URL}/reset-password?token={TOKEN}" style="color: #666666; word-break: break-all; margin-top: 8px; display: inline-block;">{APP_URL}/reset-password?token={TOKEN}</a>
        <br><br>
        Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.
    </p>
</div>`;
  users.resetPasswordTemplate.subject = "Recupera tu contraseña en Beauchapp";

  app.save(users);
});
