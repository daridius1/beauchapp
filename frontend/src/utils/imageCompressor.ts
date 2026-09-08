import { manipulateAsync, SaveFormat, Action } from 'expo-image-manipulator';

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
  format: 'image/webp' | 'image/jpeg' | 'image/png' = 'image/webp'
): Promise<Blob> {
  // If the caller asked for WebP but the browser can't export it, fall back to JPEG
  // (PNG no tiene este problema de soporte — todo navegador con <canvas> lo exporta).
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

        const drawAt = (width: number, height: number): HTMLCanvasElement => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas ctx null');
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
          return canvas;
        };

        const toBlob = (canvas: HTMLCanvasElement, quality?: number) =>
          new Promise<Blob | null>((res) => canvas.toBlob(res, effectiveFormat, quality));

        const dimsAtMax = (maxDim: number) => {
          let width = sWidth;
          let height = sHeight;
          if (width > height) {
            if (width > maxDim) { height *= maxDim / width; width = maxDim; }
          } else {
            if (height > maxDim) { width *= maxDim / height; height = maxDim; }
          }
          return { width: Math.round(width), height: Math.round(height) };
        };

        if (effectiveFormat === 'image/png') {
          // El parámetro "quality" de canvas.toBlob no existe para PNG (sin pérdida,
          // el navegador lo ignora): bajarlo no cambia un solo byte. El único lever
          // real es el tamaño en píxeles, así que se reescala de forma adaptativa —
          // en vez de probar pasos fijos (1200/900/600) que podían quedar todos por
          // encima del target en una foto/escudo con transparencia detallada — usando
          // la relación de tamaños (el peso de un PNG es aprox. proporcional al área)
          // para saltar directo cerca del tamaño que hace falta.
          const MIN_DIM = 200;
          let { width, height } = dimsAtMax(1200);

          const attempt = async (): Promise<void> => {
            let blob: Blob | null;
            try {
              blob = await toBlob(drawAt(width, height));
            } catch (err) {
              return reject(err);
            }
            if (!blob) return reject(new Error('Compression failed'));

            const atFloor = width <= MIN_DIM || height <= MIN_DIM;
            if (blob.size <= targetSize || atFloor) {
              // Best effort: si tocó el piso y sigue pesado, se sube igual — no hay
              // más margen sin perder nitidez a un punto inútil para una cara/escudo.
              return resolve(blob);
            }

            const factor = Math.sqrt(targetSize / blob.size) * 0.92; // margen de seguridad
            width = Math.max(MIN_DIM, Math.round(width * factor));
            height = Math.max(MIN_DIM, Math.round(height * factor));
            attempt();
          };

          attempt();
          return;
        }

        // JPEG/WebP: sí soportan un knob real de calidad con pérdida.
        const dimensionSteps = [1200, 900, 600];

        const tryWithMaxDim = (stepIndex: number) => {
          const { width, height } = dimsAtMax(dimensionSteps[stepIndex]);
          let canvas: HTMLCanvasElement;
          try {
            canvas = drawAt(width, height);
          } catch (err) {
            return reject(err);
          }

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

// Equivalente nativo de compressImage (Canvas/DOM no existen en iOS/Android).
// A diferencia de la versión web, no reintenta con calidad/dimensión menor
// comparando el tamaño resultante en bytes — usa un límite de dimensión y una
// calidad fijos en una sola pasada, suficiente para acotar el peso del archivo.
export async function compressImageNative(
  uri: string,
  originalWidth: number,
  originalHeight: number,
  cropToSquare: boolean = false,
  format: 'image/jpeg' | 'image/webp' = 'image/jpeg'
): Promise<{ uri: string; width: number; height: number }> {
  const actions: Action[] = [];
  let width = originalWidth;
  let height = originalHeight;

  if (cropToSquare && width !== height) {
    const minDim = Math.min(width, height);
    actions.push({
      crop: {
        originX: (width - minDim) / 2,
        originY: (height - minDim) / 2,
        width: minDim,
        height: minDim,
      },
    });
    width = minDim;
    height = minDim;
  }

  const MAX_DIM = 1200;
  if (width > MAX_DIM || height > MAX_DIM) {
    actions.push(width >= height ? { resize: { width: MAX_DIM } } : { resize: { height: MAX_DIM } });
  }

  return manipulateAsync(uri, actions, {
    compress: 0.7,
    format: format === 'image/webp' ? SaveFormat.WEBP : SaveFormat.JPEG,
  });
}
