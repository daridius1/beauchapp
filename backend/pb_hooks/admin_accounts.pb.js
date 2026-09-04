/// <reference path="../pb_data/types.d.ts" />

// Panel de administración para eliminar CUALQUIER cuenta (estudiante u organización).
// Autenticado con superusuario real de PocketBase, mismo patrón que /admin/horarios y
// /admin/reviews-import (gateSession("_superusers", ...) + $apis.requireSuperuserAuth()
// en cada acción) — a diferencia de /admin/liga, que se autentica con la propia cuenta
// de organización y NO sirve de plantilla acá.
//
// Comparte la secuencia de anonimización con /api/account/delete (account_deletion.pb.js)
// pero no puede compartir código: cada routerAdd corre en su propia VM (CLAUDE.md §2.1).

routerAdd("GET", "/admin/cuentas", (e) => {
    const { PALETTE_CSS, clientSessionGateFn, clientApiCallFn, clientEscapeHtmlFn } = require(`${__hooks}/lib/adminUi.js`);
    const SESSION_GATE_FN = clientSessionGateFn();
    const API_CALL_FN = clientApiCallFn("pb_auth");
    const ESC_FN = clientEscapeHtmlFn();

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Eliminar Cuentas - Beauchapp</title>
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
            width: 100%;
            max-width: 440px;
            margin: 60px auto;
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
        .subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.5; }
        .form-group { text-align: left; margin-bottom: 16px; }
        label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        input {
            width: 100%;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 11px 14px;
            color: var(--text-color);
            font-size: 15px;
            outline: none;
        }
        input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15); }
        .btn {
            width: 100%; background: var(--primary-color); color: #0f172a; border: none;
            border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 700;
            cursor: pointer; margin-top: 6px;
        }
        .btn:hover { background: var(--primary-hover); }
        .btn-danger { background: var(--danger-color); color: #fff; }
        .btn-danger:hover { background: #dc2626; }
        .btn-secondary { background: transparent; color: var(--text-muted); border: 1px solid var(--border-color); }
        .alert {
            padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px;
            text-align: left; display: none;
        }
        .alert-danger { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
        .alert-success { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #86efac; }
        .card {
            background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px;
            padding: 20px; margin-bottom: 16px;
        }
        .row {
            display: flex; align-items: center; justify-content: space-between; gap: 10px;
            padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .row:last-child { border-bottom: none; }
        .row-info { min-width: 0; }
        .row-name { font-size: 14px; font-weight: 700; }
        .row-sub { font-size: 12px; color: var(--text-muted); }
        .row-badge {
            display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.5px; color: var(--text-muted); border: 1px solid var(--border-color);
            border-radius: 6px; padding: 2px 6px; margin-left: 6px;
        }
        .row-del-btn {
            background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 8px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
            flex-shrink: 0;
        }
        .row-del-btn:hover { background: rgba(239, 68, 68, 0.25); }
        .empty { color: var(--text-muted); font-size: 13px; font-style: italic; padding: 8px 0; }
        .modal-overlay {
            display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6);
            align-items: center; justify-content: center; padding: 20px; z-index: 10;
        }
        .modal-box {
            background: #0f172a; border: 1px solid var(--border-color); border-radius: 16px;
            padding: 28px; max-width: 400px; width: 100%;
        }
        .modal-box h2 { font-size: 17px; margin-bottom: 10px; }
        .modal-box p { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 14px; }
        .modal-actions { display: flex; gap: 10px; margin-top: 16px; }
        .modal-actions .btn { margin-top: 0; }
        .top-actions { display: flex; justify-content: flex-end; margin-bottom: 12px; }
        .top-actions .btn { width: auto; padding: 8px 14px; }
    </style>
</head>
<body>
    <div id="loginWrap">
        <div class="container" id="loginContainer">
            <h1>Eliminar Cuentas</h1>
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
        <h1 style="margin-bottom: 4px;">Eliminar Cuentas</h1>
        <p class="subtitle">Anonimiza una cuenta (estudiante u organización) de forma permanente: se borra todo dato identificable, pero el contenido que generó (posts, partidos, apuestas) queda atribuido a "Cuenta eliminada". No es reversible.</p>
        <div class="top-actions"><button class="btn btn-secondary" id="logoutBtn">Cerrar Sesión</button></div>
        <div class="alert alert-danger" id="errorAlert"></div>
        <div class="alert alert-success" id="successAlert"></div>
        <div class="form-group">
            <input type="text" id="searchInput" placeholder="Buscar por nombre, @username o correo...">
        </div>
        <div class="card" id="resultsCard">
            <div class="empty" id="resultsEmpty">Escribe para buscar una cuenta.</div>
            <div id="resultsList"></div>
        </div>
    </div>

    <div class="modal-overlay" id="confirmOverlay">
        <div class="modal-box">
            <h2>¿Eliminar esta cuenta?</h2>
            <p id="confirmText"></p>
            <p>Escribe exactamente <strong id="confirmUsernameLabel"></strong> para confirmar:</p>
            <div class="form-group"><input type="text" id="confirmInput" autocomplete="off"></div>
            <div class="modal-actions">
                <button class="btn btn-secondary" id="confirmCancelBtn">Cancelar</button>
                <button class="btn btn-danger" id="confirmDeleteBtn">Eliminar cuenta</button>
            </div>
        </div>
    </div>

    <script>
${SESSION_GATE_FN}
${ESC_FN}

        let token = "";
        let pendingUser = null;

        const loginWrap = document.getElementById("loginWrap");
        const panelPage = document.getElementById("panelPage");
        const checkingMsg = document.getElementById("checkingMsg");
        const loginForm = document.getElementById("loginForm");
        const loginErrorAlert = document.getElementById("loginErrorAlert");
        const errorAlert = document.getElementById("errorAlert");
        const successAlert = document.getElementById("successAlert");
        const searchInput = document.getElementById("searchInput");
        const resultsList = document.getElementById("resultsList");
        const resultsEmpty = document.getElementById("resultsEmpty");
        const confirmOverlay = document.getElementById("confirmOverlay");
        const confirmText = document.getElementById("confirmText");
        const confirmUsernameLabel = document.getElementById("confirmUsernameLabel");
        const confirmInput = document.getElementById("confirmInput");

        function showError(msg) { errorAlert.textContent = msg; errorAlert.style.display = "block"; successAlert.style.display = "none"; }
        function showSuccess(msg) { successAlert.textContent = msg; successAlert.style.display = "block"; errorAlert.style.display = "none"; }
        function showLoginError(msg) { loginErrorAlert.textContent = msg; loginErrorAlert.style.display = "block"; }

        function showPanel() { loginWrap.style.display = "none"; panelPage.style.display = "block"; }
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

        document.getElementById("logoutBtn").addEventListener("click", () => {
            token = ""; localStorage.removeItem("pb_auth"); showLogin(false);
        });

${API_CALL_FN}

        function typeLabel(u) {
            if (u.type !== "organization") return "Estudiante";
            return u.subtype ? u.subtype : "Organización";
        }

        function renderResults(users) {
            resultsList.innerHTML = "";
            if (!users.length) {
                resultsEmpty.style.display = "block";
                resultsEmpty.textContent = "Sin resultados.";
                return;
            }
            resultsEmpty.style.display = "none";
            users.forEach((u) => {
                const row = document.createElement("div");
                row.className = "row";
                row.innerHTML =
                    '<div class="row-info">' +
                        '<div class="row-name">' + esc(u.name || u.username) + '<span class="row-badge">' + esc(typeLabel(u)) + '</span></div>' +
                        '<div class="row-sub">@' + esc(u.username) + (u.email ? ' · ' + esc(u.email) : '') + '</div>' +
                    '</div>' +
                    '<button class="row-del-btn" data-id="' + esc(u.id) + '">Eliminar</button>';
                row.querySelector(".row-del-btn").addEventListener("click", () => openConfirm(u));
                resultsList.appendChild(row);
            });
        }

        function openConfirm(u) {
            pendingUser = u;
            confirmText.textContent = 'Vas a eliminar la cuenta "' + (u.name || u.username) + '" (@' + u.username + '). Esta acción no se puede deshacer.';
            confirmUsernameLabel.textContent = u.username;
            confirmInput.value = "";
            confirmOverlay.style.display = "flex";
        }
        function closeConfirm() { confirmOverlay.style.display = "none"; pendingUser = null; }
        document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);

        document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
            if (!pendingUser) return;
            if (confirmInput.value.trim() !== pendingUser.username) {
                showError("El nombre de usuario escrito no coincide.");
                return;
            }
            try {
                await apiCall("/api/admin/accounts/delete", "POST", { userId: pendingUser.id, confirmUsername: confirmInput.value.trim() });
                showSuccess('Cuenta "' + pendingUser.username + '" eliminada.');
                closeConfirm();
                runSearch();
            } catch (err) {
                showError(err.message);
            }
        });

        let searchTimer = null;
        function runSearch() {
            const q = searchInput.value.trim();
            if (!q) { resultsList.innerHTML = ""; resultsEmpty.style.display = "block"; resultsEmpty.textContent = "Escribe para buscar una cuenta."; return; }
            apiCall("/api/admin/accounts/search?q=" + encodeURIComponent(q), "GET")
                .then((data) => renderResults(data.users || []))
                .catch((err) => showError(err.message));
        }
        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(runSearch, 300);
        });
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

