/// <reference path="../pb_data/types.d.ts" />

// Beaudle: Wordle diario de lugares del campus Beauchef (FCFM). Cada callback de abajo
// es autocontenido (require() propio en vez de compartir const/function de nivel de
// archivo) por el mismo motivo documentado en karma.pb.js: el JSVM no conserva
// referencias de nivel de archivo entre callbacks registrados por separado — por eso
// GET /today y POST /guess repiten la lógica de "día" en vez de compartir una función
// interna, y "días pasados jugables" vive como un query param de /today en vez de una
// ruta nueva (evita esa misma duplicación).
//
// El lugar secreto del día NUNCA se confía del cliente ni se guarda mientras la partida
// sigue en curso: se recalcula server-side en cada request a partir de la fecha + una
// salt, vía pickSecretForDay() en lib/beaudle.js. Solo se persiste en
// beaudle_games.revealed_code en el momento exacto en que la partida deja de estar
// "in_progress".
//
// Los campos json (guesses, guess_distribution) se leen/escriben como string vía
// getString()/JSON.parse() y set(field, JSON.stringify(value)) — mismo patrón que ya usa
// ladders.pb.js para "confirmations"/"openskill_changes" (Record.set() con un objeto/
// array crudo falla con "Must be a valid json value").
//
// Numeración "Beaudle #N": se asigna incrementalmente al crear cada beaudle_daily_stats
// (ver nextDayNumber en lib/beaudle.js) — nunca por diff de fechas contra un día fijo. Un
// día calendario sin ninguna partida jugada nunca genera fila y no consume número.
//
// Racha (beaudle_streak/beaudle_best_streak/beaudle_last_streak_day en "users"): solo se
// actualiza cuando una partida se completa (gana o pierde, da lo mismo) el mismo día
// calendario que le correspondía ("on_time"). Jugar un día pasado que te saltaste está
// permitido (revela el lugar igual) pero nunca mueve la racha ni otorga BeauTokens.

