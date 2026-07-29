/// <reference path="../pb_data/types.d.ts" />

// Hook de seguridad de almacenamiento:
// Garantiza que NUNCA se guarden imágenes en el disco local del servidor.
// Si Cloudflare R2 (S3) no está activo, se rechaza la subida con un error explícito.

onRecordCreateRequest((e) => {
    const settings = e.app.settings();
    if (!settings.s3 || !settings.s3.enabled) {
        const uploadedFiles = e.uploadedFiles();
        if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
            throw new BadRequestError("Error: El servicio de almacenamiento en la nube de Cloudflare no está disponible en este momento. Por favor inténtalo más tarde.");
        }
    }
    e.next();
});

onRecordUpdateRequest((e) => {
    const settings = e.app.settings();
    if (!settings.s3 || !settings.s3.enabled) {
        const uploadedFiles = e.uploadedFiles();
        if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
            throw new BadRequestError("Error: El servicio de almacenamiento en la nube de Cloudflare no está disponible en este momento. Por favor inténtalo más tarde.");
        }
    }
    e.next();
});
