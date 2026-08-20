// Piezas compartidas por las páginas HTML de administración que sirven los hooks
// (/admin/liga, /admin/horarios, /admin/beaumarket, /admin/reviews-import,
// /admin/generate-link, /register-org).
//
// Esas páginas suman ~2.360 líneas dentro de los .pb.js — el 29% del backend — sin
// typecheck, sin lint y sin tests, y cada una traía su propia copia de la paleta y de
// la lógica de sesión. Fue justamente en ese código donde apareció el único hallazgo
// alto de la auditoría (una XSS por innerHTML). Este módulo no las reescribe: extrae lo
// que era idéntico en las cinco, para que un cambio de paleta o una corrección de
// seguridad se haga en un solo lugar. Ver auditoria-2026-08-19.md §4.5.
//
// Se consume con require() DENTRO de cada routerAdd — PocketBase corre cada handler en
// una VM aislada y no ve el scope del módulo .pb.js (ver la nota en match_arbitration.pb.js).

// Paleta de DESIGN.md §2. Era byte a byte la misma en las cinco páginas.
const PALETTE_CSS = `:root {
            --bg-color: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --border-color: rgba(255, 255, 255, 0.1);
            --primary-color: #38bdf8;
            --primary-hover: #0ea5e9;
            --text-color: #f1f5f9;
            --text-muted: #94a3b8;
            --danger-color: #ef4444;
            --success-color: #22c55e;
        }`;

// Escapado de HTML para cualquier valor que termine dentro de un innerHTML o de un
// atributo. La regla de fondo es preferir textContent/createTextNode; esto es para los
// casos en que se arma una plantilla de string y reescribirla no vale la pena.
//
// Sirve tanto en el servidor (interpolar dentro del template de la página) como en el
// cliente (inyectándolo con clientEscapeHtmlFn()).
function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// La MISMA función, como texto, para incrustarla en el <script> de una página. Se
// devuelve como fuente en vez de duplicarla a mano en cada página.
function clientEscapeHtmlFn() {
    return `
        function esc(value) {
            return String(value === null || value === undefined ? "" : value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }`;
}


// Constantes de la ventana horaria, compartidas con lib/teamSchedule.js (que es quien
// manda en el servidor). Se repiten acá porque estas páginas corren en el navegador y
// no pueden requerir el módulo del backend.
const SCHEDULE_START_HOUR = 9;
const SCHEDULE_END_HOUR = 19;
const SCHEDULE_WEEKS_WINDOW = 3;

// Helpers de calendario para el <script> de una página de administración, como fuente.
//
// Los usan /admin/horarios y /admin/liga. Antes vivían solo en horarios y la vista de
// ligas iba a necesitar una segunda copia — que es exactamente cómo dos calendarios que
// tienen que coincidir terminan divergiendo (la ventana la define el servidor en
// lib/teamSchedule.js, y ambas páginas tienen que dibujar EXACTAMENTE esa).
//
// Expone: DAY_LABELS, FULL_DAY_LABELS, MONTH_LABELS, START_HOUR, END_HOUR, WEEKS_WINDOW, pad2(),
// formatDateStr(), startOfWeek(), getWindow() y blockCodeOf(day, hour).
function clientCalendarFns() {
    return `
        // DAY_LABELS son las COLUMNAS del calendario (solo días hábiles). Para
        // formatear una fecha cualquiera hace falta la semana completa: FULL_DAY_LABELS.
        const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
        const FULL_DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        const START_HOUR = ${SCHEDULE_START_HOUR}, END_HOUR = ${SCHEDULE_END_HOUR}, WEEKS_WINDOW = ${SCHEDULE_WEEKS_WINDOW};

        function pad2(n) { return String(n).padStart(2, "0"); }
        function formatDateStr(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
        function startOfWeek(date) {
            const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dow = d.getDay();
            const diffToMonday = dow === 0 ? -6 : 1 - dow;
            d.setDate(d.getDate() + diffToMonday);
            return d;
        }
        function blockCodeOf(day, hour) { return day.dateStr + "-" + pad2(hour); }
        function getWindow() {
            const start = startOfWeek(new Date());
            const weeks = [];
            for (let w = 0; w < WEEKS_WINDOW; w++) {
                const days = [];
                for (let d = 0; d < DAY_LABELS.length; d++) {
                    const day = new Date(start);
                    day.setDate(day.getDate() + w * 7 + d);
                    days.push({ dateStr: formatDateStr(day), dayOfMonth: day.getDate(), monthIdx: day.getMonth(), dayLabel: DAY_LABELS[d] });
                }
                const first = days[0], last = days[days.length - 1];
                const label = first.monthIdx === last.monthIdx
                    ? first.dayOfMonth + " al " + last.dayOfMonth + " de " + MONTH_LABELS[first.monthIdx]
                    : first.dayOfMonth + " " + MONTH_LABELS[first.monthIdx] + " al " + last.dayOfMonth + " " + MONTH_LABELS[last.monthIdx];
                weeks.push({ label, days });
            }
            return weeks;
        }`;
}

// CSS de la grilla de bloques, también compartido por las dos páginas.
const CALENDAR_CSS = `
        .week-block { margin-bottom: 18px; }
        .week-label { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        .grid-table { border-collapse: collapse; font-size: 10px; width: 100%; table-layout: fixed; }
        .grid-table th, .grid-table td { border: 1px solid var(--border-color); padding: 0; text-align: center; }
        .grid-table th { color: var(--text-muted); font-weight: 600; padding: 2px 4px; }
        .grid-table th:first-child, .grid-table td:first-child { width: 44px; }
        .grid-cell { display: block; width: 100%; height: 22px; box-sizing: border-box; cursor: pointer; user-select: none; background: rgba(15,23,42,0.4); }
        .grid-cell.occupied { background: #1e3a5f; cursor: default; }
        .grid-cell.blocked { background: var(--danger-color); cursor: default; }
        .grid-cell.chosen { background: var(--primary-color); }
        .grid-cell.mine { background: #16a34a; cursor: default; }
        .grid-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: var(--text-muted); margin-top: 8px; }
        .grid-legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
        .day-toggle { background: none; border: none; color: var(--text-muted); cursor: pointer; font: inherit; padding: 2px 4px; width: 100%; }
        .day-toggle:hover { color: var(--primary-color); }`;

module.exports = {
    PALETTE_CSS,
    CALENDAR_CSS,
    SCHEDULE_START_HOUR,
    SCHEDULE_END_HOUR,
    SCHEDULE_WEEKS_WINDOW,
    escapeHtml,
    clientEscapeHtmlFn,
    clientCalendarFns,
};
