/// <reference path="../pb_data/types.d.ts" />

// ---------------------------------------------------------------------------------
// Gestión de ligas — a diferencia de /admin/horarios (superusuario), esta herramienta
// se autentica con la propia cuenta de organización de la liga (type=organization,
// subtype=league). No existe una colección "leagues" separada: la cuenta de usuario
// ES la liga, así que cada ruta opera siempre sobre "mi propia liga" (e.auth.id), sin
// necesidad de un parámetro leagueId ni de chequear ownership contra otro id.
// ---------------------------------------------------------------------------------

routerAdd("GET", "/admin/liga", (e) => {
    const { PALETTE_CSS, CALENDAR_CSS, clientCalendarFns, clientSessionGateFn, clientApiCallFn } = require(`${__hooks}/lib/adminUi.js`);
    const CALENDAR_FNS = clientCalendarFns();
    const SESSION_GATE_FN = clientSessionGateFn();
    const API_CALL_FN = clientApiCallFn("liga_auth");

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestionar Liga</title>
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
            width: 100%;
            max-width: 480px;
            margin: 60px auto;
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            text-align: center;
        }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        h2 { font-size: 16px; font-weight: 700; margin: 28px 0 14px; }
        .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }
        .card { background: var(--card-bg); backdrop-filter: blur(16px); border: 1px solid var(--border-color); border-radius: 18px; padding: 24px; margin-bottom: 20px; }
        .form-group { text-align: left; margin-bottom: 16px; }
        label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        input[type="email"], input[type="password"], input[type="text"] {
            width: 100%; background: rgba(15,23,42,0.6); border: 1px solid var(--border-color);
            border-radius: 10px; padding: 10px 14px; color: var(--text-color); font-size: 14px; outline: none;
        }
        input:focus { border-color: var(--primary-color); }
        .hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
        .btn {
            background: var(--primary-color); color: #0f172a; border: none; border-radius: 10px;
            padding: 10px 18px; font-size: 14px; font-weight: 700; cursor: pointer;
        }
        .btn:hover { background: var(--primary-hover); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: rgba(255,255,255,0.05); color: var(--text-color); border: 1px solid var(--border-color); }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }
        .btn-sm { padding: 6px 12px; font-size: 12px; margin-right: 6px; margin-top: 6px; }
        .btn-icon { padding: 4px 8px; line-height: 1; }
        .btn-accept { background: var(--success-color); color: #05230f; }
        .btn-reject { background: rgba(255,255,255,0.05); color: var(--text-color); border: 1px solid var(--border-color); }
        .btn-danger { background: var(--danger-color); color: #fff; }
        .alert { padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; text-align: left; display: none; }
        .alert-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        #logoutBar { text-align: right; margin-bottom: 16px; }
        .team-checkbox-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 13px; }
        .match-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 13px; gap: 10px; }
        .match-row .gap-tag { font-size: 11px; color: var(--text-muted); }
        .match-actions { display: flex; gap: 6px; flex-shrink: 0; }
        select { background: rgba(15,23,42,0.6); border: 1px solid var(--border-color); border-radius: 10px; padding: 8px 12px; color: var(--text-color); font-size: 13px; width: 100%; margin-bottom: 10px; }
        /* Secciones que se consultan de vez en cuando (la polla y el roster de equipos)
           arrancan cerradas: el panel se usa sobre todo para etapas y partidos, y con
           todo abierto esas dos empujaban lo importante fuera de la primera pantalla.
           <details> nativo — sin JS, y el estado lo maneja el navegador. */
        .card-collapsible > summary {
            font-size: 16px; font-weight: 700; cursor: pointer; list-style: none;
            display: flex; align-items: center; gap: 8px; user-select: none;
        }
        .card-collapsible > summary::-webkit-details-marker { display: none; }
        .card-collapsible > summary::before {
            content: ''; width: 0; height: 0; flex: none;
            border-left: 5px solid var(--text-muted);
            border-top: 4px solid transparent; border-bottom: 4px solid transparent;
            transition: transform .15s ease;
        }
        .card-collapsible[open] > summary::before { transform: rotate(90deg); }
        .card-collapsible[open] > summary { margin-bottom: 14px; }
        .card-collapsible > summary:hover { color: var(--primary-color); }
        /* Fila de encabezado de una tarjeta: título a un lado, acción al otro. */
        .card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .card-header h2 { margin: 0; }
        .card-header .btn { margin-top: 0; }
        /* Fila de una etapa en el listado: clickeable entera, no solo un botón. */
        .stage-row {
            display: flex; align-items: center; gap: 8px;
            padding: 10px 0; border-bottom: 1px solid var(--border-color);
        }
        .stage-row:last-child { border-bottom: none; }
        .stage-open { flex: 1; display: flex; align-items: center; gap: 10px; cursor: pointer; text-align: left; background: none; border: none; color: var(--text-color); font-size: 14px; font-family: inherit; padding: 0; }
        .stage-open:hover .stage-name { color: var(--primary-color); }
        .stage-name { font-weight: 600; }
        .stage-type { font-size: 11px; color: var(--text-muted); }
        /* Modal */
        .modal-backdrop {
            display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6);
            align-items: center; justify-content: center; padding: 24px; z-index: 50;
        }
        .modal-backdrop.open { display: flex; }
        .modal-box {
            width: 100%; max-width: 420px; background: #1e293b;
            border: 1px solid var(--border-color); border-radius: 18px; padding: 24px;
        }
        .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
        .modal-actions .btn { margin-top: 0; margin-right: 0; }
        /* Variante más ancha, con scroll propio: el modal de partido retroactivo tiene
           contenido dinámico (filas de goles/tarjetas/penales) que puede crecer bastante. */
        .modal-box-lg { max-width: 560px; max-height: 85vh; overflow-y: auto; }
        .form-row { display: flex; gap: 10px; }
        .form-row > .form-group { flex: 1; min-width: 0; }
        textarea {
            width: 100%; background: rgba(15,23,42,0.6); border: 1px solid var(--border-color);
            border-radius: 10px; padding: 10px 14px; color: var(--text-color); font-size: 14px;
            outline: none; font-family: inherit; resize: vertical; min-height: 60px;
        }
        /* Una fila de gol/tarjeta/penal: equipo + jugador + lo específico del tipo +
           minuto opcional, todo en una línea que puede envolver en pantallas chicas. */
        .dynamic-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; }
        .dynamic-row select { margin-bottom: 0; min-width: 120px; flex: 1; }
        .dynamic-row input[type="number"] { width: 90px; background: rgba(15,23,42,0.6); border: 1px solid var(--border-color); border-radius: 10px; padding: 8px 10px; color: var(--text-color); font-size: 13px; }
        .dynamic-row label { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 400; color: var(--text-color); margin-bottom: 0; white-space: nowrap; }
        .remove-row-btn { background: none; border: none; color: var(--danger-color); font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; margin-left: auto; }
        .player-checkbox-list { max-height: 160px; overflow-y: auto; margin-top: 4px; }
        .summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .summary-table th, .summary-table td { padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--border-color); }
        .summary-table th:first-child, .summary-table td:first-child { text-align: left; }
        .summary-table th { color: var(--text-muted); font-weight: 600; font-size: 11px; }
        .summary-table tbody tr:last-child td { border-bottom: none; }
