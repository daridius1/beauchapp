/// <reference path="../pb_data/types.d.ts" />

// Corrección puntual: las primeras respuestas de BeauRok (antes de que mentions.pb.js
// empezara a replicar la lógica de commentCount/root de forum.pb.js) se crearon con
// $app.save() directo, así que nunca incrementaron el commentCount de lo que
// respondieron ni les quedó "root" seteado. Cualquier reply de BeauRok con root vacío es,
// por construcción, una de esas — el fix de mentions.pb.js siempre setea root desde ese
// momento en adelante, así que este filtro es preciso y esta migración es idempotente
// (si se vuelve a correr, no encuentra nada que corregir).
migrate((app) => {
    let beaurok;
    try {
        beaurok = app.findFirstRecordByFilter("users", "username = {:u}", { u: "beaurok" });
    } catch (nf) {
        return; // no existe (ej. ambiente sin la migración del bot todavía) — nada que hacer
    }

    const brokenReplies = app.findRecordsByFilter(
        "posts", "author = {:a} && actionType = 'reply' && root = ''", "", 0, 0, { a: beaurok.id }
    );

    brokenReplies.forEach((reply) => {
        try {
            const targetId = reply.getString("targetId") || reply.getString("replyTo");
            if (!targetId) return;

            const target = app.findRecordById("posts", targetId);
            reply.set("root", target.getString("root") || target.id);
            app.save(reply);

            // Mismo walk-up-chain que mentions.pb.js — empieza en el post respondido, no
            // en la respuesta misma.
            let ancestorId = targetId;
            let depth = 0;
            const visited = new Set();
            while (ancestorId && depth < 20 && !visited.has(ancestorId)) {
                visited.add(ancestorId);
                const ancestor = app.findRecordById("posts", ancestorId);
                ancestor.set("commentCount", (ancestor.getInt("commentCount") || 0) + 1);
                app.save(ancestor);
                ancestorId = ancestor.getString("replyTo") || (ancestor.getString("actionType") === "reply" ? ancestor.getString("targetId") : "");
                depth++;
            }
        } catch (err) {
            console.error("[fix_beaurok_early_reply_counts] Error corrigiendo reply " + reply.id + ":", err.message || err);
        }
    });
}, (app) => {
    // No hay revert razonable para una corrección de conteos — dejar como no-op.
});
