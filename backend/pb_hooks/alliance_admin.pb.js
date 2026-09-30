/// <reference path="../pb_data/types.d.ts" />

// Resultados oficiales de las disciplinas de Alianzas. La lectura sale por un único
// endpoint acotado; la escritura exige específicamente la cuenta de organización @cei.

routerAdd("GET", "/api/alliances/disciplines", (e) => {
    try {
        const { buildDisciplineList } = require(`${__hooks}/lib/alliances.js`);
        const rows = arrayOf(new DynamicModel({ id: "", name: "", alliance: "", place: 0 }));
        $app.db().newQuery(
            "SELECT d.id, d.name, COALESCE(p.alliance, '') AS alliance, COALESCE(p.place, 0) AS place " +
            "FROM alliance_disciplines d " +
            "LEFT JOIN alliance_placements p ON p.discipline = d.id AND p.deleted = false " +
            "WHERE d.deleted = false ORDER BY d.created ASC, p.place ASC"
        ).all(rows);
        let myAlliance = null;
        try {
            const membership = $app.findFirstRecordByFilter(
                "alliance_nikita_scores", "user = {:user}", { user: e.auth.id }
            );
            myAlliance = membership.getString("alliance") || null;
        } catch (notFound) { /* todavía no elige alianza */ }

        return e.json(200, {
            disciplines: buildDisciplineList(rows),
            myAlliance,
            canChooseAlliance: e.auth.getString("type") === "student",
        });
    } catch (err) {
        console.error("[alliance_admin.pb.js] Error al listar disciplinas:", err);
        return e.json(500, { error: "No se pudieron cargar las disciplinas." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/alliances/admin/disciplines", (e) => {
    try {
        const { isAllianceAdmin, sanitizeDisciplineName } = require(`${__hooks}/lib/alliances.js`);
        if (!isAllianceAdmin(
            e.auth.getString("type"), e.auth.getString("subtype"), e.auth.getString("username")
        )) {
            return e.json(403, { error: "Esta cuenta no administra las alianzas." });
        }

        const discipline = sanitizeDisciplineName((e.requestInfo().body || {}).name);
        if (!discipline) return e.json(400, { error: "Escribe un nombre de al menos 2 caracteres." });

        try {
            $app.findFirstRecordByFilter(
                "alliance_disciplines", "normalized_name = {:name} && deleted = false",
                { name: discipline.normalizedName }
            );
            return e.json(409, { error: "Ya existe una disciplina con ese nombre." });
        } catch (notFound) { /* el nombre está disponible */ }

        const collection = $app.findCollectionByNameOrId("alliance_disciplines");
        const record = new Record(collection);
        record.set("name", discipline.name);
        record.set("normalized_name", discipline.normalizedName);
        record.set("deleted", false);
        $app.save(record);
        return e.json(201, { id: record.id, name: record.getString("name"), placements: [] });
    } catch (err) {
        console.error("[alliance_admin.pb.js] Error al crear disciplina:", err);
        return e.json(500, { error: "No se pudo crear la disciplina." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/alliances/admin/disciplines/{disciplineId}/placements", (e) => {
    try {
        const { isAllianceAdmin, normalizePlacements } = require(`${__hooks}/lib/alliances.js`);
        if (!isAllianceAdmin(
            e.auth.getString("type"), e.auth.getString("subtype"), e.auth.getString("username")
        )) {
            return e.json(403, { error: "Esta cuenta no administra las alianzas." });
        }

        const placements = normalizePlacements((e.requestInfo().body || {}).placements);
        if (!placements) {
            return e.json(400, { error: "Los lugares deben ser números únicos entre 1 y 6." });
        }

        const disciplineId = String(e.request.pathValue("disciplineId") || "");
        let discipline;
        try {
            discipline = $app.findRecordById("alliance_disciplines", disciplineId);
        } catch (notFound) {
            return e.json(404, { error: "La disciplina no existe." });
        }
        if (discipline.getBool("deleted")) return e.json(404, { error: "La disciplina no existe." });

        $app.runInTransaction((txApp) => {
            const active = txApp.findRecordsByFilter(
                "alliance_placements", "discipline = {:discipline} && deleted = false",
                "", 0, 0, { discipline: disciplineId }
            );
            // Primero se cierran todos los resultados anteriores. Así un intercambio
            // de puestos (1.º por 2.º) nunca choca temporalmente con el índice único.
            for (const previous of active) {
                previous.set("deleted", true);
                txApp.save(previous);
            }

            const collection = txApp.findCollectionByNameOrId("alliance_placements");
            for (const placement of placements) {
                const record = new Record(collection);
                record.set("discipline", disciplineId);
                record.set("alliance", placement.alliance);
                record.set("place", placement.place);
                record.set("deleted", false);
                txApp.save(record);
            }
        });

        return e.json(200, { id: disciplineId, placements });
    } catch (err) {
        console.error("[alliance_admin.pb.js] Error al guardar lugares:", err);
        return e.json(500, { error: "No se pudieron guardar los lugares." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/alliances/admin/disciplines/{disciplineId}/archive", (e) => {
    try {
        const { isAllianceAdmin } = require(`${__hooks}/lib/alliances.js`);
        if (!isAllianceAdmin(
            e.auth.getString("type"), e.auth.getString("subtype"), e.auth.getString("username")
        )) {
            return e.json(403, { error: "Esta cuenta no administra las alianzas." });
        }

        const disciplineId = String(e.request.pathValue("disciplineId") || "");
        let discipline;
        try {
            discipline = $app.findRecordById("alliance_disciplines", disciplineId);
        } catch (notFound) {
            return e.json(404, { error: "La disciplina no existe." });
        }
        if (discipline.getBool("deleted")) return e.json(404, { error: "La disciplina no existe." });

        $app.runInTransaction((txApp) => {
            const txDiscipline = txApp.findRecordById("alliance_disciplines", disciplineId);
            txDiscipline.set("deleted", true);
            txApp.save(txDiscipline);
            const placements = txApp.findRecordsByFilter(
                "alliance_placements", "discipline = {:discipline} && deleted = false",
                "", 0, 0, { discipline: disciplineId }
            );
            for (const placement of placements) {
                placement.set("deleted", true);
                txApp.save(placement);
            }
        });
        return e.json(200, { ok: true });
    } catch (err) {
        console.error("[alliance_admin.pb.js] Error al archivar disciplina:", err);
        return e.json(500, { error: "No se pudo archivar la disciplina." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/alliances/admin/professor-claims", (e) => {
    try {
        const { isAllianceAdmin, normalizeProfessorSearch } = require(`${__hooks}/lib/alliances.js`);
        if (!isAllianceAdmin(
            e.auth.getString("type"), e.auth.getString("subtype"), e.auth.getString("username")
        )) {
            return e.json(403, { error: "Esta cuenta no administra las alianzas." });
        }

        const query = e.request.url.query();
        const page = Math.max(1, Math.floor(Number(query.get("page")) || 1));
        const perPage = 50;
        const search = normalizeProfessorSearch(query.get("q"));
        const conditions = ["c.deleted = false", "p.semester = {:semester}"];
        const params = { semester: "20262", limit: perPage, offset: (page - 1) * perPage };
        if (search) {
            conditions.push("p.search_name LIKE {:search}");
            params.search = `%${search}%`;
        }
        const where = conditions.join(" AND ");

        const rows = arrayOf(new DynamicModel({
            id: "", professor_id: "", professor_name: "", alliance: "", photo: "", created: "",
            uploader_name: "", uploader_username: "",
        }));
        $app.db().newQuery(
            "SELECT c.id, p.id AS professor_id, p.name AS professor_name, c.alliance, c.photo, c.created, " +
            "COALESCE(u.name, '') AS uploader_name, COALESCE(u.username, '') AS uploader_username " +
            "FROM alliance_professor_claims c " +
            "INNER JOIN alliance_professors p ON p.id = c.professor " +
            "LEFT JOIN users u ON u.id = c.user " +
            `WHERE ${where} ORDER BY c.created DESC LIMIT {:limit} OFFSET {:offset}`
        ).bind(params).all(rows);

        const totals = arrayOf(new DynamicModel({ total: 0 }));
        $app.db().newQuery(
            "SELECT COUNT(*) AS total FROM alliance_professor_claims c " +
            "INNER JOIN alliance_professors p ON p.id = c.professor " +
            `WHERE ${where}`
        ).bind(params).all(totals);

        const total = totals.length ? Number(totals[0].total) || 0 : 0;
        return e.json(200, {
            claimCollectionId: $app.findCollectionByNameOrId("alliance_professor_claims").id,
            page,
            perPage,
            total,
            totalPages: Math.max(1, Math.ceil(total / perPage)),
            items: rows.map((row) => ({
                id: row.id,
                professorId: row.professor_id,
                professorName: row.professor_name,
                alliance: row.alliance,
                photo: row.photo,
                created: row.created,
                uploaderName: row.uploader_name,
                uploaderUsername: row.uploader_username,
            })),
        });
    } catch (err) {
        console.error("[alliance_admin.pb.js] Error al listar adjudicaciones de Cazaprofes:", err);
        return e.json(500, { error: "No se pudieron cargar las adjudicaciones de Cazaprofes." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/alliances/admin/professor-claims/{claimId}/discard", (e) => {
    try {
        const { isAllianceAdmin } = require(`${__hooks}/lib/alliances.js`);
        if (!isAllianceAdmin(
            e.auth.getString("type"), e.auth.getString("subtype"), e.auth.getString("username")
        )) {
            return e.json(403, { error: "Esta cuenta no administra las alianzas." });
        }

        const claimId = String(e.request.pathValue("claimId") || "");
        let claim;
        try {
            claim = $app.findRecordById("alliance_professor_claims", claimId);
        } catch (notFound) {
            return e.json(404, { error: "La adjudicación no existe." });
        }
        if (claim.getBool("deleted")) {
            return e.json(404, { error: "La adjudicación ya fue descartada." });
        }

        // El registro y su foto se conservan para trazabilidad, pero dejan de ser
        // visibles y el índice parcial libera de inmediato al profesor para otra alianza.
        claim.set("deleted", true);
        $app.save(claim);
        return e.json(200, { ok: true, professorId: claim.getString("professor") });
    } catch (err) {
        console.error("[alliance_admin.pb.js] Error al descartar adjudicación de Cazaprofes:", err);
        return e.json(500, { error: "No se pudo descartar la adjudicación." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/admin/alianzas", (e) => {
    const { PALETTE_CSS, clientSessionGateFn, clientApiCallFn } = require(`${__hooks}/lib/adminUi.js`);
    const SESSION_GATE_FN = clientSessionGateFn();
    const API_CALL_FN = clientApiCallFn("alianzas_auth");

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Administrar Alianzas</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        ${PALETTE_CSS}
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body { background: var(--bg-color); color: var(--text-color); min-height: 100vh; padding: 24px; }
        .page { width: 100%; max-width: 880px; margin: 0 auto; }
        .login-card { width: 100%; max-width: 440px; margin: 60px auto; border: 1px solid var(--border-color); border-radius: 6px; padding: 32px; background: var(--card-bg); }
        h1 { font-size: 24px; margin-bottom: 6px; }
        .subtitle, .hint { color: var(--text-muted); font-size: 13px; line-height: 1.5; }
        .subtitle { margin-bottom: 24px; }
        .form-group { margin-bottom: 16px; }
        label { display: block; color: var(--text-muted); font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        input, select { width: 100%; color: var(--text-color); background: #0f172a; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px; font-size: 14px; }
        input:focus, select:focus { outline: none; border-color: var(--primary-color); }
        .btn { border: 0; border-radius: 6px; padding: 10px 16px; background: var(--primary-color); color: #0f172a; font-size: 14px; font-weight: 700; cursor: pointer; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .btn-secondary { color: var(--text-color); background: transparent; border: 1px solid var(--border-color); }
        .btn-danger { color: #fecaca; background: transparent; border: 1px solid rgba(239,68,68,.55); }
        .alert { display: none; margin-bottom: 16px; border: 1px solid rgba(239,68,68,.45); border-radius: 6px; padding: 10px 12px; color: #fecaca; background: rgba(239,68,68,.1); font-size: 13px; }
        .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
        .new-form { display: flex; gap: 8px; margin-bottom: 24px; }
        .new-form input { flex: 1; }
        .discipline { border-top: 1px solid var(--border-color); padding: 20px 0; }
        .discipline-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .discipline h2 { font-size: 17px; }
        .placement-row { display: grid; grid-template-columns: minmax(110px, 1fr) 120px; gap: 12px; align-items: center; padding: 7px 0; }
        .alliance-name { font-size: 14px; }
        .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        .empty { color: var(--text-muted); border-top: 1px solid var(--border-color); padding: 24px 0; }
        .panel-section { margin-top: 42px; }
        .section-heading { margin-bottom: 18px; }
        .section-heading h2 { font-size: 21px; margin-bottom: 4px; }
        .claim-toolbar { display: flex; gap: 8px; margin-bottom: 14px; }
        .claim-toolbar input { flex: 1; }
        .claim-card { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 16px; align-items: center; border-top: 1px solid var(--border-color); padding: 16px 0; }
        .claim-photo { width: 112px; height: 112px; object-fit: cover; border: 1px solid var(--border-color); border-radius: 6px; background: #020617; cursor: zoom-in; }
        .claim-name { font-size: 16px; font-weight: 700; margin-bottom: 5px; }
        .claim-meta { color: var(--text-muted); font-size: 13px; line-height: 1.5; }
        .pagination { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 16px; }
        @media (max-width: 620px) {
            body { padding: 16px; } .login-card { padding: 24px; } .new-form, .claim-toolbar { flex-direction: column; }
            .claim-card { grid-template-columns: 88px minmax(0, 1fr); align-items: start; }
            .claim-photo { width: 88px; height: 88px; }
            .claim-card .btn-danger { grid-column: 1 / -1; width: 100%; }
        }
    </style>
</head>
<body>
    <div id="loginPage" class="login-card">
        <h1>Administrar alianzas</h1>
        <p id="checkingMsg" class="subtitle">Verificando sesión…</p>
        <div id="loginError" class="alert"></div>
        <form id="loginForm" style="display:none;">
            <div class="form-group">
                <label for="loginIdentity">Usuario o correo de la cuenta CEI</label>
                <input id="loginIdentity" autocomplete="username" required placeholder="cei">
            </div>
            <div class="form-group">
                <label for="loginPassword">Contraseña</label>
                <input id="loginPassword" type="password" autocomplete="current-password" required>
            </div>
            <button class="btn" type="submit">Iniciar sesión</button>
        </form>
    </div>

    <main id="panelPage" class="page" style="display:none;">
        <div class="topbar">
            <div><h1>Disciplinas</h1><p class="hint">Agrega deportes y registra el lugar obtenido por cada alianza.</p></div>
            <button id="logoutBtn" class="btn btn-secondary" type="button">Cerrar sesión</button>
        </div>
        <div id="panelError" class="alert"></div>
        <form id="newDisciplineForm" class="new-form">
            <input id="disciplineName" maxlength="80" required placeholder="Ej. Vóleibol">
            <button class="btn" type="submit">Agregar deporte</button>
        </form>
        <div id="disciplineList"><p class="hint">Cargando…</p></div>

        <section class="panel-section">
            <div class="section-heading">
                <h2>Cazaprofes</h2>
                <p class="hint">Revisa las adjudicaciones vigentes. Al descartar una, deja de sumar y el profesor vuelve a quedar disponible.</p>
            </div>
            <div id="professorError" class="alert"></div>
            <form id="professorSearchForm" class="claim-toolbar">
                <input id="professorSearch" maxlength="80" placeholder="Buscar profesor">
                <button class="btn btn-secondary" type="submit">Buscar</button>
            </form>
            <div id="professorClaimList"><p class="hint">Cargando…</p></div>
            <div class="pagination">
                <button id="previousClaims" class="btn btn-secondary" type="button">Anterior</button>
                <span id="claimPageLabel" class="hint"></span>
                <button id="nextClaims" class="btn btn-secondary" type="button">Siguiente</button>
            </div>
        </section>
    </main>

    <script>
${SESSION_GATE_FN}
        let token = "";
        const allianceOptions = [
            { id: "urbana", label: "Urbana" }, { id: "pop", label: "Pop" },
            { id: "gotico", label: "Gótico" }, { id: "hiphop", label: "Hip-Hop" },
            { id: "punk", label: "Punk" }, { id: "rock", label: "Rock" }
        ];
        const loginPage = document.getElementById("loginPage");
        const panelPage = document.getElementById("panelPage");
        const checkingMsg = document.getElementById("checkingMsg");
        const loginForm = document.getElementById("loginForm");
        const loginError = document.getElementById("loginError");
        const panelError = document.getElementById("panelError");
        const disciplineList = document.getElementById("disciplineList");
        const professorError = document.getElementById("professorError");
        const professorClaimList = document.getElementById("professorClaimList");
        const claimPageLabel = document.getElementById("claimPageLabel");
        const previousClaims = document.getElementById("previousClaims");
        const nextClaims = document.getElementById("nextClaims");
        let professorPage = 1;
        let professorTotalPages = 1;

        function showError(element, message) { element.textContent = message; element.style.display = "block"; }
        function hideError(element) { element.style.display = "none"; element.textContent = ""; }
        function isCei(record) {
            return record && record.type === "organization" && record.subtype === "center"
                && String(record.username || "").toLowerCase() === "ceiuchile";
        }
        function showLogin(hadStaleSession) {
            token = ""; loginPage.style.display = "block"; panelPage.style.display = "none";
            checkingMsg.style.display = "none"; loginForm.style.display = "block";
            if (hadStaleSession) showError(loginError, "Tu sesión expiró. Inicia sesión de nuevo.");
        }
        function showPanel() {
            loginPage.style.display = "none"; panelPage.style.display = "block";
            loadDisciplines(); loadProfessorClaims();
        }

${API_CALL_FN}

        async function loadDisciplines() {
            hideError(panelError);
            disciplineList.textContent = "Cargando…";
            try {
                const data = await apiCall("/api/alliances/disciplines", "GET");
                renderDisciplines(data.disciplines || []);
            } catch (err) { showError(panelError, err.message); }
        }

        function renderDisciplines(disciplines) {
            disciplineList.textContent = "";
            if (!disciplines.length) {
                const empty = document.createElement("p"); empty.className = "empty";
                empty.textContent = "Todavía no hay disciplinas."; disciplineList.appendChild(empty); return;
            }
            disciplines.forEach((discipline) => disciplineList.appendChild(disciplineNode(discipline)));
        }

        function disciplineNode(discipline) {
            const section = document.createElement("section"); section.className = "discipline";
            const header = document.createElement("div"); header.className = "discipline-header";
            const title = document.createElement("h2"); title.textContent = discipline.name;
            const archive = document.createElement("button"); archive.type = "button";
            archive.className = "btn btn-danger"; archive.textContent = "Archivar";
            archive.addEventListener("click", async () => {
                if (!window.confirm("¿Archivar " + discipline.name + " y ocultar sus resultados?")) return;
                archive.disabled = true;
                try { await apiCall("/api/alliances/admin/disciplines/" + discipline.id + "/archive", "POST", {}); await loadDisciplines(); }
                catch (err) { showError(panelError, err.message); archive.disabled = false; }
            });
            header.appendChild(title); header.appendChild(archive); section.appendChild(header);

            const byAlliance = {};
            (discipline.placements || []).forEach((placement) => { byAlliance[placement.alliance] = placement.place; });
            const selects = {};
            allianceOptions.forEach((alliance) => {
                const row = document.createElement("div"); row.className = "placement-row";
                const label = document.createElement("span"); label.className = "alliance-name"; label.textContent = alliance.label;
                const select = document.createElement("select"); select.setAttribute("aria-label", "Lugar de " + alliance.label);
                const pending = document.createElement("option"); pending.value = ""; pending.textContent = "Sin lugar"; select.appendChild(pending);
                for (let place = 1; place <= 6; place++) {
                    const option = document.createElement("option"); option.value = String(place); option.textContent = place + ".º lugar";
                    select.appendChild(option);
                }
                select.value = byAlliance[alliance.id] ? String(byAlliance[alliance.id]) : "";
                selects[alliance.id] = select; row.appendChild(label); row.appendChild(select); section.appendChild(row);
            });

            const actions = document.createElement("div"); actions.className = "actions";
            const save = document.createElement("button"); save.type = "button"; save.className = "btn"; save.textContent = "Guardar lugares";
            save.addEventListener("click", async () => {
                const placements = {}; allianceOptions.forEach((alliance) => { placements[alliance.id] = selects[alliance.id].value; });
                save.disabled = true; hideError(panelError);
                try {
                    await apiCall("/api/alliances/admin/disciplines/" + discipline.id + "/placements", "POST", { placements: placements });
                    await loadDisciplines();
                } catch (err) { showError(panelError, err.message); save.disabled = false; }
            });
            actions.appendChild(save); section.appendChild(actions); return section;
        }

        async function loadProfessorClaims() {
            hideError(professorError);
            professorClaimList.textContent = "Cargando…";
            const search = document.getElementById("professorSearch").value.trim();
            const params = new URLSearchParams({ page: String(professorPage) });
            if (search) params.set("q", search);
            try {
                const data = await apiCall("/api/alliances/admin/professor-claims?" + params.toString(), "GET");
                professorPage = data.page || 1;
                professorTotalPages = data.totalPages || 1;
                if (professorPage > professorTotalPages) {
                    professorPage = professorTotalPages; await loadProfessorClaims(); return;
                }
                renderProfessorClaims(data.items || [], data.claimCollectionId, data.total || 0);
            } catch (err) {
                professorClaimList.textContent = "";
                showError(professorError, err.message);
            }
        }

        function renderProfessorClaims(claims, collectionId, total) {
            professorClaimList.textContent = "";
            claimPageLabel.textContent = "Página " + professorPage + " de " + professorTotalPages + " · " + total + " vigentes";
            previousClaims.disabled = professorPage <= 1;
            nextClaims.disabled = professorPage >= professorTotalPages;
            if (!claims.length) {
                const empty = document.createElement("p"); empty.className = "empty";
                empty.textContent = "No hay adjudicaciones vigentes para esta búsqueda.";
                professorClaimList.appendChild(empty); return;
            }
            claims.forEach((claim) => professorClaimList.appendChild(professorClaimNode(claim, collectionId)));
        }

        function professorClaimNode(claim, collectionId) {
            const card = document.createElement("article"); card.className = "claim-card";
            const photoLink = document.createElement("a");
            const basePhotoUrl = "/api/files/" + encodeURIComponent(collectionId) + "/" + encodeURIComponent(claim.id) + "/" + encodeURIComponent(claim.photo);
            photoLink.href = basePhotoUrl; photoLink.target = "_blank"; photoLink.rel = "noopener noreferrer";
            const photo = document.createElement("img"); photo.className = "claim-photo";
            photo.src = basePhotoUrl + "?thumb=200x200"; photo.alt = "Foto adjudicada de " + claim.professorName;
            photoLink.appendChild(photo); card.appendChild(photoLink);

            const info = document.createElement("div");
            const name = document.createElement("p"); name.className = "claim-name"; name.textContent = claim.professorName;
            const alliance = allianceOptions.find((option) => option.id === claim.alliance);
            const details = document.createElement("p"); details.className = "claim-meta";
            const uploader = claim.uploaderName || (claim.uploaderUsername ? "@" + claim.uploaderUsername : "Cuenta eliminada");
            const date = claim.created ? new Date(claim.created).toLocaleString("es-CL") : "Fecha desconocida";
            details.textContent = (alliance ? alliance.label : claim.alliance) + " · Subida por " + uploader + " · " + date;
            info.appendChild(name); info.appendChild(details); card.appendChild(info);

            const discard = document.createElement("button"); discard.type = "button";
            discard.className = "btn btn-danger"; discard.textContent = "Descartar y liberar";
            discard.addEventListener("click", async () => {
                if (!window.confirm("¿Descartar la adjudicación de " + claim.professorName + "? Dejará de sumar y podrá ser reclamado nuevamente.")) return;
                discard.disabled = true; hideError(professorError);
                try {
                    await apiCall("/api/alliances/admin/professor-claims/" + encodeURIComponent(claim.id) + "/discard", "POST", {});
                    await loadProfessorClaims();
                } catch (err) { showError(professorError, err.message); discard.disabled = false; }
            });
            card.appendChild(discard); return card;
        }

        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault(); hideError(loginError);
            try {
                const response = await fetch("/api/collections/users/auth-with-password", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identity: document.getElementById("loginIdentity").value, password: document.getElementById("loginPassword").value })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Credenciales incorrectas.");
                if (!isCei(data.record)) throw new Error("Esta cuenta no administra las alianzas.");
                token = data.token; localStorage.setItem("alianzas_auth", JSON.stringify({ token: token, model: data.record })); showPanel();
            } catch (err) { showError(loginError, err.message); }
        });
        document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.removeItem("alianzas_auth"); showLogin(false); });
        document.getElementById("newDisciplineForm").addEventListener("submit", async (event) => {
            event.preventDefault(); hideError(panelError);
            const input = document.getElementById("disciplineName"); const button = event.currentTarget.querySelector("button"); button.disabled = true;
            try { await apiCall("/api/alliances/admin/disciplines", "POST", { name: input.value }); input.value = ""; await loadDisciplines(); }
            catch (err) { showError(panelError, err.message); }
            finally { button.disabled = false; }
        });
        document.getElementById("professorSearchForm").addEventListener("submit", (event) => {
            event.preventDefault(); professorPage = 1; loadProfessorClaims();
        });
        previousClaims.addEventListener("click", () => {
            if (professorPage <= 1) return; professorPage -= 1; loadProfessorClaims();
        });
        nextClaims.addEventListener("click", () => {
            if (professorPage >= professorTotalPages) return; professorPage += 1; loadProfessorClaims();
        });

        gateSession("users", "alianzas_auth", (freshToken, record) => {
            if (!isCei(record)) { localStorage.removeItem("alianzas_auth"); showLogin(false); showError(loginError, "Esta cuenta no administra las alianzas."); return; }
            token = freshToken; showPanel();
        }, showLogin);
    </script>
</body>
</html>`;
    return e.html(200, htmlContent);
});