${CALENDAR_CSS}
        /* Partido sugerido pero todavía no aceptado: se distingue de lo ya agendado. */
        .grid-cell.proposed { background: #a855f7; }
        /* Las celdas con partido llevan su índice adentro. */
        .grid-cell { font-size: 9px; font-weight: 700; line-height: 22px; text-align: center; color: #ffffff; }
        /* Escala 1-5 de disponibilidad de un equipo. */
        .grid-cell.lvl1 { background: #b91c1c; cursor: default; }
        .grid-cell.lvl2 { background: #c2410c; cursor: default; }
        .grid-cell.lvl3 { background: #a16207; cursor: default; }
        .grid-cell.lvl4 { background: #4d7c0f; cursor: default; }
        .grid-cell.lvl5 { background: #166534; cursor: default; }
        /* Tarjetas de partido: sugerido y agendado, explicadas. */
        .match-card { border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
        .match-card.proposed { border-color: #7e22ce; background: rgba(168,85,247,0.06); }
        .match-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .match-card-teams { font-size: 14px; font-weight: 700; }
        .match-card-when { font-size: 12px; color: var(--text-muted); }
        .match-card-facts { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
        .fact { font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); border-radius: 999px; padding: 3px 9px; }
        .fact strong { color: var(--text-color); font-weight: 700; }
        .status-chip { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
        .status-played { background: rgba(34,197,94,0.15); color: #86efac; }
        .status-confirmed { background: rgba(56,189,248,0.15); color: #7dd3fc; }
        .status-suspended { background: rgba(234,179,8,0.15); color: #fde047; }
        .status-cancelled { background: rgba(239,68,68,0.15); color: #fca5a5; }
        .copy-btn { margin-left: 8px; background: rgba(255,255,255,0.08); border: 1px solid var(--border-color); border-radius: 999px; color: var(--text-color); font: inherit; font-size: 10px; font-weight: 700; padding: 1px 8px; cursor: pointer; }
        .copy-btn:hover { background: rgba(255,255,255,0.16); }
        .copy-btn.copied { background: var(--success-color); border-color: var(--success-color); color: #05230f; }
        .week-block:first-child .week-label { margin-top: 10px; }
        .match-index { font-size: 11px; font-weight: 800; border-radius: 6px; padding: 2px 7px; background: #16a34a; color: #ffffff; flex-shrink: 0; }
        .match-index.proposed { background: #a855f7; }
        .match-card-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .team-avail-link { background: none; border: none; color: var(--primary-color); font: inherit; font-size: 12px; cursor: pointer; padding: 0 0 0 8px; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="page" id="loginPage">
        <div class="container">
            <h1>Gestionar Liga</h1>
            <p class="subtitle">Inicia sesión con la cuenta de tu liga</p>
            <div class="alert alert-danger" id="loginError"></div>
            <p class="hint" id="checkingMsg">Verificando sesión…</p>
            <form id="loginForm" style="display:none;">
                <div class="form-group">
                    <label>Usuario</label>
                    <input type="text" id="loginIdentity" required autocapitalize="none" autocomplete="username">
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="loginPassword" required>
                </div>
                <button type="submit" class="btn" style="width:100%;">Iniciar Sesión</button>
            </form>
        </div>
    </div>

    <div class="page" id="panelPage" style="display:none;">
        <div id="logoutBar"><button class="btn btn-secondary btn-sm" id="logoutBtn">Cerrar Sesión</button></div>
        <h1 id="leagueName">Liga</h1>
        <p class="subtitle">Elige qué equipos participan, crea etapas, y agrega partidos dentro de cada etapa.</p>
        <div class="alert alert-danger" id="panelError"></div>

        <details class="card card-collapsible">
            <summary>Beaupolla</summary>
            <p class="hint" style="margin-top:0;margin-bottom:12px;">
                Cada persona apuesta quién gana cada partido de la liga. Acertar el ganador da 1 punto;
                acertar el empate, 2. Las apuestas de cada partido se cierran 10 minutos antes de su
                horario, o apenas el partido arranca en la vista de arbitraje — lo que pase primero.
                Hasta entonces, lo que apuesta cada quien es secreto.
            </p>
            <div id="pollaState"><p class="hint">Cargando...</p></div>
        </details>

        <details class="card card-collapsible">
            <summary>Mercado automático (Beaumarket)</summary>
            <p class="hint" style="margin-top:0;margin-bottom:12px;">
                Al agendar un partido, crea automáticamente un mercado de predicción de
                3 resultados (gana local, empate, gana visita) que cierra 10 minutos
                antes del horario del partido, igual que la polla. Es una opción aparte
                de la polla, no depende de ella. Al terminar el partido, el mercado se
                resuelve solo con el resultado real.
            </p>
            <div id="beaumarketAutoState"><p class="hint">Cargando...</p></div>
        </details>

        <details class="card card-collapsible">
            <summary>Equipos de la liga</summary>
            <p class="hint" style="margin-top:0;margin-bottom:10px;">
                El contacto y la nota de dificultad de cada equipo son privados de esta
                liga — nunca se muestran en su perfil ni a nadie más.
            </p>
            <div id="rosterList"><p class="hint">Cargando...</p></div>
        </details>

        <div class="card">
            <div class="card-header">
                <h2>Etapas</h2>
                <button class="btn btn-sm" id="openCreateStageBtn">Crear</button>
            </div>
            <div id="stagesList"><p class="hint">Cargando...</p></div>
        </div>
    </div>

    <!-- Vista propia de una etapa: gestionar una etapa dejó de ser un par de tarjetas
         que aparecían debajo del listado y pasó a ser una pantalla aparte, para que el
         panel de la liga no crezca sin fin a medida que se abren cosas. -->
    <div class="page" id="stagePage" style="display:none;">
        <div id="logoutBar"><button class="btn btn-secondary btn-sm" id="backToPanelBtn">&larr; Volver a la liga</button></div>
        <h1 id="stagePageName">Etapa</h1>
        <p class="subtitle" id="stagePageSubtitle"></p>
        <div class="alert alert-danger" id="stageError"></div>

        <div class="card">
            <div class="card-header">
                <h2>Tipo de etapa</h2>
                <select id="stageTypeSelect" style="width:auto; margin-bottom:0;">
                    <option value="groups">Fase de grupos</option>
                    <option value="knockout">Enfrentamiento directo</option>
                </select>
            </div>
            <p class="hint" style="margin-top:10px;">Una fase de grupos muestra tabla de posiciones; una eliminatoria, solo el listado de partidos.</p>
        </div>

        <details class="card card-collapsible" id="stageTeamsCard">
            <summary>Participantes</summary>
            <p class="hint" style="margin-top:0;margin-bottom:12px;">
                Los equipos de la liga que juegan esta etapa. En una fase de grupos aparecen en la
                tabla de posiciones aunque todavía no hayan jugado, y son los únicos que se pueden
                elegir al agendar partidos.
            </p>
            <div id="stageParticipantsList"><p class="hint">Cargando...</p></div>
        </details>

        <details class="card card-collapsible" id="difficultySummaryCard">
            <summary>Dificultad acumulada (solo tú la ves)</summary>
            <p class="hint" style="margin-top:0;margin-bottom:12px;">
                Cuánta dificultad de rival ha enfrentado cada equipo EN ESTA ETAPA — se
                usa para que el algoritmo de sugerencia vaya emparejando rivales de nivel
                parecido a lo largo del campeonato. Cargá la nota de dificultad (1-10) de
                cada equipo desde "Equipos de la liga" para que esto tenga datos.
            </p>
            <div id="difficultySummaryList"><p class="hint">Cargando...</p></div>
        </details>

        <div class="card">
            <h2 style="margin-top:0;">Agregar partidos</h2>
            <p class="hint">Elige los equipos de la liga que van a jugar y corre el algoritmo. Cada sugerencia se acepta o descarta individualmente.</p>
            <div id="stageTeamsList"></div>

            <h2 style="font-size:14px; margin:22px 0 6px;">Horarios permitidos</h2>
            <p class="hint" style="margin-bottom:10px;">
                Marca en qué bloques se pueden agendar los partidos de esta tanda. El botón de cada
                día marca o desmarca la columna entera. Los partidos solo se sugieren dentro de los
                bloques que marques acá.
            </p>
            <div id="allowedGridWrap"><p class="hint">Cargando...</p></div>
            <div class="grid-legend">
                <span><span class="grid-legend-swatch" style="background:var(--primary-color);"></span>Elegido</span>
                <span><span class="grid-legend-swatch" style="background:rgba(15,23,42,0.4);"></span>Libre</span>
                <span><span class="grid-legend-swatch" style="background:#1e3a5f;"></span>Ocupado</span>
                <span><span class="grid-legend-swatch" style="background:var(--danger-color);"></span>Bloqueado</span>
            </div>

            <label style="display:flex; align-items:center; gap:6px; margin-top:14px; font-size:13px;">
                <input type="checkbox" id="avoidRematchesCheck">
                Evitar repetir rivales (agendados o ya jugados)
            </label>
            <label style="display:flex; align-items:center; gap:6px; margin-top:6px; font-size:13px;">
                <input type="checkbox" id="autoAssignRefereesCheck">
                Asignar árbitros automáticamente (prioriza a quien menos ha arbitrado)
            </label>
            <button class="btn btn-sm" id="proposeBtn" style="margin-top:10px;" disabled>Sugerir partidos</button>
            <p class="hint" id="proposeHint" style="margin-top:6px;">Elige al menos un horario para poder sugerir partidos.</p>
            <div id="proposalsWrap"></div>
        </div>

        <details class="card card-collapsible" id="manualScheduleCard">
            <summary>Agendar manualmente</summary>
            <p class="hint" style="margin-top:0;margin-bottom:12px;">
                Elige los equipos y el horario a mano, sin correr el algoritmo de sugerencias.
            </p>
            <div class="form-row">
                <div class="form-group">
                    <label for="manualTeamA">Equipo A</label>
                    <select id="manualTeamA"></select>
                </div>
                <div class="form-group">
                    <label for="manualTeamB">Equipo B</label>
                    <select id="manualTeamB"></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="manualDate">Fecha</label>
                    <input type="date" id="manualDate">
                </div>
                <div class="form-group">
                    <label for="manualHour">Hora</label>
                    <select id="manualHour"></select>
                </div>
            </div>
            <label style="display:flex; align-items:center; gap:6px; margin-bottom:10px; font-size:13px;">
                <input type="checkbox" id="autoAssignRefereesManualCheck">
                Asignar árbitros automáticamente (prioriza a quien menos ha arbitrado)
            </label>
            <div class="alert alert-danger" id="manualScheduleError"></div>
            <button class="btn btn-sm" id="manualScheduleBtn">Agendar</button>
        </details>

        <div class="card">
            <h2 style="margin-top:0;">Calendario de la liga</h2>
            <p class="hint">Los partidos ya agendados o jugados de tu liga, las sugerencias que todavía no aceptas, y qué bloques están tomados por otras. El número de cada bloque es el del partido en la lista de abajo (los sugeridos van con S).</p>
            <div id="leagueGridWrap"><p class="hint">Cargando...</p></div>
            <div class="grid-legend">
                <span><span class="grid-legend-swatch" style="background:#16a34a;"></span>Partido de tu liga</span>
                <span><span class="grid-legend-swatch" style="background:#a855f7;"></span>Sugerido (sin agendar)</span>
                <span><span class="grid-legend-swatch" style="background:#1e3a5f;"></span>Ocupado por otra</span>
                <span><span class="grid-legend-swatch" style="background:var(--danger-color);"></span>Bloqueado</span>
                <span><span class="grid-legend-swatch" style="background:rgba(15,23,42,0.4);"></span>Libre</span>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2>Partidos</h2>
                <button class="btn btn-sm" id="openRetroactiveBtn">Cargar partido jugado</button>
            </div>
            <div id="stageMatchesList"></div>
        </div>
    </div>

    <!-- Disponibilidad de un equipo: se llega desde el selector de agendar partidos -->
    <div class="page" id="teamAvailPage" style="display:none;">
        <div id="logoutBar"><button class="btn btn-secondary btn-sm" id="backFromAvailBtn">&larr; Volver a la etapa</button></div>
        <h1 id="availTeamName">Equipo</h1>
        <p class="subtitle" id="availSubtitle"></p>
        <div class="alert alert-danger" id="availError"></div>

        <div class="card">
            <div id="availGridWrap"><p class="hint">Cargando...</p></div>
            <div class="grid-legend">
                <span><span class="grid-legend-swatch" style="background:#166534;"></span>Excelente</span>
                <span><span class="grid-legend-swatch" style="background:#4d7c0f;"></span>Buena</span>
                <span><span class="grid-legend-swatch" style="background:#a16207;"></span>Regular</span>
                <span><span class="grid-legend-swatch" style="background:#c2410c;"></span>Mala</span>
                <span><span class="grid-legend-swatch" style="background:#b91c1c;"></span>Muy mala</span>
                <span><span class="grid-legend-swatch" style="background:rgba(15,23,42,0.4);"></span>Sin marcar</span>
            </div>
        </div>
    </div>

    <!-- Modal de creación de etapa -->
    <div class="modal-backdrop" id="createStageModal">
        <div class="modal-box">
            <h2 style="margin-top:0;">Nueva etapa</h2>
            <form id="createStageForm">
                <div class="form-group">
                    <label for="stageName">Nombre</label>
                    <input type="text" id="stageName" placeholder="Ej. Fase de grupos" required>
                </div>
                <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:400; margin-bottom:6px;">
                    <input type="radio" name="stageType" value="groups" checked> Fase de grupos (tabla de posiciones)
                </label>
                <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:400;">
                    <input type="radio" name="stageType" value="knockout"> Enfrentamiento directo (eliminatoria)
                </label>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary btn-sm" id="cancelCreateStageBtn">Cancelar</button>
                    <button type="submit" class="btn btn-sm">Crear etapa</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal de partido retroactivo: carga un partido que ya se jugó, con todo lo que
         un árbitro real habría podido registrar en vivo, pero sin depender de que cada
         evento tenga hora exacta — a posteriori nadie recuerda el minuto preciso. -->
    <div class="modal-backdrop" id="retroactiveMatchModal">
        <div class="modal-box modal-box-lg">
            <h2 style="margin-top:0;">Cargar partido jugado</h2>
            <div class="alert alert-danger" id="retroactiveError"></div>
            <form id="retroactiveForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="retroTeamA">Equipo A</label>
                        <select id="retroTeamA"></select>
                    </div>
                    <div class="form-group">
                        <label for="retroTeamB">Equipo B</label>
                        <select id="retroTeamB"></select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="retroDate">Fecha</label>
                        <input type="date" id="retroDate" required>
                    </div>
                    <div class="form-group">
                        <label for="retroHour">Hora (opcional)</label>
                        <select id="retroHour"></select>
                    </div>
                </div>

                <details class="card-collapsible" id="retroLineupACard" style="margin-bottom:12px;">
                    <summary>Convocatoria — Equipo A (opcional)</summary>
                    <div class="player-checkbox-list" id="retroLineupA"><p class="hint">Elige el equipo A para ver su plantel.</p></div>
                </details>
                <details class="card-collapsible" id="retroLineupBCard" style="margin-bottom:12px;">
                    <summary>Convocatoria — Equipo B (opcional)</summary>
                    <div class="player-checkbox-list" id="retroLineupB"><p class="hint">Elige el equipo B para ver su plantel.</p></div>
                </details>

                <h2 style="font-size:14px; margin:18px 0 6px;">Goles</h2>
                <div id="retroGoalsList"></div>
                <button type="button" class="btn btn-secondary btn-sm" id="addGoalBtn">+ Agregar gol</button>

                <h2 style="font-size:14px; margin:18px 0 6px;">Tarjetas</h2>
                <div id="retroCardsList"></div>
                <button type="button" class="btn btn-secondary btn-sm" id="addCardBtn">+ Agregar tarjeta</button>

                <h2 style="font-size:14px; margin:18px 0 6px;">Penales</h2>
                <div id="retroPenaltiesList"></div>
                <button type="button" class="btn btn-secondary btn-sm" id="addPenaltyBtn">+ Agregar penal</button>

                <div class="form-group" style="margin-top:18px;">
                    <label for="retroNotes">Notas (opcional)</label>
                    <textarea id="retroNotes" placeholder="Informe del partido, incidencias, etc."></textarea>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary btn-sm" id="cancelRetroBtn">Cancelar</button>
                    <button type="submit" class="btn btn-sm" id="submitRetroBtn">Guardar partido</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal de edición de partido: solo para partidos que todavía no se jugaron
         (confirmed/suspended) — corrige equipos u horario de un partido ya agendado,
         sin tener que borrarlo y volver a crearlo. -->
    <div class="modal-backdrop" id="editMatchModal">
        <div class="modal-box">
            <h2 style="margin-top:0;">Editar partido</h2>
            <div class="alert alert-danger" id="editMatchError"></div>
            <form id="editMatchForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="editTeamA">Equipo A</label>
                        <select id="editTeamA"></select>
                    </div>
                    <div class="form-group">
                        <label for="editTeamB">Equipo B</label>
                        <select id="editTeamB"></select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="editDate">Fecha</label>
                        <input type="date" id="editDate" required>
                    </div>
                    <div class="form-group">
                        <label for="editHour">Hora</label>
                        <select id="editHour"></select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary btn-sm" id="cancelEditMatchBtn">Cancelar</button>
                    <button type="submit" class="btn btn-sm" id="submitEditMatchBtn">Guardar cambios</button>
                </div>
            </form>
        </div>
    </div>

    <script>
${CALENDAR_FNS}
${SESSION_GATE_FN}
        function formatBlockLabel(code) {
            const hour = code.slice(-2);
            const dateStr = code.slice(0, -3);
            const d = new Date(dateStr + "T00:00:00");
            const label = FULL_DAY_LABELS[(d.getDay() + 6) % 7] + " " + d.getDate() + " " + MONTH_LABELS[d.getMonth()];
            return label + " " + hour + ":00";
        }

        let token = "";

        const loginPage = document.getElementById("loginPage");
        const panelPage = document.getElementById("panelPage");
        const stagePage = document.getElementById("stagePage");
        const teamAvailPage = document.getElementById("teamAvailPage");
        const loginForm = document.getElementById("loginForm");
        const checkingMsg = document.getElementById("checkingMsg");
        const loginError = document.getElementById("loginError");
        const panelError = document.getElementById("panelError");
        const stageError = document.getElementById("stageError");

        function showError(el, msg) { el.textContent = msg; el.style.display = "block"; }
        function hideError(el) { el.style.display = "none"; }

        // El error se muestra en la vista que está a la vista. Antes había un solo
        // contenedor y, al gestionar una etapa, cualquier fallo se pintaba en una
        // pantalla oculta: la acción fallaba en silencio.
        function currentError() {
            if (teamAvailPage.style.display === "block") return document.getElementById("availError");
            return stagePage.style.display === "block" ? stageError : panelError;
        }

        // El nombre de un equipo lo controla la propia cuenta de equipo (campo libre de
        // su perfil), así que NUNCA se concatena dentro de innerHTML: se inserta como
        // nodo de texto. Antes se armaba con innerHTML acá y en renderStageTeamOptions,
        // lo que permitía que un equipo cualquiera (la lista muestra TODAS las cuentas
        // de equipo, no solo las del roster propio) ejecutara JS en esta página — donde
        // vive el token de la liga en localStorage. Ver auditoria-2026-08-19.md §3.1.
        function teamCheckboxRow(team, opts) {
            const options = opts || {};
            const row = document.createElement("label");
            row.className = "team-checkbox-row";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = team.id;
            if (options.className) input.className = options.className;
            input.checked = Boolean(options.checked);
            row.appendChild(input);
            row.appendChild(document.createTextNode(" " + teamLabel(team)));
            return row;
        }

        function teamLabel(team) {
            return team.name || team.username || team.id;
        }

        let myLeagueId = "";

        function showPanel(name, leagueId) {
            checkingMsg.style.display = "none";
            loginPage.style.display = "none";
            stagePage.style.display = "none";
            teamAvailPage.style.display = "none";
            panelPage.style.display = "block";
            if (name !== undefined) document.getElementById("leagueName").textContent = name || "Liga";
            if (leagueId !== undefined) myLeagueId = leagueId || "";
            hideError(panelError);
            loadPolla();
            loadBeaumarketAuto();
            loadRoster();
            loadStages();
        }
        function showLogin(hadStaleSession) {
            checkingMsg.style.display = "none";
            loginForm.style.display = "block";
            loginPage.style.display = "block";
            panelPage.style.display = "none";
            stagePage.style.display = "none";
            teamAvailPage.style.display = "none";
            if (hadStaleSession) showError(loginError, "Tu sesión expiró. Inicia sesión de nuevo.");
        }

        document.getElementById("loginForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError(loginError);
            const identity = document.getElementById("loginIdentity").value;
            const password = document.getElementById("loginPassword").value;
            try {
                const res = await fetch("/api/collections/users/auth-with-password", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identity: identity, password: password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Credenciales incorrectas.");
                if (data.record.type !== "organization" || data.record.subtype !== "league") {
                    throw new Error("Esta cuenta no es una liga.");
                }
                token = data.token;
                localStorage.setItem("liga_auth", JSON.stringify({ token, model: data.record }));
                showPanel(data.record.name, data.record.id);
            } catch (err) { showError(loginError, err.message); }
        });

        document.getElementById("logoutBtn").addEventListener("click", () => {
            token = ""; localStorage.removeItem("liga_auth"); showLogin();
        });

${API_CALL_FN}

        // --- Beaupolla ---
        //
        // Apagarla NO borra ninguna apuesta: se conservan y vuelven a aparecer si se
        // reactiva. Aun así pide escribir el nombre de la liga, porque es un cambio que
        // ve todo el mundo que venía jugando y no debería salir de un click sin querer.
        const pollaState = document.getElementById("pollaState");
        let pollaEnabled = false;
        let pollaLeagueName = "";

        async function loadPolla() {
            pollaState.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const data = await apiCall("/api/liga/polla", "GET");
                pollaEnabled = Boolean(data.enabled);
                pollaLeagueName = data.name || "";
                renderPolla();
            } catch (err) { showError(currentError(), err.message); }
        }

        function renderPolla() {
            pollaState.innerHTML = "";

            const status = document.createElement("p");
            status.style.fontSize = "13px";
            status.style.marginBottom = "12px";
            status.textContent = pollaEnabled
                ? "La polla está habilitada: las personas ya pueden apostar."
                : "La polla está deshabilitada.";
            status.style.color = pollaEnabled ? "var(--success-color)" : "var(--text-muted)";
            pollaState.appendChild(status);

            if (!pollaEnabled) {
                const btn = document.createElement("button");
                btn.className = "btn btn-accept btn-sm";
                btn.textContent = "Habilitar polla";
                btn.addEventListener("click", () => setPolla(true, btn));
                pollaState.appendChild(btn);
                return;
            }

            const label = document.createElement("label");
            label.textContent = "Para deshabilitarla, escribe el nombre de la liga: " + pollaLeagueName;
            pollaState.appendChild(label);

            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = pollaLeagueName;
            input.autocapitalize = "none";
            pollaState.appendChild(input);

            const btn = document.createElement("button");
            btn.className = "btn btn-sm";
            btn.style.background = "var(--danger-color)";
            btn.style.color = "#ffffff";
            btn.style.marginTop = "10px";
            btn.textContent = "Deshabilitar polla";
            btn.disabled = true;
            input.addEventListener("input", () => {
                btn.disabled = input.value.trim() !== pollaLeagueName;
            });
            btn.addEventListener("click", () => setPolla(false, btn, input.value.trim()));
            pollaState.appendChild(btn);
        }

        async function setPolla(enabled, btn, confirmName) {
            hideError(panelError);
            btn.disabled = true;
            try {
                await apiCall("/api/liga/polla", "POST", { enabled: enabled, confirmName: confirmName || "" });
                await loadPolla();
            } catch (err) {
                showError(currentError(), err.message);
                btn.disabled = false;
            }
        }

        // --- Mercado automático (Beaumarket) ---
        //
        // A diferencia de la polla, apagarlo no oculta nada de lo que ya exista — solo
        // deja de crear un mercado nuevo para partidos que se agenden de acá en
        // adelante. Por eso es un toggle directo, sin pedir confirmación escrita.
        const beaumarketAutoState = document.getElementById("beaumarketAutoState");
        let beaumarketAutoEnabled = false;

        async function loadBeaumarketAuto() {
            beaumarketAutoState.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const data = await apiCall("/api/liga/beaumarket-auto", "GET");
                beaumarketAutoEnabled = Boolean(data.enabled);
                renderBeaumarketAuto();
            } catch (err) { showError(currentError(), err.message); }
        }

        function renderBeaumarketAuto() {
            beaumarketAutoState.innerHTML = "";

            const status = document.createElement("p");
            status.style.fontSize = "13px";
            status.style.marginBottom = "12px";
            status.textContent = beaumarketAutoEnabled
                ? "Habilitado: cada partido nuevo agendado va a tener su mercado."
                : "Deshabilitado.";
            status.style.color = beaumarketAutoEnabled ? "var(--success-color)" : "var(--text-muted)";
            beaumarketAutoState.appendChild(status);

            const btn = document.createElement("button");
            btn.className = beaumarketAutoEnabled ? "btn btn-secondary btn-sm" : "btn btn-accept btn-sm";
            btn.textContent = beaumarketAutoEnabled ? "Deshabilitar" : "Habilitar mercado automático";
            btn.addEventListener("click", () => setBeaumarketAuto(!beaumarketAutoEnabled, btn));
            beaumarketAutoState.appendChild(btn);
        }

        async function setBeaumarketAuto(enabled, btn) {
            hideError(panelError);
            btn.disabled = true;
            try {
                await apiCall("/api/liga/beaumarket-auto", "POST", { enabled: enabled });
                await loadBeaumarketAuto();
            } catch (err) {
                showError(currentError(), err.message);
                btn.disabled = false;
            }
        }

        // --- Equipos de la liga ---
        const rosterList = document.getElementById("rosterList");
        let rosterTeams = [];

        // Contacto privado (WhatsApp/Telegram/Instagram/Signal) y nota de dificultad
        // (1-10) de un equipo YA en el roster — ver POST /api/liga/roster/team-details.
        // Deliberadamente separado del perfil del equipo: la liga es la única dueña de
        // este dato, nunca se expone a nadie más.
        function renderTeamDetailsRow(t) {
            const wrap = document.createElement("div");
            wrap.style.cssText = "display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:0 0 12px 24px; margin-top:-4px; border-bottom:1px solid var(--border-color); font-size:12px;";

            const typeSelect = document.createElement("select");
            typeSelect.style.cssText = "width:auto; margin-bottom:0;";
            [["", "Sin contacto"], ["whatsapp", "WhatsApp"], ["telegram", "Telegram"], ["instagram", "Instagram"], ["signal", "Signal"]]
                .forEach(([value, text]) => {
                    const opt = document.createElement("option");
                    opt.value = value;
                    opt.textContent = text;
                    if (value === (t.contactType || "")) opt.selected = true;
                    typeSelect.appendChild(opt);
                });

            const valueInput = document.createElement("input");
            valueInput.type = "text";
            valueInput.placeholder = "Número o usuario";
            valueInput.value = t.contactValue || "";
            valueInput.style.cssText = "width:140px; margin-bottom:0;";

            const difficultyInput = document.createElement("input");
            difficultyInput.type = "number";
            difficultyInput.min = "1";
            difficultyInput.max = "10";
            difficultyInput.placeholder = "Dificultad 1-10";
            difficultyInput.value = t.difficulty !== null && t.difficulty !== undefined ? t.difficulty : "";
            difficultyInput.style.cssText = "width:120px; background:rgba(15,23,42,0.6); border:1px solid var(--border-color); border-radius:10px; padding:8px 10px; color:var(--text-color); font-size:12px;";

            const errorEl = document.createElement("span");
            errorEl.style.cssText = "color:var(--danger-color); display:none;";

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "btn btn-sm";
            saveBtn.style.marginTop = "0";
            saveBtn.textContent = "Guardar";
            saveBtn.addEventListener("click", async () => {
                errorEl.style.display = "none";
                const rawDiff = difficultyInput.value.trim();
                if (rawDiff !== "" && (Number(rawDiff) < 1 || Number(rawDiff) > 10)) {
                    errorEl.textContent = "La dificultad va de 1 a 10.";
                    errorEl.style.display = "inline";
                    return;
                }
                saveBtn.disabled = true;
                try {
                    await apiCall("/api/liga/roster/team-details", "POST", {
                        teamId: t.id,
                        contactType: typeSelect.value || null,
                        contactValue: valueInput.value.trim(),
                        difficulty: rawDiff === "" ? null : Number(rawDiff),
                    });
                    await loadRoster();
                } catch (err) {
                    errorEl.textContent = err.message;
                    errorEl.style.display = "inline";
                    saveBtn.disabled = false;
                }
            });

            wrap.appendChild(typeSelect);
            wrap.appendChild(valueInput);
            wrap.appendChild(difficultyInput);
            wrap.appendChild(saveBtn);
            wrap.appendChild(errorEl);
            return wrap;
        }

        async function loadRoster() {
            hideError(panelError);
            rosterList.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const data = await apiCall("/api/liga/roster", "GET");
                const myTeamIds = new Set(data.myTeamIds);
                rosterTeams = data.allTeams.filter((t) => myTeamIds.has(t.id));
                rosterList.innerHTML = "";
                if (!data.allTeams.length) {
                    rosterList.innerHTML = '<p class="hint">Todavía no hay ninguna cuenta de equipo creada.</p>';
                    return;
                }
                data.allTeams.forEach((t) => {
                    const row = teamCheckboxRow(t, { checked: myTeamIds.has(t.id) });
                    row.querySelector("input").addEventListener("change", async (ev) => {
                        // Desmarcar = quitar de la liga — se confirma antes de llamar a la
                        // API porque es la acción destructiva; marcar (agregar) no la necesita.
                        if (!ev.target.checked) {
                            if (!confirm("¿Quitar a '" + teamLabel(t) + "' de la liga?")) {
                                ev.target.checked = true;
                                return;
                            }
                        }
                        ev.target.disabled = true;
                        try {
                            await apiCall("/api/liga/roster/toggle", "POST", { teamId: t.id });
                            await loadRoster();
                            renderStageTeamOptions();
                        } catch (err) { showError(currentError(), err.message); }
                        finally { ev.target.disabled = false; }
                    });
                    rosterList.appendChild(row);
                    if (myTeamIds.has(t.id)) rosterList.appendChild(renderTeamDetailsRow(t));
                });
            } catch (err) { showError(currentError(), err.message); }
        }

        // --- Etapas ---
        const stagesList = document.getElementById("stagesList");
        let stages = [];
        let activeStage = null;

        // Crear una etapa vive en un modal: es una acción puntual, y tenerla siempre
        // desplegada arriba del listado hacía que lo que uno viene a mirar (las etapas
        // que ya existen) quedara debajo de un formulario.
        const createStageModal = document.getElementById("createStageModal");
        const createStageForm = document.getElementById("createStageForm");

        function openCreateStage() {
            hideError(panelError);
            createStageForm.reset();
            createStageModal.classList.add("open");
            document.getElementById("stageName").focus();
        }
        function closeCreateStage() { createStageModal.classList.remove("open"); }

        document.getElementById("openCreateStageBtn").addEventListener("click", openCreateStage);
        document.getElementById("cancelCreateStageBtn").addEventListener("click", closeCreateStage);
        createStageModal.addEventListener("click", (e) => {
            if (e.target === createStageModal) closeCreateStage();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && createStageModal.classList.contains("open")) closeCreateStage();
        });

        createStageForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError(panelError);
            const input = document.getElementById("stageName");
            const name = input.value.trim();
            if (!name) return;
            const type = document.querySelector('input[name="stageType"]:checked').value;
            try {
                await apiCall("/api/liga/stages/create", "POST", { name, type });
                closeCreateStage();
                await loadStages();
            } catch (err) { showError(currentError(), err.message); }
        });

        const STAGE_TYPE_LABELS = { groups: "Fase de grupos", knockout: "Enfrentamiento directo" };

        async function loadStages() {
            hideError(panelError);
            stagesList.innerHTML = '<p class="hint">Cargando...</p>';
            try {
                const data = await apiCall("/api/liga/stages", "GET");
                stages = data.stages;
                stagesList.innerHTML = "";
                if (!stages.length) {
                    stagesList.innerHTML = '<p class="hint">Todavía no hay etapas. Crea la primera con el botón de arriba.</p>';
                    return;
                }
                stages.forEach((stage, idx) => {
                    const row = document.createElement("div");
                    row.className = "stage-row";

                    const upBtn = document.createElement("button");
                    upBtn.className = "btn btn-secondary btn-sm btn-icon";
                    upBtn.style.marginTop = "0";
                    upBtn.style.marginRight = "0";
                    upBtn.textContent = "▲";
                    upBtn.title = "Subir";
                    upBtn.disabled = idx === 0;
                    upBtn.addEventListener("click", () => moveStage(stage.id, "up"));

                    const downBtn = document.createElement("button");
                    downBtn.className = "btn btn-secondary btn-sm btn-icon";
                    downBtn.style.marginTop = "0";
                    downBtn.textContent = "▼";
                    downBtn.title = "Bajar";
                    downBtn.disabled = idx === stages.length - 1;
                    downBtn.addEventListener("click", () => moveStage(stage.id, "down"));

                    // La fila entera abre la etapa, no un botón "Gestionar" al costado.
                    const open = document.createElement("button");
                    open.type = "button";
                    open.className = "stage-open";
                    const nameSpan = document.createElement("span");
                    nameSpan.className = "stage-name";
                    nameSpan.textContent = stage.name;
                    const typeSpan = document.createElement("span");
                    typeSpan.className = "stage-type";
                    typeSpan.textContent = STAGE_TYPE_LABELS[stage.type] || stage.type;
                    open.appendChild(nameSpan);
                    open.appendChild(typeSpan);
                    open.addEventListener("click", () => showStage(stage));

                    const chevron = document.createElement("span");
                    chevron.className = "stage-type";
                    chevron.textContent = "›";

                    row.appendChild(upBtn);
                    row.appendChild(downBtn);
                    row.appendChild(open);
                    row.appendChild(chevron);
                    stagesList.appendChild(row);
                });
            } catch (err) { showError(currentError(), err.message); }
        }

        async function moveStage(stageId, direction) {
            hideError(panelError);
            try {
                await apiCall("/api/liga/stages/reorder", "POST", { stageId, direction });
                await loadStages();
            } catch (err) { showError(currentError(), err.message); }
        }

        // --- Vista de una etapa ---
        const stageTypeSelect = document.getElementById("stageTypeSelect");

        document.getElementById("backToPanelBtn").addEventListener("click", () => showPanel());

        stageTypeSelect.addEventListener("change", async () => {
            if (!activeStage) return;
            const previo = activeStage.type;
            stageTypeSelect.disabled = true;
            hideError(stageError);
            try {
                await apiCall("/api/liga/stages/update-type", "POST", { stageId: activeStage.id, type: stageTypeSelect.value });
                activeStage.type = stageTypeSelect.value;
            } catch (err) {
                showError(stageError, err.message);
                stageTypeSelect.value = previo;
            } finally {
                stageTypeSelect.disabled = false;
            }
        });

        function showStage(stage) {
            activeStage = stage;
            panelPage.style.display = "none";
            teamAvailPage.style.display = "none";
            stagePage.style.display = "block";
            hideError(stageError);
            document.getElementById("stagePageName").textContent = stage.name;
            document.getElementById("stagePageSubtitle").textContent =
                (document.getElementById("leagueName").textContent || "Liga") + " · gestiona los partidos de esta etapa";
            stageTypeSelect.value = stage.type === "knockout" ? "knockout" : "groups";
            document.getElementById("proposalsWrap").innerHTML = "";
            renderStageParticipants();
            renderStageTeamOptions();
            renderManualScheduleTeamOptions();
            populateHourSelect(document.getElementById("manualHour"), 12);
            const manualDate = document.getElementById("manualDate");
            manualDate.min = formatDateStr(new Date());
            const scheduleWindow = getWindow();
            const lastWeek = scheduleWindow[scheduleWindow.length - 1];
            manualDate.max = lastWeek.days[lastWeek.days.length - 1].dateStr;
            manualDate.value = "";
            hideError(document.getElementById("manualScheduleError"));
            // La selección de horarios es de cada tanda, no se arrastra entre etapas.
            allowedBlocks = new Set();
            proposedByBlock = {};
            matchIndexByBlock = {};
            document.getElementById("allowedGridWrap").innerHTML = '<p class="hint">Cargando...</p>';
            document.getElementById("leagueGridWrap").innerHTML = '<p class="hint">Cargando...</p>';
            loadCalendar();
            loadStageMatches();
            loadDifficultySummary();
            window.scrollTo(0, 0);
        }

        // Los equipos que participan de la etapa. Vacío significa que todavía no se
        // marcó ninguno — las etapas viejas que dependían del fallback a "todo el
        // roster" quedaron congeladas con sus participantes reales por la migración
        // 1788100000_backfill_league_stage_teams.
        function stageParticipants() {
            const ids = (activeStage && activeStage.teams) || [];
            return rosterTeams.filter((t) => ids.indexOf(t.id) !== -1);
        }

        // Desplegable de participantes de la etapa.
        function renderStageParticipants() {
            const wrap = document.getElementById("stageParticipantsList");
            wrap.innerHTML = "";
            if (!activeStage) return;
            if (!rosterTeams.length) {
                wrap.innerHTML = '<p class="hint">Primero agrega equipos a la liga.</p>';
                return;
            }
            const ids = activeStage.teams || [];
            rosterTeams.forEach((t) => {
                const row = teamCheckboxRow(t, { checked: ids.indexOf(t.id) !== -1 });
                row.querySelector("input").addEventListener("change", async (ev) => {
                    ev.target.disabled = true;
                    hideError(stageError);
                    try {
                        const res = await apiCall("/api/liga/stages/teams/toggle", "POST", {
                            stageId: activeStage.id,
                            teamId: t.id,
                        });
                        activeStage.teams = res.teams || [];
                        // El selector de agendar depende de esto, así que se redibuja.
                        renderStageTeamOptions();
                    } catch (err) {
                        showError(stageError, err.message);
                        ev.target.checked = !ev.target.checked;
                    } finally {
                        ev.target.disabled = false;
                    }
                });
                wrap.appendChild(row);
            });
        }

        function renderStageTeamOptions() {
            const wrap = document.getElementById("stageTeamsList");
            wrap.innerHTML = "";
            if (!activeStage) return;
            const participantes = stageParticipants();
            if (!participantes.length) {
                wrap.innerHTML = '<p class="hint">Marca primero los participantes de esta etapa.</p>';
                return;
            }
            participantes.forEach((t) => {
                const row = teamCheckboxRow(t, { checked: true, className: "stage-team-check" });
                // Ver qué disponibilidad marcó ese equipo antes de agendarle un partido.
                const link = document.createElement("button");
                link.type = "button";
                link.className = "team-avail-link";
                link.textContent = "ver horario";
                link.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    showTeamAvailability(t);
                });
                row.appendChild(link);
                wrap.appendChild(row);
            });
        }

        // --- Agendar manualmente ---
        //
        // Mismo endpoint que aceptar una sugerencia (/api/liga/matches/accept): no
        // depende de que exista una propuesta previa del algoritmo, solo revalida que
        // el bloque siga libre. Acá el admin elige equipos y horario a mano.
        function renderManualScheduleTeamOptions() {
            const selectA = document.getElementById("manualTeamA");
            const selectB = document.getElementById("manualTeamB");
            selectA.innerHTML = "";
            selectB.innerHTML = "";
            stageParticipants().forEach((t) => {
                const optA = document.createElement("option");
                optA.value = t.id;
                optA.textContent = teamLabel(t);
                selectA.appendChild(optA);
                selectB.appendChild(optA.cloneNode(true));
            });
            if (selectB.options.length > 1) selectB.selectedIndex = 1;
        }

        function populateHourSelect(select, defaultHour) {
            select.innerHTML = "";
            for (let h = START_HOUR; h <= END_HOUR; h++) {
                const opt = document.createElement("option");
                opt.value = String(h);
                opt.textContent = pad2(h) + ":00";
                if (h === defaultHour) opt.selected = true;
                select.appendChild(opt);
            }
        }

        document.getElementById("manualScheduleBtn").addEventListener("click", async () => {
            const errorEl = document.getElementById("manualScheduleError");
            hideError(errorEl);
            if (!activeStage) return;
            const teamA = document.getElementById("manualTeamA").value;
            const teamB = document.getElementById("manualTeamB").value;
            const date = document.getElementById("manualDate").value;
            const hour = Number(document.getElementById("manualHour").value);
            if (!teamA || !teamB) { showError(errorEl, "Elige los dos equipos."); return; }
            if (teamA === teamB) { showError(errorEl, "Los dos equipos no pueden ser el mismo."); return; }
            if (!date) { showError(errorEl, "Elige una fecha."); return; }
            const btn = document.getElementById("manualScheduleBtn");
            btn.disabled = true;
            try {
                await apiCall("/api/liga/matches/accept", "POST", {
                    stageId: activeStage.id, teamA, teamB, block: date + "-" + pad2(hour),
                    autoAssignReferees: document.getElementById("autoAssignRefereesManualCheck").checked,
                });
                document.getElementById("manualScheduleCard").removeAttribute("open");
                loadStageMatches();
                loadCalendar();
            } catch (err) {
                showError(errorEl, err.message);
            } finally {
                btn.disabled = false;
            }
        });

        // --- Calendarios de la etapa ---
        //
        // Dos grillas sobre la MISMA ventana de 3 semanas:
        //   allowedGridWrap : en qué bloques se puede agendar esta tanda (clickeable).
        //   leagueGridWrap  : qué hay agendado, propio o de otra liga (solo lectura).
        //
        // Un bloque bloqueado por el administrador o ya ocupado no se puede elegir: la
        // grilla lo muestra y no responde al click, igual que en /admin/horarios.
        let calendarData = { blocked: new Set(), occupied: new Set(), matchByBlock: {} };
        let allowedBlocks = new Set();
        // Partidos sugeridos todavía no aceptados, por bloque. Se pintan en el
        // calendario junto a los ya agendados para poder ver el resultado del
        // algoritmo en contexto, no solo como una lista de texto.
        let proposedByBlock = {};
        // blockCode -> índice que muestra la lista "Partidos". Se llena en
        // loadStageMatches() y lo lee el calendario para rotular la celda.
        let matchIndexByBlock = {};

        async function loadCalendar() {
            try {
                const data = await apiCall("/api/liga/calendar", "GET");
                calendarData = {
                    blocked: new Set(data.blocked || []),
                    occupied: new Set(data.occupied || []),
                    matchByBlock: {},
                };
                (data.matches || []).forEach((m) => { calendarData.matchByBlock[m.blockCode] = m; });
            } catch (err) {
                showError(currentError(), err.message);
            }
            renderAllowedGrid();
            renderLeagueGrid();
        }

        function cellStateOf(block) {
            if (calendarData.matchByBlock[block]) return "mine";
            if (calendarData.occupied.has(block)) return "occupied";
            if (calendarData.blocked.has(block)) return "blocked";
            return "free";
        }

        // Dibuja una grilla de 3 semanas. onCell(celda, bloque, estado) decide qué hacer
        // con cada celda; dayButton agrega el botón de marcar/desmarcar la columna.
        function renderGrid(wrap, onCell, dayButton) {
            wrap.innerHTML = "";
            getWindow().forEach((week) => {
                const weekDiv = document.createElement("div");
                weekDiv.className = "week-block";

                const label = document.createElement("div");
                label.className = "week-label";
                label.textContent = "Semana del " + week.label;
                weekDiv.appendChild(label);

                const table = document.createElement("table");
                table.className = "grid-table";

                const head = document.createElement("tr");
                head.appendChild(document.createElement("th"));
                week.days.forEach((day) => {
                    const th = document.createElement("th");
                    if (dayButton) {
                        const btn = document.createElement("button");
                        btn.type = "button";
                        btn.className = "day-toggle";
                        btn.textContent = day.dayLabel + " " + day.dayOfMonth;
                        btn.title = "Marcar o desmarcar todo el día";
                        btn.addEventListener("click", () => dayButton(day));
                        th.appendChild(btn);
                    } else {
                        th.textContent = day.dayLabel + " " + day.dayOfMonth;
                    }
                    head.appendChild(th);
                });
                table.appendChild(head);

                for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
                    const row = document.createElement("tr");
                    const hourTh = document.createElement("th");
                    hourTh.textContent = pad2(hour) + ":00";
                    row.appendChild(hourTh);

                    week.days.forEach((day) => {
                        const block = blockCodeOf(day, hour);
                        const td = document.createElement("td");
                        const cell = document.createElement("div");
                        cell.className = "grid-cell";
                        onCell(cell, block, cellStateOf(block));
                        td.appendChild(cell);
                        row.appendChild(td);
                    });
                    table.appendChild(row);
                }

                weekDiv.appendChild(table);
                wrap.appendChild(weekDiv);
            });
        }

        // ¿Se puede elegir este bloque para agendar? Ni ocupado ni bloqueado.
        function isChoosable(block) {
            const st = cellStateOf(block);
            return st === "free";
        }

        function renderAllowedGrid() {
            renderGrid(
                document.getElementById("allowedGridWrap"),
                (cell, block, state) => {
                    if (state !== "free") {
                        cell.classList.add(state === "mine" ? "occupied" : state);
                        cell.title = state === "blocked" ? "Bloqueado por el administrador" : "Ya ocupado por un partido";
                        return;
                    }
                    if (allowedBlocks.has(block)) cell.classList.add("chosen");
                    cell.addEventListener("click", () => {
                        if (allowedBlocks.has(block)) allowedBlocks.delete(block);
                        else allowedBlocks.add(block);
                        cell.classList.toggle("chosen", allowedBlocks.has(block));
                        syncProposeBtn();
                    });
                },
                (day) => {
                    // El botón del día marca la columna entera; si ya estaba toda
                    // marcada, la desmarca.
                    const bloques = [];
                    for (let h = START_HOUR; h <= END_HOUR; h++) {
                        const b = blockCodeOf(day, h);
                        if (isChoosable(b)) bloques.push(b);
                    }
                    if (!bloques.length) return;
                    const todosMarcados = bloques.every((b) => allowedBlocks.has(b));
                    bloques.forEach((b) => (todosMarcados ? allowedBlocks.delete(b) : allowedBlocks.add(b)));
                    renderAllowedGrid();
                    syncProposeBtn();
                }
            );
            syncProposeBtn();
        }

        // Sin bloques elegidos no hay nada entre lo que optimizar, así que sugerir no
        // tiene sentido: el botón queda deshabilitado y dice por qué.
        function syncProposeBtn() {
            const btn = document.getElementById("proposeBtn");
            if (!btn) return;
            const vacio = allowedBlocks.size === 0;
            btn.disabled = vacio;
            btn.title = vacio ? "Elige al menos un horario en el calendario de arriba" : "";
            const hint = document.getElementById("proposeHint");
            if (hint) hint.textContent = vacio
                ? "Elige al menos un horario para poder sugerir partidos."
                : "Horarios elegidos: " + allowedBlocks.size + ".";
        }

        // Cada celda con partido lleva su índice, el mismo que muestra la lista de
        // abajo: así se sabe QUÉ partido está en cada bloque sin pasar el mouse.
        // Agendados van numerados 1, 2, 3…; sugeridos S1, S2, S3…, que además se
        // distinguen por color.
        function renderLeagueGrid() {
            renderGrid(document.getElementById("leagueGridWrap"), (cell, block, state) => {
                const propuesto = proposedByBlock[block];
                if (propuesto) {
                    cell.classList.add("proposed");
                    cell.textContent = propuesto.label;
                    cell.title = "Sugerido " + propuesto.label + ": " + propuesto.teamAName + " vs " + propuesto.teamBName;
                    return;
                }
                if (state === "free") return;
                cell.classList.add(state);
                const m = calendarData.matchByBlock[block];
                if (m) {
                    const label = matchIndexByBlock[block];
                    if (label) cell.textContent = label;
                    cell.title = (label ? label + ": " : "") + m.teamAName + " vs " + m.teamBName +
                        " (" + (STATUS_LABELS[m.status] || m.status) + ")";
                } else if (state === "blocked") {
                    cell.title = "Bloqueado por el administrador";
                } else {
                    cell.title = "Ocupado por un partido de otra liga";
                }
            });
        }

        const STATUS_LABELS = {
            confirmed: "Por jugar",
            played: "Jugado",
            suspended: "Suspendido",
            cancelled: "Cancelado",
        };

        // --- Disponibilidad de un equipo ---
        //
        // Los mismos bloques de siempre, pintados con la escala 1-5 que marcó el equipo.
        // Un bloque sin marcar no es "no puede": el algoritmo lo trata como Regular (ver
        // lib/teamSchedule.js), y la leyenda lo dice para que no se lea como un rechazo.
        const availError = document.getElementById("availError");

        document.getElementById("backFromAvailBtn").addEventListener("click", () => {
            teamAvailPage.style.display = "none";
            stagePage.style.display = "block";
            window.scrollTo(0, 0);
        });

        async function showTeamAvailability(team) {
            stagePage.style.display = "none";
            teamAvailPage.style.display = "block";
            hideError(availError);
            window.scrollTo(0, 0);

            document.getElementById("availTeamName").textContent = teamLabel(team);
            document.getElementById("availSubtitle").textContent = "Disponibilidad que marcó para las próximas 3 semanas";
            const wrap = document.getElementById("availGridWrap");
            wrap.innerHTML = '<p class="hint">Cargando...</p>';

            let data;
            try {
                data = await apiCall("/api/liga/team-availability?teamId=" + encodeURIComponent(team.id), "GET");
            } catch (err) {
                wrap.innerHTML = "";
                showError(availError, err.message);
                return;
            }

            document.getElementById("availSubtitle").textContent = data.submitted
                ? "Disponibilidad que marcó para las próximas 3 semanas"
                : "Este equipo todavía no marcó su disponibilidad — cuenta como Regular en todos los bloques.";

            const happiness = data.happiness || {};
            renderGrid(wrap, (cell, block) => {
                const lvl = happiness[block];
                if (lvl >= 1 && lvl <= 5) {
                    cell.classList.add("lvl" + lvl);
                    cell.title = ["Muy mala", "Mala", "Regular", "Buena", "Excelente"][lvl - 1];
                } else {
                    cell.style.cursor = "default";
                    cell.title = "Sin marcar";
                }
            });
        }

        let lastByeTeamId = null;

        document.getElementById("proposeBtn").addEventListener("click", async () => {
            hideError(currentError());
            if (!activeStage) return;
            const selected = Array.from(document.querySelectorAll(".stage-team-check:checked")).map((i) => i.value);
            if (selected.length < 2) { showError(currentError(), "Elige al menos 2 equipos."); return; }
            if (allowedBlocks.size === 0) { showError(currentError(), "Elige al menos un horario."); return; }
            const btn = document.getElementById("proposeBtn");
            btn.disabled = true;
            try {
                const payload = { stageId: activeStage.id, teamIds: selected };
                if (lastByeTeamId) payload.byeTeamId = lastByeTeamId;
                if (document.getElementById("avoidRematchesCheck").checked) payload.avoidRematches = true;
                payload.allowedBlocks = Array.from(allowedBlocks);
                const res = await apiCall("/api/liga/matches/propose", "POST", payload);
                renderProposals(res, (byeId) => { lastByeTeamId = byeId; btn.click(); });
            } catch (err) { showError(currentError(), err.message); }
            finally { syncProposeBtn(); }
        });

        // Etiquetas de la escala 1-5 que marca cada equipo en /horarios.
        const HAPPINESS_LABELS = ["Muy mala", "Mala", "Regular", "Buena", "Excelente"];
        function happinessLabel(n) { return HAPPINESS_LABELS[n - 1] || "Sin marcar"; }

        function factChip(label, value) {
            const el = document.createElement("span");
            el.className = "fact";
            el.appendChild(document.createTextNode(label + " "));
            const strong = document.createElement("strong");
            strong.textContent = value;
            el.appendChild(strong);
            return el;
        }

        // El código de arbitraje se comparte por WhatsApp con el árbitro de turno, así
        // que copiarlo es lo que el admin viene a hacer con él. La API de portapapeles
        // solo existe en contexto seguro (https o localhost); si se entra por IP de la
        // red, se cae al textarea + execCommand, que sigue andando ahí.
        function copyToClipboard(text) {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text);
            }
            return new Promise((resolve, reject) => {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.setAttribute("readonly", "");
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                let ok = false;
                try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
                document.body.removeChild(ta);
                ok ? resolve() : reject(new Error("No se pudo copiar."));
            });
        }

        function codeChip(code) {
            const el = document.createElement("span");
            el.className = "fact";
            el.appendChild(document.createTextNode("Código para arbitrar "));
            const strong = document.createElement("strong");
            strong.textContent = code;
            el.appendChild(strong);

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "copy-btn";
            btn.title = "Copiar el código";
            btn.textContent = "Copiar";
            btn.addEventListener("click", async () => {
                try {
                    await copyToClipboard(code);
                    btn.textContent = "Copiado";
                    btn.classList.add("copied");
                } catch (err) {
                    btn.textContent = "No se pudo";
                }
                setTimeout(() => {
                    btn.textContent = "Copiar";
                    btn.classList.remove("copied");
                }, 1600);
            });
            el.appendChild(btn);
            return el;
        }

        // Mismo patrón que codeChip, para un link que ya trae el código incluido —
        // quien lo recibe entra directo a arbitrar sin tipear nada.
        function linkChip(url) {
            const el = document.createElement("span");
            el.className = "fact";
            el.appendChild(document.createTextNode("Link para arbitrar"));

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "copy-btn";
            btn.title = "Copiar el link";
            btn.textContent = "Copiar link";
            btn.addEventListener("click", async () => {
                try {
                    await copyToClipboard(url);
                    btn.textContent = "Copiado";
                    btn.classList.add("copied");
                } catch (err) {
                    btn.textContent = "No se pudo";
                }
                setTimeout(() => {
                    btn.textContent = "Copiar link";
                    btn.classList.remove("copied");
                }, 1600);
            });
            el.appendChild(btn);
            return el;
        }

        // Botón que abre el contacto privado de un equipo (WhatsApp/Telegram/
        // Instagram/Signal, cargado desde el roster) — null si no cargó ninguno. Mismas
        // fórmulas que frontend/src/components/SocialButtonsRow.tsx, reimplementadas acá
        // porque esta página no puede importar un componente de React Native.
        function contactUrl(contact) {
            if (!contact || !contact.type || !contact.value) return null;
            const value = contact.value.trim();
            if (contact.type === "whatsapp") return "https://wa.me/" + value.replace(/[^0-9]/g, "");
            const handle = value.replace(/^@+/, "");
            if (contact.type === "telegram") return "https://t.me/" + handle;
            if (contact.type === "instagram") return "https://instagram.com/" + handle;
            if (contact.type === "signal") return "https://signal.me/#p/" + handle;
            return null;
        }

        const CONTACT_LABELS = { whatsapp: "WhatsApp", telegram: "Telegram", instagram: "Instagram", signal: "Signal" };

        function teamContactButton(teamName, contact) {
            const url = contactUrl(contact);
            if (!url) return null;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-sm btn-secondary";
            btn.style.marginTop = "6px";
            btn.textContent = (CONTACT_LABELS[contact.type] || "Contacto") + ": " + teamName;
            btn.addEventListener("click", () => window.open(url, "_blank"));
            return btn;
        }

        // Cabecera común de las dos listas: índice + equipos a la izquierda, chip a la
        // derecha. El índice es el mismo que se pinta en la celda del calendario.
        function matchCardHead(index, proposed, teams, chip) {
            const head = document.createElement("div");
            head.className = "match-card-head";
            const title = document.createElement("div");
            title.className = "match-card-title";
            const idx = document.createElement("span");
            idx.className = "match-index" + (proposed ? " proposed" : "");
            idx.textContent = index;
            title.appendChild(idx);
            const names = document.createElement("span");
            names.className = "match-card-teams";
            names.textContent = teams;
            title.appendChild(names);
            head.appendChild(title);
            head.appendChild(chip);
            return head;
        }

        function renderProposals(res, onByeChange) {
            const wrap = document.getElementById("proposalsWrap");
            wrap.innerHTML = "";
            proposedByBlock = {};
            renderLeagueGrid();

            if (res.needsBye) {
                const p = document.createElement("p");
                p.className = "hint";
                p.textContent = "Cantidad impar de equipos — elige quién queda libre:";
                wrap.appendChild(p);
                const select = document.createElement("select");
                res.candidates.forEach((c) => {
                    const opt = document.createElement("option");
                    opt.value = c.id;
                    opt.textContent = (c.name || c.username || c.id) + (c.id === res.suggestedByeTeamId ? " (sugerido)" : "");
                    if (c.id === res.suggestedByeTeamId) opt.selected = true;
                    select.appendChild(opt);
                });
                wrap.appendChild(select);
                const btn = document.createElement("button");
                btn.className = "btn btn-sm";
                btn.textContent = "Usar este bye";
                btn.addEventListener("click", () => onByeChange(select.value));
                wrap.appendChild(btn);
                return;
            }

            if (res.infeasible) {
                wrap.innerHTML = '<p class="hint">No existe ningún emparejamiento posible con los equipos y los horarios elegidos.</p>';
                return;
            }

            const heading = document.createElement("h3");
            heading.style.margin = "16px 0 4px";
            heading.style.fontSize = "15px";
            heading.textContent = "Sugerencias (" + res.matches.length + ")";
            wrap.appendChild(heading);

            // El resumen explica QUÉ optimizó el algoritmo, no solo los números.
            const summary = document.createElement("p");
            summary.className = "hint";
            summary.textContent =
                "Todavía no están agendadas: acepta las que te sirvan. Se buscó el horario que" +
                " deje más contentos a los dos equipos; en el peor caso quedó una diferencia de " +
                // maxGap y no threshold: el umbral es lo que se BUSCÓ, y liberar un
                // bloque disputado puede obligar a un partido a quedar por encima.
                (res.maxGap !== null && res.maxGap !== undefined ? res.maxGap : res.threshold).toFixed(2) +
                " entre ellos." +
                (res.byeTeamId ? " Queda libre esta fecha: " + (res.byeTeamName || res.byeTeamId) + "." : "");
            wrap.appendChild(summary);

            res.matches.forEach((m, i) => {
                const label = "S" + (i + 1);
                // Pintar la sugerencia en el calendario de la liga: es la forma de ver
                // dónde cae respecto de lo ya agendado sin cruzar dos listas a mano.
                proposedByBlock[m.block] = { label, teamAName: m.teamAName, teamBName: m.teamBName };

                const card = document.createElement("div");
                card.className = "match-card proposed";

                const chip = document.createElement("span");
                chip.className = "match-card-when";
                chip.textContent = formatBlockLabel(m.block);
                card.appendChild(matchCardHead(label, true, m.teamAName + " vs " + m.teamBName, chip));

                const facts = document.createElement("div");
                facts.className = "match-card-facts";
                facts.appendChild(factChip("Para " + m.teamAName + ":", happinessLabel(m.happinessA)));
                facts.appendChild(factChip("Para " + m.teamBName + ":", happinessLabel(m.happinessB)));
                facts.appendChild(factChip("Diferencia:", m.gap.toFixed(2)));
                card.appendChild(facts);

                // Los dos límites conocidos del algoritmo, dichos en vez de escondidos:
                // este partido tuvo que ceder justicia (o directamente la hora) porque
                // otro par del mismo lote se quedó con el bloque que le tocaba.
                if (m.overThreshold || m.collision) {
                    const aviso = document.createElement("p");
                    aviso.className = "hint";
                    aviso.style.margin = "4px 0 0";
                    aviso.textContent = m.collision
                        ? "Ojo: no quedaba ningún otro horario en común, así que coincide con otra sugerencia de esta misma tanda. Agenda solo una de las dos."
                        : "Ojo: para no chocar con otra sugerencia de esta tanda, este partido quedó con más diferencia que el resto.";
                    card.appendChild(aviso);
                }

                const actions = document.createElement("div");
                actions.className = "match-actions";
                const acceptBtn = document.createElement("button");
                acceptBtn.className = "btn btn-sm btn-accept";
                acceptBtn.textContent = "Agendar";
                acceptBtn.addEventListener("click", async () => {
                    acceptBtn.disabled = true;
                    try {
                        await apiCall("/api/liga/matches/accept", "POST", {
                            stageId: activeStage.id,
                            teamA: m.teamA, teamB: m.teamB, block: m.block,
                            happinessA: m.happinessA, happinessB: m.happinessB, gap: m.gap,
                            autoAssignReferees: document.getElementById("autoAssignRefereesCheck").checked,
                        });
                        delete proposedByBlock[m.block];
                        card.remove();
                        loadStageMatches();
                        loadCalendar();
                    } catch (err) { showError(currentError(), err.message); acceptBtn.disabled = false; }
                });
                const rejectBtn = document.createElement("button");
                rejectBtn.className = "btn btn-sm btn-reject";
                rejectBtn.textContent = "Descartar";
                rejectBtn.addEventListener("click", () => {
                    delete proposedByBlock[m.block];
                    card.remove();
                    renderLeagueGrid();
                });
                actions.appendChild(acceptBtn);
                actions.appendChild(rejectBtn);
                card.appendChild(actions);
                wrap.appendChild(card);
            });

            renderLeagueGrid();
        }

        // 2 equipos árbitro por partido, de la misma etapa, siempre editable. Los
        // candidatos son los participantes de la etapa que no juegan este partido —
        // etiquetados con cuántos partidos ya arbitraron, para que el admin vea a
        // simple vista a quién le toca antes de elegir.
        function renderRefereeAssignment(m, refereeCounts) {
            const wrap = document.createElement("div");
            wrap.style.marginTop = "10px";

            const label = document.createElement("div");
            label.className = "hint";
            label.style.marginBottom = "4px";
            label.textContent = "Árbitros:";
            wrap.appendChild(label);

            const candidates = stageParticipants().filter((t) => t.id !== m.teamA && t.id !== m.teamB);

            function buildSelect(selectedId) {
                const select = document.createElement("select");
                const noneOpt = document.createElement("option");
                noneOpt.value = "";
                noneOpt.textContent = "Sin asignar";
                select.appendChild(noneOpt);
                candidates.forEach((t) => {
                    const opt = document.createElement("option");
                    opt.value = t.id;
                    opt.textContent = teamLabel(t) + " (arbitró " + (refereeCounts[t.id] || 0) + ")";
                    if (t.id === selectedId) opt.selected = true;
                    select.appendChild(opt);
                });
                return select;
            }

            const currentRefs = m.refereeTeams || [];
            const selectA = buildSelect(currentRefs[0]);
            const selectB = buildSelect(currentRefs[1]);
            wrap.appendChild(selectA);
            wrap.appendChild(selectB);

            const errorEl = document.createElement("p");
            errorEl.className = "hint";
            errorEl.style.color = "var(--danger-color)";
            errorEl.style.display = "none";
            wrap.appendChild(errorEl);

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "btn btn-sm";
            saveBtn.style.marginTop = "6px";
            saveBtn.textContent = "Guardar árbitros";
            saveBtn.addEventListener("click", async () => {
                errorEl.style.display = "none";
                const ids = [selectA.value, selectB.value].filter(Boolean);
                if (ids.length === 2 && ids[0] === ids[1]) {
                    errorEl.textContent = "Los dos árbitros no pueden ser el mismo equipo.";
                    errorEl.style.display = "block";
                    return;
                }
                saveBtn.disabled = true;
                try {
                    await apiCall("/api/liga/matches/set-referees", "POST", { matchId: m.id, refereeTeamIds: ids });
                    loadStageMatches();
                } catch (err) {
                    errorEl.textContent = err.message;
                    errorEl.style.display = "block";
                    saveBtn.disabled = false;
                }
            });
            wrap.appendChild(saveBtn);

            return wrap;
        }

        async function loadStageMatches() {
            if (!activeStage) return;
            const list = document.getElementById("stageMatchesList");
            list.innerHTML = '<p class="hint">Cargando...</p>';
            let data;
            try {
                data = await apiCall("/api/liga/matches?stageId=" + activeStage.id, "GET");
            } catch (err) { showError(currentError(), err.message); return; }

            list.innerHTML = "";
            if (!data.matches.length) {
                list.innerHTML = '<p class="hint">Todavía no hay partidos en esta etapa. Agenda uno desde "Agendar partidos".</p>';
                return;
            }

            // El índice de cada partido es su posición acá, y es el que se pinta en la
            // celda del calendario. La lista viene ordenada por bloque desde el servidor,
            // así que el orden de los números sigue al del calendario.
            matchIndexByBlock = {};
            data.matches.forEach((m, i) => {
                const label = String(i + 1);
                if (m.blockCode) matchIndexByBlock[m.blockCode] = label;

                const card = document.createElement("div");
                card.className = "match-card";

                const chip = document.createElement("span");
                chip.className = "status-chip status-" + m.status;
                chip.textContent = STATUS_LABELS[m.status] || m.status;
                card.appendChild(matchCardHead(label, false, m.teamAName + " vs " + m.teamBName, chip));

                const when = document.createElement("div");
                when.className = "match-card-when";
                when.textContent = formatBlockLabel(m.blockCode);
                card.appendChild(when);

                const facts = document.createElement("div");
                facts.className = "match-card-facts";
                if (m.status === "played") {
                    facts.appendChild(factChip("Resultado:", (m.scoreA || 0) + " - " + (m.scoreB || 0)));
                } else if (m.status === "confirmed") {
                    // El código es lo que habilita a arbitrar: es el dato que el admin
                    // viene a buscar a esta lista. El link ya lo trae incluido, para
                    // compartir de una sola vez.
                    facts.appendChild(codeChip(m.code));
                    if (m.arbitrateUrl) facts.appendChild(linkChip(m.arbitrateUrl));
                }
                if (facts.childNodes.length) card.appendChild(facts);

                const contactsRow = document.createElement("div");
                const contactBtnA = teamContactButton(m.teamAName, m.teamAContact);
                const contactBtnB = teamContactButton(m.teamBName, m.teamBContact);
                if (contactBtnA) contactsRow.appendChild(contactBtnA);
                if (contactBtnB) contactsRow.appendChild(contactBtnB);
                if (contactsRow.childNodes.length) card.appendChild(contactsRow);

                if (m.status !== "cancelled") {
                    card.appendChild(renderRefereeAssignment(m, data.refereeCounts || {}));
                }

                if (m.status === "confirmed" || m.status === "suspended") {
                    const actions = document.createElement("div");
                    actions.className = "match-actions";
                    const btn = document.createElement("button");
                    btn.className = "btn btn-sm " + (m.status === "confirmed" ? "btn-secondary" : "btn-accept");
                    btn.textContent = m.status === "confirmed" ? "Suspender" : "Reactivar";
                    btn.addEventListener("click", async () => {
                        const verb = m.status === "confirmed" ? "suspender" : "reactivar";
                        if (!confirm("¿" + verb.charAt(0).toUpperCase() + verb.slice(1) + " este partido?")) return;
                        btn.disabled = true;
                        try {
                            await apiCall(
                                "/api/liga/matches/" + (m.status === "confirmed" ? "suspend" : "reactivate"),
                                "POST",
                                { matchId: m.id }
                            );
                            loadStageMatches();
                            loadCalendar();
                        } catch (err) { showError(currentError(), err.message); btn.disabled = false; }
                    });
                    actions.appendChild(btn);

                    const editBtn = document.createElement("button");
                    editBtn.className = "btn btn-sm btn-secondary";
                    editBtn.textContent = "Editar";
                    editBtn.addEventListener("click", () => openEditMatchModal(m));
                    actions.appendChild(editBtn);

                    const deleteBtn = document.createElement("button");
                    deleteBtn.className = "btn btn-sm btn-danger";
                    deleteBtn.textContent = "Eliminar";
                    deleteBtn.addEventListener("click", async () => {
                        if (!confirm("¿Eliminar este partido? " + m.teamAName + " vs " + m.teamBName + ", " + formatBlockLabel(m.blockCode) + ". No se puede deshacer.")) return;
                        deleteBtn.disabled = true;
                        try {
                            await apiCall("/api/liga/matches/delete", "POST", { matchId: m.id });
                            loadStageMatches();
                            loadCalendar();
                        } catch (err) { showError(currentError(), err.message); deleteBtn.disabled = false; }
                    });
                    actions.appendChild(deleteBtn);

                    card.appendChild(actions);
                }

                list.appendChild(card);
            });

            renderLeagueGrid();
        }

        // Dificultad acumulada de rivales, EN ESTA ETAPA (no toda la liga — cada etapa
        // arranca el balance desde cero) — solo lectura, solo para este panel.
        async function loadDifficultySummary() {
            if (!activeStage) return;
            const list = document.getElementById("difficultySummaryList");
            list.innerHTML = '<p class="hint">Cargando...</p>';
            let data;
            try {
                data = await apiCall("/api/liga/difficulty-summary?stageId=" + activeStage.id, "GET");
            } catch (err) {
                list.innerHTML = "";
                showError(currentError(), err.message);
                return;
            }
            list.innerHTML = "";
            if (!data.teams.length) {
                list.innerHTML = '<p class="hint">Esta etapa todavía no tiene participantes.</p>';
                return;
            }
            const table = document.createElement("table");
            table.className = "summary-table";
            const thead = document.createElement("thead");
            thead.innerHTML = "<tr><th>Equipo</th><th>Nota</th><th>Partidos</th><th>Suma rival</th><th>Promedio rival</th></tr>";
            table.appendChild(thead);
            const tbody = document.createElement("tbody");
            data.teams.forEach((t) => {
                const tr = document.createElement("tr");
                const cells = [
                    t.teamName,
                    t.ownDifficulty !== null ? String(t.ownDifficulty) : "—",
                    t.matchesCount ? String(t.matchesCount) : "—",
                    t.matchesCount ? String(t.facedTotal) : "—",
                    t.matchesCount ? t.average.toFixed(1) : "—",
                ];
                cells.forEach((text) => {
                    const td = document.createElement("td");
                    td.textContent = text;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            list.appendChild(table);
        }

        // --- Cargar partido jugado (retroactivo) ---
        //
        // Crea el partido directo en status:'played', con todo lo que un árbitro real
        // habría podido registrar en vivo (convocatoria, goles, tarjetas, penales) pero
        // sin depender de que cada evento tenga hora exacta: el minuto es opcional por
        // fila, y no se generan eventos de reloj — summarizeEvents() no los necesita
        // para derivar el marcador de un partido que ya nace 'played'.
        const retroactiveModal = document.getElementById("retroactiveMatchModal");
        const retroactiveForm = document.getElementById("retroactiveForm");
        const retroactiveError = document.getElementById("retroactiveError");
        let retroRosterCache = {};

        // Réplica de newEventId() de frontend/src/utils/matchEvents.ts: cada evento
        // necesita una identidad propia, porque sin la hora real la clave legada del
        // servidor ("legacy:tipo@undefined") colisionaría entre dos goles del mismo tipo.
        function newClientEventId() {
            if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
            return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        }

        async function loadTeamRoster(teamId) {
            if (retroRosterCache[teamId]) return retroRosterCache[teamId];
            const filter = 'team = "' + teamId + '" && deleted = false';
            const data = await apiCall("/api/collections/team_players/records?filter=" + encodeURIComponent(filter) + "&sort=name&perPage=200", "GET");
            const roster = data.items || [];
            retroRosterCache[teamId] = roster;
            return roster;
        }

        function teamIdForLetter(letter) {
            return document.getElementById(letter === "A" ? "retroTeamA" : "retroTeamB").value;
        }
        function teamNameForLetter(letter) {
            const select = document.getElementById(letter === "A" ? "retroTeamA" : "retroTeamB");
            const opt = select.selectedOptions[0];
            return opt ? opt.textContent : "Equipo " + letter;
        }

        function resetRetroDynamicSections() {
            document.getElementById("retroGoalsList").innerHTML = "";
            document.getElementById("retroCardsList").innerHTML = "";
            document.getElementById("retroPenaltiesList").innerHTML = "";
            document.getElementById("retroLineupA").innerHTML = '<p class="hint">Elige el equipo A para ver su plantel.</p>';
            document.getElementById("retroLineupB").innerHTML = '<p class="hint">Elige el equipo B para ver su plantel.</p>';
            document.getElementById("retroLineupACard").open = false;
            document.getElementById("retroLineupBCard").open = false;
        }
        document.getElementById("retroTeamA").addEventListener("change", resetRetroDynamicSections);
        document.getElementById("retroTeamB").addEventListener("change", resetRetroDynamicSections);

        async function renderLineupChecklist(side) {
            const teamId = teamIdForLetter(side);
            const wrap = document.getElementById(side === "A" ? "retroLineupA" : "retroLineupB");
            wrap.innerHTML = '<p class="hint">Cargando...</p>';
            let roster;
            try {
                roster = await loadTeamRoster(teamId);
            } catch (err) {
                wrap.innerHTML = "";
                showError(retroactiveError, err.message);
                return;
            }
            wrap.innerHTML = "";
            if (!roster.length) {
                wrap.innerHTML = '<p class="hint">Este equipo no tiene jugadores cargados en su plantel.</p>';
                return;
            }
            roster.forEach((p) => {
                const row = document.createElement("label");
                row.className = "team-checkbox-row";
                const input = document.createElement("input");
                input.type = "checkbox";
                input.value = p.id;
                input.dataset.name = p.name;
                row.appendChild(input);
                row.appendChild(document.createTextNode(" " + p.name));
                wrap.appendChild(row);
            });
        }
        document.getElementById("retroLineupACard").addEventListener("toggle", (e) => {
            if (e.target.open) renderLineupChecklist("A");
        });
        document.getElementById("retroLineupBCard").addEventListener("toggle", (e) => {
            if (e.target.open) renderLineupChecklist("B");
        });

        // Una fila de gol/tarjeta/penal: equipo + jugador (del roster, "Sin jugador" si
        // se deja en blanco) + lo específico del tipo + minuto opcional. La convocatoria
        // queda completamente desacoplada de este selector: se puede anotar un gol de un
        // jugador sin haberlo marcado antes en "Convocatoria".
        function addEventRow(listId, kind) {
            const list = document.getElementById(listId);
            const row = document.createElement("div");
            row.className = "dynamic-row";

            const teamSelect = document.createElement("select");
            ["A", "B"].forEach((letter) => {
                const opt = document.createElement("option");
                opt.value = letter;
                opt.textContent = teamNameForLetter(letter);
                teamSelect.appendChild(opt);
            });
            row.appendChild(teamSelect);

            const playerSelect = document.createElement("select");
            row.appendChild(playerSelect);
            populateRowPlayerSelect(playerSelect, teamSelect.value);
            teamSelect.addEventListener("change", () => populateRowPlayerSelect(playerSelect, teamSelect.value));

            let extraControl;
            if (kind === "goal") {
                const label = document.createElement("label");
                extraControl = document.createElement("input");
                extraControl.type = "checkbox";
                label.appendChild(extraControl);
                label.appendChild(document.createTextNode(" Autogol"));
                row.appendChild(label);
            } else if (kind === "card") {
                extraControl = document.createElement("select");
                extraControl.style.minWidth = "90px";
                [["yellow_card", "Amarilla"], ["red_card", "Roja"]].forEach((pair) => {
                    const opt = document.createElement("option");
                    opt.value = pair[0];
                    opt.textContent = pair[1];
                    extraControl.appendChild(opt);
                });
                row.appendChild(extraControl);
            } else {
                const label = document.createElement("label");
                extraControl = document.createElement("input");
                extraControl.type = "checkbox";
                extraControl.checked = true;
                label.appendChild(extraControl);
                label.appendChild(document.createTextNode(" Convertido"));
                row.appendChild(label);
            }

            const minuteInput = document.createElement("input");
            minuteInput.type = "number";
            minuteInput.min = "0";
            minuteInput.max = "200";
            minuteInput.placeholder = "Minuto";
            row.appendChild(minuteInput);

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "remove-row-btn";
            removeBtn.title = "Quitar fila";
            removeBtn.textContent = "×";
            removeBtn.addEventListener("click", () => row.remove());
            row.appendChild(removeBtn);

            row._retroGetEvent = function () {
                const letter = teamSelect.value;
                const playerOpt = playerSelect.selectedOptions[0];
                const base = { id: newClientEventId(), team: letter };
                if (playerOpt && playerOpt.value) {
                    base.playerId = playerOpt.value;
                    base.player = playerOpt.textContent;
                }
                if (minuteInput.value !== "") base.minute = Number(minuteInput.value);
                if (kind === "goal") { base.type = "goal"; base.ownGoal = extraControl.checked; }
                else if (kind === "card") { base.type = extraControl.value; }
                else { base.type = "penalty"; base.scored = extraControl.checked; }
                return base;
            };

            list.appendChild(row);
        }

        async function populateRowPlayerSelect(playerSelect, letter) {
            playerSelect.innerHTML = '<option value="">Sin jugador</option>';
            const teamId = teamIdForLetter(letter);
            if (!teamId) return;
            let roster;
            try { roster = await loadTeamRoster(teamId); } catch (err) { return; }
            roster.forEach((p) => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = p.name;
                playerSelect.appendChild(opt);
            });
        }

        document.getElementById("addGoalBtn").addEventListener("click", () => addEventRow("retroGoalsList", "goal"));
        document.getElementById("addCardBtn").addEventListener("click", () => addEventRow("retroCardsList", "card"));
        document.getElementById("addPenaltyBtn").addEventListener("click", () => addEventRow("retroPenaltiesList", "penalty"));

        function openRetroactiveModal() {
            if (!activeStage) return;
            hideError(retroactiveError);
            retroactiveForm.reset();
            retroRosterCache = {};
            resetRetroDynamicSections();

            const selectA = document.getElementById("retroTeamA");
            const selectB = document.getElementById("retroTeamB");
            selectA.innerHTML = "";
            selectB.innerHTML = "";
            stageParticipants().forEach((t) => {
                const optA = document.createElement("option");
                optA.value = t.id;
                optA.textContent = teamLabel(t);
                selectA.appendChild(optA);
                selectB.appendChild(optA.cloneNode(true));
            });
            if (selectB.options.length > 1) selectB.selectedIndex = 1;

            const dateInput = document.getElementById("retroDate");
            dateInput.max = formatDateStr(new Date());
            dateInput.value = "";

            const hourSelect = document.getElementById("retroHour");
            hourSelect.innerHTML = '<option value="">Sin especificar</option>';
            for (let h = START_HOUR; h <= END_HOUR; h++) {
                const opt = document.createElement("option");
                opt.value = String(h);
                opt.textContent = pad2(h) + ":00";
                hourSelect.appendChild(opt);
            }

            retroactiveModal.classList.add("open");
        }
        function closeRetroactiveModal() { retroactiveModal.classList.remove("open"); }

        document.getElementById("openRetroactiveBtn").addEventListener("click", openRetroactiveModal);
        document.getElementById("cancelRetroBtn").addEventListener("click", closeRetroactiveModal);
        retroactiveModal.addEventListener("click", (e) => { if (e.target === retroactiveModal) closeRetroactiveModal(); });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && retroactiveModal.classList.contains("open")) closeRetroactiveModal();
        });

        retroactiveForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError(retroactiveError);
            if (!activeStage) return;

            const teamA = document.getElementById("retroTeamA").value;
            const teamB = document.getElementById("retroTeamB").value;
            const date = document.getElementById("retroDate").value;
            const hourValue = document.getElementById("retroHour").value;
            const notes = document.getElementById("retroNotes").value.trim();

            if (!teamA || !teamB) { showError(retroactiveError, "Elige los dos equipos."); return; }
            if (teamA === teamB) { showError(retroactiveError, "Los dos equipos no pueden ser el mismo."); return; }
            if (!date) { showError(retroactiveError, "Elige una fecha."); return; }

            const events = [];

            function lineupEvent(side) {
                const wrap = document.getElementById(side === "A" ? "retroLineupA" : "retroLineupB");
                const checked = Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked'));
                if (!checked.length) return null;
                return {
                    id: newClientEventId(),
                    type: "lineup",
                    team: side,
                    players: checked.map((input) => ({ playerId: input.value, name: input.dataset.name })),
                };
            }
            const lineupA = lineupEvent("A");
            const lineupB = lineupEvent("B");
            if (lineupA) events.push(lineupA);
            if (lineupB) events.push(lineupB);

            ["retroGoalsList", "retroCardsList", "retroPenaltiesList"].forEach((listId) => {
                document.getElementById(listId).querySelectorAll(".dynamic-row").forEach((row) => {
                    if (row._retroGetEvent) events.push(row._retroGetEvent());
                });
            });

            const payload = { stageId: activeStage.id, teamA, teamB, date, notes, events };
            if (hourValue) payload.hour = Number(hourValue);

            const btn = document.getElementById("submitRetroBtn");
            btn.disabled = true;
            try {
                await apiCall("/api/liga/matches/retroactive", "POST", payload);
                closeRetroactiveModal();
                loadStageMatches();
                loadCalendar();
            } catch (err) {
                showError(retroactiveError, err.message);
            } finally {
                btn.disabled = false;
            }
        });

        // --- Editar partido (solo confirmed/suspended) ---
        //
        // Mismo endpoint de validación que agendar (equipos del roster, participantes
        // de la etapa, bloque libre), pero contra /api/liga/matches/update, que además
        // excluye este mismo partido de la revisión de bloque ocupado.
        const editMatchModal = document.getElementById("editMatchModal");
        const editMatchForm = document.getElementById("editMatchForm");
        const editMatchError = document.getElementById("editMatchError");
        let editingMatchId = null;

        function openEditMatchModal(m) {
            editingMatchId = m.id;
            hideError(editMatchError);

            const selectA = document.getElementById("editTeamA");
            const selectB = document.getElementById("editTeamB");
            selectA.innerHTML = "";
            selectB.innerHTML = "";
            stageParticipants().forEach((t) => {
                const optA = document.createElement("option");
                optA.value = t.id;
                optA.textContent = teamLabel(t);
                selectA.appendChild(optA);
                selectB.appendChild(optA.cloneNode(true));
            });
            selectA.value = m.teamA;
            selectB.value = m.teamB;

            const hour = m.blockCode.slice(-2);
            const date = m.blockCode.slice(0, -3);
            document.getElementById("editDate").value = date;
            populateHourSelect(document.getElementById("editHour"), Number(hour));

            editMatchModal.classList.add("open");
        }
        function closeEditMatchModal() { editMatchModal.classList.remove("open"); editingMatchId = null; }

        document.getElementById("cancelEditMatchBtn").addEventListener("click", closeEditMatchModal);
        editMatchModal.addEventListener("click", (e) => { if (e.target === editMatchModal) closeEditMatchModal(); });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && editMatchModal.classList.contains("open")) closeEditMatchModal();
        });

        editMatchForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideError(editMatchError);
            if (!editingMatchId) return;

            const teamA = document.getElementById("editTeamA").value;
            const teamB = document.getElementById("editTeamB").value;
            const date = document.getElementById("editDate").value;
            const hour = Number(document.getElementById("editHour").value);
            if (!teamA || !teamB) { showError(editMatchError, "Elige los dos equipos."); return; }
            if (teamA === teamB) { showError(editMatchError, "Los dos equipos no pueden ser el mismo."); return; }
            if (!date) { showError(editMatchError, "Elige una fecha."); return; }

            const btn = document.getElementById("submitEditMatchBtn");
            btn.disabled = true;
            try {
                await apiCall("/api/liga/matches/update", "POST", {
                    matchId: editingMatchId, teamA, teamB, block: date + "-" + pad2(hour),
                });
                closeEditMatchModal();
                loadStageMatches();
                loadCalendar();
            } catch (err) {
                showError(editMatchError, err.message);
            } finally {
                btn.disabled = false;
            }
        });

        // Al final del script a propósito: showPanel()/loadRoster()/loadStages() usan
        // consts (rosterList, stagesList, etc.) declaradas más abajo en este mismo
        // script — si este chequeo de sesión corre antes de esas declaraciones, revienta
        // con "can't access lexical declaration before initialization" (temporal dead
        // zone), que es justo el bug que esto corrige.
        //
        // gateSession valida el token contra el servidor (auth-refresh) antes de decidir
        // qué mostrar — antes se confiaba en que un token presente en localStorage
        // seguía sirviendo, así que una sesión vencida mostraba el panel igual y recién
        // fallaba al primer POST.
        gateSession("users", "liga_auth", (freshToken, record) => {
            token = freshToken;
            showPanel(record && record.name, record && record.id);
        }, (hadStaleSession) => showLogin(hadStaleSession));
    </script>
