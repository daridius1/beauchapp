/// <reference path="../pb_data/types.d.ts" />

// Contacto centralizado de "Conoce Beauchef": un solo registro de contacto por usuario,
// compartido por Tinder, Mascotas, Música, Películas, Videojuegos y Libros. Antes cada
// categoría iba a tener sus propios campos (como tinder_profiles); se decidió centralizarlo
// para no pedirle a la gente que llene el mismo Instagram/WhatsApp seis veces.
const CONOCE_MATCH_COLLECTIONS = [
    "tinder_matches",
    "pet_matches",
    "song_matches",
    "movie_matches",
    "game_matches",
    "book_matches",
];

onRecordEnrich((e) => {
    try {
        const authUser = e.requestInfo && e.requestInfo.auth;
        const isAdmin = e.requestInfo && e.requestInfo.admin;
        if (isAdmin) {
            return e.next();
        }

        const contactUserId = e.record.getString("user");
        if (authUser && contactUserId === authUser.id) {
            // El propietario ve sus propios datos
            return e.next();
        }

        let hasMatch = false;
        if (authUser) {
            const idA = authUser.id < contactUserId ? authUser.id : contactUserId;
            const idB = authUser.id > contactUserId ? authUser.id : contactUserId;
            for (const collectionName of CONOCE_MATCH_COLLECTIONS) {
                try {
                    const match = $app.findFirstRecordByFilter(
                        collectionName,
                        "userA = {:idA} && userB = {:idB} && (status != 'unmatched' || status = '')",
                        { idA: idA, idB: idB }
                    );
                    if (match) {
                        hasMatch = true;
                        break;
                    }
                } catch (err) {
                    // Sin match en esta categoría, se sigue probando con las demás
                }
            }
        }

        if (!hasMatch) {
            // Blanquear datos de contacto para proteger privacidad
            e.record.set("instagram", "");
            e.record.set("whatsapp", "");
            e.record.set("telegram", "");
        }
    } catch (err) {
        console.error("[Conoce Contacts] Error enriching record:", err);
    }
    return e.next();
}, "conoce_contacts");
