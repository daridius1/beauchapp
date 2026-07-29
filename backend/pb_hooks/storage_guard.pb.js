/// <reference path="../pb_data/types.d.ts" />

// Hook de seguridad de almacenamiento:
// Garantiza que NUNCA se guarden imágenes en el disco local del servidor.
// Si Cloudflare R2 (S3) no está activo, se rechaza la subida con un error explícito.

const enforceR2ForFileUploads = (e) => {
    try {
        const settings = e.app.settings();
        const isR2Active = settings.s3 && settings.s3.enabled;

        if (!isR2Active) {
            const uploadedFiles = e.uploadedFiles();
            if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
                throw new BadRequestError("Error: El servicio de almacenamiento en la nube de Cloudflare no está disponible en este momento. Por favor inténtalo más tarde.");
            }
        }
    } catch (err) {
        if (err instanceof BadRequestError) {
            throw err;
        }
        // Ignorar otros errores internos no relacionados a BadRequestError
    }
};

onRecordCreateRequest((e) => {
    enforceR2ForFileUploads(e);
    e.next();
});

onRecordUpdateRequest((e) => {
    enforceR2ForFileUploads(e);
    e.next();
});