</body>
</html>
    `;
    return e.html(200, htmlContent);
});

routerAdd("GET", "/api/liga/polla", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        return e.json(200, {
            enabled: e.auth.getBool("pollaEnabled"),
            name: e.auth.getString("name") || e.auth.getString("username") || "",
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/polla:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo leer el estado de la polla." });
    }
}, $apis.requireAuth("users"));

// Habilitar es un click; deshabilitar exige escribir el nombre de la liga.
//
// No es una barrera de seguridad (la sesión ya está autenticada como la liga): es una
// barrera contra el descuido. Apagar la polla saca de la vista algo con lo que puede
// haber gente jugando hace semanas, y un toggle suelto en un panel se aprieta sin
// querer. Las apuestas NO se borran — se conservan y reaparecen si se reactiva.
routerAdd("POST", "/api/liga/polla", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const enabled = Boolean(body.enabled);

        if (!enabled) {
            const expected = e.auth.getString("name") || e.auth.getString("username") || "";
            const given = String(body.confirmName || "").trim();
            if (!expected || given !== expected) {
                throw new BadRequestError("Escribe el nombre exacto de la liga para deshabilitar la polla.");
            }
        }

        const league = $app.findRecordById("users", e.auth.id);
        league.set("pollaEnabled", enabled);
        $app.save(league);

        return e.json(200, { success: true, enabled: enabled });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/polla:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cambiar el estado de la polla." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/liga/beaumarket-auto", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        return e.json(200, { enabled: e.auth.getBool("beaumarketAutoEnabled") });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/beaumarket-auto:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo leer el estado del mercado automático." });
    }
}, $apis.requireAuth("users"));

// A diferencia de la polla, apagar esto no oculta nada con lo que la gente ya esté
// jugando — solo deja de crear un mercado nuevo para partidos que se agenden de acá en
// adelante. Los mercados ya creados siguen su curso normal. Por eso es un toggle
// directo, sin la barrera de "escribe el nombre de la liga" que sí tiene la polla.
routerAdd("POST", "/api/liga/beaumarket-auto", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const enabled = Boolean(body.enabled);

        const league = $app.findRecordById("users", e.auth.id);
        league.set("beaumarketAutoEnabled", enabled);
        $app.save(league);

        return e.json(200, { success: true, enabled: enabled });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/beaumarket-auto:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cambiar el estado del mercado automático." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/liga/roster", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const allTeams = $app.findRecordsByFilter("users", "type = 'organization' && subtype = 'team'", "name", 500, 0);
        const myRows = $app.findRecordsByFilter("league_teams", "league = {:league} && deleted = false", "", 0, 0, { league: e.auth.id });
        const myTeamIds = new Set(myRows.map((r) => r.getString("team")));
        // Contacto y dificultad son detalles PRIVADOS de administración de esta liga
        // (viven en league_teams, nunca en users) — solo tiene sentido incluirlos para
        // equipos que ya están en el roster; para el resto (candidatos a agregar) alcanza
        // con la identidad básica.
        const detailsByTeam = {};
        myRows.forEach((r) => {
            const difficulty = r.get("difficulty");
            detailsByTeam[r.getString("team")] = {
                contactType: r.getString("contactType") || null,
                contactValue: r.getString("contactValue") || "",
                difficulty: difficulty !== null && difficulty !== undefined && difficulty !== "" ? Number(difficulty) : null,
            };
        });
        return e.json(200, {
            allTeams: allTeams.map((t) => {
                const base = { id: t.id, name: t.getString("name"), username: t.getString("username") };
                if (myTeamIds.has(t.id)) Object.assign(base, detailsByTeam[t.id]);
                return base;
            }),
            myTeamIds: Array.from(myTeamIds),
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/roster:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar el roster." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/roster/toggle", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const teamId = String(body.teamId || "");
        if (!teamId) throw new BadRequestError("Falta teamId.");

        let team;
        try {
            team = $app.findRecordById("users", teamId);
        } catch (err) {
            throw new BadRequestError("El equipo indicado no existe.");
        }
        if (team.getString("type") !== "organization" || team.getString("subtype") !== "team") {
            throw new BadRequestError("Esa cuenta no es un equipo.");
        }

        // Sin filtrar por `deleted` acá a propósito: hace falta encontrar la fila aunque
        // esté soft-borrada, para reactivarla en vez de chocar con el índice único
        // (league, team) al intentar crear una nueva.
        let existing = null;
        try {
            existing = $app.findFirstRecordByFilter(
                "league_teams",
                "league = {:league} && team = {:team}",
                { league: e.auth.id, team: teamId }
            );
        } catch (err) {
            existing = null;
        }

        if (existing) {
            const wasDeleted = existing.getBool("deleted");
            existing.set("deleted", !wasDeleted);
            $app.save(existing);
            return e.json(200, { inRoster: wasDeleted });
        }

        const coll = $app.findCollectionByNameOrId("league_teams");
        const record = new Record(coll);
        record.set("league", e.auth.id);
        record.set("team", teamId);
        $app.save(record);
        return e.json(200, { inRoster: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/roster/toggle:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo actualizar el roster." });
    }
}, $apis.requireAuth("users"));

// Contacto privado de administración (nunca el perfil social del equipo, ver la
// migración 1788000000) y nota de dificultad (1-10, para el balance del algoritmo de
// sugerencia) — ambos viven en la fila de league_teams de ESTA liga, nunca en `users`.
routerAdd("POST", "/api/liga/roster/team-details", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const teamId = String(body.teamId || "");
        if (!teamId) throw new BadRequestError("Falta teamId.");

        let rosterRow;
        try {
            rosterRow = $app.findFirstRecordByFilter(
                "league_teams", "league = {:league} && team = {:team} && deleted = false",
                { league: e.auth.id, team: teamId }
            );
        } catch (err) {
            throw new BadRequestError("Ese equipo no pertenece a tu liga.");
        }

        if (Object.prototype.hasOwnProperty.call(body, "difficulty")) {
            const raw = body.difficulty;
            if (raw === null || raw === "") {
                rosterRow.set("difficulty", null);
            } else {
                const n = Number(raw);
                if (!Number.isFinite(n) || n < 1 || n > 10) {
                    throw new BadRequestError("La dificultad debe ser un número entre 1 y 10.");
                }
                rosterRow.set("difficulty", Math.round(n));
            }
        }

        const VALID_CONTACT_TYPES = ["whatsapp", "telegram", "instagram", "signal"];
        if (Object.prototype.hasOwnProperty.call(body, "contactType")) {
            const t = body.contactType === null ? "" : String(body.contactType || "");
            if (t && !VALID_CONTACT_TYPES.includes(t)) {
                throw new BadRequestError("Tipo de contacto inválido.");
            }
            rosterRow.set("contactType", t);
        }
        if (Object.prototype.hasOwnProperty.call(body, "contactValue")) {
            rosterRow.set("contactValue", String(body.contactValue || ""));
        }

        $app.save(rosterRow);
        return e.json(200, { success: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/roster/team-details:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo guardar." });
    }
}, $apis.requireAuth("users"));

// Estado de los bloques de la ventana móvil, para dibujar los calendarios del panel.
//
// Devuelve tres cosas distintas a propósito:
//   - blocked  : bloques cerrados por el administrador de horarios.
//   - occupied : bloques tomados por CUALQUIER partido, de esta liga o de otra. El
//                bloque representa un espacio físico compartido, así que si otra liga
//                agenda ahí, para todas queda ocupado.
//   - matches  : los partidos de ESTA liga, con nombres y estado, para que el calendario
//                de la etapa muestre qué hay agendado en cada bloque y no solo que está
//                ocupado.
routerAdd("GET", "/api/liga/calendar", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const { windowBlockCodes, windowBlockRange } = require(`${__hooks}/lib/teamSchedule.js`);

        const allWindowBlocks = windowBlockCodes();
        const range = windowBlockRange();
        const maxRows = allWindowBlocks.length;

        const blocked = $app
            .findRecordsByFilter("horario_blocked_slots", "blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
            .map((r) => r.getString("blockCode"));

        const horarioTaken = $app
            .findRecordsByFilter("horario_matches", "status = 'confirmed' && blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
            .map((r) => r.getString("blockCode"));

        const leagueTaken = $app.findRecordsByFilter(
            "league_matches",
            "(status = 'confirmed' || status = 'played') && deleted = false && blockCode >= {:from} && blockCode <= {:to}",
            "", maxRows, 0, range
        );

        // Nombre de equipo cacheado: varios partidos comparten los mismos equipos y no
        // vale la pena una consulta por cada lado de cada partido.
        const nameCache = {};
        function teamName(id) {
            if (!id) return "";
            if (nameCache[id] !== undefined) return nameCache[id];
            try {
                const t = $app.findRecordById("users", id);
                nameCache[id] = t.getString("name") || t.getString("username") || id;
            } catch (err) {
                nameCache[id] = id;
            }
            return nameCache[id];
        }

        const mine = [];
        for (const m of leagueTaken) {
            if (m.getString("league") !== e.auth.id) continue;
            mine.push({
                id: m.id,
                blockCode: m.getString("blockCode"),
                stageId: m.getString("stage"),
                status: m.getString("status"),
                teamAName: teamName(m.getString("teamA")),
                teamBName: teamName(m.getString("teamB")),
            });
        }

        return e.json(200, {
            blocked: blocked,
            occupied: horarioTaken.concat(leagueTaken.map((m) => m.getString("blockCode"))),
            matches: mine,
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/calendar:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar el calendario." });
    }
}, $apis.requireAuth("users"));

// Disponibilidad que marcó UN equipo de la liga, para poder mirarla antes de agendar.
//
// Solo la liga, y solo de equipos de su propio roster: es información que el equipo
// entregó para que lo agenden, no un dato público.
routerAdd("GET", "/api/liga/team-availability", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const teamId = String(e.requestInfo().query["teamId"] || "");
        if (!teamId) throw new BadRequestError("Falta teamId.");

        try {
            $app.findFirstRecordByFilter(
                "league_teams",
                "league = {:league} && team = {:team} && deleted = false",
                { league: e.auth.id, team: teamId }
            );
        } catch (err) {
            throw new BadRequestError("Ese equipo no pertenece a tu liga.");
        }

        let team;
        try {
            team = $app.findRecordById("users", teamId);
        } catch (err) {
            throw new BadRequestError("Ese equipo no existe.");
        }

        // Sin fila de disponibilidad, el equipo no marcó nada: el algoritmo lo trata
        // como "Regular" en todos los bloques (ver lib/teamSchedule.js), así que acá se
        // devuelve vacío y la vista lo dice explícitamente.
        let happiness = {};
        try {
            const row = $app.findFirstRecordByFilter("horario_availability", "team = {:t}", { t: teamId });
            happiness = JSON.parse(row.getString("happiness") || "{}");
        } catch (err) {
            happiness = {};
        }

        return e.json(200, {
            teamName: team.getString("name") || team.getString("username") || teamId,
            submitted: Object.keys(happiness).length > 0,
            happiness: happiness,
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/team-availability:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar la disponibilidad." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/liga/stages", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        // Orden explícito (`order`), no de creación — es el mismo orden que ve cualquiera
        // en la vista de la liga, y el que /admin/liga deja subir/bajar con las flechas.
        const stages = $app.findRecordsByFilter("league_stages", "league = {:league} && deleted = false", "order,created", 0, 0, { league: e.auth.id });
        return e.json(200, {
            stages: stages.map((s) => ({
                id: s.id,
                name: s.getString("name"),
                type: s.getString("type"),
                order: s.getInt("order"),
                // Participantes explícitos de la etapa. Vacío = etapa vieja, anterior a
                // que existiera el campo: ahí se sigue deduciendo de los partidos.
                teams: s.get("teams") || [],
            })),
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/stages:", err);
        return e.json(400, { error: (err && err.message) || "No se pudieron cargar las etapas." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/stages/create", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const name = String(body.name || "").trim();
        if (!name) throw new BadRequestError("El nombre es requerido.");
        const type = String(body.type || "groups");
        if (type !== "groups" && type !== "knockout") {
            throw new BadRequestError("El tipo de etapa debe ser 'groups' o 'knockout'.");
        }

        // Etapa nueva siempre al final del orden actual (sin contar las soft-borradas,
        // para que no dejen un hueco en el orden visible).
        const existing = $app.findRecordsByFilter("league_stages", "league = {:league} && deleted = false", "", 0, 0, { league: e.auth.id });

        const coll = $app.findCollectionByNameOrId("league_stages");
        const record = new Record(coll);
        record.set("league", e.auth.id);
        record.set("name", name);
        record.set("type", type);
        record.set("order", existing.length);
        $app.save(record);
        return e.json(200, { success: true, id: record.id });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/stages/create:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo crear la etapa." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/stages/update-type", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const stageId = String(body.stageId || "");
        const type = String(body.type || "");
        if (!stageId) throw new BadRequestError("Falta stageId.");
        if (type !== "groups" && type !== "knockout") {
            throw new BadRequestError("El tipo de etapa debe ser 'groups' o 'knockout'.");
        }

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("Esa etapa no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }
        stage.set("type", type);
        $app.save(stage);
        return e.json(200, { success: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/stages/update-type:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo actualizar el tipo de etapa." });
    }
}, $apis.requireAuth("users"));

// Marcar o desmarcar un equipo como participante de una etapa.
//
// Es lo que permite que la tabla de una fase de grupos muestre a los equipos ANTES de
// que jueguen: sin esto, quiénes participan solo se podía deducir de los partidos ya
// agendados, y un grupo recién armado se veía vacío.
routerAdd("POST", "/api/liga/stages/teams/toggle", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const stageId = String(body.stageId || "");
        const teamId = String(body.teamId || "");
        if (!stageId || !teamId) throw new BadRequestError("Falta stageId o teamId.");

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("Esa etapa no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        // Solo equipos que ya están en el roster de la liga: una etapa no puede sumar a
        // alguien que no participa del torneo.
        let enRoster = false;
        try {
            $app.findFirstRecordByFilter(
                "league_teams",
                "league = {:league} && team = {:team} && deleted = false",
                { league: e.auth.id, team: teamId }
            );
            enRoster = true;
        } catch (err) {
            enRoster = false;
        }
        if (!enRoster) {
            throw new BadRequestError("Ese equipo no pertenece a tu liga.");
        }

        const actuales = (stage.get("teams") || []).map(String);
        const estaba = actuales.indexOf(teamId) !== -1;
        const siguientes = estaba ? actuales.filter((id) => id !== teamId) : actuales.concat([teamId]);

        stage.set("teams", siguientes);
        $app.save(stage);

        return e.json(200, { success: true, inStage: !estaba, teams: siguientes });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/stages/teams/toggle:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo actualizar los participantes." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/stages/reorder", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const stageId = String(body.stageId || "");
        const direction = String(body.direction || "");
        if (!stageId) throw new BadRequestError("Falta stageId.");
        if (direction !== "up" && direction !== "down") {
            throw new BadRequestError("direction debe ser 'up' o 'down'.");
        }

        // Se recalcula el orden actual completo (no se confía en el `order` guardado
        // aislado) para encontrar cuál es el vecino real a intercambiar, igual que hace
        // GET /api/liga/stages para mostrarlas.
        const stages = $app.findRecordsByFilter("league_stages", "league = {:league} && deleted = false", "order,created", 0, 0, { league: e.auth.id });
        const idx = stages.findIndex((s) => s.id === stageId);
        if (idx === -1) throw new BadRequestError("Esa etapa no pertenece a tu liga.");

        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= stages.length) {
            // Ya está en la punta — no hay nada que mover, no es un error.
            return e.json(200, { success: true });
        }

        const current = stages[idx];
        const other = stages[swapIdx];
        const currentOrder = current.getInt("order");
        const otherOrder = other.getInt("order");
        current.set("order", otherOrder);
        other.set("order", currentOrder);
        $app.save(current);
        $app.save(other);
        return e.json(200, { success: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/stages/reorder:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo reordenar la etapa." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/liga/matches", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const stageId = String(e.requestInfo().query.stageId || "");
        if (!stageId) throw new BadRequestError("Falta stageId.");

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("La etapa indicada no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        function teamDisplay(teamId) {
            try {
                const team = $app.findRecordById("users", teamId);
                return team.getString("name") || team.getString("username") || teamId;
            } catch (err) {
                return teamId;
            }
        }

        // El código de arbitraje (league_matches.code) es un campo "hidden" — no viaja
        // en una lectura normal de la colección para cuentas no-superusuario, así que
        // la única forma de que la liga lo vea (para poder compartirlo) es que una ruta
        // con $app, como esta, lo incluya explícitamente en su propia respuesta.
        function reportStatusFor(matchId) {
            try {
                return $app.findFirstRecordByFilter("match_reports", "match = {:match} && deleted = false", { match: matchId }).getString("status");
            } catch (err) {
                return null;
            }
        }

        // Contacto privado de administración de un equipo (nunca el perfil social,
        // ver migración 1788000000) — null si no cargó ninguno.
        function teamContact(teamId) {
            try {
                const row = $app.findFirstRecordByFilter(
                    "league_teams", "league = {:league} && team = {:team} && deleted = false",
                    { league: e.auth.id, team: teamId }
                );
                const type = row.getString("contactType");
                const value = row.getString("contactValue");
                if (!type || !value) return null;
                return { type, value };
            } catch (err) {
                return null;
            }
        }

        // Cuántos partidos ha arbitrado cada equipo hasta ahora — una sola consulta +
        // tally en JS (mismo patrón que ya usa avoidRematches con pairKey), no un
        // contador guardado: así una reasignación de árbitro nunca puede desincronizarse.
        // status != 'cancelled' incluye confirmed/played/suspended — un partido
        // suspendido sigue comprometido, solo está pausado.
        function computeRefereeCounts() {
            const rows = $app.findRecordsByFilter(
                "league_matches", "league = {:league} && deleted = false && status != 'cancelled'",
                "", 0, 0, { league: e.auth.id }
            );
            const counts = {};
            rows.forEach((m) => (m.get("refereeTeams") || []).forEach((id) => { counts[id] = (counts[id] || 0) + 1; }));
            return counts;
        }
        const refereeCounts = computeRefereeCounts();

        // URL base de la app — mismo patrón que auth.pb.js: variable de entorno si está
        // configurada, si no se deriva del propio request (funciona en local sin nada
        // que configurar).
        const envAppUrl = $os.getenv("APP_URL") || $os.getenv("SITE_URL");
        const host = e.requestInfo().headers["host"] || "localhost:8090";
        const protocol = e.requestInfo().headers["x-forwarded-proto"] || "http";
        const baseUrl = envAppUrl ? envAppUrl.replace(/\/$/, "") : `${protocol}://${host}`;

        // Ordenados por bloque (no por creación): el índice de cada partido en esta
        // lista es el que se pinta en la celda del calendario, así que numerarlos en
        // orden cronológico es lo que hace que ambos se lean juntos.
        const matches = $app.findRecordsByFilter("league_matches", "stage = {:stage} && deleted = false", "blockCode", 0, 0, { stage: stageId });
        return e.json(200, {
            refereeCounts,
            matches: matches.map((m) => {
                const teamA = m.getString("teamA");
                const teamB = m.getString("teamB");
                const refereeTeams = m.get("refereeTeams") || [];
                return {
                    id: m.id,
                    teamA,
                    teamB,
                    teamAName: teamDisplay(teamA),
                    teamBName: teamDisplay(teamB),
                    teamAContact: teamContact(teamA),
                    teamBContact: teamContact(teamB),
                    blockCode: m.getString("blockCode"),
                    status: m.getString("status"),
                    scoreA: m.getInt("scoreA"),
                    scoreB: m.getInt("scoreB"),
                    code: m.getString("code"),
                    arbitrateUrl: m.getString("status") === "confirmed"
                        ? `${baseUrl}/partidos/${m.id}/arbitrar?code=${m.getString("code")}`
                        : null,
                    refereeTeams,
                    refereeTeamNames: refereeTeams.map(teamDisplay),
                    reportStatus: reportStatusFor(m.id),
                };
            }),
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/matches:", err);
        return e.json(400, { error: (err && err.message) || "No se pudieron cargar los partidos." });
    }
}, $apis.requireAuth("users"));

