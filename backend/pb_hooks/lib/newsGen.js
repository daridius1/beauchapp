// Lógica pura (sin `$app`/`$http`) para generar noticias de partidos de liga con IA.
// Se usa desde news.pb.js (vía require dentro del handler, ver la nota de
// mentions.pb.js sobre por qué siempre adentro) y desde los tests en
// lib/__tests__/newsGen.test.js.
//
// Mismo reparto de responsabilidades que lib/beaurok.js: acá se arma el texto y el
// prompt; la llamada real a DeepSeek con $http.send y la API key vive en news.pb.js.

// Claves de las fuentes de datos que el panel de /admin/noticias deja tildar. Vive
// acá (no solo en el HTML del panel) para que el endpoint de generación pueda
// validar qué mandó el cliente sin confiar ciegamente en el array recibido.
const SOURCE_KEYS = ["matchInfo", "leagueContext", "statements", "refereeReport", "comments", "weather"];

const EVENT_TYPE_LABELS = {
    goal: "Gol",
    yellow_card: "Tarjeta amarilla",
    red_card: "Tarjeta roja",
    penalty: "Penal",
};

// Las dos únicas canchas del campus Beauchef donde se juegan los partidos — lista
// cerrada a propósito, la elige a mano quien genera la noticia (no hay otro lugar del
// sistema que registre esto todavía). Vive acá para que el panel de /admin/noticias y
// el armado del contexto usen exactamente el mismo texto.
const VENUE_LABELS = {
    multicancha_850: 'Multicancha 850 ("El Coliseo de 850")',
    futsal_menos3: 'Cancha de futsal del -3 ("La Tetera")',
};

/** Filtra y devuelve solo las claves de `selected` que son fuentes válidas conocidas. */
function normalizeSelectedSources(selected) {
    if (!Array.isArray(selected)) return [];
    return selected.filter((key) => SOURCE_KEYS.includes(key));
}

/** Línea legible de un evento de gol/tarjeta/penal para el "informe arbitral". Los
 *  eventos que no aportan al relato (lineup, half_start, pause, etc.) se omiten. */
function formatEvent(event, teamAName, teamBName) {
    const label = EVENT_TYPE_LABELS[event && event.type];
    if (!label) return null;
    const teamName = event.team === "A" ? teamAName : event.team === "B" ? teamBName : "";
    const who = event.player ? ` — ${event.player}` : "";
    const minute = event.minute != null ? `Min ${event.minute}: ` : "";
    const extra = event.type === "goal" && event.ownGoal ? " (autogol)" : event.type === "penalty" && event.scored === false ? " (fallado)" : "";
    return `${minute}${label}${who}${teamName ? ` (${teamName})` : ""}${extra}`;
}

/** Línea legible de una fila de tabla de posiciones. */
function formatStandingRow(row) {
    const dif = row.dif >= 0 ? `+${row.dif}` : `${row.dif}`;
    return `${row.position}. ${row.teamName} — ${row.pts} pts (PJ ${row.pj}, PG ${row.pg}, PE ${row.pe}, PP ${row.pp}, GF ${row.gf}, GC ${row.gc}, DIF ${dif})`;
}

/** "venía de una victoria 3-1 ante Rival" / derrota / empate, o null si es su debut. */
function formatForm(teamName, form) {
    if (!form) return null;
    const resultLabel = form.result === "win" ? "una victoria" : form.result === "loss" ? "una derrota" : "un empate";
    return `${teamName} venía de ${resultLabel} ${form.gf}-${form.gc} ante ${form.opponentName || "su rival anterior"}.`;
}

/** "Plantel Ingeniería (DT: Fulano): Jugador1 (3 goles), Jugador2 (0 goles)" — null si
 *  el equipo no tiene ni plantel ni DT cargado, para no meter una línea vacía. */
function formatRosterLine(teamName, roster) {
    if (!roster) return null;
    const hasPlayers = Array.isArray(roster.players) && roster.players.length > 0;
    if (!hasPlayers && !roster.dtName) return null;
    const dtPart = roster.dtName ? `DT: ${roster.dtName}` : "sin DT registrado";
    const playersPart = hasPlayers
        ? roster.players.map((p) => `${p.name}${p.isCaptain ? " (capitán)" : ""} (${p.goals} ${p.goals === 1 ? "gol" : "goles"})`).join(", ")
        : "sin plantel cargado";
    return `Plantel ${teamName} (${dtPart}): ${playersPart}`;
}

