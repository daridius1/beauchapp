/// <reference path="../pb_data/types.d.ts" />

// Moderacion de Nikita Jump. Las sanciones anulan el aporte competitivo, pero
// conservan las partidas para que la decision siga siendo auditable.

routerAdd("GET", "/admin/nikita", (e) => {
    const { PALETTE_CSS, clientSessionGateFn, clientApiCallFn } = require(`${__hooks}/lib/adminUi.js`);
    const SESSION_GATE_FN = clientSessionGateFn();
    const API_CALL_FN = clientApiCallFn("pb_auth");
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Moderar Nikita Jump - Beauchapp</title>
    <style>
        ${PALETTE_CSS}
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg-color); color: var(--text-color); font: 14px system-ui, sans-serif; padding: 24px; }
        .page { max-width: 760px; margin: 0 auto; }
        .login { max-width: 420px; margin: 60px auto; padding: 28px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); }
        h1 { margin: 0 0 6px; font-size: 24px; }
        .muted { color: var(--text-muted); line-height: 1.5; }
        .toolbar { display: flex; gap: 8px; margin: 24px 0; }
        input, textarea { width: 100%; color: var(--text-color); background: #0f172a; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px; }
        textarea { min-height: 82px; resize: vertical; }
        button { border: 1px solid var(--border-color); border-radius: 6px; padding: 9px 13px; background: transparent; color: var(--text-color); font-weight: 700; cursor: pointer; }
        button.primary { background: var(--primary-color); color: #0f172a; border-color: var(--primary-color); }
        button.danger { border-color: #ef4444; color: #fecaca; }
        button:disabled { opacity: .5; cursor: not-allowed; }
        .row { border-top: 1px solid var(--border-color); padding: 16px 0; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 16px; }
        .name { font-size: 16px; font-weight: 700; }
        .stats { color: var(--text-muted); font-size: 13px; line-height: 1.6; }
        .badge { display: inline-block; margin-left: 8px; padding: 2px 6px; border: 1px solid #ef4444; border-radius: 4px; color: #fecaca; font-size: 11px; }
        .alert { display: none; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 6px; margin: 14px 0; }
        .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.7); align-items: center; justify-content: center; padding: 20px; }
        .modal-box { width: 100%; max-width: 440px; padding: 22px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        label { display: block; margin: 14px 0 6px; color: var(--text-muted); font-weight: 700; }
        @media (max-width: 560px) { body { padding: 16px; } .toolbar { flex-direction: column; } .row { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <section id="loginPage" class="login">
        <h1>Moderar Nikita Jump</h1>
        <p id="checking" class="muted">Verificando sesión…</p>
        <form id="loginForm" style="display:none">
            <label for="identity">Correo del administrador</label><input id="identity" type="email" required>
            <label for="password">Contraseña</label><input id="password" type="password" required>
            <button class="primary" type="submit" style="margin-top:16px">Iniciar sesión</button>
        </form>
    </section>
    <main id="panel" class="page" style="display:none">
        <h1>Moderar Nikita Jump</h1>
        <p class="muted">Banear impide jugar, quita el puntaje del ranking y anula las partidas sin borrar la evidencia.</p>
        <div id="alert" class="alert"></div>
        <form id="searchForm" class="toolbar"><input id="search" placeholder="Buscar por nombre o usuario"><button class="primary">Buscar</button></form>
        <div id="results"><p class="muted">Busca una cuenta para revisar su historial.</p></div>
    </main>
    <div id="modal" class="modal"><div class="modal-box">
        <h2 id="modalTitle">Banear jugador</h2><p id="modalText" class="muted"></p>
        <label for="reason">Motivo de la sanción</label><textarea id="reason" maxlength="500"></textarea>
        <div class="modal-actions"><button id="cancel" type="button">Cancelar</button><button id="confirm" class="danger" type="button">Banear y anular partidas</button></div>
    </div></div>
    <script>
${SESSION_GATE_FN}
        let token = "";
        let selected = null;
        const loginPage = document.getElementById("loginPage");
        const panel = document.getElementById("panel");
        const loginForm = document.getElementById("loginForm");
        const checking = document.getElementById("checking");
        const results = document.getElementById("results");
        const alertBox = document.getElementById("alert");
        const modal = document.getElementById("modal");
        function showLogin() { checking.style.display = "none"; loginForm.style.display = "block"; }
        function showPanel() { loginPage.style.display = "none"; panel.style.display = "block"; }
        function showAlert(message) { alertBox.textContent = message; alertBox.style.display = "block"; }
        gateSession("_superusers", "pb_auth", (freshToken) => { token = freshToken; showPanel(); }, showLogin);
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const response = await fetch("/api/collections/_superusers/auth-with-password", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identity: document.getElementById("identity").value, password: document.getElementById("password").value })
            });
            const data = await response.json();
            if (!response.ok) { showAlert(data.message || "Credenciales incorrectas."); return; }
            token = data.token; localStorage.setItem("pb_auth", JSON.stringify({ token: token, model: data.record })); showPanel();
        });
