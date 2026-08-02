/// <reference path="../pb_data/types.d.ts" />

// Hook para gestionar autoconteos de Likes y Asistencias en la colección "activities"
console.log("[LOAD] activities.pb.js hook loaded!");

// 1. Al dar Like a una actividad
onRecordAfterCreateSuccess((e) => {
    try {
        const activityId = e.record.getString("activity");
        if (!activityId) return e.next();

        try {
            const actRec = $app.findRecordById("activities", activityId);
            const currentLikes = actRec.getInt("like_count") || 0;
            actRec.set("like_count", currentLikes + 1);
            $app.save(actRec);
            console.log(`[activities.pb.js] Incrementado like_count para actividad ${activityId}: ${currentLikes} -> ${currentLikes + 1}`);
        } catch (err) {
            console.log(`[activities.pb.js] Error incrementando like_count para actividad ${activityId}:`, err);
        }
    } catch (outerErr) {
        console.log("[activities.pb.js] Outer error in activity_likes create:", outerErr);
    }
    return e.next();
}, "activity_likes");

// 2. Al quitar Like a una actividad
onRecordAfterDeleteSuccess((e) => {
    try {
        const activityId = e.record.getString("activity");
        if (!activityId) return e.next();

        try {
            const actRec = $app.findRecordById("activities", activityId);
            const currentLikes = actRec.getInt("like_count") || 0;
            const newLikes = Math.max(0, currentLikes - 1);
            actRec.set("like_count", newLikes);
            $app.save(actRec);
            console.log(`[activities.pb.js] Decrementado like_count para actividad ${activityId}: ${currentLikes} -> ${newLikes}`);
        } catch (err) {
            console.log(`[activities.pb.js] Error decrementando like_count para actividad ${activityId}:`, err);
        }
    } catch (outerErr) {
        console.log("[activities.pb.js] Outer error in activity_likes delete:", outerErr);
    }
    return e.next();
}, "activity_likes");

// 3. Al marcar "Asistiré" en una actividad
onRecordAfterCreateSuccess((e) => {
    try {
        const activityId = e.record.getString("activity");
        if (!activityId) return e.next();

        try {
            const actRec = $app.findRecordById("activities", activityId);
            const currentAttendees = actRec.getInt("attendee_count") || 0;
            actRec.set("attendee_count", currentAttendees + 1);
            $app.save(actRec);
            console.log(`[activities.pb.js] Incrementado attendee_count para actividad ${activityId}: ${currentAttendees} -> ${currentAttendees + 1}`);
        } catch (err) {
            console.log(`[activities.pb.js] Error incrementando attendee_count para actividad ${activityId}:`, err);
        }
    } catch (outerErr) {
        console.log("[activities.pb.js] Outer error in activity_attendees create:", outerErr);
    }
    return e.next();
}, "activity_attendees");

// 4. Al desmarcar "Asistiré" en una actividad
onRecordAfterDeleteSuccess((e) => {
    try {
        const activityId = e.record.getString("activity");
        if (!activityId) return e.next();

        try {
            const actRec = $app.findRecordById("activities", activityId);
            const currentAttendees = actRec.getInt("attendee_count") || 0;
            const newAttendees = Math.max(0, currentAttendees - 1);
            actRec.set("attendee_count", newAttendees);
            $app.save(actRec);
            console.log(`[activities.pb.js] Decrementado attendee_count para actividad ${activityId}: ${currentAttendees} -> ${newAttendees}`);
        } catch (err) {
            console.log(`[activities.pb.js] Error decrementando attendee_count para actividad ${activityId}:`, err);
        }
    } catch (outerErr) {
        console.log("[activities.pb.js] Outer error in activity_attendees delete:", outerErr);
    }
    return e.next();
}, "activity_attendees");
