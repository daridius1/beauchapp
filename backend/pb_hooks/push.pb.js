/// <reference path="../pb_data/types.d.ts" />

// Web Push usa un endpoint y dos claves públicas generadas por el navegador. Nunca se
// exponen por las reglas de colección: entran y salen solo por estas rutas autenticadas.
// El dispatcher externo recibe lotes desde el cron para que la criptografía VAPID y el
// tráfico a FCM/Mozilla/APNs no compitan con la app en el Atom.

routerAdd("POST", "/api/push/subscribe", (e) => {
    // routerAdd corre en una VM aislada: esta validación debe vivir dentro del
    // callback, no como helper de módulo (ver AGENTS.md §2.1).
    const validSubscription = (endpoint, p256dh, auth) => {
        const supportedHosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
        const endpointMatch = /^https:\/\/([^\/:?#]+)(?:[\/:?#]|$)/.exec(endpoint);
        return !!endpointMatch
            && supportedHosts.includes(endpointMatch[1])
            && /^[A-Za-z0-9_-]{40,255}$/.test(p256dh)
            && /^[A-Za-z0-9_-]{16,255}$/.test(auth);
    };
    try {
        const body = e.requestInfo().body || {};
        const endpoint = String(body.endpoint || "");
        const p256dh = String(body.p256dh || "");
        const auth = String(body.auth || "");
        if (!validSubscription(endpoint, p256dh, auth)) {
            throw new BadRequestError("La suscripción del navegador no es válida.");
        }

        let subscription = null;
        try {
            subscription = $app.findFirstRecordByFilter(
                "push_subscriptions", "endpoint = {:endpoint}", { endpoint: endpoint }
            );
        } catch (err) {}

        if (!subscription) {
            subscription = new Record($app.findCollectionByNameOrId("push_subscriptions"));
        }
        subscription.set("user", e.auth.id);
        subscription.set("endpoint", endpoint);
        subscription.set("p256dh", p256dh);
        subscription.set("auth", auth);
        subscription.set("userAgent", String(e.requestInfo().headers["user-agent"] || "").slice(0, 500));
        subscription.set("disabled", false);
        $app.save(subscription);

        return e.json(200, { success: true });
    } catch (err) {
        console.error("[push.pb.js] Error guardando suscripción:", err);
        return e.json(400, { error: (err && err.message) || "No se pudo activar las notificaciones." });
    }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/push/unsubscribe", (e) => {
    try {
        const endpoint = String((e.requestInfo().body || {}).endpoint || "");
        if (!endpoint) throw new BadRequestError("Falta la suscripción a desactivar.");
        const subscription = $app.findFirstRecordByFilter(
            "push_subscriptions", "endpoint = {:endpoint} && user = {:user}", { endpoint: endpoint, user: e.auth.id }
        );
        $app.delete(subscription);
        return e.json(200, { success: true });
    } catch (err) {
        return e.json(200, { success: true }); // La baja debe ser idempotente para el navegador.
    }
}, $apis.requireAuth("users"));

// Cada notificación interna se vuelve elegible para push sin que sus productores tengan
// que conocer dispositivos, preferencias ni VAPID. Si el dispatcher aún no está
// configurado, no se acumula una cola que nadie puede entregar.
onRecordAfterCreateSuccess((e) => {
    if (!$os.getenv("PUSH_DISPATCH_URL") || !$os.getenv("PUSH_DISPATCH_TOKEN")) return;
    try {
        const outbox = new Record($app.findCollectionByNameOrId("push_outbox"));
        outbox.set("notification", e.record.id);
        outbox.set("attempts", 0);
        outbox.set("status", "pending");
        $app.save(outbox);
    } catch (err) {
        console.error("[push.pb.js] Error agregando aviso a la cola:", err.message || err);
    }
}, "notifications");

cronAdd("dispatch_web_push", "* * * * *", () => {
    const notificationUrl = (type, relatedId) => {
        if (!relatedId) return "/notifications";
        if (type === "mention" || type === "reply") return "/posts/" + relatedId;
        if (type === "ladder_match" || type === "ladder_confirmation") return "/ladders/matches/" + relatedId;
        if (type === "activity" || type === "new_activity") return "/activities/" + relatedId;
        if (type === "org_invite") return "/users/" + relatedId;
        if (type === "trade_proposed" || type === "trade_countered" || type === "trade_accepted") return "/album/" + relatedId;
        if (type === "match") return "/tinder?initialTab=matches";
        if (type === "league_referee_result" || type === "league_referee_assignment") return "/partidos/" + relatedId;
        return "/notifications";
    };
    const dispatcherUrl = $os.getenv("PUSH_DISPATCH_URL");
    const dispatcherToken = $os.getenv("PUSH_DISPATCH_TOKEN");
    if (!dispatcherUrl || !dispatcherToken) return;

    try {
        const jobs = $app.findRecordsByFilter(
            "push_outbox", "status = 'pending' && attempts < 5", "created", 25, 0
        );
        if (!jobs.length) return;

        const entries = [];
        const jobsWithoutDevices = [];
        jobs.forEach((job) => {
            try {
                const notification = $app.findRecordById("notifications", job.getString("notification"));
                const devices = $app.findRecordsByFilter(
                    "push_subscriptions", "user = {:user} && disabled = false", "", 10, 0,
                    { user: notification.getString("user") }
                );
                if (!devices.length) {
                    jobsWithoutDevices.push(job);
                    return;
                }
                devices.forEach((device) => entries.push({
                    outboxId: job.id,
                    subscriptionId: device.id,
                    endpoint: device.getString("endpoint"),
                    p256dh: device.getString("p256dh"),
                    auth: device.getString("auth"),
                    notification: {
                        id: notification.id,
                        title: notification.getString("title"),
                        body: notification.getString("body"),
                        url: notificationUrl(notification.getString("type"), notification.getString("relatedId")),
                    },
                }));
            } catch (err) {
                job.set("status", "discarded");
                $app.save(job);
            }
        });

        jobsWithoutDevices.forEach((job) => {
            job.set("status", "discarded");
            $app.save(job);
        });
        if (!entries.length) return;

        const response = $http.send({
            url: dispatcherUrl,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + dispatcherToken,
            },
            body: JSON.stringify({ entries: entries }),
            timeout: 20,
        });
        if (response.statusCode < 200 || response.statusCode >= 300) throw new Error("Dispatcher respondió " + response.statusCode);

        const data = response.json || JSON.parse(response.raw || "{}");
        const delivered = new Set((data.deliveredOutboxIds || []).map(String));
        const invalidSubscriptions = new Set((data.invalidSubscriptionIds || []).map(String));
        entries.forEach((entry) => {
            if (invalidSubscriptions.has(entry.subscriptionId)) {
                try {
                    const subscription = $app.findRecordById("push_subscriptions", entry.subscriptionId);
                    subscription.set("disabled", true);
                    $app.save(subscription);
                } catch (err) {}
            }
        });
        jobs.forEach((job) => {
            if (delivered.has(job.id)) {
                job.set("status", "sent");
            } else if (job.getString("status") === "pending") {
                const attempts = job.getInt("attempts") + 1;
                job.set("attempts", attempts);
                if (attempts >= 5) job.set("status", "failed");
            }
            $app.save(job);
        });
    } catch (err) {
        console.error("[push.pb.js] Error despachando cola:", err.message || err);
    }
});
