/// <reference path="../pb_data/types.d.ts" />

// Búsqueda de canciones en Spotify para Música: la elección y la reproducción ya no
// dependen de subir un archivo propio, se apoyan en el catálogo real de Spotify (el
// frontend arma el embed público con el spotifyTrackId elegido acá, sin necesitar token).
// Solo hace falta Client Credentials (SPOTIFY_CLIENT_ID/SECRET en .env, ver
// .env.example) — sin login de usuario, alcanza para buscar.
routerAdd("GET", "/api/spotify/search", (e) => {
    const { base64Encode, parseSearchResults } = require(`${__hooks}/lib/spotify.js`);

    const clientId = $os.getenv("SPOTIFY_CLIENT_ID");
    const clientSecret = $os.getenv("SPOTIFY_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        throw new BadRequestError("La búsqueda de Spotify no está configurada en este servidor.");
    }

    const q = (e.requestInfo().query["q"] || "").trim();
    if (!q) {
        throw new BadRequestError("Escribe algo para buscar.");
    }

    // Token cacheado en el store del proceso — a diferencia de una variable de módulo, esto
    // sí persiste entre requests (cada routerAdd corre en su propia VM, ver CLAUDE.md §2.1).
    const store = $app.store();
    const cacheKey = "spotify_token";
    let token = null;
    const cached = store.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60000) {
        token = cached.token;
    } else {
        const tokenRes = $http.send({
            url: "https://accounts.spotify.com/api/token",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + base64Encode(`${clientId}:${clientSecret}`),
            },
            body: "grant_type=client_credentials",
            timeout: 15,
        });
        if (tokenRes.statusCode !== 200 || !tokenRes.json || !tokenRes.json.access_token) {
            console.error("[spotify.pb.js] Error obteniendo token:", tokenRes.statusCode, tokenRes.raw);
            throw new BadRequestError("No se pudo conectar con Spotify. Intenta de nuevo.");
        }
        token = tokenRes.json.access_token;
        store.set(cacheKey, {
            token,
            expiresAt: Date.now() + (tokenRes.json.expires_in || 3600) * 1000,
        });
    }

    const searchRes = $http.send({
        url: "https://api.spotify.com/v1/search?type=track&limit=10&q=" + encodeURIComponent(q),
        method: "GET",
        headers: { "Authorization": "Bearer " + token },
        timeout: 15,
    });
    if (searchRes.statusCode !== 200) {
        console.error("[spotify.pb.js] Error buscando:", searchRes.statusCode, searchRes.raw);
        throw new BadRequestError("No se pudo buscar en Spotify. Intenta de nuevo.");
    }

    return e.json(200, { items: parseSearchResults(searchRes.json) });
}, $apis.requireAuth("users"));
