/// <reference path="../pb_data/types.d.ts" />

// Punto de entrada único para el administrador del sitio: enlaza a todas las
// herramientas gateadas con superusuario real (no incluye /admin/liga ni
// /admin/noticias, que se autentican con la cuenta propia de la organización, no con
// un superusuario — ver adminUi.js). Sin lógica de negocio propia: cuando se agregue
// una próxima herramienta admin-only, solo hace falta sumarle una tarjeta acá.

routerAdd("GET", "/admin", (e) => {
    const { PALETTE_CSS, clientSessionGateFn } = require(`${__hooks}/lib/adminUi.js`);
    const SESSION_GATE_FN = clientSessionGateFn();

    const LINKS = [
        { href: "/admin/generate-link", title: "Generar enlace", desc: "Crear cuentas de organización (centro, equipo, liga, banda, comunidad)." },
        { href: "/admin/album", title: "Álbumes", desc: "Crear álbumes de figuritas y elegir qué ligas los componen." },
        { href: "/admin/cuentas", title: "Eliminar cuentas", desc: "Anonimizar una cuenta de estudiante u organización." },
        { href: "/admin/horarios", title: "Horarios", desc: "Bloques de cancha cerrados u ocupados." },
        { href: "/admin/beaumarket", title: "Beaumarket", desc: "Crear y cerrar mercados de predicción manuales." },
        { href: "/admin/reviews-import", title: "Importar reseñas", desc: "Cargar reseñas de cursos/profesores en lote." },
    ];

    const linksHtml = LINKS.map((l) =>
        `<a class="link-card" href="${l.href}"><span class="link-title">${l.title}</span><span class="link-desc">${l.desc}</span></a>`
    ).join("");

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Administración - Beauchapp</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        ${PALETTE_CSS}
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body {
            background-color: var(--bg-color);
            background-image: radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 40%),
                              radial-gradient(circle at bottom left, rgba(30, 41, 59, 0.5), transparent 50%);
            color: var(--text-color);
            min-height: 100vh;
            padding: 24px;
        }
        .page { max-width: 640px; margin: 0 auto; }
        .container {
            width: 100%; max-width: 440px; margin: 60px auto; background: var(--card-bg);
            backdrop-filter: blur(16px); border: 1px solid var(--border-color); border-radius: 24px;
            padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3); text-align: center;
        }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
        .subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.5; }
        .form-group { text-align: left; margin-bottom: 16px; }
        label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        input {
            width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color);
            border-radius: 10px; padding: 11px 14px; color: var(--text-color); font-size: 15px; outline: none;
        }
        input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15); }
        .btn {
            width: 100%; background: var(--primary-color); color: #0f172a; border: none;
            border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 700;
            cursor: pointer; margin-top: 6px;
        }
        .btn:hover { background: var(--primary-hover); }
        .alert {
            padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px;
            text-align: left; display: none;
        }
        .alert-danger { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
        .link-card {
            display: flex; flex-direction: column; gap: 4px; text-decoration: none;
            background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px;
            padding: 18px 20px; margin-bottom: 12px;
        }
        .link-card:hover { border-color: var(--primary-color); }
        .link-title { font-size: 15px; font-weight: 700; color: var(--text-color); }
        .link-desc { font-size: 12px; color: var(--text-muted); }
    </style>
</head>
<body>
    <div id="loginWrap">
        <div class="container" id="loginContainer">
            <h1>Administración</h1>
            <div class="alert alert-danger" id="loginErrorAlert"></div>
            <p class="subtitle" id="checkingMsg">Verificando sesión…</p>
            <form id="loginForm" style="display: none;">
                <div class="form-group">
                    <label for="loginEmail">Correo del Administrador</label>
                    <input type="email" id="loginEmail" required placeholder="admin@beauchapp.cl">
                </div>
                <div class="form-group">
                    <label for="loginPassword">Contraseña</label>
                    <input type="password" id="loginPassword" required placeholder="••••••••">
                </div>
                <button type="submit" class="btn">Iniciar Sesión</button>
            </form>
        </div>
    </div>

    <div class="page" id="panelPage" style="display: none;">
        <h1 style="margin-bottom: 4px;">Administración</h1>
        <p class="subtitle">Herramientas que solo el administrador del sitio puede activar.</p>
        ${linksHtml}
    </div>

    <script>
${SESSION_GATE_FN}

        let token = "";

        const loginWrap = document.getElementById("loginWrap");
        const panelPage = document.getElementById("panelPage");
        const checkingMsg = document.getElementById("checkingMsg");
        const loginForm = document.getElementById("loginForm");
        const loginErrorAlert = document.getElementById("loginErrorAlert");

        function showPanel() { loginWrap.style.display = "none"; panelPage.style.display = "block"; }
        function showLoginError(msg) { loginErrorAlert.textContent = msg; loginErrorAlert.style.display = "block"; }
        function showLogin(hadStaleSession) {
            checkingMsg.style.display = "none";
            loginForm.style.display = "block";
            loginWrap.style.display = "block";
            panelPage.style.display = "none";
            if (hadStaleSession) showLoginError("Tu sesión expiró. Inicia sesión de nuevo.");
        }

        gateSession("_superusers", "pb_auth", (freshToken) => { token = freshToken; showPanel(); }, showLogin);

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            loginErrorAlert.style.display = "none";
            const email = document.getElementById("loginEmail").value;
            const password = document.getElementById("loginPassword").value;
            try {
                const response = await fetch("/api/collections/_superusers/auth-with-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identity: email, password: password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Credenciales incorrectas.");
                token = data.token;
                localStorage.setItem("pb_auth", JSON.stringify({ token, model: data.record }));
                showPanel();
            } catch (err) {
                showLoginError(err.message);
            }
        });
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});
