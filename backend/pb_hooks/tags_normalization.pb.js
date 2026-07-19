// Hook para normalizar y limpiar etiquetas (tags) a minúsculas, sin acentos ni especiales (solo a-z0-9)
function cleanTagBackend(t) {
    let s = typeof t === 'string' ? t : String(t);
    return s.toLowerCase()
            .replace(/[áäâà]/g, "a")
            .replace(/[éëêè]/g, "e")
            .replace(/[íïîì]/g, "i")
            .replace(/[óöôò]/g, "o")
            .replace(/[úüûù]/g, "u")
            .replace(/[ñ]/g, "n")
            .replace(/[^a-z0-9]/g, "")
            .trim();
}

onRecordCreate((e) => {
    const rawStr = e.record.getString("tags");
    if (rawStr && rawStr !== "null" && rawStr !== "") {
        try {
            const tags = JSON.parse(rawStr);
            if (Array.isArray(tags)) {
                const cleaned = tags.map(cleanTagBackend).filter(Boolean);
                const uniqueTags = Array.from(new Set(cleaned));
                e.record.set("tags", uniqueTags);
            }
        } catch (err) {
            console.log("[ERROR Normalizing Tags Create]", err);
        }
    }
    return e.next();
}, "posts", "problems");

onRecordUpdate((e) => {
    const rawStr = e.record.getString("tags");
    if (rawStr && rawStr !== "null" && rawStr !== "") {
        try {
            const tags = JSON.parse(rawStr);
            if (Array.isArray(tags)) {
                const cleaned = tags.map(cleanTagBackend).filter(Boolean);
                const uniqueTags = Array.from(new Set(cleaned));
                e.record.set("tags", uniqueTags);
            }
        } catch (err) {
            console.log("[ERROR Normalizing Tags Update]", err);
        }
    }
    return e.next();
}, "posts", "problems");
