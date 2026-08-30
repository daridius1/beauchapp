import * as lame from '@breezystack/lamejs';

// Compresión de audio en el navegador: siempre a mono, a un bitrate fijo bajo, y recortada
// a SONG_CLIP_SECONDS — para que "una canción por perfil" no dispare el consumo de disco/
// subida del servidor (mismo espíritu que compressImage con las fotos, en
// frontend/src/utils/imageCompressor.ts).
//
// Solo funciona en web: decodificar un archivo de audio arbitrario a PCM requiere Web
// Audio API, que no existe en el runtime nativo de React Native sin un módulo nativo
// adicional. En native, la subida de canción se deja sin implementar por ahora.

export const SONG_TARGET_KBPS = 96;
export const SONG_CLIP_SECONDS = 30;

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

// Recorta [startSample, startSample+sliceLength) y hace downmix a mono en el mismo paso,
// en vez de mezclar el buffer completo y recortar después — evita mantener en memoria un
// Float32Array del largo de la canción entera cuando solo se necesitan 30 segundos.
function sliceAndDownmixToMono(buffer: AudioBuffer, startSample: number, sliceLength: number): Float32Array {
  const { numberOfChannels } = buffer;
  const mono = new Float32Array(sliceLength);

  if (numberOfChannels === 1) {
    mono.set(buffer.getChannelData(0).subarray(startSample, startSample + sliceLength));
    return mono;
  }

  const channels: Float32Array[] = [];
  for (let c = 0; c < numberOfChannels; c++) channels.push(buffer.getChannelData(c));

  for (let i = 0; i < sliceLength; i++) {
    let sum = 0;
    const idx = startSample + i;
    for (let c = 0; c < numberOfChannels; c++) sum += channels[c][idx];
    mono[i] = sum / numberOfChannels;
  }
  return mono;
}

/** Decodifica un archivo de audio arbitrario a PCM (solo web, vía Web Audio API). */
export async function decodeAudioFileWeb(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  try {
    return await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close?.();
  }
}

/**
 * Recorta un AudioBuffer ya decodificado a SONG_CLIP_SECONDS desde startSec, y lo
 * comprime a MP3 mono @ SONG_TARGET_KBPS. startSec se ajusta para que el recorte nunca se
 * pase del final de la canción.
 */
export function compressAudioClip(buffer: AudioBuffer, startSec: number): Blob {
  const clipDuration = Math.min(SONG_CLIP_SECONDS, buffer.duration);
  const clampedStart = Math.max(0, Math.min(startSec, buffer.duration - clipDuration));

  const startSample = Math.floor(clampedStart * buffer.sampleRate);
  const sliceLength = Math.floor(clipDuration * buffer.sampleRate);

  const monoSamples = sliceAndDownmixToMono(buffer, startSample, sliceLength);
  const pcm = floatTo16BitPCM(monoSamples);

  const encoder = new lame.Mp3Encoder(1, buffer.sampleRate, SONG_TARGET_KBPS);
  const blockSize = 1152; // tamaño de frame que espera lamejs
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += blockSize) {
    const chunk = pcm.subarray(i, i + blockSize);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length > 0) chunks.push(encoded);
  }
  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) chunks.push(finalChunk);

  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}

/**
 * Abre el selector de archivos nativo del navegador filtrado a audio. Resuelve null si el
 * usuario cierra el diálogo sin elegir nada (no hay evento 'change' que lo confirme, así
 * que no resuelve nunca en ese caso — no bloquea nada porque nadie espera activamente).
 */
export function pickAudioFileWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => {
      resolve(input.files?.[0] || null);
    };
    input.click();
  });
}
