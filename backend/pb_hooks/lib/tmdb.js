// Lógica pura de la búsqueda de TMDB (sin $app/$http, testeable con node --test). Las
// llamadas de red viven en tmdb.pb.js.

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

// Adapta un item crudo de /search/movie o /search/tv al shape que consume el frontend.
// mediaType se pasa explícito porque la respuesta de cada endpoint no lo trae (a
// diferencia de /search/multi, que sí lo trae pero también devuelve personas que no
// queremos mostrar acá).
function parseResultItem(item, mediaType) {
    if (!item || !item.id) return null;
    const title = mediaType === "tv" ? item.name : item.title;
    if (!title) return null;
    const dateStr = mediaType === "tv" ? item.first_air_date : item.release_date;
    return {
        id: String(item.id),
        mediaType,
        title,
        year: dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null,
        posterUrl: item.poster_path ? POSTER_BASE + item.poster_path : "",
    };
}

// Combina resultados de películas y series en una sola lista, ordenada por popularidad
// (el campo que ya trae cada respuesta de TMDB) de mayor a menor.
function mergeSearchResults(movieJson, tvJson) {
    const movies = ((movieJson && movieJson.results) || [])
        .map((it) => ({ ...parseResultItem(it, "movie"), popularity: it.popularity || 0 }))
        .filter((it) => it && it.id);
    const tv = ((tvJson && tvJson.results) || [])
        .map((it) => ({ ...parseResultItem(it, "tv"), popularity: it.popularity || 0 }))
        .filter((it) => it && it.id);

    return movies.concat(tv)
        .sort((a, b) => b.popularity - a.popularity)
        .map(({ popularity, ...rest }) => rest);
}

module.exports = { parseResultItem, mergeSearchResults };
