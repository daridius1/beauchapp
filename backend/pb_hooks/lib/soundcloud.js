function normalizeSoundCloudUrl(value) {
    const raw = String(value || "").trim();
    if (!raw || raw.length > 500 || /[\s\\]/.test(raw)) return null;

    const match = raw.match(/^https:\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(?:#.*)?$/i);
    if (!match) return null;
    const host = match[1].toLowerCase();
    const allowed = ["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"];
    if (allowed.indexOf(host) === -1 || !match[2] || match[2] === "/") return null;

    return `https://${host}${match[2]}${match[3] || ""}`.slice(0, 500);
}

module.exports = { normalizeSoundCloudUrl };
