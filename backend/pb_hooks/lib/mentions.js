// Lógica pura (sin `$app`/PocketBase) del parseo de menciones (@username) en el contenido
// de un post. Se usa tanto desde mentions.pb.js (vía require) como desde los tests en
// lib/__tests__ (vía Node directamente).

// Extrae usernames mencionados (@username, 3-20 caracteres alfanuméricos/guiones/puntos) de
// un texto. Incluye el punto porque el username de estudiantes se deriva directo del prefijo
// de su correo institucional (ver auth.pb.js) y esos correos suelen ser "nombre.apellido"
// — sin el punto en el charset, "@nombre.apellido" solo capturaba "nombre" y la mención nunca
// encontraba al usuario real, así que la notificación nunca se creaba. Solo cuenta como
// mención si está precedido por inicio de línea o espacio (evita matchear emails tipo
// user@dominio.cl). Devuelve un array de usernames únicos en minúsculas.
function parseMentions(content) {
    if (!content) return [];
    const regex = /(?:^|\s)@([a-zA-Z0-9_.-]{3,20})\b/g;
    const mentionedUsernames = new Set();
    let match;
    while ((match = regex.exec(content)) !== null) {
        mentionedUsernames.add(match[1].toLowerCase());
    }
    return Array.from(mentionedUsernames);
}

module.exports = { parseMentions };
