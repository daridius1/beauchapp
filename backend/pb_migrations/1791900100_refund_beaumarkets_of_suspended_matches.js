/// <reference path="../pb_data/types.d.ts" />

// Devuelve lo apostado en los mercados de partidos que ya estaban suspendidos, ahora que
// suspender reembolsa (ver POST /api/liga/matches/suspend). Antes suspender solo cerraba el
// mercado, y los ℬ quedaban congelados sin fecha.
//
// Mismo trato que recibe hoy un partido al suspenderse: reembolso 1:1 de cada posición,
// mercado 'cancelled' y desvinculado del partido (para que la liga pueda activarle uno
// nuevo si lo reagenda). Solo se reembolsan mercados 'open'/'closed': uno resuelto ya
// pagó y uno cancelado ya devolvió.
//
// La regla va copiada acá y no con require() porque en las migraciones no existe __hooks
// (CLAUDE.md §2.7).
migrate((app) => {
    const matches = app.findRecordsByFilter(
        "league_matches", "status = 'suspended' && beaumarketMarket != ''", "", 0, 0
    );
    matches.forEach((match) => {
        let market = null;
        try {
            market = app.findRecordById("beaumarkets", match.getString("beaumarketMarket"));
        } catch (err) {
            // El mercado pudo haberse borrado a mano: solo queda soltar la referencia.
        }
        const status = market ? market.getString("status") : "";
        if (status === "resolved") return;

        if (status === "open" || status === "closed") {
            const positions = app.findRecordsByFilter(
                "beaumarket_positions", "market = {:m}", "", 0, 0, { m: market.id }
            );
            positions.forEach((pos) => {
                const amount = pos.getInt("amount");
                if (amount > 0) {
                    app.db()
                        .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                        .bind({ amt: amount, id: pos.getString("user") })
                        .execute();
                }
            });
            market.set("status", "cancelled");
            app.save(market);
        }

        match.set("beaumarketMarket", "");
        app.save(match);
    });
}, (app) => {
    // Sin vuelta atrás: los ℬ ya volvieron a cada saldo y pudieron gastarse.
});
