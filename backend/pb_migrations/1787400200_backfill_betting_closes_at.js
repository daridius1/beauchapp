/// <reference path="../pb_data/types.d.ts" />

// Rellena `bettingClosesAt` en los partidos que ya existían antes de la Beaupolla.
//
// Sin esto quedarían en null, y `isBettingClosed` trata un partido sin fecha como
// CERRADO — o sea que la polla nunca se abriría para los partidos ya agendados.
//
// El cálculo está COPIADO de lib/polla.js en vez de importado, por dos motivos:
//   1) el contexto de migraciones no expone `__hooks`, así que el require de los hooks
//      no resuelve (verificado: "ReferenceError: __hooks is not defined");
//   2) una migración es una foto de un momento, no debe cambiar de comportamiento
//      porque alguien edite después la función de la que dependía.
migrate((app) => {
    const CLOSE_MINUTES_BEFORE = 10;

    function closeTimeFromBlock(blockCode) {
        const code = String(blockCode || "");
        if (code.length < 13) return null;
        const hour = Number(code.slice(-2));
        const parts = code.slice(0, -3).split("-").map(Number);
        if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n)) || !Number.isFinite(hour)) {
            return null;
        }
        const start = new Date(parts[0], parts[1] - 1, parts[2], hour, 0, 0, 0);
        if (isNaN(start.getTime())) return null;
        return new Date(start.getTime() - CLOSE_MINUTES_BEFORE * 60 * 1000).toISOString();
    }

    const PAGE_SIZE = 200;
    while (true) {
        // Sin avanzar offset: las filas ya rellenadas salen del filtro, así que la
        // consulta siguiente vuelve a empezar por la primera pendiente.
        const page = app.findRecordsByFilter("league_matches", "bettingClosesAt = ''", "created", PAGE_SIZE, 0);
        if (!page || page.length === 0) break;

        let updated = 0;
        for (const match of page) {
            const closesAt = closeTimeFromBlock(match.getString("blockCode"));
            if (!closesAt) continue;
            match.set("bettingClosesAt", closesAt);
            app.save(match);
            updated++;
        }
        // Si ninguno de la página se pudo calcular (blockCode ilegible), no hay avance
        // posible y seguir consultando sería un bucle infinito.
        if (updated === 0) break;
    }
}, (app) => {
    // Irreversible a propósito: dejar el campo en blanco no aporta nada y rompería la
    // polla de los partidos ya agendados.
});
