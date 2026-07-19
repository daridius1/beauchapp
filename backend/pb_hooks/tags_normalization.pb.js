// Hook para normalizar etiquetas (tags) a minúsculas en posts y problems de forma segura
onRecordCreate((e) => {
    const rawStr = e.record.getString("tags");
    if (rawStr && rawStr !== "null" && rawStr !== "") {
        try {
            const tags = JSON.parse(rawStr);
            if (Array.isArray(tags)) {
                const lowerTags = tags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
                e.record.set("tags", lowerTags);
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
                const lowerTags = tags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
                e.record.set("tags", lowerTags);
            }
        } catch (err) {
            console.log("[ERROR Normalizing Tags Update]", err);
        }
    }
    return e.next();
}, "posts", "problems");
