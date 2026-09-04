// Lógica pura de la búsqueda de Spotify (sin $app/$http, así se puede testear con
// node --test). Las llamadas de red y el manejo del token viven en spotify.pb.js.

// Codificador base64 propio: la VM Goja de PocketBase no expone btoa/Buffer, y esto es
// justo lo que hace falta para el header "Authorization: Basic ..." del token endpoint.
function base64Encode(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    let i = 0;
    while (i < str.length) {
        const a = str.charCodeAt(i++);
        const hasB = i < str.length;
        const b = hasB ? str.charCodeAt(i++) : 0;
        const hasC = i < str.length;
        const c = hasC ? str.charCodeAt(i++) : 0;
        const n = (a << 16) | (b << 8) | c;
        result += chars[(n >> 18) & 63];
        result += chars[(n >> 12) & 63];
        result += hasB ? chars[(n >> 6) & 63] : "=";
        result += hasC ? chars[n & 63] : "=";
    }
    return result;
}

// Adapta la respuesta cruda de GET /v1/search?type=track al shape que consume el
// frontend — solo lo que necesitamos para mostrar resultados y guardar la elección.
function parseSearchResults(json) {
    const items = (json && json.tracks && json.tracks.items) || [];
    return items
        .filter((t) => t && t.id && t.name)
        .map((t) => ({
            id: t.id,
            name: t.name,
            artist: ((t.artists || []).map((a) => a.name).filter(Boolean)).join(", "),
            year: t.album && t.album.release_date ? parseInt(t.album.release_date.slice(0, 4), 10) || null : null,
            imageUrl: (t.album && t.album.images && t.album.images[0] && t.album.images[0].url) || "",
        }));
}

module.exports = { base64Encode, parseSearchResults };
