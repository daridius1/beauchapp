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


