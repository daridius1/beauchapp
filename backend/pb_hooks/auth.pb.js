/// <reference path="../pb_data/types.d.ts" />

// 1. Filtro de exclusividad universitaria
// Interceptar el registro de usuarios para validar el correo institucional @ing.uchile.cl
onRecordCreateRequest((e) => {
    const type = e.record.getString("type");

    // Helper para generar token localmente (evita problemas de aislamiento en Goja)
    const generateTokenLocal = () => {
        return $security.randomString(15);
    };

    if (type === "organization") {
        // Only superusers (admins) can create an organization
        if (!e.hasSuperuserAuth()) {
            throw new BadRequestError("No tienes permisos para crear una cuenta de organización.");
        }
        // If not verified, generate token and expiration
        if (!e.record.getBool("verified")) {
            const token = generateTokenLocal();
            e.record.set("registrationToken", token);

            const oneWeekLater = new Date();
            oneWeekLater.setDate(oneWeekLater.getDate() + 7);
            e.record.set("tokenExpiresAt", oneWeekLater.toISOString());
        }
        return e.next();
    }

    // Cierre de capacidad para registro de estudiantes nuevos — controlado desde el
    // dashboard de admin (Collections > app_config), nunca hardcodeado. Se chequea antes
    // que cualquier otra validación: si está cerrado, no importa si el correo es válido o
    // no. Falla "abierto" (deja registrar) si por algún motivo no se puede leer la
    // config, para no bloquear accidentalmente todo el registro por un bug ajeno a esto —
    // por eso el throw vive AFUERA del try, nunca adentro (si no, se auto-atraparía).
    let registrationOpen = true;
    let registrationClosedMessage = "El registro está cerrado temporalmente.";
    try {
        const configRows = $app.findRecordsByFilter("app_config", "", "", 1, 0, {});
        if (configRows.length > 0) {
            registrationOpen = configRows[0].getBool("registration_open");
            registrationClosedMessage = configRows[0].getString("registration_closed_message") || registrationClosedMessage;
        }
    } catch (err) {
        console.error("[auth.pb.js] Error consultando app_config, se permite el registro por defecto:", err);
    }
    if (!registrationOpen) {
        throw new BadRequestError(registrationClosedMessage);
    }

    // For everyone else, enforce student type
    e.record.set("type", "student");
    if (!e.hasSuperuserAuth()) {
        e.record.set("verified", false);
    }

    const email = e.record.getString("email");
    if (!email) {
        throw new BadRequestError("El correo electrónico es requerido para estudiantes.");
    }

    if (!email.endsWith("@ing.uchile.cl")) {
        throw new BadRequestError("Acceso denegado. Solo se permiten correos con el dominio @ing.uchile.cl");
    }

    // Derivar username del prefijo del correo institucional para estudiantes
    const emailPrefix = email.split("@")[0];
    e.record.set("username", emailPrefix);

    return e.next();
}, "users");

// 1.5. Proteger campos type y subtype (solo admins reales de PocketBase pueden modificarlos)
onRecordUpdateRequest((e) => {
    const original = e.record.original();
    if (e.record.get("type") !== original.get("type")) {
        if (!e.hasSuperuserAuth()) {
            e.record.set("type", original.get("type"));
        }
    }
    if (e.record.get("subtype") !== original.get("subtype")) {
        if (!e.hasSuperuserAuth()) {
            e.record.set("subtype", original.get("subtype"));
        }
    }
    // Proteger el campo verified para que no lo modifiquen usuarios comunes
    if (e.record.get("verified") !== original.get("verified")) {
        if (!e.hasSuperuserAuth()) {
            e.record.set("verified", original.get("verified"));
        }
    }
    return e.next();
}, "users");


