/// <reference path="../pb_data/types.d.ts" />

// 15. Seguridad: Redactar información de autoría en problemas eliminados para que no viaje al cliente
onRecordEnrich((e) => {
    try {
        if (e.record.getBool("deleted")) {
            e.record.set("author", "");
            const expand = e.record.expand();
            if (expand && expand["author"]) {
                delete expand["author"];
            }
        }
    } catch (err) {
        console.log("[Security Link] Error onRecordEnrich problems:", err.message || err);
    }
    return e.next();
}, "problems");