/**
 * Línea de una declaración: rol (con equipo si es jugador), si fue convocado a ESTE
 * partido (cuando se pudo determinar), y si autorizó que se le nombre por su nombre
 * real. `calledUp` es `true`/`false`/`null` (null = no se pudo determinar, ej. el
 * informe no registró convocatoria — ver news.pb.js).
 */
function formatStatementLine(s, index) {
    const parts = [s.role || "persona"];
    if (s.calledUp === true) parts.push("convocado a este partido");
    else if (s.calledUp === false) parts.push("no convocado a este partido");
    if (s.wantsMention && s.authorName) parts.push(`autorizó ser nombrado como "${s.authorName}"`);
    else parts.push("prefiere no ser nombrado");
    return `${index + 1}. (${parts.join(", ")}): "${s.content}"`;
}

// Título de cada sección, en el mismo orden en que se arman — un solo lugar para el
// texto que ve tanto la IA (como encabezado "## ...") como el panel de administración
// (como nombre de la categoría), así nunca se desalinean.
const SECTION_TITLES = {
    matchInfo: "Información del partido",
    leagueContext: "Contexto de la liga",
    statements: "Declaraciones recogidas (privadas — el nombre real de cada persona solo se puede usar si la línea dice \"autorizó ser nombrado\")",
    refereeReport: "Informe arbitral",
    comments: "Comentarios públicos del partido",
    weather: "Clima en el campus Beauchef ese día",
    editorContext: "Contexto adicional del editor",
};

/**
 * Arma cada sección de contexto por separado — `[{ key, title, body }]`, sin filtrar
 * por selectedSources — para que tanto el prompt final (`buildContext`, que sí filtra)
 * como el panel de administración (`buildContextSections`, que necesita ver TODO para
 * mostrarlo aunque no esté tildado) usen exactamente el mismo texto por categoría, una
 * sola vez. Todos los parámetros son opcionales: si no hay datos para una fuente,
 * simplemente no aparece en el resultado. Se manda TODO lo disponible de cada fuente a
 * propósito — el costo de lectura de DeepSeek es bajo, y más contexto real es lo que
 * evita que la IA rellene con generalidades o invente detalles que no pasaron.
 *
 * @param {object} params
 * @param {object} params.match - { teamAName, teamBName, scoreA, scoreB, dateLabel, status, venue }
 * @param {object} [params.league] - { name }
 * @param {object} [params.stage] - { name }
 * @param {Array<object>} [params.standings] - tabla de la etapa: [{ position, teamName, pj, pg, pe, pp, gf, gc, dif, pts }]
 * @param {object} [params.formA] - último resultado previo del equipo A: { result: 'win'|'loss'|'draw', gf, gc, opponentName }
 * @param {object} [params.formB] - ídem para el equipo B
 * @param {Array<object>} [params.topScorers] - goleadores del campeonato: [{ name, teamName, goals, inThisMatch }]
 * @param {object} [params.rosterA] - plantel del equipo A: { dtName, players: [{ name, goals, isCaptain }] }
 * @param {object} [params.rosterB] - ídem para el equipo B
 * @param {Array<object>} [params.statements] - [{ content, role, calledUp, wantsMention, authorName }]
 * @param {object} [params.report] - { notes, events, calledUpA, notCalledA, calledUpB, notCalledB }
 * @param {Array<{authorName: string, content: string}>} [params.comments]
 * @param {object} [params.weather] - { summary }
 * @param {string} [params.editorContext] - texto libre que escribió quien genera la noticia.
 */
