/// <reference path="../pb_data/types.d.ts" />

// Valida que optionIndex esté dentro del rango de pollOptions del post al votar o
// cambiar el voto. Único chequeo que las reglas declarativas de PocketBase no pueden
// expresar (no hay operador de largo de array) — todo lo demás (un voto por usuario,
// permiso para cambiar el voto) ya lo garantiza el índice único + las reglas de la
// colección poll_votes.
const validatePollVote = (e) => {
    const postId = e.record.getString("post");
    const optionIndex = e.record.getInt("optionIndex");

    let options = [];
    try {
        const post = $app.findRecordById("posts", postId);
        options = post.get("pollOptions") || [];
    } catch (err) {
        throw new BadRequestError("La publicación de esta encuesta no existe.");
    }

    if (!Array.isArray(options) || options.length < 2) {
        throw new BadRequestError("Esta publicación no tiene una encuesta activa.");
    }
    if (optionIndex < 0 || optionIndex >= options.length) {
        throw new BadRequestError("Opción de encuesta inválida.");
    }

    return e.next();
};

onRecordCreateRequest(validatePollVote, "poll_votes");
onRecordUpdateRequest(validatePollVote, "poll_votes");