// Suspender/reactivar — para cuando un partido agendado no se puede jugar en su
// horario (cancha, clima) pero no se quiere cancelar del todo: sale de "por jugar"
// y se puede reactivar más tarde a "confirmed" para reagendarlo con el mismo código.
routerAdd("POST", "/api/liga/matches/suspend", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        if (!matchId) throw new BadRequestError("Falta matchId.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("league") !== e.auth.id) {
            throw new BadRequestError("Ese partido no pertenece a tu liga.");
        }
        if (match.getString("status") !== "confirmed") {
            throw new BadRequestError("Solo se puede suspender un partido que esté por jugar.");
        }

        match.set("status", "suspended");
        $app.save(match);

        // Si tiene mercado automático de Beaumarket, se cierra (no se cancela/reembolsa):
        // un partido suspendido puede reagendarse más tarde, así que no hace falta
        // deshacer nada todavía — solo dejar de aceptar apuestas nuevas sobre un
        // horario que por ahora no va a ocurrir.
        const marketId = match.getString("beaumarketMarket");
        if (marketId) {
            try {
                const market = $app.findRecordById("beaumarkets", marketId);
                if (market.getString("status") === "open") {
                    market.set("status", "closed");
                    $app.save(market);
                }
            } catch (err) {
                // El mercado pudo haberse borrado a mano — no bloquea la suspensión.
            }
        }

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/suspend:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo suspender el partido." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/matches/reactivate", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        if (!matchId) throw new BadRequestError("Falta matchId.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("league") !== e.auth.id) {
            throw new BadRequestError("Ese partido no pertenece a tu liga.");
        }
        if (match.getString("status") !== "suspended") {
            throw new BadRequestError("Este partido no está suspendido.");
        }

        match.set("status", "confirmed");
        $app.save(match);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/reactivate:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo reactivar el partido." });
    }
}, $apis.requireAuth("users"));

