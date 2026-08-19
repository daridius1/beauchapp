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

module.exports = {
    PALETTE_CSS,
    escapeHtml,
    clientEscapeHtmlFn,
};
