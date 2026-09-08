/// <reference path="../pb_data/types.d.ts" />

// Panel de administración para crear álbumes de figuritas y decidir qué ligas entran
// en cada uno (una Copa CDI masculina/femenina/mixta del mismo año puede compartir un
// solo álbum). Autenticado con superusuario real, mismo patrón que /admin/cuentas —
// a propósito NO es /admin/liga: activar un álbum es una decisión del administrador
// del sitio, no de la propia liga.
//
// Cada routerAdd corre en su propia VM (CLAUDE.md §2.1): todo require() va dentro del
// handler.

routerAdd("GET", "/admin/album", (e) => {
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
    <title>Álbumes - Beauchapp</title>
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
        .page { max-width: 720px; margin: 0 auto; }
        .container {
            width: 100%; max-width: 440px; margin: 60px auto; background: var(--card-bg);
            backdrop-filter: blur(16px); border: 1px solid var(--border-color); border-radius: 24px;
            padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3); text-align: center;
        }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
        h2 { font-size: 15px; font-weight: 700; margin-bottom: 10px; }
        .subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.5; }
        .form-group { text-align: left; margin-bottom: 16px; }
        label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        input[type="text"] {
            width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color);
            border-radius: 10px; padding: 11px 14px; color: var(--text-color); font-size: 14px; outline: none;
        }
        input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15); }
        .btn {
            background: var(--primary-color); color: #0f172a; border: none; border-radius: 10px;
            padding: 10px 14px; font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .btn:hover { background: var(--primary-hover); }
        .btn-secondary { background: transparent; color: var(--text-muted); border: 1px solid var(--border-color); }
        .btn-danger { background: var(--danger-color); color: #fff; }
        .alert {
            padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px;
            text-align: left; display: none;
        }
        .alert-danger { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
        .alert-success { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #86efac; }
        .card {
            background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px;
            padding: 20px; margin-bottom: 16px; text-align: left;
        }
        .card-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
        .card-header .name { font-size: 15px; font-weight: 700; }
        .status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 6px; }
        .status-on { background: rgba(34, 197, 94, 0.15); color: var(--success-color); }
        .status-off { background: rgba(148, 163, 184, 0.15); color: var(--text-muted); }
        .league-list { margin: 12px 0; max-height: 220px; overflow-y: auto; }
        .league-save-hint { font-size: 11px; color: var(--text-muted); font-style: italic; margin-bottom: 4px; }
        .league-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 0; font-size: 13px; }
        .league-item input { width: auto; }
        .league-item-checkbox { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
        .league-category-select {
            background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px;
            padding: 4px 8px; color: var(--text-color); font-size: 12px; outline: none; flex-shrink: 0;
        }
        .league-category-select:disabled { opacity: 0.4; }
        .card-actions { display: flex; gap: 8px; margin-top: 12px; }
        .empty { color: var(--text-muted); font-size: 13px; font-style: italic; padding: 8px 0; }
        .top-actions { display: flex; justify-content: flex-end; margin-bottom: 12px; }
        .palette-block { margin: 14px 0; }
        .palette-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
        .palette-slot { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .palette-slot-name { font-size: 12px; color: var(--text-muted); width: 76px; flex-shrink: 0; }
        .palette-swatches { display: flex; flex-wrap: wrap; gap: 6px; }
        .swatch {
            width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent;
            cursor: pointer; box-sizing: border-box;
        }
        .swatch-selected { border-color: #ffffff; transform: scale(1.15); }
        .cover-row { display: flex; align-items: center; gap: 12px; }
        .cover-preview {
            width: 64px; height: 64px; border-radius: 10px; object-fit: cover;
            border: 1px solid var(--border-color); background: rgba(15, 23, 42, 0.6);
        }
        .cover-empty {
            width: 64px; height: 64px; border-radius: 10px; border: 1px dashed var(--border-color);
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; color: var(--text-muted); text-align: center; padding: 4px;
        }
        .cover-actions { display: flex; flex-direction: column; gap: 6px; }
        .cover-upload-label { display: inline-block; text-align: center; }
    </style>
</head>
<body>
    <div id="loginWrap">
        <div class="container" id="loginContainer">
            <h1>Álbumes</h1>
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
                <button type="submit" class="btn" style="width: 100%; margin-top: 6px;">Iniciar Sesión</button>
            </form>
        </div>
    </div>

    <div class="page" id="panelPage" style="display: none;">
        <h1 style="margin-bottom: 4px;">Álbumes</h1>
        <p class="subtitle">Un álbum puede juntar varias ligas (ej. Copa CDI masculina/femenina/mixta) — las figuritas son los jugadores de los equipos de las ligas elegidas. Comprar sobres cuesta BeauTokens.</p>
        <div class="top-actions"><button class="btn btn-secondary" id="logoutBtn">Cerrar Sesión</button></div>
        <div class="alert alert-danger" id="errorAlert"></div>
        <div class="alert alert-success" id="successAlert"></div>

        <div class="card">
            <h2>Crear álbum</h2>
            <div class="form-group" style="margin-bottom: 8px;">
                <input type="text" id="newAlbumName" placeholder="Nombre del álbum (ej. Copa CDI 2026)">
            </div>
            <button class="btn" id="createAlbumBtn">Crear álbum</button>
        </div>

        <div id="albumsList"></div>
    </div>

    <script>
${SESSION_GATE_FN}
${ESC_FN}

        let token = "";
        let leagues = [];
        let albumsCollectionId = "";

        // Solo lectura del blob (thumb chico, panel angosto) — el propio field cover
        // no es "protected", así que no hace falta viajar el token acá (mismo motivo
        // por el que Image en el frontend nunca manda Authorization, ver getFileUrl
        // en frontend/src/services/pocketbase.ts).
        function fileUrl(collectionId, id, filename, thumb) {
            return "/api/files/" + collectionId + "/" + id + "/" + filename + (thumb ? "?thumb=" + thumb : "");
        }

        // Misma lista que "values" del campo paletteColorN en
        // 1790700200_add_palette_to_albums.js — tiene que coincidir carácter por
        // carácter, PocketBase rechaza cualquier valor fuera de esa lista.
        const PALETTE_VALUES = [
            "#DC2626", "#EA580C", "#D97706", "#CA8A04",
            "#65A30D", "#16A34A", "#059669", "#0D9488",
            "#0891B2", "#2563EB", "#4F46E5", "#7C3AED",
            "#9333EA", "#C026D3", "#DB2777", "#57534E",
            "#000000", "#FFFFFF",
        ];
        const PALETTE_SLOTS = [
            { field: "paletteColor1", label: "Color 1" },
            { field: "paletteColor2", label: "Color 2" },
            { field: "paletteColor3", label: "Color 3" },
        ];
        // Mismos 3 valores que CATEGORY_VALUES en lib/album.js (no se puede reusar esa
        // lista acá: este script corre en el navegador, no en la VM de hooks) — la
        // lámina de plantel del álbum los muestra abreviados (MAS/FEM/MIX) en el
        // cuadrado de la esquina superior derecha, o "-" si queda "Sin categoría".
        const CATEGORY_OPTIONS = [
            { value: "", label: "Sin categoría" },
            { value: "masc", label: "Masculina" },
            { value: "fem", label: "Femenina" },
            { value: "mixto", label: "Mixta" },
        ];

        const loginWrap = document.getElementById("loginWrap");
        const panelPage = document.getElementById("panelPage");
        const checkingMsg = document.getElementById("checkingMsg");
        const loginForm = document.getElementById("loginForm");
        const loginErrorAlert = document.getElementById("loginErrorAlert");
        const errorAlert = document.getElementById("errorAlert");
        const successAlert = document.getElementById("successAlert");
        const albumsList = document.getElementById("albumsList");

        function showError(msg) { errorAlert.textContent = msg; errorAlert.style.display = "block"; successAlert.style.display = "none"; }
        function showSuccess(msg) { successAlert.textContent = msg; successAlert.style.display = "block"; errorAlert.style.display = "none"; }
        function showLoginError(msg) { loginErrorAlert.textContent = msg; loginErrorAlert.style.display = "block"; }

        function showPanel() { loginWrap.style.display = "none"; panelPage.style.display = "block"; loadAll(); }
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

        function renderAlbums(albums) {
            albumsList.innerHTML = "";
            if (!albums.length) {
                albumsList.innerHTML = '<div class="empty">Todavía no hay álbumes creados.</div>';
                return;
            }
            albums.forEach((album) => {
                const card = document.createElement("div");
                card.className = "card";

                const leagueItemsHtml = leagues.map((l) => {
                    const checked = album.leagueIds.includes(l.id);
                    const category = (album.leagueCategories && album.leagueCategories[l.id]) || "";
                    const categoryOptionsHtml = CATEGORY_OPTIONS.map((opt) =>
                        '<option value="' + opt.value + '"' + (opt.value === category ? " selected" : "") + '>' + opt.label + '</option>'
                    ).join("");
                    return (
                        '<div class="league-item">' +
                            '<label class="league-item-checkbox"><input type="checkbox" value="' + esc(l.id) + '" ' + (checked ? "checked" : "") + '> ' + esc(l.name) + '</label>' +
                            '<select class="league-category-select" data-league-id="' + esc(l.id) + '"' + (checked ? "" : " disabled") + '>' + categoryOptionsHtml + '</select>' +
                        '</div>'
                    );
                }).join("") || '<div class="empty">No hay cuentas de liga todavía.</div>';

                const paletteHtml = PALETTE_SLOTS.map((slot) => {
                    const current = album[slot.field] || "";
                    const swatchesHtml = PALETTE_VALUES.map((hex) => {
                        const selected = hex === current ? " swatch-selected" : "";
                        return '<div class="swatch' + selected + '" data-field="' + slot.field + '" data-hex="' + hex + '" style="background:' + hex + '"></div>';
                    }).join("");
                    return (
                        '<div class="palette-slot">' +
                            '<span class="palette-slot-name">' + slot.label + '</span>' +
                            '<div class="palette-swatches">' + swatchesHtml + '</div>' +
                        '</div>'
                    );
                }).join("");

                const coverUrl = album.cover ? fileUrl(albumsCollectionId, album.id, album.cover, "200x200") : "";

                card.innerHTML =
                    '<div class="card-header">' +
                        '<span class="name">' + esc(album.name) + '</span>' +
                        '<span class="status ' + (album.enabled ? "status-on" : "status-off") + '">' + (album.enabled ? "Activo" : "Inactivo") + '</span>' +
                    '</div>' +
                    '<div class="palette-block">' +
                        '<div class="palette-label">Portada del álbum</div>' +
                        '<div class="cover-row">' +
                            (coverUrl
                                ? '<img class="cover-preview" src="' + coverUrl + '">'
                                : '<div class="cover-empty">Sin portada</div>') +
                            '<div class="cover-actions">' +
                                '<label class="btn btn-secondary cover-upload-label">' + (coverUrl ? "Cambiar" : "Subir imagen") +
                                    '<input type="file" accept="image/jpeg,image/png,image/webp" class="cover-input" style="display:none">' +
                                '</label>' +
                                (coverUrl ? '<button class="btn btn-secondary cover-remove-btn">Quitar</button>' : "") +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="palette-block">' +
                        '<div class="palette-label">Paleta del álbum (fondo y marco de las páginas)</div>' +
                        paletteHtml +
                    '</div>' +
                    '<div class="league-list">' + leagueItemsHtml + '</div>' +
                    '<div class="league-save-hint">Cada casillero (y cada color) se guarda solo, al tocarlo.</div>' +
                    '<div class="card-actions">' +
                        '<button class="btn ' + (album.enabled ? "btn-secondary" : "") + ' toggle-btn">' + (album.enabled ? "Desactivar" : "Activar") + '</button>' +
                    '</div>';

                // Portada: PATCH directo a la colección (no a /api/admin/album/*) porque
                // subir un archivo necesita multipart/form-data — el token de _superusers
                // ya bypassa la updateRule null de "albums" sin nada más. Se recarga toda
                // la lista al terminar, mismo patrón que el botón Activar/Desactivar más
                // abajo, para no tener que reconstruir la card a mano.
                const coverInput = card.querySelector(".cover-input");
                coverInput.addEventListener("change", async () => {
                    const file = coverInput.files[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append("cover", file);
                    try {
                        const res = await fetch("/api/collections/albums/records/" + album.id, {
                            method: "PATCH",
                            headers: { "Authorization": "Bearer " + token },
                            body: formData,
                        });
                        const updated = await res.json();
                        if (!res.ok) throw new Error(updated.message || "No se pudo subir la portada.");
                        showSuccess('Portada de "' + album.name + '" actualizada.');
                        loadAll();
                    } catch (err) {
                        showError(err.message);
                    }
                });

                const coverRemoveBtn = card.querySelector(".cover-remove-btn");
                if (coverRemoveBtn) {
                    coverRemoveBtn.addEventListener("click", async () => {
                        try {
                            const res = await fetch("/api/collections/albums/records/" + album.id, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                                body: JSON.stringify({ cover: "" }),
                            });
                            const updated = await res.json();
                            if (!res.ok) throw new Error(updated.message || "No se pudo quitar la portada.");
                            showSuccess('Portada de "' + album.name + '" eliminada.');
                            loadAll();
                        } catch (err) {
                            showError(err.message);
                        }
                    });
                }

                card.querySelectorAll('.swatch').forEach((swatchEl) => {
                    swatchEl.addEventListener("click", async () => {
                        const field = swatchEl.getAttribute("data-field");
                        const hex = swatchEl.getAttribute("data-hex");
                        if (album[field] === hex) return;
                        const prev = album[field];
                        album[field] = hex;
                        card.querySelectorAll('.swatch[data-field="' + field + '"]').forEach((s) => {
                            s.classList.toggle("swatch-selected", s.getAttribute("data-hex") === hex);
                        });
                        try {
                            await apiCall("/api/admin/album/set-palette", "POST", {
                                albumId: album.id,
                                paletteColor1: album.paletteColor1 || "",
                                paletteColor2: album.paletteColor2 || "",
                                paletteColor3: album.paletteColor3 || "",
                            });
                            showSuccess('Paleta de "' + album.name + '" actualizada.');
                        } catch (err) {
                            album[field] = prev; // la escritura falló: revertir
                            card.querySelectorAll('.swatch[data-field="' + field + '"]').forEach((s) => {
                                s.classList.toggle("swatch-selected", s.getAttribute("data-hex") === prev);
                            });
                            showError(err.message);
                        }
                    });
                });

                // Cada casillero se guarda apenas se toca — un botón "Guardar ligas"
                // aparte permitía marcar casilleros y después perderlos sin darse cuenta
                // (ej. tocando "Activar" antes, que refresca la tarjeta desde el servidor
                // y los pisa). Sin ese paso intermedio no hay estado que se pueda perder.
                card.querySelectorAll('.league-item input').forEach((checkbox) => {
                    checkbox.addEventListener("change", async () => {
                        const leagueIds = Array.from(card.querySelectorAll('.league-item input:checked')).map((i) => i.value);
                        const select = checkbox.closest(".league-item").querySelector(".league-category-select");
                        checkbox.disabled = true;
                        try {
                            await apiCall("/api/admin/album/set-leagues", "POST", { albumId: album.id, leagueIds });
                            album.leagueIds = leagueIds;
                            // Desmarcarla no borra su categoría en el servidor (ver
                            // set-leagues, ya no borra-y-recrea) — pero el selector se
                            // deshabilita igual: no tiene sentido tocarla mientras esa
                            // liga no forma parte del álbum.
                            select.disabled = !checkbox.checked;
                            showSuccess('Ligas de "' + album.name + '" actualizadas.');
                        } catch (err) {
                            checkbox.checked = !checkbox.checked; // la escritura falló: revertir el casillero
                            showError(err.message);
                        } finally {
                            checkbox.disabled = false;
                        }
                    });
                });

                // Misma categoría se guarda sola al elegirla, sin pasar por
                // set-leagues (ver el comentario grande sobre set-league-category).
                card.querySelectorAll('.league-category-select').forEach((select) => {
                    select.addEventListener("change", async () => {
                        const leagueId = select.getAttribute("data-league-id");
                        const category = select.value;
                        const prev = (album.leagueCategories && album.leagueCategories[leagueId]) || "";
                        select.disabled = true;
                        try {
                            await apiCall("/api/admin/album/set-league-category", "POST", { albumId: album.id, leagueId, category });
                            if (!album.leagueCategories) album.leagueCategories = {};
                            album.leagueCategories[leagueId] = category;
                            showSuccess('Categoría actualizada en "' + album.name + '".');
                        } catch (err) {
                            select.value = prev; // la escritura falló: revertir el selector
                            showError(err.message);
                        } finally {
                            select.disabled = false;
                        }
                    });
                });
                card.querySelector(".toggle-btn").addEventListener("click", async () => {
                    try {
                        await apiCall("/api/admin/album/toggle", "POST", { albumId: album.id, enabled: !album.enabled });
                        showSuccess('Álbum "' + album.name + '" ' + (album.enabled ? "desactivado" : "activado") + '.');
                        loadAll();
                    } catch (err) {
                        showError(err.message);
                    }
                });

                albumsList.appendChild(card);
            });
        }

        function loadAll() {
            apiCall("/api/admin/album/list", "GET")
                .then((data) => {
                    leagues = data.leagues || [];
                    albumsCollectionId = data.albumsCollectionId || "";
                    renderAlbums(data.albums || []);
                })
                .catch((err) => showError(err.message));
        }

        document.getElementById("createAlbumBtn").addEventListener("click", async () => {
            const input = document.getElementById("newAlbumName");
            const name = input.value.trim();
            if (!name) { showError("El nombre del álbum es requerido."); return; }
            try {
                await apiCall("/api/admin/album/create", "POST", { name });
                input.value = "";
                showSuccess('Álbum "' + name + '" creado.');
                loadAll();
            } catch (err) {
                showError(err.message);
            }
        });
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

routerAdd("GET", "/api/admin/album/list", (e) => {
    try {
        const albums = $app.findRecordsByFilter("albums", "", "-created", 200, 0, {});
        const albumLeagueRows = $app.findRecordsByFilter("album_leagues", "", "", 2000, 0, {});
        const leagueIdsByAlbum = {};
        // Categoría (masc/fem/mixto) elegida para cada liga DENTRO de cada álbum — clave
        // "albumId:leagueId" porque la misma liga podría (en teoría) entrar a más de un
        // álbum con una categoría distinta en cada uno (ver 1791300000_add_category_to_album_leagues.js).
        const categoryByAlbumLeague = {};
        albumLeagueRows.forEach((r) => {
            const albumId = r.getString("album");
            if (!leagueIdsByAlbum[albumId]) leagueIdsByAlbum[albumId] = [];
            leagueIdsByAlbum[albumId].push(r.getString("league"));
            categoryByAlbumLeague[albumId + ":" + r.getString("league")] = r.getString("category");
        });

        const leagues = $app
            .findRecordsByFilter("users", "type = 'organization' && subtype = 'league' && deleted = false", "name", 500, 0, {})
            .map((r) => ({ id: r.id, name: r.getString("name") }));

        return e.json(200, {
            albums: albums.map((a) => ({
                id: a.id,
                name: a.getString("name"),
                enabled: a.getBool("enabled"),
                leagueIds: leagueIdsByAlbum[a.id] || [],
                leagueCategories: (leagueIdsByAlbum[a.id] || []).reduce((acc, leagueId) => {
                    acc[leagueId] = categoryByAlbumLeague[a.id + ":" + leagueId] || "";
                    return acc;
                }, {}),
                paletteColor1: a.getString("paletteColor1"),
                paletteColor2: a.getString("paletteColor2"),
                paletteColor3: a.getString("paletteColor3"),
                cover: a.getString("cover"),
            })),
            leagues,
            // Para armar la URL de la portada en el panel (GET /api/files/:collectionId/:id/:filename)
            // sin pasar por un endpoint propio: la subida/borrado también van directo contra
            // /api/collections/albums/records/:id con el token de _superusers, que bypassa la
            // updateRule null de `albums` igual que $app.* en el resto de este archivo.
            albumsCollectionId: $app.findCollectionByNameOrId("albums").id,
        });
    } catch (err) {
        console.error("[admin_album.pb.js] Error en GET /api/admin/album/list:", err);
        return e.json(500, { error: "No se pudieron cargar los álbumes." });
    }
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/album/create", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const name = String(body.name || "").trim();
        if (!name) throw new BadRequestError("El nombre del álbum es requerido.");

        const album = new Record($app.findCollectionByNameOrId("albums"));
        album.set("name", name);
        album.set("enabled", false);
        $app.save(album);

        return e.json(200, { success: true, id: album.id });
    } catch (err) {
        console.error("[admin_album.pb.js] Error en POST /api/admin/album/create:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo crear el álbum." });
    }
}, $apis.requireSuperuserAuth());

routerAdd("POST", "/api/admin/album/toggle", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const albumId = String(body.albumId || "");
        if (!albumId) throw new BadRequestError("Falta el id del álbum.");

        const album = $app.findRecordById("albums", albumId);
        album.set("enabled", Boolean(body.enabled));
        $app.save(album);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[admin_album.pb.js] Error en POST /api/admin/album/toggle:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo actualizar el álbum." });
    }
}, $apis.requireSuperuserAuth());

// Los 3 colores se mandan siempre juntos (el swatch que cambia el cliente ya trae los
// otros dos sin tocar) — más simple que un endpoint por slot, y evita una condición de
// carrera si alguien toca dos swatches casi al mismo tiempo.
routerAdd("POST", "/api/admin/album/set-palette", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const albumId = String(body.albumId || "");
        if (!albumId) throw new BadRequestError("Falta el id del álbum.");

        const album = $app.findRecordById("albums", albumId);
        album.set("paletteColor1", String(body.paletteColor1 || ""));
        album.set("paletteColor2", String(body.paletteColor2 || ""));
        album.set("paletteColor3", String(body.paletteColor3 || ""));
        $app.save(album);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[admin_album.pb.js] Error en POST /api/admin/album/set-palette:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo actualizar la paleta." });
    }
}, $apis.requireSuperuserAuth());