${API_CALL_FN}
        function render(players) {
            results.textContent = "";
            if (!players.length) { const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "Sin resultados."; results.appendChild(empty); return; }
            players.forEach((player) => {
                const row = document.createElement("div"); row.className = "row";
                const info = document.createElement("div");
                const name = document.createElement("div"); name.className = "name"; name.textContent = player.name || player.username;
                if (player.banned) { const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = "Baneado"; name.appendChild(badge); }
                const stats = document.createElement("div"); stats.className = "stats";
                stats.textContent = "@" + player.username + " · " + player.alliance + " · récord " + player.highScore.toLocaleString("es-CL") + " · aporte " + player.totalScore.toLocaleString("es-CL") + " · " + player.runs + " partidas";
                info.appendChild(name); info.appendChild(stats); row.appendChild(info);
                const action = document.createElement("button"); action.type = "button";
                action.textContent = player.banned ? "Quitar baneo" : "Banear"; action.className = player.banned ? "" : "danger";
                action.addEventListener("click", () => player.banned ? unban(player) : openBan(player));
                row.appendChild(action); results.appendChild(row);
            });
        }
        async function search() {
            const query = document.getElementById("search").value.trim();
            const data = await apiCall("/api/admin/nikita/players?q=" + encodeURIComponent(query), "GET"); render(data.players || []);
        }
        document.getElementById("searchForm").addEventListener("submit", (event) => { event.preventDefault(); search().catch((err) => showAlert(err.message)); });
        function openBan(player) {
            selected = player; document.getElementById("modalText").textContent = "Se anularán " + player.runs + " partidas y " + player.totalScore.toLocaleString("es-CL") + " puntos de " + (player.name || player.username) + ".";
            document.getElementById("reason").value = ""; modal.style.display = "flex";
        }
        document.getElementById("cancel").addEventListener("click", () => { modal.style.display = "none"; selected = null; });
        document.getElementById("confirm").addEventListener("click", async () => {
            if (!selected) return;
            const reason = document.getElementById("reason").value.trim();
            if (reason.length < 3) { showAlert("Escribe el motivo de la sanción."); return; }
            await apiCall("/api/admin/nikita/players/" + selected.id + "/ban", "POST", { reason: reason });
            modal.style.display = "none"; showAlert("Jugador baneado y partidas anuladas."); await search();
        });
        async function unban(player) {
            if (!window.confirm("¿Permitir que " + (player.name || player.username) + " vuelva a jugar? Las partidas anuladas no se restaurarán.")) return;
            await apiCall("/api/admin/nikita/players/" + player.id + "/unban", "POST", {}); showAlert("Baneo retirado. El jugador comienza nuevamente desde cero."); await search();
        }
    </script>
