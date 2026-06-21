// Beauchapp PocketBase Hooks
// Lógica de negocio del lado del servidor

// 1. Filtro de exclusividad universitaria
// Interceptar el registro de usuarios para validar el correo institucional @ug.uchile.cl
onRecordBeforeCreateRequest((e) => {
    const email = e.record.getString("email");
    
    if (!email) {
        throw new BadRequestError("El correo electrónico es requerido.");
    }
    
    if (!email.endsWith("@ug.uchile.cl")) {
        throw new BadRequestError("Acceso denegado. Solo se permiten correos con el dominio @ug.uchile.cl");
    }
}, "users");

// 2. Cálculo automatizado del algoritmo ELO
// Interceptar la creación de un nuevo partido para actualizar el ELO de ambos jugadores.
// (Esto se activará cuando la colección 'partidas' o 'matches' sea configurada).
onRecordAfterCreateRequest((e) => {
    // Lógica para actualizar el ELO:
    // 1. Obtener ID de jugador 1 y jugador 2, y el resultado.
    // 2. Obtener ELOs actuales de la tabla 'perfiles' o 'users'.
    // 3. Calcular la probabilidad y el nuevo ELO (Puntaje base: 1200; K = 32).
    // 4. Actualizar el ELO en la base de datos dentro de una transacción.
}, "matches");
