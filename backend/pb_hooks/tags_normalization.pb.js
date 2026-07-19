// Hook para normalizar etiquetas (tags) a minúsculas en posts y problems
onRecordCreate((e) => {
    const rawTags = e.record.get("tags");
    if (rawTags) {
        try {
            if (rawTags && typeof rawTags.map === 'function') {
                const lowerTags = rawTags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
                e.record.set("tags", lowerTags);
            }
        } catch (err) {
            console.log("[ERROR Normalizing Tags Create]", err);
        }
    }
    return e.next();
}, "posts", "problems");

onRecordUpdate((e) => {
    const rawTags = e.record.get("tags");
    if (rawTags) {
        try {
            if (rawTags && typeof rawTags.map === 'function') {
                const lowerTags = rawTags.map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
                e.record.set("tags", lowerTags);
            }
        } catch (err) {
            console.log("[ERROR Normalizing Tags Update]", err);
        }
    }
    return e.next();
}, "posts", "problems");
