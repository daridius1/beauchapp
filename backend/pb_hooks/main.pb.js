// Beauchapp PocketBase Hooks
// Lógica de negocio del lado del servidor - Compatible con PocketBase v0.23+

// 1. Filtro de exclusividad universitaria
// Interceptar el registro de usuarios para validar el correo institucional @ing.uchile.cl
onRecordCreateRequest((e) => {
    console.log("[DEBUG] onRecordCreateRequest hook triggered for users");
    const type = e.record.getString("type");
    console.log("[DEBUG] Record type:", type);
    console.log("[DEBUG] Is superuser auth:", e.hasSuperuserAuth());

    // Helper para generar token localmente (evita problemas de aislamiento en Goja)
    const generateTokenLocal = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 15; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    };

    if (type === "organization") {
        // Only superusers (admins) can create an organization
        if (!e.hasSuperuserAuth()) {
            console.log("[DEBUG] Blocked: No superuser auth!");
            throw new BadRequestError("No tienes permisos para crear una cuenta de organización.");
        }
        // If not verified, generate token and expiration
        try {
            if (!e.record.getBool("verified")) {
                const token = generateTokenLocal();
                console.log("[DEBUG] Trying to set registrationToken to:", token);
                e.record.set("registrationToken", token);
                
                const oneWeekLater = new Date();
                oneWeekLater.setDate(oneWeekLater.getDate() + 7);
                console.log("[DEBUG] Trying to set tokenExpiresAt to:", oneWeekLater.toISOString());
                e.record.set("tokenExpiresAt", oneWeekLater.toISOString());
                console.log("[DEBUG] Generated activation token successfully:", token);
            }
        } catch (err) {
            console.log("[DEBUG] Exception setting token fields:", err.message);
            throw err;
        }
        console.log("[DEBUG] Organization record checks passed. Proceeding with e.next()...");
        return e.next();
    }

    // For everyone else, enforce student type
    e.record.set("type", "student");

    const email = e.record.getString("email");
    if (!email) {
        throw new BadRequestError("El correo electrónico es requerido para estudiantes.");
    }
    
    if (!email.endsWith("@ing.uchile.cl")) {
        throw new BadRequestError("Acceso denegado. Solo se permiten correos con el dominio @ing.uchile.cl");
    }
    
    console.log("[DEBUG] Student record checks passed. Proceeding with e.next()...");
    return e.next();
}, "users");

// 1.5. Proteger campos type y subtype (solo admins reales de PocketBase pueden modificarlos)
onRecordUpdateRequest((e) => {
    const original = e.record.originalCopy();
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
}, "users");



// 6. Lógica de Árboles Estilo Reddit para Posts (Lógica inyectada directamente en los hooks)

onRecordCreateRequest((e) => {
    try {
        const parentId = e.record.getString("replyTo");

        if (parentId) {
            // Es una respuesta: limpiar tags
            e.record.set("tags", []);

            // Buscar el root
            try {
                const parent = $app.findRecordById("posts", parentId);
                let rootId = parent.getString("root");
                if (!rootId) {
                    rootId = parent.id; // El padre es la raíz
                }
                e.record.set("root", rootId);
            } catch (err) {
                console.log("Error in root hook:", err);
            }
        }

        // Inicializar conteo
        e.record.set("commentCount", 0);
    } catch (outerErr) {
        console.log("OUTER ERROR in posts create hook:", outerErr);
    }

}, "posts");

onRecordAfterCreateSuccess((e) => {
    const rootId = e.record.getString("root");
    if (rootId) {
        try {
            const rows = arrayOf(new DynamicModel({ "id": "", "replyTo": "", "commentCount": 0 }));
            $app.db().select("id", "replyTo", "commentCount").from("posts").where(
                $dbx.or($dbx.hashExp({ "root": rootId }), $dbx.hashExp({ "id": rootId }))
            ).all(rows);
            
            const childrenMap = {};
            for (let j = 0; j < rows.length; j++) {
                const r = rows[j];
                if (r.replyTo) {
                    if (!childrenMap[r.replyTo]) childrenMap[r.replyTo] = [];
                    childrenMap[r.replyTo].push(r.id);
                }
            }
            
            function countDescendants(postId) {
                const kids = childrenMap[postId] || [];
                let count = kids.length;
                for (let i = 0; i < kids.length; i++) {
                    count += countDescendants(kids[i]);
                }
                return count;
            }
            
            for (let j = 0; j < rows.length; j++) {
                const r = rows[j];
                const newCount = countDescendants(r.id);
                if (r.commentCount !== newCount) {
                    $app.db().newQuery("UPDATE posts SET commentCount = {:count} WHERE id = {:id}").bind({
                        "count": newCount,
                        "id": r.id,
                    }).execute();
                }
            }
        } catch (err) {
            console.log("Error recalcTree create:", err);
        }
    }

}, "posts");

