/// <reference path="../pb_data/types.d.ts" />

// Importación masiva de ramos y profesores (scrape de ucampus) a las colecciones
// 'courses' / 'professors' / 'course_professors'. Vista de administración no
// enlazada desde la navegación de la app (igual que /admin/generate-link),
// solo accesible por URL directa + login de superusuario.

routerAdd("GET", "/admin/reviews-import", (e) => {
    const { PALETTE_CSS } = require(`${__hooks}/lib/adminUi.js`);

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Importar Ramos y Profesores - Beauchapp</title>
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
            max-width: 560px;
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
            font-size: 26px;
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

        input[type="email"], input[type="password"] {
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

        input:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }

        input[type="file"] {
            width: 100%;
            background: rgba(15, 23, 42, 0.6);
            border: 1px dashed var(--border-color);
            border-radius: 12px;
            padding: 16px;
            color: var(--text-muted);
            font-size: 13px;
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

        .btn:hover { background: var(--primary-hover); transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }

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

        .log-box {
            margin-top: 20px;
            padding: 14px 16px;
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            display: none;
            text-align: left;
            max-height: 240px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.6;
        }

        .log-line { color: var(--text-muted); }
        .log-line.success { color: var(--success-color); }
        .log-line.error { color: var(--danger-color); }
    </style>
</head>
<body>
    <div class="container" id="mainContainer">
        <h1>Importar Ramos y Profesores</h1>
        <p class="subtitle" id="formSubtitle">Sube el JSON scrapeado de ucampus para actualizar la base de datos de Reseñas</p>

        <div class="alert alert-danger" id="errorAlert"></div>

        <!-- Vista de Login -->
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

        <!-- Vista del Importador -->
        <form id="importForm" style="display: none;">
            <div class="form-group">
                <label for="jsonFile">Archivo JSON (formato fcfm_simple.json)</label>
                <input type="file" id="jsonFile" accept="application/json,.json" required>
            </div>
            <button type="submit" class="btn" id="importBtn">Importar</button>
            <button type="button" class="btn btn-secondary" id="logoutBtn" style="margin-top: 10px;">Cerrar Sesión</button>
        </form>

        <div class="log-box" id="logBox"></div>
    </div>

    <script>
        let token = "";

        try {
            const authData = JSON.parse(localStorage.getItem("pb_auth") || localStorage.getItem("pocketbase_auth"));
            if (authData && authData.token) token = authData.token;
        } catch (e) {}

        const loginForm = document.getElementById("loginForm");
        const importForm = document.getElementById("importForm");
        const errorAlert = document.getElementById("errorAlert");
        const logBox = document.getElementById("logBox");
        const importBtn = document.getElementById("importBtn");

        function showError(msg) {
            errorAlert.textContent = msg;
            errorAlert.style.display = "block";
        }
        function hideError() { errorAlert.style.display = "none"; }

        function log(msg, cls) {
            logBox.style.display = "block";
            const line = document.createElement("div");
            line.className = "log-line" + (cls ? " " + cls : "");
            line.textContent = msg;
            logBox.appendChild(line);
            logBox.scrollTop = logBox.scrollHeight;
        }

        function showImporter() {
            loginForm.style.display = "none";
            importForm.style.display = "block";
        }
        function showLogin() {
            loginForm.style.display = "block";
            importForm.style.display = "none";
        }

        if (token) showImporter(); else showLogin();

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError();
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
                showImporter();
            } catch (err) {
                showError(err.message);
            }
        });

        document.getElementById("logoutBtn").addEventListener("click", () => {
            token = "";
            localStorage.removeItem("pb_auth");
            showLogin();
        });

        async function postBatch(path, payload) {
            const response = await fetch(path, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    token = "";
                    localStorage.removeItem("pb_auth");
                    showLogin();
                    throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
                }
                throw new Error(data.error || data.message || "Error en la importación.");
            }
            return data;
        }

        function chunk(arr, size) {
            const out = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
        }

        importForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError();
            logBox.innerHTML = "";
            logBox.style.display = "block";

            const fileInput = document.getElementById("jsonFile");
            const file = fileInput.files[0];
            if (!file) return;

            importBtn.disabled = true;
            try {
                log("Leyendo archivo...");
                const text = await file.text();
                const data = JSON.parse(text);

                const ramos = data.ramos || {};
                const profesores = data.profesores || {};
                const tiposCodigos = (data.metadata && data.metadata.tipos_codigos_ramos) || {};

                // --- 1. Cursos ---
                const courseItems = Object.keys(ramos).map((codigo) => {
                    const r = ramos[codigo];
                    const prefijo = (codigo.match(/^[A-Za-z]+/) || [""])[0].toUpperCase().slice(0, 2);
                    const meta = tiposCodigos[prefijo] || {};
                    return {
                        codigo: codigo,
                        nombre: r.nombre || "",
                        area: meta.area || "",
                        tipo: meta.tipo || "",
                        prefijo: prefijo,
                        semestres: r.semestres || {},
                    };
                });

                log("Cursos a importar: " + courseItems.length);
                const courseIdByCodigo = {};
                const courseBatches = chunk(courseItems, 300);
                let cCreated = 0, cUpdated = 0, cErrors = 0;
                for (let i = 0; i < courseBatches.length; i++) {
                    const res = await postBatch("/api/admin/reviews-import/courses", { courses: courseBatches[i] });
                    Object.assign(courseIdByCodigo, res.map || {});
                    cCreated += res.created || 0;
                    cUpdated += res.updated || 0;
                    cErrors += (res.errors || []).length;
                    log(\`Cursos: lote \${i + 1}/\${courseBatches.length} (\${cCreated} creados, \${cUpdated} actualizados)\`);
                }
                log(\`Cursos completados: \${cCreated} creados, \${cUpdated} actualizados, \${cErrors} errores\`, cErrors ? "error" : "success");

                // --- 2. Profesores ---
                const professorItems = Object.keys(profesores).map((nombre) => ({ nombre: nombre }));
                log("Profesores a importar: " + professorItems.length);
                const professorIdByNombre = {};
                const professorBatches = chunk(professorItems, 300);
                let pCreated = 0, pUpdated = 0, pErrors = 0;
                for (let i = 0; i < professorBatches.length; i++) {
                    const res = await postBatch("/api/admin/reviews-import/professors", { professors: professorBatches[i] });
                    Object.assign(professorIdByNombre, res.map || {});
                    pCreated += res.created || 0;
                    pUpdated += res.updated || 0;
                    pErrors += (res.errors || []).length;
                    log(\`Profesores: lote \${i + 1}/\${professorBatches.length} (\${pCreated} creados, \${pUpdated} actualizados)\`);
                }
                log(\`Profesores completados: \${pCreated} creados, \${pUpdated} actualizados, \${pErrors} errores\`, pErrors ? "error" : "success");

                // --- 3. Vínculos curso-profesor ---
                const linkItems = [];
                Object.keys(profesores).forEach((nombre) => {
                    const professorId = professorIdByNombre[nombre];
                    if (!professorId) return;
                    const cursosDict = profesores[nombre] || {};
                    Object.keys(cursosDict).forEach((codigo) => {
                        const courseId = courseIdByCodigo[codigo];
                        if (!courseId) return;
                        linkItems.push({ courseId: courseId, professorId: professorId, semestres: cursosDict[codigo] || [] });
                    });
                });

                log("Vínculos ramo-profesor a importar: " + linkItems.length);
                const linkBatches = chunk(linkItems, 500);
                let lCreated = 0, lUpdated = 0, lErrors = 0;
                for (let i = 0; i < linkBatches.length; i++) {
                    const res = await postBatch("/api/admin/reviews-import/links", { links: linkBatches[i] });
                    lCreated += res.created || 0;
                    lUpdated += res.updated || 0;
                    lErrors += (res.errors || []).length;
                    log(\`Vínculos: lote \${i + 1}/\${linkBatches.length} (\${lCreated} creados, \${lUpdated} actualizados)\`);
                }
                log(\`Vínculos completados: \${lCreated} creados, \${lUpdated} actualizados, \${lErrors} errores\`, lErrors ? "error" : "success");

                log("Importación finalizada.", "success");
            } catch (err) {
                showError(err.message);
                log("Importación interrumpida: " + err.message, "error");
            } finally {
                importBtn.disabled = false;
            }
        });
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

routerAdd("POST", "/api/admin/reviews-import/courses", (e) => {
    const body = e.requestInfo().body;
    const items = body.courses || [];

    const map = {};
    let created = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const codigo = (it.codigo || "").trim();
        if (!codigo) continue;
        try {
            let record;
            let wasCreated = false;
            try {
                record = $app.findFirstRecordByFilter("courses", "codigo = {:codigo}", { codigo: codigo });
            } catch (err) {
                record = new Record($app.findCollectionByNameOrId("courses"));
                wasCreated = true;
            }
            record.set("codigo", codigo);
            record.set("nombre", it.nombre || "");
            record.set("area", it.area || "");
            record.set("tipo", it.tipo || "");
            record.set("prefijo", it.prefijo || "");
            record.set("semestres", it.semestres || {});
            $app.save(record);

            if (wasCreated) created++; else updated++;
            map[codigo] = record.id;
        } catch (err) {
            errors.push({ codigo: codigo, error: String(err) });
        }
    }

    return e.json(200, { map: map, created: created, updated: updated, errors: errors });
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/reviews-import/professors", (e) => {
    const body = e.requestInfo().body;
    const items = body.professors || [];

    const map = {};
    let created = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const nombre = (it.nombre || "").trim();
        if (!nombre) continue;
        try {
            let record;
            let wasCreated = false;
            try {
                record = $app.findFirstRecordByFilter("professors", "nombre = {:nombre}", { nombre: nombre });
            } catch (err) {
                record = new Record($app.findCollectionByNameOrId("professors"));
                wasCreated = true;
            }
            record.set("nombre", nombre);
            $app.save(record);

            if (wasCreated) created++; else updated++;
            map[nombre] = record.id;
        } catch (err) {
            errors.push({ nombre: nombre, error: String(err) });
        }
    }

    return e.json(200, { map: map, created: created, updated: updated, errors: errors });
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/reviews-import/links", (e) => {
    const body = e.requestInfo().body;
    const items = body.links || [];

    let created = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const courseId = it.courseId || "";
        const professorId = it.professorId || "";
        if (!courseId || !professorId) continue;
        try {
            let record;
            let wasCreated = false;
            try {
                record = $app.findFirstRecordByFilter(
                    "course_professors",
                    "course = {:course} && professor = {:professor}",
                    { course: courseId, professor: professorId }
                );
            } catch (err) {
                record = new Record($app.findCollectionByNameOrId("course_professors"));
                wasCreated = true;
            }
            record.set("course", courseId);
            record.set("professor", professorId);
            record.set("semestres", it.semestres || []);
            $app.save(record);

            if (wasCreated) created++; else updated++;
        } catch (err) {
            errors.push({ courseId: courseId, professorId: professorId, error: String(err) });
        }
    }

    return e.json(200, { created: created, updated: updated, errors: errors });
}, $apis.requireSuperuserAuth());