// Editar un partido ya agendado — corrige equipos u horario sin borrar y volver a
// crear. Restringido a 'confirmed'/'suspended': un partido 'played' ya tiene su
// corrección propia (enmendar el marcador vía /api/league-matches/events, ver
// matchWriteDecision en lib/matchEvents.js), y no tiene sentido reescribir quién jugó
// o cuándo algo que ya ocurrió.
routerAdd("POST", "/api/liga/matches/update", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const { windowBlockCodes, windowBlockRange, pastBlockCodes, computeValidBlocks } = require(`${__hooks}/lib/teamSchedule.js`);
        const { bettingCloseTimeFromBlock } = require(`${__hooks}/lib/polla.js`);

        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const teamA = String(body.teamA || "");
        const teamB = String(body.teamB || "");
        const block = String(body.block || "");
        if (!matchId || !teamA || !teamB || !block) throw new BadRequestError("Faltan datos del partido.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("league") !== e.auth.id) {
            throw new BadRequestError("Ese partido no pertenece a tu liga.");
        }
        if (match.getString("status") !== "confirmed" && match.getString("status") !== "suspended") {
            throw new BadRequestError("Solo se pueden editar partidos que todavía no se jugaron.");
        }

        let stage;
        try {
            stage = $app.findRecordById("league_stages", match.getString("stage"));
        } catch (err) {
            throw new BadRequestError("La etapa de este partido ya no existe.");
        }

        // Misma validación que /accept: equipos del roster de la liga y participantes
        // marcados de la etapa.
        const rosterRows = $app.findRecordsByFilter(
            "league_teams", "league = {:league} && deleted = false", "", 0, 0, { league: e.auth.id }
        );
        const rosterSet = new Set(rosterRows.map((r) => r.getString("team")));
        if (teamA === teamB) {
            throw new BadRequestError("Un equipo no puede jugar contra sí mismo.");
        }
        if (!rosterSet.has(teamA) || !rosterSet.has(teamB)) {
            throw new BadRequestError("Ambos equipos deben pertenecer a tu liga.");
        }
        const stageTeams = (stage.get("teams") || []).map(String);
        const stageSet = new Set(stageTeams);
        if (!(stageSet.has(teamA) && stageSet.has(teamB))) {
            throw new BadRequestError("Ambos equipos deben participar de esta etapa.");
        }

        // Solo revalida el bloque si de verdad cambió — si no, un partido 'confirmed'
        // siempre "chocaría" contra su propio bloque actual al mirarse a sí mismo, y un
        // partido cuyo bloque quedó fuera de la ventana móvil de 3 semanas (agendado
        // hace tiempo) se rechazaría sin necesidad si no toca ese campo.
        if (block !== match.getString("blockCode")) {
            const allWindowBlocks = windowBlockCodes();
            const range = windowBlockRange();
            const maxRows = allWindowBlocks.length;
            const blockedCodes = $app
                .findRecordsByFilter("horario_blocked_slots", "blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
                .map((r) => r.getString("blockCode"));
            const occupiedCodes = $app
                .findRecordsByFilter("horario_matches", "status = 'confirmed' && blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
                .map((r) => r.getString("blockCode"))
                .concat(
                    $app
                        .findRecordsByFilter(
                            "league_matches",
                            "(status = 'confirmed' || status = 'played') && deleted = false && id != {:matchId} && blockCode >= {:from} && blockCode <= {:to}",
                            "", maxRows, 0, { from: range.from, to: range.to, matchId }
                        )
                        .map((r) => r.getString("blockCode"))
                );
            const pastCodes = pastBlockCodes(allWindowBlocks);
            const validBlocks = new Set(computeValidBlocks(allWindowBlocks, [blockedCodes, occupiedCodes, pastCodes]));
            if (!validBlocks.has(block)) {
                throw new BadRequestError("Ese bloque ya no está disponible (se bloqueó, se ocupó con otro partido, o ya pasó).");
            }
        }

        match.set("teamA", teamA);
        match.set("teamB", teamB);
        match.set("blockCode", block);
        const closesAt = bettingCloseTimeFromBlock(block);
        if (closesAt) match.set("bettingClosesAt", closesAt);

        // Si tiene mercado automático de Beaumarket todavía abierto, se actualiza para
        // que refleje el horario y los equipos nuevos — uno cerrado (partido suspendido)
        // se deja tal cual, mismo criterio que /suspend: no se reabre solo.
        const marketId = match.getString("beaumarketMarket");
        if (marketId) {
            try {
                const market = $app.findRecordById("beaumarkets", marketId);
                if (market.getString("status") === "open") {
                    const nameOf = (id) => {
                        try {
                            const t = $app.findRecordById("users", id);
                            return t.getString("name") || t.getString("username") || id;
                        } catch (err) { return id; }
                    };
                    const teamAName = nameOf(teamA);
                    const teamBName = nameOf(teamB);
                    market.set("title", teamAName + " vs " + teamBName);
                    market.set("outcomes", JSON.stringify(["Gana " + teamAName, "Empate", "Gana " + teamBName]));
                    if (closesAt) market.set("closesAt", closesAt);
                    $app.save(market);
                }
            } catch (err) {
                // El mercado pudo haberse borrado a mano — no bloquea la edición.
            }
        }

        $app.save(match);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/update:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo editar el partido." });
    }
}, $apis.requireAuth("users"));

