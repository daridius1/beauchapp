/// <reference path="../pb_data/types.d.ts" />

// Búsqueda de películas/series en TMDB (themoviedb.org) para la categoría fusionada de
// "Conoce Beauchef" (Películas absorbe Anime y Series — el anime de TV ya vive catalogado
// ahí mismo como serie). A diferencia de Spotify, TMDB no exige token OAuth: alcanza con
// la api_key fija de la cuenta (TMDB_API_KEY en .env, ver .env.example), sin cuenta
// premium ni caché de token de por medio.
routerAdd("GET", "/api/tmdb/search", (e) => {
    const { mergeSearchResults } = require(`${__hooks}/lib/tmdb.js`);

    const apiKey = $os.getenv("TMDB_API_KEY");
    if (!apiKey) {
        throw new BadRequestError("La búsqueda de TMDB no está configurada en este servidor.");
    }

    const q = (e.requestInfo().query["q"] || "").trim();
    if (!q) {
        throw new BadRequestError("Escribe algo para buscar.");
    }

    const encodedQuery = encodeURIComponent(q);
    const [movieRes, tvRes] = [
        $http.send({
            url: `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=es-ES&query=${encodedQuery}`,
            method: "GET",
            timeout: 15,
        }),
        $http.send({
            url: `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=es-ES&query=${encodedQuery}`,
            method: "GET",
            timeout: 15,
        }),
    ];

    if (movieRes.statusCode !== 200 || tvRes.statusCode !== 200) {
        console.error("[tmdb.pb.js] Error buscando:", movieRes.statusCode, movieRes.raw, tvRes.statusCode, tvRes.raw);
        throw new BadRequestError("No se pudo buscar en TMDB. Intenta de nuevo.");
    }

    return e.json(200, { items: mergeSearchResults(movieRes.json, tvRes.json) });
}, $apis.requireAuth("users"));
