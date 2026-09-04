// Lógica pura de la búsqueda de IGDB (sin $app/$http, testeable con node --test). Las
// llamadas de red y el token de Twitch viven en igdb.pb.js.

// t_cover_big (264x374) es el tamaño de carátula más grande que sirve IGDB sin pedir la
// original a resolución completa — de sobra para una tarjeta de perfil.
const COVER_BASE = "https://images.igdb.com/igdb/image/upload/t_cover_big/";

// IGDB (Apicalypse) devuelve un array plano de juegos, no un objeto envoltorio como
// TMDB/Spotify. Cada item: { id, name, first_release_date (unix seconds), cover: { image_id } }.
function parseSearchResults(items) {
    if (!Array.isArray(items)) return [];
    return items
        .filter((it) => it && it.id && it.name)
        .map((it) => ({
            id: String(it.id),
            name: it.name,
            year: it.first_release_date ? new Date(it.first_release_date * 1000).getUTCFullYear() : null,
            coverUrl: it.cover && it.cover.image_id ? COVER_BASE + it.cover.image_id + ".jpg" : "",
        }));
}

module.exports = { parseSearchResults };
