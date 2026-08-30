/// <reference path="../pb_data/types.d.ts" />

// Hook para el autoconteo de Likes en la colección "songs". Mismo patrón que pets.pb.js /
// activities.pb.js: síncrono (antes de que la respuesta HTTP salga) para que un GET
// inmediato del cliente no lea el contador desactualizado.

onRecordCreateRequest((e) => {
    try {
        const songId = e.record.getString("song");
        if (!songId) return e.next();

        try {
            const songRec = $app.findRecordById("songs", songId);
            const currentLikes = songRec.getInt("like_count") || 0;
            songRec.set("like_count", currentLikes + 1);
            $app.save(songRec);
        } catch (err) {
            console.error(`[songs.pb.js] Error incrementando like_count para canción ${songId}:`, err);
        }
    } catch (outerErr) {
        console.error("[songs.pb.js] Outer error in song_likes create:", outerErr);
    }
    return e.next();
}, "song_likes");

onRecordDeleteRequest((e) => {
    try {
        const songId = e.record.getString("song");
        if (!songId) return e.next();

        try {
            const songRec = $app.findRecordById("songs", songId);
            const currentLikes = songRec.getInt("like_count") || 0;
            songRec.set("like_count", Math.max(0, currentLikes - 1));
            $app.save(songRec);
        } catch (err) {
            console.error(`[songs.pb.js] Error decrementando like_count para canción ${songId}:`, err);
        }
    } catch (outerErr) {
        console.error("[songs.pb.js] Outer error in song_likes delete:", outerErr);
    }
    return e.next();
}, "song_likes");
