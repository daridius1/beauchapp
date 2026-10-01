function isGiphyMediaUrl(value) {
    return typeof value === "string" && /^https:\/\/media(?:[0-9]+)?\.giphy\.com\//.test(value);
}

function sanitizeGiphyPayload(value) {
    // PocketBase puede entregar un campo JSON como objeto Go expuesto a Goja o como
    // texto JSON, según si la petición llegó como JSON puro o multipart/form-data.
    // Normalizarlo evita que una selección válida falle solo por llevar otro adjunto.
    try {
        if (Array.isArray(value)) {
            const encoded = typeof value.string === "function"
                ? value.string()
                : String.fromCharCode.apply(null, value);
            value = JSON.parse(encoded);
        } else if (typeof value === "string") {
            value = JSON.parse(value);
        } else if (value && typeof value === "object") {
            value = JSON.parse(JSON.stringify(value));
        }
    } catch (_) {
        return null;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const id = String(value.id || "").trim();
    const mp4Url = String(value.mp4Url || "").trim();
    const webpUrl = String(value.webpUrl || "").trim();
    const stillUrl = String(value.stillUrl || "").trim();
    const sourceUrl = String(value.sourceUrl || "").trim();
    if (!/^[a-zA-Z0-9]+$/.test(id)) return null;
    if (!isGiphyMediaUrl(mp4Url) && !isGiphyMediaUrl(webpUrl)) return null;
    if (mp4Url && !isGiphyMediaUrl(mp4Url)) return null;
    if (webpUrl && !isGiphyMediaUrl(webpUrl)) return null;
    if (stillUrl && !isGiphyMediaUrl(stillUrl)) return null;
    if (sourceUrl && !/^https:\/\/(?:www\.)?giphy\.com\//.test(sourceUrl)) return null;

    return {
        id,
        title: String(value.title || "GIF de GIPHY").slice(0, 160),
        mp4Url,
        webpUrl,
        stillUrl,
        username: String(value.username || "").slice(0, 100),
        sourceUrl,
    };
}

module.exports = { isGiphyMediaUrl, sanitizeGiphyPayload };