// 8. Validación de tipos para organization_members
onRecordCreateRequest((e) => {
    const userId = e.record.getString("user");
    const orgId = e.record.getString("organization");

    if (!userId || !orgId) {
        throw new ApiError(400, "Los campos 'user' y 'organization' son requeridos.");
    }

    try {
        const userRec = $app.findRecordById("users", userId);
        if (userRec.getString("type") !== "student") {
            throw new ApiError(400, "El integrante debe ser una cuenta de estudiante.");
        }
    } catch(err) {
        throw new ApiError(400, err.message || "El usuario no existe.");
    }

    try {
        const orgRec = $app.findRecordById("users", orgId);
        if (orgRec.getString("type") !== "organization") {
            throw new ApiError(400, "El destino debe ser una cuenta de organización.");
        }
    } catch(err) {
        throw new ApiError(400, err.message || "La organización no existe.");
    }

    // El throw de "ya participa" va FUERA del try a propósito: antes estaba adentro y
    // el propio catch se lo tragaba, así que el chequeo nunca disparaba y el usuario
    // veía el error crudo del índice único idx_om_user_org en vez de este mensaje.
    // El try solo envuelve la consulta (que puede fallar si no hay ninguna fila).
    let existing = [];
    try {
        existing = $app.findRecordsByFilter(
            "organization_members",
            "organization = {:orgId} && user = {:userId}",
            "-created", 1, 0,
            { orgId: orgId, userId: userId }
        ) || [];
    } catch(err) {
        // Sin membresía previa — es el camino normal, no un error.
        existing = [];
    }
    if (existing.length > 0) {
        throw new ApiError(400, "El usuario ya participa en esta organización.");
    }

    // Sumarse a una organización ya no es instantáneo: toda fila nueva arranca en
    // "pending" sin importar qué status mande el cliente — queda a la espera de que el
    // estudiante invitado la acepte desde /api/org-invites/respond (ver organizations.pb.js).
    e.record.set("status", "pending");

    return e.next();
}, "organization_members");

onRecordUpdateRequest((e) => {
    const original = e.record.original();
    if (e.record.get("user") !== original.get("user") || e.record.get("organization") !== original.get("organization")) {
        throw new ApiError(400, "No se pueden modificar los campos 'user' u 'organization' una vez creados.");
    }
    // Nadie puede activar una membresía por esta vía (ni siquiera la propia
    // organización) — solo /api/org-invites/respond puede, porque guarda con $app.save
    // directamente y eso evita este hook de request. Así se cierra la vía por la que
    // organizationService.addMember reactivaba de forma instantánea una fila ya
    // existente (ej. alguien previamente sacado) sin pasar por aprobación.
    if (e.record.get("status") === "active" && original.get("status") !== "active") {
        throw new ApiError(400, "La membresía solo se activa cuando el usuario invitado la acepta.");
    }
    return e.next();
}, "organization_members");