</body>
</html>`;
    return e.html(200, htmlContent);
});

routerAdd("GET", "/api/admin/nikita/players", (e) => {
    const query = String(e.request.url.query().get("q") || "").trim().slice(0, 80);
    if (!query) return e.json(200, { players: [] });
    const rows = arrayOf(new DynamicModel({
        id: "", name: "", username: "", alliance: "", high_score: 0, total_score: 0,
        nikita_banned: false, nikita_ban_reason: "", runs: 0,
    }));
    $app.db().newQuery(
        "SELECT u.id, u.name, u.username, s.alliance, s.high_score, s.total_score, " +
        "s.nikita_banned, s.nikita_ban_reason, " +
        "(SELECT COUNT(*) FROM alliance_nikita_runs r WHERE r.user = u.id AND r.voided = false) AS runs " +
        "FROM users u INNER JOIN alliance_nikita_scores s ON s.user = u.id " +
        "WHERE u.deleted = false AND (u.name LIKE {:q} OR u.username LIKE {:q}) " +
        "ORDER BY s.nikita_banned DESC, s.total_score DESC LIMIT 30"
    ).bind({ q: `%${query}%` }).all(rows);
    return e.json(200, { players: rows.map((row) => ({
        id: row.id, name: row.name, username: row.username, alliance: row.alliance,
        highScore: Number(row.high_score) || 0, totalScore: Number(row.total_score) || 0,
        banned: Boolean(row.nikita_banned), banReason: row.nikita_ban_reason,
        runs: Number(row.runs) || 0,
    })) });
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/nikita/players/{userId}/ban", (e) => {
    const userId = String(e.request.pathValue("userId") || "");
    const reason = String((e.requestInfo().body || {}).reason || "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (reason.length < 3) return e.json(400, { error: "Escribe el motivo de la sanción." });
    let removedPoints = 0;
    let voidedRuns = 0;
    try {
        $app.runInTransaction((txApp) => {
            const membership = txApp.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: userId }
            );
            removedPoints = membership.getInt("total_score") || 0;
            const countRows = arrayOf(new DynamicModel({ total: 0 }));
            txApp.db().newQuery(
                "SELECT COUNT(*) AS total FROM alliance_nikita_runs WHERE user = {:user} AND voided = false"
            ).bind({ user: userId }).all(countRows);
            voidedRuns = countRows.length ? Number(countRows[0].total) || 0 : 0;
            const now = new DateTime().string();
            txApp.db().newQuery(
                "UPDATE alliance_nikita_runs SET voided = true, voided_at = {:now}, " +
                "void_reason = {:reason}, voided_by = {:admin} WHERE user = {:user} AND voided = false"
            ).bind({ now, reason, admin: e.auth.id, user: userId }).execute();
            membership.set("nikita_banned", true);
            membership.set("nikita_banned_at", now);
            membership.set("nikita_ban_reason", reason);
            membership.set("nikita_banned_by", e.auth.id);
            membership.set("high_score", 0);
            membership.set("total_score", 0);
            membership.set("active_run_id", "");
            membership.set("active_seed", 0);
            membership.set("active_started_at", 0);
            txApp.save(membership);
        });
    } catch (err) {
        return e.json(404, { error: "El jugador no participa en Nikita Jump." });
    }
    return e.json(200, { ok: true, removedPoints, voidedRuns });
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/nikita/players/{userId}/unban", (e) => {
    const userId = String(e.request.pathValue("userId") || "");
    try {
        const membership = $app.findFirstRecordByFilter(
            "alliance_nikita_scores", "user = {:user}", { user: userId }
        );
        membership.set("nikita_banned", false);
        membership.set("nikita_banned_at", "");
        membership.set("nikita_ban_reason", "");
        membership.set("nikita_banned_by", "");
        $app.save(membership);
    } catch (err) {
        return e.json(404, { error: "El jugador no participa en Nikita Jump." });
    }
    return e.json(200, { ok: true });
}, $apis.requireSuperuserAuth());