function computeSections({ match, league, stage, standings, formA, formB, topScorers, rosterA, rosterB, statements, report, comments, weather, editorContext }) {
    const result = [];
    const push = (key, body) => { if (body) result.push({ key, title: SECTION_TITLES[key], body }); };

    if (match) {
        const lines = [
            `Partido: ${match.teamAName || "Equipo A"} ${match.scoreA ?? "?"} - ${match.scoreB ?? "?"} ${match.teamBName || "Equipo B"}`,
        ];
        if (match.dateLabel) lines.push(`Fecha: ${match.dateLabel}`);
        if (match.status) lines.push(`Estado: ${match.status}`);
        if (match.venue && VENUE_LABELS[match.venue]) lines.push(`Cancha: ${VENUE_LABELS[match.venue]}`);
        push("matchInfo", lines.join("\n"));
    }

    if (league || stage || (standings && standings.length) || formA || formB || (topScorers && topScorers.length) || rosterA || rosterB) {
        const lines = [];
        if (league && league.name) lines.push(`Liga: ${league.name}`);
        if (stage && stage.name) lines.push(`Etapa: ${stage.name}`);
        if (Array.isArray(standings) && standings.length > 0) {
            lines.push("Tabla de posiciones de la etapa (antes de este resultado no se recalcula por separado, ya lo incluye):");
            standings.forEach((row) => lines.push(formatStandingRow(row)));
        }
        const formLineA = match && formatForm(match.teamAName, formA);
        const formLineB = match && formatForm(match.teamBName, formB);
        if (formLineA) lines.push(formLineA);
        if (formLineB) lines.push(formLineB);
        if (Array.isArray(topScorers) && topScorers.length > 0) {
            lines.push("Tabla de goleadores del campeonato:");
            topScorers.forEach((s, i) => {
                lines.push(`${i + 1}. ${s.name}${s.teamName ? ` (${s.teamName})` : ""} — ${s.goals} goles${s.inThisMatch ? " · jugó en este partido" : ""}`);
            });
        }
        const rosterLineA = match && formatRosterLine(match.teamAName, rosterA);
        const rosterLineB = match && formatRosterLine(match.teamBName, rosterB);
        if (rosterLineA) lines.push(rosterLineA);
        if (rosterLineB) lines.push(rosterLineB);
        push("leagueContext", lines.join("\n"));
    }

    if (Array.isArray(statements) && statements.length > 0) {
        push("statements", statements.map((s, i) => formatStatementLine(s, i)).join("\n"));
    }

    if (report) {
        const lines = [];
        const eventLines = Array.isArray(report.events)
            ? report.events
                  .map((e) => formatEvent(e, match && match.teamAName, match && match.teamBName))
                  .filter(Boolean)
            : [];
        if (eventLines.length > 0) lines.push(eventLines.join("\n"));
        if (report.notes) lines.push(`Notas del árbitro: ${report.notes}`);
        if (Array.isArray(report.calledUpA) && report.calledUpA.length > 0) {
            lines.push(`Convocados ${match && match.teamAName}: ${report.calledUpA.join(", ")}`);
        }
        if (Array.isArray(report.notCalledA) && report.notCalledA.length > 0) {
            lines.push(`No convocados ${match && match.teamAName}: ${report.notCalledA.join(", ")}`);
        }
        if (Array.isArray(report.calledUpB) && report.calledUpB.length > 0) {
            lines.push(`Convocados ${match && match.teamBName}: ${report.calledUpB.join(", ")}`);
        }
        if (Array.isArray(report.notCalledB) && report.notCalledB.length > 0) {
            lines.push(`No convocados ${match && match.teamBName}: ${report.notCalledB.join(", ")}`);
        }
        push("refereeReport", lines.join("\n"));
    }

    if (Array.isArray(comments) && comments.length > 0) {
        push("comments", comments.map((c) => `- ${c.authorName || "Alguien"}: "${c.content}"`).join("\n"));
    }

    if (weather && weather.summary) {
        push("weather", weather.summary);
    }

    if (editorContext && editorContext.trim()) {
        push("editorContext", editorContext.trim());
    }

    return result;
}

/**
 * Todas las secciones disponibles, como `{ matchInfo: { title, body }, ... }` — para el
 * panel de /admin/noticias, que necesita mostrar el contenido real de CADA categoría
 * (tildada o no) sin un botón de "actualizar vista previa" aparte.
 */
function buildContextSections(params) {
    const sections = {};
    computeSections(params).forEach((s) => { sections[s.key] = { title: s.title, body: s.body }; });
    return sections;
}