// 9. Servir la vista HTML para la activación de organizaciones
routerAdd("GET", "/register-org", (e) => {
    const { PALETTE_CSS } = require(`${__hooks}/lib/adminUi.js`);

    const token = e.requestInfo().query["token"] || "";
    
    if (!token || token.length !== 15) {
        return e.html(400, `<h1 style="color:#ef4444;text-align:center;margin-top:100px;font-family:sans-serif;">Token de registro ausente o inválido.</h1>`);
    }

    let userRecord;
    try {
        userRecord = $app.findFirstRecordByFilter("users", "registrationToken = {:token} && verified = false", { token: token });
    } catch (err) {
        return e.html(400, `<h1 style="color:#ef4444;text-align:center;margin-top:100px;font-family:sans-serif;">Enlace de activación inválido o ya utilizado.</h1>`);
    }

    // El vencimiento se comprueba también acá, no solo al enviar el formulario: si no,
    // el enlace vencido muestra el formulario completo, la persona llena todo y recién
    // ahí se entera. POST /api/register-organization lo vuelve a verificar igual — esta
    // comprobación es de cortesía, la que manda es aquella.
    const expiraEn = new Date(userRecord.getString("tokenExpiresAt"));
    if (!userRecord.getString("tokenExpiresAt") || expiraEn < new Date()) {
        return e.html(400, `<h1 style="color:#ef4444;text-align:center;margin-top:100px;font-family:sans-serif;">Este enlace de activación venció. Pídele uno nuevo a quien te lo compartió.</h1>`);
    }

    const expiresAt = new Date(userRecord.getString("tokenExpiresAt"));
    if (expiresAt < new Date()) {
        return e.html(400, `<h1 style="color:#ef4444;text-align:center;margin-top:100px;font-family:sans-serif;">Este enlace de activación ha expirado.</h1>`);
    }

    let subtypeText = "Organización";
    const subtype = userRecord.getString("subtype");
    if (subtype === "center") subtypeText = "Centro de Estudiantes";
    else if (subtype === "team") subtypeText = "Equipo";
    else if (subtype === "community") subtypeText = "Comunidad libre";
    else if (subtype === "band") subtypeText = "Banda / Grupo Musical";
    else if (subtype === "organization") subtypeText = "Organización";
    else if (subtype === "league") subtypeText = "Liga";

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activar Cuenta - Beauchapp</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        ${PALETTE_CSS}

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Outfit', sans-serif;
        }

        body {
            background-color: var(--bg-color);
            background-image: radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 40%),
                              radial-gradient(circle at bottom left, rgba(30, 41, 59, 0.5), transparent 50%);
            color: var(--text-color);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .container {
            width: 100%;
            max-width: 500px;
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
        }

        h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #fff 0%, var(--primary-color) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtype-badge {
            display: inline-block;
            background: rgba(56, 189, 248, 0.15);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: var(--primary-color);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .subtitle {
            font-size: 14px;
            color: var(--text-muted);
            margin-bottom: 30px;
        }

        .form-group {
            text-align: left;
            margin-bottom: 20px;
        }

        label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-muted);
            margin-bottom: 8px;
            padding-left: 4px;
        }

        input, textarea {
            width: 100%;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 12px 16px;
            color: var(--text-color);
            font-size: 16px;
            outline: none;
            transition: all 0.3s ease;
        }

        input:focus, textarea:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }

        textarea {
            resize: vertical;
            min-height: 80px;
        }

        .btn {
            width: 100%;
            background: var(--primary-color);
            color: #0f172a;
            border: none;
            border-radius: 12px;
            padding: 14px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
        }

        .btn:hover {
            background: var(--primary-hover);
            transform: translateY(-1px);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .alert {
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 20px;
            text-align: left;
            display: none;
        }

        .alert-danger {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }

        .alert-success {
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #86efac;
        }

        .spinner {
            width: 20px;
            height: 20px;
            border: 3px solid rgba(15, 23, 42, 0.3);
            border-top: 3px solid #0f172a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            display: none;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container" id="mainContainer">
        <h1>Activar Cuenta</h1>
        <div class="subtype-badge">${subtypeText}</div>
        <p class="subtitle">Configura los detalles de acceso para tu organización en Beauchapp</p>
        
        <div class="alert alert-danger" id="errorAlert"></div>
        <div class="alert alert-success" id="successAlert"></div>

        <form id="regForm">
            <input type="hidden" id="tokenField" name="token">
            
            <div class="form-group">
                <label for="name">Nombre Oficial</label>
                <input type="text" id="name" required placeholder="Ej. Centro de Estudiantes de Ingeniería">
            </div>

            <div class="form-group">
                <label for="username">Nombre de Usuario (Username)</label>
                <input type="text" id="username" required placeholder="Ej. cei" pattern="^[a-zA-Z0-9_-]{3,20}$" title="De 3 a 20 caracteres: letras, números y guiones.">
            </div>

            <div class="form-group">
                <label for="description">Descripción (Opcional)</label>
                <textarea id="description" placeholder="Información de contacto, redes sociales o una breve reseña..."></textarea>
            </div>

            <div class="form-group">
                <label for="password">Contraseña de Acceso</label>
                <input type="password" id="password" required minlength="8" placeholder="Mínimo 8 caracteres">
            </div>

            <div class="form-group">
                <label for="passwordConfirm">Confirmar Contraseña</label>
                <input type="password" id="passwordConfirm" required minlength="8" placeholder="Repite la contraseña">
            </div>

            <button type="submit" class="btn" id="submitBtn">
                <span class="spinner" id="btnSpinner"></span>
                <span id="btnText">Activar y Guardar</span>
            </button>
        </form>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        document.getElementById('tokenField').value = token;

        function showError(msg) {
            const errDiv = document.getElementById('errorAlert');
            errDiv.textContent = msg;
            errDiv.style.display = 'block';
            document.getElementById('successAlert').style.display = 'none';
            window.scrollTo(0, 0);
        }

        function showSuccess(msg) {
            const successDiv = document.getElementById('successAlert');
            successDiv.textContent = msg;
            successDiv.style.display = 'block';
            document.getElementById('errorAlert').style.display = 'none';
            window.scrollTo(0, 0);
        }

        document.getElementById('regForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value.trim();
            const username = document.getElementById('username').value.trim();
            const description = document.getElementById('description').value.trim();
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('passwordConfirm').value;

            if (password !== passwordConfirm) {
                showError("Las contraseñas no coinciden.");
                return;
            }

            const btn = document.getElementById('submitBtn');
            const spinner = document.getElementById('btnSpinner');
            const btnText = document.getElementById('btnText');

            btn.disabled = true;
            spinner.style.display = 'inline-block';
            btnText.textContent = 'Procesando...';

            try {
                const response = await fetch('/api/register-organization', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token,
                        name,
                        username,
                        description,
                        password
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Ocurrió un error al procesar el registro.");
                }

                showSuccess("¡Cuenta activada con éxito! Ya puedes iniciar sesión desde la aplicación móvil Beauchapp.");
                document.getElementById('regForm').style.display = 'none';
            } catch (err) {
                showError(err.message);
            } finally {
                btn.disabled = false;
                spinner.style.display = 'none';
                btnText.textContent = 'Activar y Guardar';
            }
        });
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

// Registrar/Activar organización con un token válido
routerAdd("POST", "/api/register-organization", (e) => {
    const body = e.requestInfo().body;
    const token = body.token || "";
    const name = body.name || "";
    const username = body.username || "";
    const description = body.description || "";
    const password = body.password || "";

    if (!token || !name || !username || !password) {
        return e.json(400, { error: "Todos los campos obligatorios son requeridos." });
    }

    let userRecord;
    try {
        userRecord = $app.findFirstRecordByFilter("users", "registrationToken = {:token} && verified = false", { token: token });
    } catch(err) {
        return e.json(400, { error: "El enlace de activación no es válido o ya fue utilizado." });
    }

    const expiresAt = new Date(userRecord.getString("tokenExpiresAt"));
    if (expiresAt < new Date()) {
        return e.json(400, { error: "Este enlace de activación ha expirado." });
    }

    // Validar nombre de usuario único
    try {
        const existing = $app.findFirstRecordByFilter("users", "username = {:username} && id != {:id}", { username: username, id: userRecord.id });
        if (existing) {
            return e.json(400, { error: "El nombre de usuario ya está registrado por otra cuenta." });
        }
    } catch (err) {}

    // Activar y guardar la organización
    try {
        userRecord.set("name", name);
        userRecord.set("username", username);
        userRecord.set("description", description);
        userRecord.set("verified", true);
        userRecord.set("registrationToken", "");
        userRecord.set("tokenExpiresAt", "");
        userRecord.setPassword(password);

        $app.save(userRecord);
    } catch (err) {
        return e.json(400, { error: "No se pudo registrar la organización: " + err.message });
    }

    return e.json(200, { success: true });
});

// 10. Servir la vista del generador de enlaces (para administradores)
routerAdd("GET", "/admin/generate-link", (e) => {
    const { PALETTE_CSS } = require(`${__hooks}/lib/adminUi.js`);

    let subtypeOptionsHtml = "";
    const subtypeLabels = {
        "center": "Centro de Estudiantes",
        "team": "Equipo",
        "community": "Comunidad libre",
        "band": "Banda / Grupo Musical",
        "organization": "Organización",
        "league": "Liga"
    };

    try {
        const usersCol = $app.findCollectionByNameOrId("users");
        const subtypeField = usersCol.fields.getByName("subtype");
        if (subtypeField && subtypeField.values) {
            subtypeField.values.forEach((val) => {
                const label = subtypeLabels[val] || (val.charAt(0).toUpperCase() + val.slice(1));
                subtypeOptionsHtml += `<option value="${val}">${label}</option>`;
            });
        }
    } catch (err) {
        console.error("[auth.pb.js] Error leyendo opciones de subtype de la DB:", err);
    }

    if (!subtypeOptionsHtml) {
        subtypeOptionsHtml = `
            <option value="center">Centro de Estudiantes</option>
            <option value="team">Equipo</option>
            <option value="community">Comunidad libre</option>
            <option value="band">Banda / Grupo Musical</option>
            <option value="organization">Organización</option>
            <option value="league">Liga</option>
        `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generador de Enlaces - Beauchapp</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        ${PALETTE_CSS}

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Outfit', sans-serif;
        }

        body {
            background-color: var(--bg-color);
            background-image: radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 40%),
                              radial-gradient(circle at bottom left, rgba(30, 41, 59, 0.5), transparent 50%);
            color: var(--text-color);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .container {
            width: 100%;
            max-width: 500px;
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
        }

        h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #fff 0%, var(--primary-color) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle {
            font-size: 14px;
            color: var(--text-muted);
            margin-bottom: 30px;
        }

        .form-group {
            text-align: left;
            margin-bottom: 20px;
        }

        label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-muted);
            margin-bottom: 8px;
            padding-left: 4px;
        }

        input, select {
            width: 100%;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 12px 16px;
            color: var(--text-color);
            font-size: 16px;
            outline: none;
            transition: all 0.3s ease;
        }

        input:focus, select:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }

        .btn {
            width: 100%;
            background: var(--primary-color);
            color: #0f172a;
            border: none;
            border-radius: 12px;
            padding: 14px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
        }

        .btn:hover {
            background: var(--primary-hover);
            transform: translateY(-1px);
        }

        .btn:active {
            transform: translateY(0);
        }

        .alert {
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 20px;
            text-align: left;
            display: none;
        }

        .alert-danger {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }

        .result-container {
            margin-top: 25px;
            padding: 20px;
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            display: none;
            text-align: left;
        }

        .result-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--success-color);
            margin-bottom: 10px;
        }

        .url-box {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px 12px;
            font-family: monospace;
            font-size: 13px;
            color: var(--primary-color);
            word-break: break-all;
            margin-bottom: 15px;
            user-select: all;
        }

        .copy-btn {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 13px;
            cursor: pointer;
            width: 100%;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        .copy-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        .hint-text { display: block; color: var(--text-muted); font-size: 12px; margin-top: 6px; }
        .link-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .link-row .idx { color: var(--text-muted); font-size: 12px; font-weight: 700; min-width: 22px; }
        .link-row .url-box { flex: 1; margin: 0; min-width: 0; overflow-wrap: anywhere; }
        /* .copy-btn trae width:100%; en una fila flex eso aplasta la URL a un carácter. */
        .link-row .row-copy { flex-shrink: 0; width: auto; margin: 0; padding: 6px 12px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container" id="mainContainer">
        <h1>Generador de Enlaces</h1>
        <p class="subtitle" id="formSubtitle">Crea un enlace de registro seguro para una nueva organización</p>
        
        <div class="alert alert-danger" id="errorAlert"></div>

        <!-- Vista de Login si no está autenticado -->
        <form id="loginForm" style="display: none;">
            <p class="subtitle" style="margin-top: -15px; color: var(--danger-color);">Inicia sesión con tu cuenta de Administrador de PocketBase</p>
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

        <!-- Vista del Generador -->
        <form id="generatorForm" style="display: none;">
            <div class="form-group">
                <label for="subtype">Subtipo de Organización</label>
                <select id="subtype" required>
                    ${subtypeOptionsHtml}
                </select>
            </div>
            <div class="form-group">
                <label for="count">Cantidad de enlaces</label>
                <input type="number" id="count" min="1" max="25" value="1">
                <small class="hint-text">Cada enlace sirve una sola vez, para una organización distinta.</small>
            </div>
            <button type="submit" class="btn" id="generateBtn">Generar Enlace</button>
            <button type="button" class="copy-btn" id="logoutBtn" style="margin-top: 15px;">Cerrar Sesión</button>
        </form>

        <div class="result-container" id="resultBox">
            <div class="result-title" id="resultTitle">✓ Enlace Generado Exitosamente</div>
            <div id="expiryNote" class="hint-text" style="margin-bottom: 12px;"></div>
            <div id="linksList"></div>
            <button class="copy-btn" id="copyBtn">Copiar Enlace</button>
        </div>
    </div>

    <script>
        let token = "";

        // Intentar recuperar sesión existente
        try {
            const authData = JSON.parse(localStorage.getItem("pocketbase_auth") || localStorage.getItem("pb_auth"));
            if (authData && authData.token) {
                token = authData.token;
            }
        } catch (e) {}

        const loginForm = document.getElementById("loginForm");
        const generatorForm = document.getElementById("generatorForm");
        const errorAlert = document.getElementById("errorAlert");
        const resultBox = document.getElementById("resultBox");

        function showError(msg) {
            errorAlert.textContent = msg;
            errorAlert.style.display = "block";
        }

        function hideError() {
            errorAlert.style.display = "none";
        }

        function showGenerator() {
            loginForm.style.display = "none";
            generatorForm.style.display = "block";
            document.getElementById("formSubtitle").style.display = "block";
        }

        function showLogin() {
            loginForm.style.display = "block";
            generatorForm.style.display = "none";
            document.getElementById("formSubtitle").style.display = "none";
        }

        if (token) {
            showGenerator();
        } else {
            showLogin();
        }

        // Manejar Login
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError();
            const email = document.getElementById("loginEmail").value;
            const password = document.getElementById("loginPassword").value;

            try {
                // Autenticar contra la colección de superusuarios
                const response = await fetch("/api/collections/_superusers/auth-with-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identity: email, password: password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Credenciales incorrectas.");

                token = data.token;
                localStorage.setItem("pb_auth", JSON.stringify({ token, model: data.record }));
                showGenerator();
            } catch (err) {
                showError(err.message);
            }
        });

        // Cerrar sesión
        document.getElementById("logoutBtn").addEventListener("click", () => {
            token = "";
            localStorage.removeItem("pb_auth");
            showLogin();
            resultBox.style.display = "none";
        });

        // Generar Enlace
        generatorForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError();
            resultBox.style.display = "none";
            const subtype = document.getElementById("subtype").value;
            const count = Math.max(1, Math.min(25, parseInt(document.getElementById("count").value, 10) || 1));

            const genBtn = document.getElementById("generateBtn");
            genBtn.disabled = true;
            genBtn.textContent = count > 1 ? "Generando " + count + " enlaces..." : "Generando...";

            try {
                const response = await fetch("/api/admin/generate-link", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + token
                    },
                    body: JSON.stringify({ subtype, count })
                });
                const data = await response.json();
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        token = "";
                        localStorage.removeItem("pb_auth");
                        showLogin();
                        throw new Error("Sesión expirada. Por favor, inicia sesión de nuevo.");
                    }
                    throw new Error(data.error || "Error al generar enlace.");
                }

                mostrarEnlaces(data);
            } catch (err) {
                showError(err.message);
            } finally {
                genBtn.disabled = false;
                genBtn.textContent = "Generar Enlace";
            }
        });

        // Un enlace por fila, cada uno con su propio botón de copiar; el de abajo copia
        // la lista completa, que es lo práctico cuando se generan varios de una.
        let ultimosEnlaces = [];
        function mostrarEnlaces(data) {
            ultimosEnlaces = data.links || (data.link ? [data.link] : []);
            const lista = document.getElementById("linksList");
            lista.innerHTML = "";
            ultimosEnlaces.forEach((enlace, i) => {
                const fila = document.createElement("div");
                fila.className = "link-row";
                if (ultimosEnlaces.length > 1) {
                    const idx = document.createElement("span");
                    idx.className = "idx";
                    idx.textContent = (i + 1) + ".";
                    fila.appendChild(idx);
                }
                const caja = document.createElement("div");
                caja.className = "url-box";
                caja.textContent = enlace;
                fila.appendChild(caja);
                const btn = document.createElement("button");
                btn.className = "copy-btn row-copy";
                btn.textContent = "Copiar";
                btn.addEventListener("click", () => copiar(enlace, btn, "Copiar"));
                fila.appendChild(btn);
                lista.appendChild(fila);
            });

            document.getElementById("resultTitle").textContent = ultimosEnlaces.length > 1
                ? "✓ " + ultimosEnlaces.length + " enlaces generados"
                : "✓ Enlace Generado Exitosamente";

            const vence = data.expiresAt ? new Date(data.expiresAt) : null;
            document.getElementById("expiryNote").textContent = vence
                ? "Vencen el " + vence.toLocaleDateString("es-CL", { day: "numeric", month: "long" }) +
                  " a las " + vence.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) +
                  " (" + (data.expiresInDays || 7) + " días). Después dejan de servir y hay que generar otros."
                : "";

            document.getElementById("copyBtn").textContent = ultimosEnlaces.length > 1 ? "Copiar todos" : "Copiar Enlace";
            if (data.warning) showError(data.warning);
            resultBox.style.display = "block";
        }

        // Copiar con fallback para contextos no seguros (entrar por IP, sin HTTPS,
        // donde navigator.clipboard no existe).
        function copiar(texto, btn, etiquetaOriginal) {
            const listo = () => {
                btn.textContent = "✓ ¡Copiado!";
                setTimeout(() => { btn.textContent = etiquetaOriginal; }, 2000);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(texto).then(listo);
                return;
            }
            const textArea = document.createElement("textarea");
            textArea.value = texto;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand("copy");
                listo();
            } catch (err) {
                console.error("Fallback copy failed", err);
            }
            document.body.removeChild(textArea);
        }

        document.getElementById("copyBtn").addEventListener("click", () => {
            const btn = document.getElementById("copyBtn");
            const etiqueta = ultimosEnlaces.length > 1 ? "Copiar todos" : "Copiar Enlace";
            copiar(ultimosEnlaces.join("\\n"), btn, etiqueta);
        });
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

