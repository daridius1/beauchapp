/// <reference path="../pb_data/types.d.ts" />

// Búsqueda de videojuegos en IGDB (Internet Game Database) para la categoría Videojuegos
// de "Conoce Beauchef" — mismo patrón que Spotify/TMDB. IGDB se autentica vía Twitch
// (IGDB_CLIENT_ID/IGDB_CLIENT_SECRET en .env, un "Client ID"/"Client Secret" de una app de
// Twitch Developers): Client Credentials igual que Spotify, sin login de usuario. A
// diferencia de TMDB/Spotify, IGDB no es REST con query params — se consulta con POST y
// una query en su propio lenguaje (Apicalypse).
routerAdd("GET", "/api/igdb/search", (e) => {
    const { parseSearchResults } = require(`${__hooks}/lib/igdb.js`);

    const clientId = $os.getenv("IGDB_CLIENT_ID");
    const clientSecret = $os.getenv("IGDB_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        throw new BadRequestError("La búsqueda de IGDB no está configurada en este servidor.");
    }

    const q = (e.requestInfo().query["q"] || "").trim();
    if (!q) {
        throw new BadRequestError("Escribe algo para buscar.");
    }

    // Token de Twitch cacheado en el store del proceso — mismo motivo que el de Spotify
    // (persiste entre requests a diferencia de una variable de módulo, ver CLAUDE.md §2.1).
    // Los tokens de app de Twitch duran ~60 días, así que en la práctica casi no se
    // refresca, pero igual se revisa la expiración por las dudas.
    const store = $app.store();
    const cacheKey = "igdb_token";
    let token = null;
    const cached = store.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60000) {
        token = cached.token;
    } else {
        const tokenRes = $http.send({
            url: `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
            method: "POST",
            timeout: 15,
        });
        if (tokenRes.statusCode !== 200 || !tokenRes.json || !tokenRes.json.access_token) {
            console.error("[igdb.pb.js] Error obteniendo token:", tokenRes.statusCode, tokenRes.raw);
            throw new BadRequestError("No se pudo conectar con IGDB. Intenta de nuevo.");
        }
        token = tokenRes.json.access_token;
        store.set(cacheKey, {
            token,
            expiresAt: Date.now() + (tokenRes.json.expires_in || 5184000) * 1000,
        });
    }

    // Apicalypse: la comilla doble del query se escapa por si alguien busca un título que
    // ya trae comillas.
    const safeQuery = q.replace(/"/g, '\\"');
    const searchRes = $http.send({
        url: "https://api.igdb.com/v4/games",
        method: "POST",
        headers: {
            "Client-ID": clientId,
            "Authorization": "Bearer " + token,
            "Content-Type": "text/plain",
        },
        body: `search "${safeQuery}"; fields name,first_release_date,cover.image_id; limit 10;`,
        timeout: 15,
    });
    if (searchRes.statusCode !== 200) {
        console.error("[igdb.pb.js] Error buscando:", searchRes.statusCode, searchRes.raw);
        throw new BadRequestError("No se pudo buscar en IGDB. Intenta de nuevo.");
    }

    return e.json(200, { items: parseSearchResults(searchRes.json) });
}, $apis.requireAuth("users"));
