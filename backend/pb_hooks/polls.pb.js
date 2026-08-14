/// <reference path="../pb_data/types.d.ts" />

// Valida que optionIndex esté dentro del rango de pollOptions del post al votar o
// cambiar el voto (único chequeo que las reglas declarativas de PocketBase no pueden
// expresar, no hay operador de largo de array — todo lo demás, un voto por usuario,
// permiso para cambiar el voto, ya lo garantiza el índice único + las reglas de la
// colección poll_votes) y que quien vota no sea una cuenta de organización (respaldo
// server-side del mismo bloqueo que ya hace el frontend en PollView).
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

    try {
        const voter = $app.findRecordById("users", e.auth.id);
        if (voter.getString("type") === "organization") {
            throw new BadRequestError("Las cuentas de organización no pueden votar en encuestas.");
        }
    } catch (err) {
        if (err instanceof BadRequestError) throw err;
        throw new BadRequestError("No se pudo validar el voto.");
    }

    return e.next();
};

onRecordCreateRequest(validatePollVote, "poll_votes");
onRecordUpdateRequest(validatePollVote, "poll_votes");