routerAdd("GET", "/api/beaudle/today", (e) => {
    try {
        const { PLACES, MAX_GUESSES } = require(`${__hooks}/lib/beaudle.js`);

        const variant = e.requestInfo().query["variant"] || "classic";
        if (variant !== "classic") {
            return e.json(400, { error: "Variante desconocida." });
        }

        const t = new DateTime().time().in(new Timezone("America/Santiago"));
        const pad = (n) => String(n).padStart(2, "0");
        const today = `${t.year()}-${pad(Number(t.month()))}-${pad(t.day())}`;

        // "day" es opcional — sin él, es el comportamiento de siempre (hoy). Con él, sirve
        // para ver/jugar un día pasado específico (ej. desde la lista de días o al tocar
        // "Ver Beaudle" en una cita/comentario de ese día). Nunca se permite un día futuro.
        const day = String(e.requestInfo().query["day"] || today);
        if (day > today) {
            return e.json(400, { error: "Ese día todavía no existe." });
        }

        let game = null;
        try {
            game = $app.findFirstRecordByFilter(
                "beaudle_games", "user = {:u} && day = {:d} && variant = {:v}",
                { u: e.auth.id, d: day, v: variant }
            );
        } catch (nf) { /* sin partida ese día todavía */ }

        let stats = null;
        try {
            stats = $app.findFirstRecordByFilter(
                "beaudle_daily_stats", "day = {:d} && variant = {:v}", { d: day, v: variant }
            );
        } catch (nf) { /* sin stats ese día todavía */ }

        const dayNumber = stats ? (stats.getInt("day_number") || null) : null;
        const statsJson = stats
            ? {
                day, variant,
                playersCount: stats.getInt("players_count"),
                solvedCount: stats.getInt("solved_count"),
                guessDistribution: JSON.parse(stats.getString("guess_distribution") || "{}"),
            }
            : { day, variant, playersCount: 0, solvedCount: 0, guessDistribution: {} };

        const isToday = day === today;

        if (!game) {
            return e.json(200, {
                day, variant, dayNumber, isToday, maxGuesses: MAX_GUESSES, status: "in_progress",
                guesses: [], guessesRemaining: MAX_GUESSES, revealedPlace: null, stats: statsJson,
                statsId: stats ? stats.id : null, solvedAtGuess: null,
            });
        }

        const status = game.getString("status");
        const guesses = JSON.parse(game.getString("guesses") || "[]");
        let revealedPlace = null;
        if (status !== "in_progress") {
            const code = game.getString("revealed_code");
            revealedPlace = PLACES.find((p) => p.code === code) || null;
        }
        return e.json(200, {
            day, variant, dayNumber, isToday, maxGuesses: MAX_GUESSES, status, guesses,
            guessesRemaining: MAX_GUESSES - guesses.length, revealedPlace, stats: statsJson,
            statsId: stats ? stats.id : null, solvedAtGuess: game.getInt("solvedAtGuess") || null,
        });
    } catch (err) {
        console.error("[beaudle.pb.js] Error en GET /api/beaudle/today:", err);
        return e.json(500, { error: "No se pudo cargar el Beaudle de ese día." });
    }
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/beaudle/days", (e) => {
    try {
        const { MAX_GUESSES } = require(`${__hooks}/lib/beaudle.js`);

        const variant = e.requestInfo().query["variant"] || "classic";
        if (variant !== "classic") {
            return e.json(400, { error: "Variante desconocida." });
        }

        const page = Math.max(1, Number(e.requestInfo().query["page"] || 1) || 1);
        const perPage = Math.min(50, Math.max(1, Number(e.requestInfo().query["perPage"] || 30) || 30));

        const t = new DateTime().time().in(new Timezone("America/Santiago"));
        const pad = (n) => String(n).padStart(2, "0");
        const today = `${t.year()}-${pad(Number(t.month()))}-${pad(t.day())}`;

        const statsRows = $app.findRecordsByFilter(
            "beaudle_daily_stats", "variant = {:v}", "-day_number", perPage, (page - 1) * perPage, { v: variant }
        );

        const days = statsRows.map((statsRow) => {
            const day = statsRow.getString("day");
            let myStatus = "not_played";
            let myGuessCount = 0;
            try {
                const game = $app.findFirstRecordByFilter(
                    "beaudle_games", "user = {:u} && day = {:d} && variant = {:v}",
                    { u: e.auth.id, d: day, v: variant }
                );
                myStatus = game.getString("status");
                myGuessCount = JSON.parse(game.getString("guesses") || "[]").length;
            } catch (nf) { /* nunca jugó ese día */ }

            return {
                day,
                dayNumber: statsRow.getInt("day_number") || null,
                isToday: day === today,
                playersCount: statsRow.getInt("players_count") || 0,
                solvedCount: statsRow.getInt("solved_count") || 0,
                myStatus, myGuessCount,
            };
        });

        let myStreak = 0;
        let myBestStreak = 0;
        try {
            const userRecord = $app.findRecordById("users", e.auth.id);
            myStreak = userRecord.getInt("beaudle_streak") || 0;
            myBestStreak = userRecord.getInt("beaudle_best_streak") || 0;
        } catch (err) { /* no debería pasar (usuario autenticado), pero por si acaso */ }

        return e.json(200, { days, maxGuesses: MAX_GUESSES, myStreak, myBestStreak });
    } catch (err) {
        console.error("[beaudle.pb.js] Error en GET /api/beaudle/days:", err);
        return e.json(500, { error: "No se pudo cargar la lista de días de Beaudle." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/beaudle/guess", (e) => {
    try {
        const { PLACES, MAX_GUESSES, pickSecretForDay, compareGuessToSecret, nextDayNumber, computeStreakUpdate } = require(`${__hooks}/lib/beaudle.js`);

        const body = e.requestInfo().body || {};
        const variant = body.variant || "classic";
        const code = String(body.code || "").toLowerCase();
        if (variant !== "classic") {
            return e.json(400, { error: "Variante desconocida." });
        }

        const guessPlace = PLACES.find((p) => p.code === code);
        if (!guessPlace) {
            return e.json(400, { error: "Lugar inválido." });
        }

        const t = new DateTime().time().in(new Timezone("America/Santiago"));
        const pad = (n) => String(n).padStart(2, "0");
        const today = `${t.year()}-${pad(Number(t.month()))}-${pad(t.day())}`;

        // "day" opcional en el body — permite adivinar sobre un día pasado (partida
        // retroactiva). Nunca se permite un día futuro. onTime decide si esta partida
        // otorga BeauTokens y mueve la racha, más abajo.
        const day = String(body.day || today);
        if (day > today) {
            return e.json(400, { error: "Ese día todavía no existe." });
        }
        const onTime = day === today;

        const salt = $os.getenv("BEAUDLE_SEED_SALT") || "beaudle-default-salt-v1";
        const secretPlace = pickSecretForDay(day, PLACES, salt);
        const feedback = compareGuessToSecret(guessPlace, secretPlace);

        // Busca-o-crea la partida de ese día. No se usa una transacción explícita (sin
        // precedente en este repo): el riesgo de carrera por doble-submit del mismo
        // usuario se mitiga deshabilitando el botón de enviar en el frontend mientras la
        // request está en vuelo, y una eventual deriva rara en las stats la corrige el
        // cron nocturno de abajo — mismo nivel de tolerancia a riesgo que ya acepta
        // marketplace.pb.js hoy para su contador de recomendaciones.
        let game;
        let isNewGame = false;
        try {
            game = $app.findFirstRecordByFilter(
                "beaudle_games", "user = {:u} && day = {:d} && variant = {:v}",
                { u: e.auth.id, d: day, v: variant }
            );
        } catch (nf) {
            const coll = $app.findCollectionByNameOrId("beaudle_games");
            game = new Record(coll);
            game.set("user", e.auth.id);
            game.set("day", day);
            game.set("variant", variant);
            game.set("status", "in_progress");
            game.set("guesses", JSON.stringify([]));
            game.set("on_time", onTime);
            isNewGame = true;
        }

        if (game.getString("status") !== "in_progress") {
            return e.json(400, { error: "Ya completaste el Beaudle de ese día." });
        }
        const guesses = JSON.parse(game.getString("guesses") || "[]");
        if (guesses.length >= MAX_GUESSES) {
            return e.json(400, { error: "Ya usaste todos tus intentos de ese día." });
        }

        guesses.push({ ...feedback, code: guessPlace.code, guessedAt: new DateTime().string() });
        game.set("guesses", JSON.stringify(guesses));

        let justFinished = false;
        if (feedback.solved) {
            game.set("status", "won");
            game.set("solvedAtGuess", guesses.length);
            game.set("revealed_code", secretPlace.code);
            justFinished = true;
        } else if (guesses.length >= MAX_GUESSES) {
            game.set("status", "lost");
            game.set("revealed_code", secretPlace.code);
            justFinished = true;
        }
        $app.save(game);

        // Recompensa de BeauTokens y actualización de racha — gane o pierda, una sola vez
        // (justo en la transición a "won"/"lost", nunca de nuevo si se reintenta la ruta
        // con la partida ya terminada, porque el chequeo de status !== "in_progress" de
        // más arriba ya corta esa segunda llamada antes de llegar acá), y SOLO si la
        // partida fue on_time — una partida retroactiva de un día pasado nunca otorga
        // puntos ni mueve la racha, aunque sí revela el lugar y queda registrada.
        const FINISH_REWARD_BEAUTOKENS = 10;
        if (justFinished && onTime) {
            $app.db()
                .newQuery("UPDATE users SET beautokens = COALESCE(beautokens, 0) + {:amt} WHERE id = {:id}")
                .bind({ amt: FINISH_REWARD_BEAUTOKENS, id: e.auth.id })
                .execute();

            try {
                const userRecord = $app.findRecordById("users", e.auth.id);
                const prevStreak = userRecord.getInt("beaudle_streak") || 0;
                const prevBestStreak = userRecord.getInt("beaudle_best_streak") || 0;
                const lastStreakDay = userRecord.getString("beaudle_last_streak_day") || null;
                const streakUpdate = computeStreakUpdate(prevStreak, prevBestStreak, lastStreakDay, day);
                userRecord.set("beaudle_streak", streakUpdate.streak);
                userRecord.set("beaudle_best_streak", streakUpdate.bestStreak);
                userRecord.set("beaudle_last_streak_day", streakUpdate.lastStreakDay);
                $app.save(userRecord);
            } catch (streakErr) {
                console.error("[beaudle.pb.js] Error actualizando racha:", streakErr);
            }
        }

        // beaudle_daily_stats: busca-o-crea la fila del día y actualiza contadores.
        let stats;
        try {
            stats = $app.findFirstRecordByFilter(
                "beaudle_daily_stats", "day = {:d} && variant = {:v}", { d: day, v: variant }
            );
        } catch (nf) {
            // Numerar "Beaudle #N" a partir de la última fila que exista para esta
            // variante — nunca por diff de fechas contra un día fijo (ver lib/beaudle.js).
            let prevDayNumber = 0;
            const prevRows = $app.findRecordsByFilter(
                "beaudle_daily_stats", "variant = {:v}", "-day_number", 1, 0, { v: variant }
            );
            if (prevRows.length > 0) {
                prevDayNumber = prevRows[0].getInt("day_number") || 0;
            }

            const coll = $app.findCollectionByNameOrId("beaudle_daily_stats");
            stats = new Record(coll);
            stats.set("day", day);
            stats.set("variant", variant);
            stats.set("day_number", nextDayNumber(prevDayNumber));
            stats.set("players_count", 0);
            stats.set("solved_count", 0);
            stats.set("guess_distribution", JSON.stringify({}));
        }

        if (isNewGame) {
            stats.set("players_count", (stats.getInt("players_count") || 0) + 1);
        }
        if (justFinished) {
            const dist = JSON.parse(stats.getString("guess_distribution") || "{}");
            const bucketKey = feedback.solved ? String(guesses.length) : "failed";
            dist[bucketKey] = (dist[bucketKey] || 0) + 1;
            stats.set("guess_distribution", JSON.stringify(dist));
            if (feedback.solved) {
                stats.set("solved_count", (stats.getInt("solved_count") || 0) + 1);
            }
        }
        $app.save(stats);

        const status = game.getString("status");
        return e.json(200, {
            day, variant, dayNumber: stats.getInt("day_number") || null, isToday: onTime, maxGuesses: MAX_GUESSES, status, guesses,
            guessesRemaining: MAX_GUESSES - guesses.length,
            revealedPlace: status !== "in_progress" ? PLACES.find((p) => p.code === game.getString("revealed_code")) : null,
            stats: {
                day, variant,
                playersCount: stats.getInt("players_count"),
                solvedCount: stats.getInt("solved_count"),
                guessDistribution: JSON.parse(stats.getString("guess_distribution") || "{}"),
            },
            statsId: stats.id, solvedAtGuess: game.getInt("solvedAtGuess") || null,
        });
    } catch (err) {
        console.error("[beaudle.pb.js] Error en POST /api/beaudle/guess:", err);
        return e.json(400, { error: "No se pudo registrar tu intento." });
    }
}, $apis.requireAuth("users"));

// Crea la fila de beaudle_daily_stats de HOY apenas empieza el día (hora Chile), para que
// aparezca en la lista sin que nadie tenga que jugar primero — la numeración "Beaudle #N"
// se asigna igual que siempre (ver nextDayNumber en lib/beaudle.js), a partir de la
// última fila que exista. Idempotente: si ya existe (alguien ya jugó hoy antes de que
// corriera este cron, o el cron ya corrió), no hace nada. "10 4 * * *" (UTC) cae poco
// después de medianoche en Chile — mismo criterio de horario que el cron de abajo.
cronAdd("create_todays_beaudle", "10 4 * * *", () => {
    try {
        const { nextDayNumber } = require(`${__hooks}/lib/beaudle.js`);
        const variant = "classic";
        const t = new DateTime().time().in(new Timezone("America/Santiago"));
        const pad = (n) => String(n).padStart(2, "0");
        const today = `${t.year()}-${pad(Number(t.month()))}-${pad(t.day())}`;

        try {
            $app.findFirstRecordByFilter("beaudle_daily_stats", "day = {:d} && variant = {:v}", { d: today, v: variant });
            return; // ya existe
        } catch (nf) { /* no existe todavía, se crea abajo */ }

        let prevDayNumber = 0;
        const prevRows = $app.findRecordsByFilter(
            "beaudle_daily_stats", "variant = {:v}", "-day_number", 1, 0, { v: variant }
        );
        if (prevRows.length > 0) {
            prevDayNumber = prevRows[0].getInt("day_number") || 0;
        }

        const coll = $app.findCollectionByNameOrId("beaudle_daily_stats");
        const stats = new Record(coll);
        stats.set("day", today);
        stats.set("variant", variant);
        stats.set("day_number", nextDayNumber(prevDayNumber));
        stats.set("players_count", 0);
        stats.set("solved_count", 0);
        stats.set("guess_distribution", JSON.stringify({}));
        $app.save(stats);
    } catch (err) {
        console.error("[beaudle.pb.js] Error en cron create_todays_beaudle:", err);
    }
});

// Corrección de deriva liviana: recalcula beaudle_daily_stats SOLO del día de ayer (hora
// Chile) recorriendo beaudle_games de ese día. A diferencia de karma.pb.js (que
// reconstruye todos los usuarios cada noche), acá basta un solo día porque el volumen es
// bajo — el día de hoy sigue en curso y no tiene sentido "corregirlo" a mitad de partida.
// Si nadie jugó ayer, no se crea una fila vacía — un día sin ninguna partida nunca
// consume un número de "Beaudle #N".
cronAdd("recalculate_beaudle_stats_yesterday", "20 4 * * *", () => {
    try {
        const { nextDayNumber } = require(`${__hooks}/lib/beaudle.js`);
        const variant = "classic";
        const t = new DateTime().time().in(new Timezone("America/Santiago")).addDate(0, 0, -1);
        const pad = (n) => String(n).padStart(2, "0");
        const yesterday = `${t.year()}-${pad(Number(t.month()))}-${pad(t.day())}`;

        const games = $app.findRecordsByFilter(
            "beaudle_games", "day = {:d} && variant = {:v}", "", 5000, 0, { d: yesterday, v: variant }
        );
        if (games.length === 0) {
            return;
        }

        let players = 0;
        let solved = 0;
        const dist = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, failed: 0 };
        games.forEach((g) => {
            players++;
            const status = g.getString("status");
            const nGuesses = JSON.parse(g.getString("guesses") || "[]").length;
            if (status === "won") {
                solved++;
                dist[String(g.getInt("solvedAtGuess") || nGuesses)]++;
            } else if (status === "lost") {
                dist.failed++;
            }
        });

        let stats;
        try {
            stats = $app.findFirstRecordByFilter(
                "beaudle_daily_stats", "day = {:d} && variant = {:v}", { d: yesterday, v: variant }
            );
        } catch (nf) {
            let prevDayNumber = 0;
            const prevRows = $app.findRecordsByFilter(
                "beaudle_daily_stats", "variant = {:v}", "-day_number", 1, 0, { v: variant }
            );
            if (prevRows.length > 0) {
                prevDayNumber = prevRows[0].getInt("day_number") || 0;
            }
            stats = new Record($app.findCollectionByNameOrId("beaudle_daily_stats"));
            stats.set("day", yesterday);
            stats.set("variant", variant);
            stats.set("day_number", nextDayNumber(prevDayNumber));
        }
        stats.set("players_count", players);
        stats.set("solved_count", solved);
        stats.set("guess_distribution", JSON.stringify(dist));
        $app.save(stats);
    } catch (err) {
        console.error("[beaudle.pb.js] Error en cron recalculate_beaudle_stats_yesterday:", err);
    }
});
