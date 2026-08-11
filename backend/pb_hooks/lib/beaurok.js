// Lógica pura (sin `$app`) de BeauRok: el bot que responde cuando lo etiquetan
// (@beaurok) en un comentario/post. Se usa desde mentions.pb.js (vía require) y desde
// los tests en lib/__tests__/beaurok.test.js. La orquestación con $app (buscar al bot,
// llamar a la API de DeepSeek vía $http.send, crear el post de respuesta) vive en
// mentions.pb.js — no acá, ni en un hook nuevo (ver comentario en mentions.pb.js sobre
// por qué solo puede haber UN onRecordAfterCreateSuccess("posts") efectivo).

const BEAUROK_USERNAME = "beaurok";

// Máximo real del campo "content" de la colección posts — cualquier respuesta que se le
// vaya a guardar tiene que respetar esto, aunque el prompt ya le pida ser breve.
const POST_CONTENT_MAX = 280;

// Saca el "@beaurok" del texto antes de mandarlo al modelo — mismo charset de username
// que lib/mentions.js#parseMentions, sin capturar el resto de menciones (a otras
// personas les puede seguir hablando el post, eso no es asunto del bot).
function stripMention(content) {
    if (!content) return "";
    const regex = new RegExp(`(?:^|\\s)@${BEAUROK_USERNAME}\\b`, "gi");
    return content.replace(regex, " ").replace(/ {2,}/g, " ").trim();
}

// Prompt corto a propósito: pocas instrucciones, respuesta breve. system fija el
// personaje y el límite de largo; user es el texto ya limpio que lo mencionó.
function buildBeaurokPrompt(strippedContent) {
    const system = "Eres BeauRok, un bot con humor seco que comenta publicaciones de " +
        "estudiantes de Beauchef (FCFM, Universidad de Chile). Respondes en español de " +
        "Chile, informal, en una sola frase corta (máximo 200 caracteres). No inventas " +
        "datos que no estén en el texto.";
    const user = strippedContent || "(sin texto, solo me etiquetaron)";
    return { system, user };
}

// Recorte duro por si el modelo se pasa de largo — protege el máximo real del campo.
function truncateReply(text, maxLen = POST_CONTENT_MAX) {
    const trimmed = (text || "").trim();
    if (trimmed.length <= maxLen) return trimmed;
    return trimmed.slice(0, maxLen - 1).trim() + "…";
}

module.exports = { BEAUROK_USERNAME, POST_CONTENT_MAX, stripMention, buildBeaurokPrompt, truncateReply };