// Endpoint POST para generar el link de una organización
routerAdd("POST", "/api/admin/generate-link", (e) => {
    // Duración de un enlace de registro, en días. Está acá arriba y no repartido por el
    // handler porque es lo que hay que mirar (y lo único que hay que cambiar) para saber
    // cuánto vive un enlace: lo escribe este endpoint en tokenExpiresAt y lo verifican
    // tanto GET /register-org como POST /api/register-organization.
    // Van adentro del handler (no al nivel del módulo) porque cada routerAdd corre en su
    // propia VM: un const de afuera no existe acá dentro.
    const REGISTRATION_LINK_DAYS = 7;
    const MAX_LINKS_PER_REQUEST = 25;

    const body = e.requestInfo().body;
    const subtype = body.subtype || "";

    // Cuántos enlaces generar de una vez. Cada uno crea su propia cuenta inactiva con
    // su propio token: son intercambiables pero no compartibles — el primero que use
    // uno se queda con esa cuenta.
    let count = parseInt(body.count, 10);
    if (!Number.isFinite(count) || count < 1) count = 1;
    if (count > MAX_LINKS_PER_REQUEST) {
        return e.json(400, { error: "Como máximo " + MAX_LINKS_PER_REQUEST + " enlaces por vez." });
    }

    let validSubtypes = ["center", "team", "community", "band", "organization", "league"];
    try {
        const usersCol = $app.findCollectionByNameOrId("users");
        const subtypeField = usersCol.fields.getByName("subtype");
        if (subtypeField && subtypeField.values && subtypeField.values.length > 0) {
            validSubtypes = subtypeField.values;
        }
    } catch (err) {}

    if (!validSubtypes.includes(subtype)) {
        return e.json(400, { error: "El subtipo no es válido." });
    }

    // La URL base, una sola vez para todos los enlaces de esta tanda.
    const envAppUrl = $os.getenv("APP_URL") || $os.getenv("SITE_URL");
    const host = e.requestInfo().headers["host"] || "localhost:8090";
    const protocol = e.requestInfo().headers["x-forwarded-proto"] || "http";
    const baseUrl = envAppUrl ? envAppUrl.replace(/\/$/, "") : `${protocol}://${host}`;

    const usersCol = $app.findCollectionByNameOrId("users");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REGISTRATION_LINK_DAYS);
    const expiresAtIso = expiresAt.toISOString();

    const links = [];
    for (let i = 0; i < count; i++) {
        // Cada enlace es una cuenta inactiva independiente. Si uno de la tanda falla se
        // devuelve lo que sí se creó en vez de perderlo todo: las cuentas ya guardadas
        // existen igual, y fingir que no sería peor que informarlo.
        const userRec = new Record(usersCol);
        try {
            userRec.set("type", "organization");
            userRec.set("subtype", subtype);
            userRec.set("verified", false);

            // Token y expiración se ponen acá directamente: $app.save no dispara los
            // hooks de onRecordCreateRequest, así que nadie más los va a rellenar.
            userRec.set("registrationToken", $security.randomString(15));
            userRec.set("tokenExpiresAt", expiresAtIso);

            // Contraseña temporal aleatoria: la cuenta no debe poder usarse hasta que
            // alguien complete el registro con el enlace.
            userRec.setPassword($security.randomString(30));

            $app.save(userRec);
        } catch (err) {
            if (links.length === 0) {
                return e.json(400, { error: "No se pudo crear la organización inactiva: " + err.message });
            }
            return e.json(200, {
                success: true,
                links: links,
                link: links[0],
                expiresAt: expiresAtIso,
                expiresInDays: REGISTRATION_LINK_DAYS,
                warning: "Se generaron " + links.length + " de " + count + " enlaces: " + err.message,
            });
        }
        links.push(`${baseUrl}/register-org?token=${userRec.getString("registrationToken")}`);
    }

    // `link` en singular se mantiene por si algo viejo todavía lo lee.
    return e.json(200, {
        success: true,
        links: links,
        link: links[0],
        expiresAt: expiresAtIso,
        expiresInDays: REGISTRATION_LINK_DAYS,
    });
}, $apis.requireSuperuserAuth());