// Eliminar un partido — borrado suave (deleted=true) pero pensado para sentirse
// completo: desaparece de todas las listas (todas filtran deleted=false, ver
// GET /api/liga/matches, público en public_league.pb.js) y status pasa a 'cancelled',
// que es justo lo que ya excluyen los chequeos existentes de la polla
// (validatePollaBet en polla.pb.js) y de matchWriteDecision (nadie puede seguir
// arbitrándolo). Restringido a partidos que no se jugaron: uno 'played' ya puede tener
// pagos reales de Beaumarket resueltos y puntos de Beaupolla contados, y deshacer eso
// es un problema distinto (revertir pagos, no solo ocultar un registro).
routerAdd("POST", "/api/liga/matches/delete", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        if (!matchId) throw new BadRequestError("Falta matchId.");

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("league") !== e.auth.id) {
            throw new BadRequestError("Ese partido no pertenece a tu liga.");
        }
        if (match.getString("status") !== "confirmed" && match.getString("status") !== "suspended") {
            throw new BadRequestError("Solo se pueden eliminar partidos que todavía no se jugaron.");
        }

        $app.runInTransaction((txApp) => {
            const txMatch = txApp.findRecordById("league_matches", matchId);

            // Mismo reembolso 1:1 que POST /api/admin/beaumarket/cancel (beaumarket.pb.js),
            // pero inline: ese endpoint exige superusuario y acá quien elimina es la
            // cuenta de la liga.
            const marketId = txMatch.getString("beaumarketMarket");
            if (marketId) {
                try {
                    const market = txApp.findRecordById("beaumarkets", marketId);
                    const marketStatus = market.getString("status");
                    if (marketStatus === "open" || marketStatus === "closed") {
                        const positions = txApp.findRecordsByFilter(
                            "beaumarket_positions", "market = {:m}", "", 0, 0, { m: marketId }
                        );
                        positions.forEach((pos) => {
                            const amount = pos.getInt("amount");
                            if (amount > 0) {
                                txApp.db()
                                    .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                                    .bind({ amt: amount, id: pos.getString("user") })
                                    .execute();
                            }
                        });
                        market.set("status", "cancelled");
                        txApp.save(market);
                    }
                } catch (err) {
                    // El mercado pudo haberse borrado a mano — no bloquea la eliminación.
                }
            }

            txMatch.set("status", "cancelled");
            txMatch.set("deleted", true);
            txApp.save(txMatch);
        });

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/delete:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo eliminar el partido." });
    }
}, $apis.requireAuth("users"));