// Reemplazo de las ligas de un álbum — borra las que se desmarcaron e inserta las
// nuevas, pero NO toca las que ya estaban (a diferencia de un borra-todo-y-recrea, que
// hubiera perdido la categoría ya elegida de cada liga que sigue marcada — ver
// set-league-category más abajo — cada vez que se toca un solo casillero).
routerAdd("POST", "/api/admin/album/set-leagues", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const albumId = String(body.albumId || "");
        const leagueIds = Array.isArray(body.leagueIds) ? body.leagueIds.map(String) : [];
        if (!albumId) throw new BadRequestError("Falta el id del álbum.");

        $app.findRecordById("albums", albumId); // valida que exista

        $app.runInTransaction((txApp) => {
            const existing = txApp.findRecordsByFilter("album_leagues", "album = {:a}", "", 500, 0, { a: albumId });
            const existingLeagueIds = existing.map((r) => r.getString("league"));

            existing.forEach((r) => {
                if (!leagueIds.includes(r.getString("league"))) txApp.delete(r);
            });

            leagueIds.forEach((leagueId) => {
                if (existingLeagueIds.includes(leagueId)) return;
                const row = new Record(txApp.findCollectionByNameOrId("album_leagues"));
                row.set("album", albumId);
                row.set("league", leagueId);
                txApp.save(row);
            });
        });

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[admin_album.pb.js] Error en POST /api/admin/album/set-leagues:", err);
        return e.json(400, { error: (err && err.message) || "No se pudieron guardar las ligas del álbum." });
    }
}, $apis.requireSuperuserAuth());

// Categoría (masc/fem/mixto) de una liga DENTRO de un álbum — separado de set-leagues
// porque se guarda "solo, al tocarlo" (mismo criterio que el resto del panel) sin
// disparar el reemplazo completo de ligas.
routerAdd("POST", "/api/admin/album/set-league-category", (e) => {
    try {
        const { CATEGORY_VALUES } = require(`${__hooks}/lib/album.js`);
        const body = e.requestInfo().body || {};
        const albumId = String(body.albumId || "");
        const leagueId = String(body.leagueId || "");
        const category = String(body.category || "");
        if (!albumId || !leagueId) throw new BadRequestError("Faltan datos.");
        if (category && CATEGORY_VALUES.indexOf(category) === -1) {
            throw new BadRequestError("Categoría inválida.");
        }

        let row;
        try {
            row = $app.findFirstRecordByFilter("album_leagues", "album = {:a} && league = {:l}", { a: albumId, l: leagueId });
        } catch (err) {
            throw new BadRequestError("Esa liga no pertenece a ese álbum.");
        }
        row.set("category", category);
        $app.save(row);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[admin_album.pb.js] Error en POST /api/admin/album/set-league-category:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo actualizar la categoría." });
    }
}, $apis.requireSuperuserAuth());
