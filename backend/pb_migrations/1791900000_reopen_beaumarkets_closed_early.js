/// <reference path="../pb_data/types.d.ts" />

// Reabre los mercados de partidos que el cron beaumarket_autoclose cerró antes de tiempo.
//
// El cron comparaba closesAt ("2026-09-11 13:50:00.000Z", con espacio) contra un
// toISOString() ("2026-09-11T00:00:00.000Z", con T) como texto. Como ' ' < 'T', desde las
// 00:00 UTC del día del cierre cualquier mercado de ese día parecía vencido, y se cerraba
// a las 21:00 de la noche anterior en Chile. Ver closesAtMs en lib/beaumarket.js.
//
// Solo se reabre lo que es seguro reabrir: un mercado 'closed' con el cierre todavía en
// el futuro y con su partido 'confirmed' (no borrado). El mercado de un partido suspendido
// queda cerrado a propósito (POST /api/liga/matches/suspend), y el de un cierre ya
// cumplido está bien cerrado. Los pozos no se tocan: cerrar solo impedía seguir apostando.
//
// La regla va copiada acá y no con require() porque en las migraciones no existe __hooks
// (CLAUDE.md §2.7).
migrate((app) => {
    const markets = app.findRecordsByFilter(
        "beaumarkets", "status = 'closed' && closesAt != '' && closesAt > @now", "", 0, 0
    );
    markets.forEach((market) => {
        const matches = app.findRecordsByFilter(
            "league_matches",
            "beaumarketMarket = {:m} && status = 'confirmed' && deleted = false",
            "", 1, 0,
            { m: market.id }
        );
        if (!matches.length) return;
        market.set("status", "open");
        app.save(market);
    });
}, (app) => {
    // Sin vuelta atrás: después de correr, un mercado reabierto por esta migración no se
    // distingue de uno que nunca se cerró, y volver a cerrarlo repetiría el bug.
});