routerAdd("GET", "/api/admin/accounts/search", (e) => {
    const q = (e.requestInfo().query["q"] || "").trim();
    if (!q) return e.json(200, { users: [] });

    let results = [];
    try {
        results = $app.findRecordsByFilter(
            "users",
            "deleted = false && (name ~ {:q} || username ~ {:q} || email ~ {:q})",
            "name", 30, 0, { q: q }
        ) || [];
    } catch (err) {
        return e.json(500, { error: "No se pudo buscar cuentas: " + err.message });
    }

    return e.json(200, {
        users: results.map((u) => ({
            id: u.id,
            name: u.getString("name"),
            username: u.getString("username"),
            email: u.getString("email"),
            type: u.getString("type"),
            subtype: u.getString("subtype"),
        })),
    });
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/accounts/delete", (e) => {
    const { anonymizeUserRecord } = require(`${__hooks}/lib/accountDeletion.js`);

    const body = e.requestInfo().body;
    const userId = body.userId || "";
    const confirmUsername = body.confirmUsername || "";
    if (!userId || !confirmUsername) {
        return e.json(400, { error: "Falta el id de la cuenta o la confirmación." });
    }

    let record;
    try {
        record = $app.findRecordById("users", userId);
    } catch (err) {
        return e.json(404, { error: "La cuenta no existe." });
    }

    if (record.getBool("deleted")) {
        return e.json(400, { error: "Esta cuenta ya fue eliminada." });
    }
    if (record.getString("username") !== confirmUsername) {
        return e.json(400, { error: "El nombre de usuario de confirmación no coincide." });
    }

    try {
        const email = record.getString("email");
        const emailHash = email ? $security.sha256(email.trim().toLowerCase()) : "";
        const usernamePlaceholder = "eliminado_" + record.id;
        const deletedAtIso = new Date().toISOString();

        anonymizeUserRecord(record, { emailHash, deletedAtIso, usernamePlaceholder });
        record.setRandomPassword();
        record.refreshTokenKey();
        $app.save(record);

        try {
            const tinderProfile = $app.findFirstRecordByFilter(
                "tinder_profiles", "user = {:id}", { id: record.id }
            );
            if (tinderProfile) $app.delete(tinderProfile);
        } catch (err) {}

        try {
            const sellerProfile = $app.findFirstRecordByFilter(
                "seller_profiles", "user = {:id}", { id: record.id }
            );
            if (sellerProfile) {
                sellerProfile.set("bio", "");
                sellerProfile.set("wall_announcement", "");
                sellerProfile.set("wsp_phone", "");
                sellerProfile.set("instagram_handle", "");
                sellerProfile.set("contact_notes", "");
                $app.save(sellerProfile);
            }
        } catch (err) {}

        try {
            const asMember = $app.findRecordsByFilter(
                "organization_members", "user = {:id}", "", 500, 0, { id: record.id }
            ) || [];
            for (let i = 0; i < asMember.length; i++) $app.delete(asMember[i]);
        } catch (err) {}
        try {
            const asOrg = $app.findRecordsByFilter(
                "organization_members", "organization = {:id}", "", 500, 0, { id: record.id }
            ) || [];
            for (let i = 0; i < asOrg.length; i++) $app.delete(asOrg[i]);
        } catch (err) {}
    } catch (err) {
        console.error("[admin_accounts.pb.js] Error al eliminar cuenta:", err);
        return e.json(500, { error: "No se pudo eliminar la cuenta: " + err.message });
    }

    return e.json(200, { success: true });
}, $apis.requireSuperuserAuth());
