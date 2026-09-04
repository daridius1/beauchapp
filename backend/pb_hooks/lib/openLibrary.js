// Lógica pura de la búsqueda de Open Library (sin $app/$http, testeable con node --test).
// Las llamadas de red viven en books.pb.js.

// "L" = large, el tamaño de carátula más grande que sirve Open Library sin pedir la
// original — de sobra para una tarjeta de perfil, igual que t_cover_big en IGDB.
const COVER_BASE = "https://covers.openlibrary.org/b/id/";

// Open Library devuelve { docs: [...] } de /search.json. Cada doc: { key, title,
// author_name: [...], first_publish_year, cover_i }.
function parseSearchResults(json) {
    const docs = (json && json.docs) || [];
    return docs
        .filter((d) => d && d.key && d.title)
        .map((d) => ({
            id: String(d.key).replace(/^\/works\//, ""),
            title: d.title,
            author: (d.author_name || []).filter(Boolean).join(", "),
            year: d.first_publish_year || null,
            coverUrl: d.cover_i ? `${COVER_BASE}${d.cover_i}-L.jpg` : "",
        }));
}

module.exports = { parseSearchResults };