onRecordAfterDeleteSuccess((e) => {
    const rootId = e.record.getString("root");
    if (rootId) {
        try {
            const rows = arrayOf(new DynamicModel({ "id": "", "replyTo": "", "commentCount": 0 }));
            $app.db().select("id", "replyTo", "commentCount").from("posts").where(
                $dbx.or($dbx.hashExp({ "root": rootId }), $dbx.hashExp({ "id": rootId }))
            ).all(rows);
            
            const childrenMap = {};
            for (let j = 0; j < rows.length; j++) {
                const r = rows[j];
                if (r.replyTo) {
                    if (!childrenMap[r.replyTo]) childrenMap[r.replyTo] = [];
                    childrenMap[r.replyTo].push(r.id);
                }
            }
            
            function countDescendants(postId) {
                const kids = childrenMap[postId] || [];
                let count = kids.length;
                for (let i = 0; i < kids.length; i++) {
                    count += countDescendants(kids[i]);
                }
                return count;
            }
            
            for (let j = 0; j < rows.length; j++) {
                const r = rows[j];
                const newCount = countDescendants(r.id);
                if (r.commentCount !== newCount) {
                    $app.db().newQuery("UPDATE posts SET commentCount = {:count} WHERE id = {:id}").bind({
                        "count": newCount,
                        "id": r.id,
                    }).execute();
                }
            }
        } catch (err) {
            console.log("Error recalcTree delete:", err);
        }
    }

}, "posts");

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
            throw new Error("El integrante debe ser una cuenta de estudiante.");
        }
    } catch(err) {
        throw new ApiError(400, err.message || "El usuario no existe.");
    }

    try {
        const orgRec = $app.findRecordById("users", orgId);
        if (orgRec.getString("type") !== "organization") {
            throw new Error("El destino debe ser una cuenta de organización.");
        }
    } catch(err) {
        throw new ApiError(400, err.message || "La organización no existe.");
    }

    const existing = $app.findRecordsByFilter(
        "organization_members",
        "organization = {:orgId} && user = {:userId}",
        "",
        1,
        0,
        { orgId: orgId, user: userId }
    );
    if (existing.length > 0) {
        throw new ApiError(400, "El usuario ya participa en esta organización.");
    }

    return e.next();
}, "organization_members");

onRecordUpdateRequest((e) => {
    const original = e.record.originalCopy();
    if (e.record.get("user") !== original.get("user") || e.record.get("organization") !== original.get("organization")) {
        throw new ApiError(400, "No se pueden modificar los campos 'user' u 'organization' una vez creados.");
    }
    return e.next();
}, "organization_members");


// 9. Servir la vista HTML para la activación de organizaciones
routerAdd("GET", "/register-org", (e) => {
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

    const expiresAt = new Date(userRecord.getString("tokenExpiresAt"));
    if (expiresAt < new Date()) {
        return e.html(400, `<h1 style="color:#ef4444;text-align:center;margin-top:100px;font-family:sans-serif;">Este enlace de activación ha expirado.</h1>`);
    }

    let subtypeText = "Organización";
    const subtype = userRecord.getString("subtype");
    if (subtype === "center") subtypeText = "Centro de Estudiantes";
    else if (subtype === "team") subtypeText = "Equipo Oficial";
    else if (subtype === "community") subtypeText = "Comunidad libre";

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activar Cuenta - Beauchapp</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --border-color: rgba(255, 255, 255, 0.1);
            --primary-color: #38bdf8;
            --primary-hover: #0ea5e9;
            --text-color: #f1f5f9;
            --text-muted: #94a3b8;
            --danger-color: #ef4444;
            --success-color: #22c55e;
        }

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
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generador de Enlaces - Beauchapp</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --border-color: rgba(255, 255, 255, 0.1);
            --primary-color: #38bdf8;
            --primary-hover: #0ea5e9;
            --text-color: #f1f5f9;
            --text-muted: #94a3b8;
            --danger-color: #ef4444;
            --success-color: #22c55e;
        }

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
                    <option value="center">Centro de Estudiantes</option>
                    <option value="team">Equipo Oficial</option>
                    <option value="community">Comunidad libre</option>
                </select>
            </div>
            <button type="submit" class="btn">Generar Enlace</button>
            <button type="button" class="copy-btn" id="logoutBtn" style="margin-top: 15px;">Cerrar Sesión</button>
        </form>

        <div class="result-container" id="resultBox">
            <div class="result-title">✓ Enlace Generado Exitosamente</div>
            <div class="url-box" id="urlBox"></div>
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
        const urlBox = document.getElementById("urlBox");

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

            try {
                const response = await fetch("/api/admin/generate-link", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + token
                    },
                    body: JSON.stringify({ subtype })
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

                urlBox.textContent = data.link;
                resultBox.style.display = "block";
            } catch (err) {
                showError(err.message);
            }
        });

        // Copiar Enlace
        document.getElementById("copyBtn").addEventListener("click", () => {
            navigator.clipboard.writeText(urlBox.textContent);
            const btn = document.getElementById("copyBtn");
            btn.textContent = "✓ ¡Copiado!";
            setTimeout(() => {
                btn.textContent = "Copiar Enlace";
            }, 2000);
        });
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

// Endpoint POST para generar el link de una organización
routerAdd("POST", "/api/admin/generate-link", (e) => {
    const body = e.requestInfo().body;
    const subtype = body.subtype || "";

    if (subtype !== "center" && subtype !== "team" && subtype !== "community") {
        return e.json(400, { error: "El subtipo no es válido." });
    }

    // Crear el usuario inactivo con token
    const usersCol = $app.findCollectionByNameOrId("users");
    const userRec = new Record(usersCol);

    try {
        userRec.set("type", "organization");
        userRec.set("subtype", subtype);
        userRec.set("verified", false);
        
        // Poner contraseña temporal súper segura aleatoria de 30 chars
        const tempPass = $security.randomString(30);
        userRec.setPassword(tempPass);

        // Guardar record (esto llamará a nuestro hook onRecordCreateRequest de users,
        // el cual autogenerará el token y el tokenExpiresAt automáticamente!)
        $app.save(userRec);
    } catch (err) {
        return e.json(400, { error: "No se pudo crear la organización inactiva: " + err.message });
    }

    // Obtener la URL base dinámicamente de los headers
    const host = e.requestInfo().headers["host"] || "localhost:8090";
    const protocol = e.requestInfo().headers["x-forwarded-proto"] || "http";
    const activationUrl = protocol + "://" + host + "/register-org?token=" + userRec.getString("registrationToken");

    return e.json(200, { success: true, link: activationUrl });
}, $apis.requireSuperuserAuth());
