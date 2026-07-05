export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Calculate new dimensions (max 1200px)
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 1200;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas ctx null'));
        ctx.drawImage(img, 0, 0, width, height);

        // Iterative compression to hit < 250KB
        let quality = 0.85;
        const targetSize = 250 * 1024;

        const attemptCompression = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Compression failed'));
              if (blob.size <= targetSize || quality <= 0.1) {
                if (blob.size > targetSize) {
                  reject(new Error('La imagen es muy compleja y no pudo ser reducida a menos de 250KB. Elige otra.'));
                } else {
                  resolve(blob);
                }
              } else {
                quality -= 0.15;
                attemptCompression();
              }
            },
            'image/webp',
            quality
          );
        };

        attemptCompression();
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