/**
 * El texto final que recibe DeepSeek: las mismas secciones de `computeSections`, pero
 * solo las marcadas en `selectedSources` (más `editorContext`, que siempre se incluye
 * si el editor escribió algo — no es una fuente que se tilde, es su propio aporte).
 *
 * @param {object} params - los mismos de `computeSections`.
 * @param {string[]} params.selectedSources
 */
function buildContext(params) {
    const sources = normalizeSelectedSources(params.selectedSources);
    const allowed = (key) => key === "editorContext" || sources.includes(key);
    return computeSections(params)
        .filter((s) => allowed(s.key))
        .map((s) => `## ${s.title}\n${s.body}`)
        .join("\n\n");
}

// Tope del texto de instrucciones editoriales que cada medio puede guardar (ver
// migración add_news_instructions_to_users.js) — alcanza para hartas instrucciones de
// tono/estilo sin abrir la puerta a inflar el costo de cada generación sin límite.
const MAX_INSTRUCTIONS_LEN = 2000;

/** Mensajes system/user para POST /chat/completions de DeepSeek (mismo endpoint que
 *  usa BeauRok en mentions.pb.js). `customInstructions` son las instrucciones
 *  editoriales que el medio guardó (opcional) — se AGREGAN al final del prompt base,
 *  nunca lo reemplazan: las reglas de formato y privacidad de abajo son fijas a
 *  propósito y no las puede tocar el texto personalizado. */
function buildPrompt(context, customInstructions) {
    const system =
        "Eres redactor/a de \"Beauchef Deportes\", el medio de noticias deportivas de la " +
        "facultad. Escribes en español de Chile, tono periodístico pero cercano, sin " +
        "inventar datos que no estén en el contexto entregado. Cuando hay varias " +
        "declaraciones o comentarios parecidos (por ejemplo varias quejas), sintetízalos " +
        "en tu propia descripción (ej. \"hinchas molestos por el arbitraje\") en vez de " +
        "citarlos uno por uno. Las declaraciones son privadas por defecto: nunca reveles " +
        "el nombre real ni datos que permitan identificar a quien la hizo, salvo que su " +
        "línea diga explícitamente \"autorizó ser nombrado como <nombre>\" — solo en ese " +
        "caso puedes usar ese nombre real al citar o resumir ESA declaración puntual, " +
        "nunca para el resto. Responde EXACTAMENTE en este formato, sin texto antes ni " +
        "después:\n" +
        "TITULO: <un titular de una línea>\n" +
        "BAJADA: <un resumen de una línea, distinto del título>\n" +
        "CUERPO: <la noticia completa, varios párrafos>";
    const trimmedInstructions = (customInstructions || "").trim().slice(0, MAX_INSTRUCTIONS_LEN);
    const fullSystem = trimmedInstructions
        ? `${system}\n\nInstrucciones adicionales del medio (estilo/tono — nunca pueden aflojar las reglas de arriba):\n${trimmedInstructions}`
        : system;
    const user = context && context.trim() ? context : "(sin datos adicionales del partido)";
    return { system: fullSystem, user };
}

/** Separa título/bajada/cuerpo de la respuesta del modelo. Robusto a que el modelo no
 *  respete el formato pedido: si no encuentra las etiquetas, usa la primera línea
 *  no vacía como título, sin bajada, y el resto como cuerpo. */
function parseAiResponse(rawText) {
    const text = (rawText || "").trim();
    if (!text) return { title: "", subtitle: "", body: "" };

    const titleMatch = text.match(/TITULO:\s*(.+)/i);
    const subtitleMatch = text.match(/BAJADA:\s*(.+)/i);
    const bodyMatch = text.match(/CUERPO:\s*([\s\S]+)/i);
    if (titleMatch && bodyMatch) {
        return {
            title: titleMatch[1].trim(),
            subtitle: subtitleMatch ? subtitleMatch[1].trim() : "",
            body: bodyMatch[1].trim(),
        };
    }

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] || "Noticia";
    const body = lines.slice(1).join("\n\n") || text;
    return { title, subtitle: "", body };
}

module.exports = {
    SOURCE_KEYS,
    VENUE_LABELS,
    MAX_INSTRUCTIONS_LEN,
    normalizeSelectedSources,
    buildContextSections,
    buildContext,
    buildPrompt,
    parseAiResponse,
};
