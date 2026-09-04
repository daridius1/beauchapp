// Lógica pura (sin `$app`) compartida por los hooks de posts/comentarios polimórficos
// de forum.pb.js. Se usa con require() DENTRO de cada handler — igual que el resto de
// pb_hooks/lib/*.js, porque cada onRecordCreateRequest/onRecordDeleteRequest corre en
// su propia VM aislada y no ve nada declarado a nivel de módulo del archivo que los
// registra (mismo motivo documentado en mentions.pb.js).

// Distingue "el objetivo ya no existe" (se citó/comentó algo que después se borró) de un
// error real: lo primero es esperable y no debe llenar el log de ruido en cada ocurrencia.
function esTargetInexistente(err) {
    return String(err).includes("no rows in result set");
}

// Colección real detrás de cada targetType polimórfico. Cualquier targetType no listado
// cae al fallback "posts" — que es lo correcto para citas/comentarios sobre otro post,
// pero un targetType nuevo que en verdad apunta a otra colección hay que sumarlo acá,
// o toda cita/comentario sobre ese tipo de objetivo termina buscando su id en "posts",
// nunca lo encuentra, y activa la rama de "target inexistente" siempre.
function targetCollectionOf(targetType) {
    switch (targetType) {
        case "problem": return "problems";
        case "match": return "ladder_matches";
        case "league_match": return "league_matches";
        case "activity": return "activities";
        case "course": return "courses";
        case "beaumarket": return "beaumarkets";
        case "beaudle": return "beaudle_daily_stats";
        case "pet": return "pets";
        case "song": return "songs";
        default: return "posts";
    }
}

module.exports = { esTargetInexistente, targetCollectionOf };
