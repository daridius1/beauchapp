// Detect WebP canvas export support (cached once)
let _webpSupported: boolean | null = null;
function supportsWebpExport(): boolean {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    _webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    _webpSupported = false;
  }
  return _webpSupported;
}

export async function compressImage(
  file: File,
  cropToSquare: boolean = false,
  format: 'image/webp' | 'image/jpeg' = 'image/webp'
): Promise<Blob> {
  // If the caller asked for WebP but the browser can't export it, fall back to JPEG
  const effectiveFormat = (format === 'image/webp' && !supportsWebpExport())
    ? 'image/jpeg'
    : format;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

        if (cropToSquare) {
          const minDim = Math.min(img.width, img.height);
          sx = (img.width - minDim) / 2;
          sy = (img.height - minDim) / 2;
          sWidth = minDim;
          sHeight = minDim;
        }

        const targetSize = 250 * 1024;
        // Progressive max dimensions: try larger first, shrink if needed
        const dimensionSteps = [1200, 900, 600];

        const tryWithMaxDim = (stepIndex: number) => {
          const MAX_DIM = dimensionSteps[stepIndex];

          // Calculate new dimensions
          let width = sWidth;
          let height = sHeight;
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
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);

          // Iterative quality reduction
          let quality = 0.85;
          const attemptCompression = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) return reject(new Error('Compression failed'));

                if (blob.size <= targetSize) {
                  // Success
                  resolve(blob);
                } else if (quality > 0.1) {
                  // Reduce quality and retry
                  quality -= 0.15;
                  attemptCompression();
                } else if (stepIndex < dimensionSteps.length - 1) {
                  // Quality bottomed out — try smaller dimensions
                  tryWithMaxDim(stepIndex + 1);
                } else {
                  // All attempts exhausted (should be virtually impossible at 600px + q0.1)
                  resolve(blob);
                }
              },
              effectiveFormat,
              quality
            );
          };

          attemptCompression();
        };

        tryWithMaxDim(0);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