// Equipo(s) árbitro asignados a un partido — siempre se puede modificar, sin importar
// el estado del partido. Distinto de match_reports.refereeId (quién efectivamente
// corre el reloj EN VIVO con el código de arbitraje) — este es el compromiso
// organizativo asignado de antemano por la liga, ver migración 1788000000.
routerAdd("POST", "/api/liga/matches/set-referees", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const body = e.requestInfo().body || {};
        const matchId = String(body.matchId || "");
        const refereeTeamIds = Array.isArray(body.refereeTeamIds) ? body.refereeTeamIds.map(String).filter(Boolean) : [];
        if (!matchId) throw new BadRequestError("Falta matchId.");
        if (refereeTeamIds.length > 2) throw new BadRequestError("Como máximo 2 equipos árbitro.");
        if (new Set(refereeTeamIds).size !== refereeTeamIds.length) {
            throw new BadRequestError("Los equipos árbitro no pueden repetirse.");
        }

        let match;
        try {
            match = $app.findRecordById("league_matches", matchId);
        } catch (err) {
            throw new BadRequestError("El partido indicado no existe.");
        }
        if (match.getString("league") !== e.auth.id) {
            throw new BadRequestError("Ese partido no pertenece a tu liga.");
        }

        const teamA = match.getString("teamA");
        const teamB = match.getString("teamB");
        if (refereeTeamIds.includes(teamA) || refereeTeamIds.includes(teamB)) {
            throw new BadRequestError("Un equipo no puede arbitrar su propio partido.");
        }

        if (refereeTeamIds.length) {
            const rosterRows = $app.findRecordsByFilter(
                "league_teams", "league = {:league} && deleted = false", "", 0, 0, { league: e.auth.id }
            );
            const rosterSet = new Set(rosterRows.map((r) => r.getString("team")));
            if (!refereeTeamIds.every((id) => rosterSet.has(id))) {
                throw new BadRequestError("Los equipos árbitro deben pertenecer a tu liga.");
            }

            // "de la MISMA etapa del partido": los árbitros tienen que estar entre los
            // participantes marcados de esa etapa.
            let stageTeams = [];
            try {
                stageTeams = ($app.findRecordById("league_stages", match.getString("stage")).get("teams") || []).map(String);
            } catch (err) {
                stageTeams = [];
            }
            if (!refereeTeamIds.every((id) => stageTeams.includes(id))) {
                throw new BadRequestError("Los equipos árbitro deben participar de la misma etapa del partido.");
            }
        }

        match.set("refereeTeams", refereeTeamIds);
        $app.save(match);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/set-referees:", err);
        return e.json(400, { error: (err && err.message) || "No se pudieron guardar los árbitros." });
    }
}, $apis.requireAuth("users"));

// Solo lectura, solo admin: dificultad acumulada de RIVALES que le han tocado a cada
// equipo, en ESTA etapa (no toda la liga — así lo confirmó el usuario explícitamente:
// cada etapa arranca el balance desde cero). Alimenta la misma noción que usa el
// algoritmo de sugerencia (ver POST /api/liga/matches/propose) para poder mostrarle al
// admin, en la misma pantalla, por qué el algoritmo prioriza como prioriza.
routerAdd("GET", "/api/liga/difficulty-summary", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const stageId = String(e.requestInfo().query.stageId || "");
        if (!stageId) throw new BadRequestError("Falta stageId.");

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("La etapa indicada no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        function teamDisplay(teamId) {
            try {
                const team = $app.findRecordById("users", teamId);
                return team.getString("name") || team.getString("username") || teamId;
            } catch (err) {
                return teamId;
            }
        }

        const rosterRows = $app.findRecordsByFilter(
            "league_teams", "league = {:league} && deleted = false", "", 0, 0, { league: e.auth.id }
        );
        const difficultyByTeam = {};
        rosterRows.forEach((r) => {
            const d = r.get("difficulty");
            if (d !== null && d !== undefined && d !== "") difficultyByTeam[r.getString("team")] = Number(d);
        });

        const stageTeams = (stage.get("teams") || []).map(String);
        const participantIds = stageTeams;

        // Un partido cancelado nunca ocurrió, no debe pesar en el balance ni en el
        // conteo — confirmado explícitamente con el usuario. Un suspendido tampoco: se
        // puede volver a agendar libremente (así lo trata "evitar revanchas"), y contarlo
        // acá lo sumaría de nuevo cuando se rejuegue. Tiene que ser EXACTAMENTE el mismo
        // filtro que usa POST /api/liga/matches/propose, porque esta pantalla existe
        // justamente para explicar por qué el algoritmo prioriza como prioriza.
        const stageMatches = $app.findRecordsByFilter(
            "league_matches", "stage = {:stage} && deleted = false && (status = 'confirmed' || status = 'played')",
            "", 0, 0, { stage: stageId }
        );
        const summary = {};
        participantIds.forEach((id) => { summary[id] = { totalFaced: 0, matchesCount: 0 }; });
        stageMatches.forEach((m) => {
            const a = m.getString("teamA");
            const b = m.getString("teamB");
            if (difficultyByTeam[b] !== undefined && summary[a]) {
                summary[a].totalFaced += difficultyByTeam[b];
                summary[a].matchesCount += 1;
            }
            if (difficultyByTeam[a] !== undefined && summary[b]) {
                summary[b].totalFaced += difficultyByTeam[a];
                summary[b].matchesCount += 1;
            }
        });

        return e.json(200, {
            teams: participantIds.map((id) => {
                const s = summary[id];
                return {
                    teamId: id,
                    teamName: teamDisplay(id),
                    ownDifficulty: difficultyByTeam[id] !== undefined ? difficultyByTeam[id] : null,
                    facedTotal: s.totalFaced,
                    matchesCount: s.matchesCount,
                    average: s.matchesCount ? s.totalFaced / s.matchesCount : null,
                };
            }),
        });
    } catch (err) {
        console.error("[league.pb.js] Error en GET /api/liga/difficulty-summary:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo calcular el resumen de dificultad." });
    }
}, $apis.requireAuth("users"));

// teamDisplay/loadValidBlocks/loadMatchInputs se definen DENTRO de cada routerAdd que
// las usa — ver la nota equivalente en team_schedule.pb.js sobre por qué una función
// top-level de este archivo no se puede llamar de forma confiable desde el closure de
// un routerAdd distinto.

