/**
 * Ejecuta una función asíncrona y garantiza que la promesa resuelva en al menos
 * el tiempo mínimo especificado (en milisegundos), para evitar el parpadeo
 * rápido de indicadores de carga (loader flickering) sin retrasar la respuesta
 * si la red de producción ya es lenta.
 *
 * @param asyncFn La función asíncrona a ejecutar.
 * @param minDurationMs Duración mínima que debe durar la promesa (por defecto 400ms).
 */
export async function withMinimumDelay<T>(
  asyncFn: () => Promise<T>,
  minDurationMs = 400
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await asyncFn();
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime < minDurationMs) {
      await new Promise(resolve => setTimeout(resolve, minDurationMs - elapsedTime));
    }
    return result;
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime < minDurationMs) {
      await new Promise(resolve => setTimeout(resolve, minDurationMs - elapsedTime));
    }
    throw error;
  }
}