routerAdd("POST", "/api/liga/matches/propose", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const {
            windowBlockCodes,
            windowBlockRange,
            pastBlockCodes,
            computeValidBlocks,
            fillDefaultHappiness,
            DEFAULT_HAPPINESS_LEVEL,
            DEFAULT_TEMPERATURE,
            MAX_TEAMS,
            rankByeCandidates,
            isPairingFeasible,
            proposeMatches,
            pairKey,
        } = require(`${__hooks}/lib/teamSchedule.js`);

        const body = e.requestInfo().body || {};
        const stageId = String(body.stageId || "");
        // Sin deduplicar, un id repetido produce el par (X,X): gap 0 y el score máximo
        // posible, así que el optimizador lo PREFIERE y la propuesta sale con "X vs X".
        let teamIds = Array.isArray(body.teamIds)
            ? body.teamIds.map(String).filter((id, i, arr) => arr.indexOf(id) === i)
            : [];
        const byeTeamId = body.byeTeamId ? String(body.byeTeamId) : null;
        const avoidRematches = !!body.avoidRematches;
        // Horarios en los que la liga permite agendar esta tanda. Vacío = sin
        // restricción, que es como se comportaba antes de que el panel los ofreciera.
        const allowedBlocks = Array.isArray(body.allowedBlocks) ? body.allowedBlocks.map(String) : [];

        if (!stageId) throw new BadRequestError("Falta stageId.");
        if (teamIds.length < 2) throw new BadRequestError("Elige al menos 2 equipos.");
        if (teamIds.length > MAX_TEAMS) {
            throw new BadRequestError(`El emparejamiento óptimo admite hasta ${MAX_TEAMS} equipos por tanda; elige menos.`);
        }

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("La etapa indicada no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        const rosterRows = $app.findRecordsByFilter(
            "league_teams",
            "league = {:league} && deleted = false",
            "",
            0,
            0,
            { league: e.auth.id }
        );
        const rosterSet = new Set(rosterRows.map((r) => r.getString("team")));
        if (!teamIds.every((id) => rosterSet.has(id))) {
            throw new BadRequestError("Todos los equipos elegidos deben pertenecer a tu liga.");
        }
        // Agendar queda restringido a los participantes marcados de la etapa — es la
        // misma regla que aplica el selector del panel, pero impuesta en el servidor.
        const stageTeams = (stage.get("teams") || []).map(String);
        const stageSet = new Set(stageTeams);
        if (!teamIds.every((id) => stageSet.has(id))) {
            throw new BadRequestError("Todos los equipos elegidos deben participar de esta etapa.");
        }


        function teamDisplay(teamId) {
            try {
                const team = $app.findRecordById("users", teamId);
                return team.getString("name") || team.getString("username") || teamId;
            } catch (err) {
                return teamId;
            }
        }

        function loadValidBlocks() {
            // Acotado a la ventana móvil: antes esto recorría todos los partidos
            // jugados de la historia en cada propuesta. Ver auditoria-2026-08-19.md §4.3.
            const allWindowBlocks = windowBlockCodes();
            const range = windowBlockRange();
            const maxRows = allWindowBlocks.length;
            const blockedCodes = $app
                .findRecordsByFilter("horario_blocked_slots", "blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
                .map((r) => r.getString("blockCode"));
            const occupiedCodes = $app
                .findRecordsByFilter("horario_matches", "status = 'confirmed' && blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
                .map((r) => r.getString("blockCode"))
                .concat(
                    $app
                        .findRecordsByFilter(
                            "league_matches",
                            "(status = 'confirmed' || status = 'played') && deleted = false && blockCode >= {:from} && blockCode <= {:to}",
                            "", maxRows, 0, range
                        )
                        .map((r) => r.getString("blockCode"))
                );
            // La ventana móvil arranca en el lunes de la semana ACTUAL: un fin de
            // semana (o cualquier día pasado el lunes), esa misma semana ya incluye
            // días/horas que ya pasaron. Sin excluirlos, "Sugerir partidos" podía
            // terminar apuntando a un bloque que ya ocurrió.
            const pastCodes = pastBlockCodes(allWindowBlocks);
            return {
                allWindowBlocks,
                validBlocks: computeValidBlocks(allWindowBlocks, [blockedCodes, occupiedCodes, pastCodes]),
            };
        }

        // La disponibilidad de cada equipo se arma sobre la ventana COMPLETA, no sobre
        // los bloques donde hoy se puede agendar: la escala de un equipo es su opinión
        // sobre toda la ventana marcable, y recortarla antes de normalizar inflaba
        // diferencias triviales (ver computePairEdge en lib/teamSchedule.js). Dónde se
        // puede agendar es un dato aparte, `candidateBlocks`.
        function loadMatchInputs(ids, scaleBlocks) {
            const happinessByTeam = {};
            for (const teamId of ids) {
                let happiness = {};
                try {
                    const record = $app.findFirstRecordByFilter("horario_availability", "team = {:team}", { team: teamId });
                    happiness = JSON.parse(record.getString("happiness") || "{}");
                } catch (err) {
                    happiness = {};
                }
                happinessByTeam[teamId] = fillDefaultHappiness(happiness, scaleBlocks, DEFAULT_HAPPINESS_LEVEL);
            }
            return happinessByTeam;
        }

        // Los bloques candidatos son los libres de la ventana, restringidos a los que
        // la liga eligió. Se intersecta y no se reemplaza: un horario elegido que esté
        // bloqueado u ocupado sigue sin poder usarse.
        const { allWindowBlocks, validBlocks } = loadValidBlocks();
        let candidateBlocks = validBlocks;
        if (allowedBlocks.length > 0) {
            const permitidos = new Set(allowedBlocks);
            candidateBlocks = candidateBlocks.filter((b) => permitidos.has(b));
            if (candidateBlocks.length === 0) {
                throw new BadRequestError(
                    "Ninguno de los horarios elegidos está disponible (pueden estar bloqueados o ya ocupados)."
                );
            }
        }
        const happinessByTeam = loadMatchInputs(teamIds, allWindowBlocks);

        // "Ya se enfrentaron" cuenta agendados (confirmed) y ya jugados (played) —
        // los suspendidos NO cuentan, se pueden volver a agendar libremente. Se calcula
        // antes del bye porque elegir a quién dejar libre depende de si el resto queda
        // con algún emparejamiento posible.
        let excludedPairs = null;
        if (avoidRematches) {
            const alreadyPlayed = $app.findRecordsByFilter(
                "league_matches",
                "league = {:league} && (status = 'confirmed' || status = 'played') && deleted = false",
                "",
                0,
                0,
                { league: e.auth.id }
            );
            excludedPairs = new Set(
                alreadyPlayed.map((m) => pairKey(m.getString("teamA"), m.getString("teamB")))
            );
        }

        // Partidos de la etapa que efectivamente cuentan. Mismo criterio que
        // excludedPairs a propósito: un partido suspendido se puede volver a agendar,
        // así que tampoco puede pesar como si ya se hubiera jugado. Con el filtro
        // anterior (`status != 'cancelled'`) el mismo partido contaba como no-jugado
        // para las revanchas y como jugado para el balance de dificultad, y al
        // reagendarlo la dificultad del rival se sumaba dos veces.
        const stageMatches = $app.findRecordsByFilter(
            "league_matches", "stage = {:stage} && deleted = false && (status = 'confirmed' || status = 'played')",
            "", 0, 0, { stage: stageId }
        );
        const matchesCountByTeam = {};
        stageMatches.forEach((m) => {
            [m.getString("teamA"), m.getString("teamB")].forEach((id) => {
                matchesCountByTeam[id] = (matchesCountByTeam[id] || 0) + 1;
            });
        });

        if (teamIds.length % 2 !== 0) {
            if (byeTeamId && teamIds.indexOf(byeTeamId) === -1) {
                throw new BadRequestError("El equipo que queda libre tiene que ser uno de los elegidos.");
            }
            if (!byeTeamId) {
                const ranked = rankByeCandidates(teamIds, happinessByTeam, candidateBlocks, matchesCountByTeam);
                let suggested = ranked.length ? ranked[0] : null;
                // Con "evitar revanchas", el mejor candidato a bye puede dejar al resto
                // sin ningún emparejamiento posible; ahí se cae al siguiente en vez de
                // sugerir algo que el admin va a tener que descartar a mano. Sin
                // revanchas excluidas nunca hay infactibilidad, y no vale la pena pagar
                // la búsqueda.
                if (excludedPairs) {
                    for (const candidate of ranked) {
                        const rest = teamIds.filter((id) => id !== candidate);
                        if (isPairingFeasible(rest, happinessByTeam, excludedPairs, candidateBlocks)) {
                            suggested = candidate;
                            break;
                        }
                    }
                }
                return e.json(200, {
                    needsBye: true,
                    suggestedByeTeamId: suggested,
                    candidates: teamIds.map((id) => ({ id, name: teamDisplay(id) })),
                });
            }
            teamIds = teamIds.filter((id) => id !== byeTeamId);
        }

        // Balance de dificultad: cuánta dificultad de rival ha enfrentado cada equipo
        // hasta ahora, EN ESTA ETAPA (cada etapa arranca el balance desde cero — así lo
        // pidió el usuario explícitamente). Un equipo sin nota de dificultad no
        // participa del criterio (ver difficultyBalanceGain).
        const difficultyByTeam = {};
        rosterRows.forEach((r) => {
            const d = r.get("difficulty");
            if (d !== null && d !== undefined && d !== "") difficultyByTeam[r.getString("team")] = Number(d);
        });
        const facedByTeam = {};
        function addFaced(teamId, opponentDifficulty) {
            if (opponentDifficulty === undefined) return;
            if (!facedByTeam[teamId]) facedByTeam[teamId] = { totalFaced: 0, matchesCount: 0 };
            facedByTeam[teamId].totalFaced += opponentDifficulty;
            facedByTeam[teamId].matchesCount += 1;
        }
        stageMatches.forEach((m) => {
            const a = m.getString("teamA");
            const b = m.getString("teamB");
            if (difficultyByTeam[b] !== undefined) addFaced(a, difficultyByTeam[b]);
            if (difficultyByTeam[a] !== undefined) addFaced(b, difficultyByTeam[a]);
        });
        // La referencia es el promedio de dificultad de LA ETAPA, no el de los equipos
        // elegidos en esta tanda: `facedByTeam` se acumula a lo largo de toda la etapa,
        // así que medirlo contra un promedio que cambia en cada tanda re-juzgaba el
        // historial con otra vara. Una fecha entre puros equipos fuertes subía el
        // promedio y de golpe todos parecían tener déficit de rivales difíciles.
        const stageDifficulties = stageTeams
            .map((id) => difficultyByTeam[id])
            .filter((d) => d !== undefined);
        const targetAvg = stageDifficulties.length
            ? stageDifficulties.reduce((s, d) => s + d, 0) / stageDifficulties.length
            : 0;
        const difficultyContext = { difficultyByTeam, facedByTeam, targetAvg, temperature: DEFAULT_TEMPERATURE };

        const result = proposeMatches(teamIds, happinessByTeam, excludedPairs, difficultyContext, candidateBlocks);
        if (result.infeasible) {
            return e.json(200, { infeasible: true, byeTeamId: byeTeamId || null });
        }

        const matches = result.matches.map((m) => ({
            ...m,
            teamAName: teamDisplay(m.teamA),
            teamBName: teamDisplay(m.teamB),
        }));

        return e.json(200, {
            infeasible: false,
            threshold: result.threshold,
            // La peor diferencia que quedó DE VERDAD. No siempre es el umbral: resolver
            // un choque de bloques puede obligar a ceder (ver resolveBlockCollisions), y
            // el panel anunciaba el umbral como si fuera el peor caso.
            maxGap: result.maxGap,
            totalScore: result.totalScore,
            matches,
            byeTeamId: byeTeamId || null,
            byeTeamName: byeTeamId ? teamDisplay(byeTeamId) : null,
        });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/propose:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo generar la propuesta." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/liga/matches/accept", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const { windowBlockCodes, windowBlockRange, pastBlockCodes, computeValidBlocks } = require(`${__hooks}/lib/teamSchedule.js`);
        const { CODE_ALPHABET, CODE_LENGTH } = require(`${__hooks}/lib/matchEvents.js`);
        const { bettingCloseTimeFromBlock } = require(`${__hooks}/lib/polla.js`);

        const body = e.requestInfo().body || {};
        const stageId = String(body.stageId || "");
        const teamA = String(body.teamA || "");
        const teamB = String(body.teamB || "");
        const block = String(body.block || "");
        const happinessA = Number.isFinite(body.happinessA) ? body.happinessA : null;
        const happinessB = Number.isFinite(body.happinessB) ? body.happinessB : null;
        const gap = Number.isFinite(body.gap) ? body.gap : null;
        const autoAssignReferees = !!body.autoAssignReferees;

        if (!stageId || !teamA || !teamB || !block) {
            throw new BadRequestError("Faltan datos del partido.");
        }

        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("La etapa indicada no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        const rosterRows = $app.findRecordsByFilter(
            "league_teams",
            "league = {:league} && deleted = false",
            "",
            0,
            0,
            { league: e.auth.id }
        );
        const rosterSet = new Set(rosterRows.map((r) => r.getString("team")));
        if (teamA === teamB) {
            throw new BadRequestError("Un equipo no puede jugar contra sí mismo.");
        }
        if (!rosterSet.has(teamA) || !rosterSet.has(teamB)) {
            throw new BadRequestError("Ambos equipos deben pertenecer a tu liga.");
        }
        // Agendar queda restringido a los participantes marcados de la etapa — es la
        // misma regla que aplica el selector del panel, pero impuesta en el servidor.
        const stageTeams = (stage.get("teams") || []).map(String);
        const stageSet = new Set(stageTeams);
        if (!(stageSet.has(teamA) && stageSet.has(teamB))) {
            throw new BadRequestError("Ambos equipos deben participar de esta etapa.");
        }


        // Re-chequeo defensivo: el bloque pudo haberse ocupado (bloqueado por el admin,
        // o tomado por otro partido) entre que se generó la sugerencia y este click.
        // Acotado a la ventana móvil — ver auditoria-2026-08-19.md §4.3.
        const allWindowBlocks = windowBlockCodes();
        const range = windowBlockRange();
        const maxRows = allWindowBlocks.length;
        const blockedCodes = $app
            .findRecordsByFilter("horario_blocked_slots", "blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
            .map((r) => r.getString("blockCode"));
        const occupiedCodes = $app
            .findRecordsByFilter("horario_matches", "status = 'confirmed' && blockCode >= {:from} && blockCode <= {:to}", "", maxRows, 0, range)
            .map((r) => r.getString("blockCode"))
            .concat(
                $app
                    .findRecordsByFilter(
                        "league_matches",
                        "(status = 'confirmed' || status = 'played') && deleted = false && blockCode >= {:from} && blockCode <= {:to}",
                        "", maxRows, 0, range
                    )
                    .map((r) => r.getString("blockCode"))
            );
        // También rechaza un bloque que ya pasó — la sugerencia pudo generarse antes
        // (ej. quedó abierta en otra pestaña) y ese horario ya no tiene sentido.
        const pastCodes = pastBlockCodes(allWindowBlocks);
        const validBlocks = new Set(computeValidBlocks(allWindowBlocks, [blockedCodes, occupiedCodes, pastCodes]));
        if (!validBlocks.has(block)) {
            throw new BadRequestError("Ese bloque ya no está disponible (se bloqueó, se ocupó con otro partido, o ya pasó). Vuelve a generar la sugerencia.");
        }

        const coll = $app.findCollectionByNameOrId("league_matches");
        const record = new Record(coll);
        record.set("league", e.auth.id);
        record.set("stage", stageId);
        record.set("teamA", teamA);
        record.set("teamB", teamB);
        record.set("blockCode", block);
        if (happinessA !== null) record.set("happinessA", happinessA);
        if (happinessB !== null) record.set("happinessB", happinessB);
        if (gap !== null) record.set("gap", gap);
        record.set("status", "confirmed");
        // El código de arbitraje se genera acá, junto con el partido — hace falta desde
        // el primer intento de arbitrarlo, no solo para quien se suma después.
        record.set("code", $security.randomStringWithAlphabet(CODE_LENGTH, CODE_ALPHABET));
        // Cierre de la polla: 10 minutos antes de la hora del bloque. Se sabe acá mismo
        // porque el horario ya está elegido. Si el partido arranca antes en la vista de
        // arbitraje, el hook de eventos adelanta esta fecha. Ver lib/polla.js.
        const closesAt = bettingCloseTimeFromBlock(block);
        if (closesAt) record.set("bettingClosesAt", closesAt);

        // Mercado automático de Beaumarket: mismo cierre que la polla (10 min antes del
        // bloque), 3 resultados fijos (local/empate/visita) para que la vista del
        // partido pueda mostrar la probabilidad como en un partido real. Solo si la
        // liga lo habilitó — es una opción aparte de la polla, no atada a ella.
        if (e.auth.getBool("beaumarketAutoEnabled") && closesAt) {
            const nameOf = (id) => {
                try {
                    const t = $app.findRecordById("users", id);
                    return t.getString("name") || t.getString("username") || id;
                } catch (err) { return id; }
            };
            const teamAName = nameOf(teamA);
            const teamBName = nameOf(teamB);
            const market = new Record($app.findCollectionByNameOrId("beaumarkets"));
            market.set("title", teamAName + " vs " + teamBName);
            market.set("outcomes", JSON.stringify(["Gana " + teamAName, "Empate", "Gana " + teamBName]));
            market.set("status", "open");
            market.set("closesAt", closesAt);
            market.set("pool", JSON.stringify([0, 0, 0]));
            $app.save(market);
            record.set("beaumarketMarket", market.id);
        }

        // Árbitros automáticos: entre los participantes de la etapa que no sean los dos
        // que juegan, elige los 2 que menos han arbitrado hasta ahora. status !=
        // 'cancelled': un partido cancelado no cuenta.
        if (autoAssignReferees) {
            const { pickLeastBusyReferees } = require(`${__hooks}/lib/refereeAssignment.js`);
            const candidatePool = stageTeams;
            const refRows = $app.findRecordsByFilter(
                "league_matches", "league = {:league} && deleted = false && status != 'cancelled'",
                "", 0, 0, { league: e.auth.id }
            );
            const countByTeam = {};
            refRows.forEach((m) => (m.get("refereeTeams") || []).forEach((id) => { countByTeam[id] = (countByTeam[id] || 0) + 1; }));
            const chosen = pickLeastBusyReferees(candidatePool, countByTeam, [teamA, teamB]);
            if (chosen.length) record.set("refereeTeams", chosen);
        }

        $app.save(record);

        return e.json(200, { success: true, id: record.id });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/accept:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo agregar el partido." });
    }
}, $apis.requireAuth("users"));

// Carga retroactiva de un partido que ya se jugó fuera de la app (por ejemplo,
// arbitrado en papel): crea el partido directo en status:'played' con el resultado y
// los eventos que la liga ya tiene, sin pasar por el código de arbitraje ni por el
// reloj en vivo. A diferencia de /accept, esto NO revalida disponibilidad de bloque —
// una fecha pasada nunca cae dentro de windowBlockRange() (que siempre mira desde hoy
// hacia adelante), así que no compite por el mismo recurso que /accept protege. La
// corrección posterior de este partido no necesita ningún endpoint nuevo: ya cae
// gratis de matchWriteDecision() en lib/matchEvents.js, que trata todo partido
// 'played' de la propia liga como una enmienda sin código ni reloj (ver
// POST /api/league-matches/events en match_arbitration.pb.js).
routerAdd("POST", "/api/liga/matches/retroactive", (e) => {
    try {
        if (e.auth.getString("type") !== "organization" || e.auth.getString("subtype") !== "league") {
            throw new BadRequestError("Esta cuenta no es una liga.");
        }
        const { isValidEvent, summarizeEvents, CODE_ALPHABET, CODE_LENGTH } = require(`${__hooks}/lib/matchEvents.js`);
        const { formatDate, blockCode, START_HOUR, END_HOUR } = require(`${__hooks}/lib/teamSchedule.js`);

        const body = e.requestInfo().body || {};
        const stageId = String(body.stageId || "");
        const teamA = String(body.teamA || "");
        const teamB = String(body.teamB || "");
        const date = String(body.date || "");
        const hour = Number.isInteger(body.hour) ? body.hour : 12;
        const notes = String(body.notes || "");
        const events = Array.isArray(body.events) ? body.events : [];

        if (!stageId || !teamA || !teamB || !date) throw new BadRequestError("Faltan datos del partido.");
        if (teamA === teamB) throw new BadRequestError("Los dos equipos no pueden ser el mismo.");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestError("Fecha inválida.");
        if (date > formatDate(new Date())) {
            throw new BadRequestError('No se puede cargar un partido con fecha futura — usa "Agendar manualmente".');
        }
        if (hour < START_HOUR || hour > END_HOUR) throw new BadRequestError("Hora inválida.");

        // Igual que /accept: etapa propia, ambos equipos en el roster de la liga y
        // entre los participantes marcados de la etapa.
        let stage;
        try {
            stage = $app.findRecordById("league_stages", stageId);
        } catch (err) {
            throw new BadRequestError("La etapa indicada no existe.");
        }
        if (stage.getString("league") !== e.auth.id) {
            throw new BadRequestError("Esa etapa no pertenece a tu liga.");
        }

        const rosterRows = $app.findRecordsByFilter(
            "league_teams",
            "league = {:league} && deleted = false",
            "",
            0,
            0,
            { league: e.auth.id }
        );
        const rosterSet = new Set(rosterRows.map((r) => r.getString("team")));
        if (teamA === teamB) {
            throw new BadRequestError("Un equipo no puede jugar contra sí mismo.");
        }
        if (!rosterSet.has(teamA) || !rosterSet.has(teamB)) {
            throw new BadRequestError("Ambos equipos deben pertenecer a tu liga.");
        }

        const stageTeams = (stage.get("teams") || []).map(String);
        const stageSet = new Set(stageTeams);
        if (!(stageSet.has(teamA) && stageSet.has(teamB))) {
            throw new BadRequestError("Ambos equipos deben participar de esta etapa.");
        }

        // Este endpoint es SOLO para resultado ya jugado: nada de reloj. Sin
        // half_start/half_end/pause/resume, summarizeEvents() no necesita ningún
        // contexto de reloj para derivar el marcador — currentHalf/clockRunning quedan
        // en su default, que es justo lo correcto para un partido que nace 'played'.
        const CLOCK_TYPES = new Set(["half_start", "half_end", "pause", "resume"]);
        for (const ev of events) {
            if (ev && CLOCK_TYPES.has(ev.type)) {
                throw new BadRequestError("Este formulario no admite eventos de reloj — es solo para partidos ya jugados.");
            }
            if (!isValidEvent(ev)) throw new BadRequestError("Hay un evento con formato inválido.");
        }

        const summary = summarizeEvents(events);

        const coll = $app.findCollectionByNameOrId("league_matches");
        const record = new Record(coll);
        record.set("league", e.auth.id);
        record.set("stage", stageId);
        record.set("teamA", teamA);
        record.set("teamB", teamB);
        record.set("blockCode", blockCode(date, hour));
        record.set("status", "played");
        record.set("scoreA", summary.scoreA);
        record.set("scoreB", summary.scoreB);
        // El código de arbitraje queda sin uso real (el partido ya nace cerrado), pero
        // el campo es requerido por el esquema — se genera igual que en /accept.
        record.set("code", $security.randomStringWithAlphabet(CODE_LENGTH, CODE_ALPHABET));
        // Sin bettingClosesAt: polla_bets.createRule exige "match.bettingClosesAt >
        // @now" (migración 1787400100) — un campo vacío nunca cumple esa comparación,
        // así que la Beaupolla queda cerrada por la misma regla declarativa que ya
        // protege el resto de partidos, sin chequeo defensivo aparte.
        $app.save(record);

        const reportColl = $app.findCollectionByNameOrId("match_reports");
        const report = new Record(reportColl);
        report.set("match", record.id);
        report.set("events", events);
        report.set("status", "approved");
        if (notes) report.set("notes", notes);
        $app.save(report);

        return e.json(200, { success: true, id: record.id });
    } catch (err) {
        console.error("[league.pb.js] Error en POST /api/liga/matches/retroactive:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo cargar el partido." });
    }
}, $apis.requireAuth("users"));
