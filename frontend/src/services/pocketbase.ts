import PocketBase from 'pocketbase';

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrl = () => {
  // 1. Prioridad: Variable de entorno (útil para producción y setups manuales)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Fallback automático para desarrollo
  if (Platform.OS === 'web') {
    // En la web, se conecta al puerto 8090 en el mismo host que corre el navegador
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // Si estamos en desarrollo local con Expo, usamos el puerto 8090
      if (window.location.port === '8081') {
        return `http://${hostname}:8090`;
      }
      // En producción servido por PocketBase/Cloudflare, usamos el mismo origen
      return window.location.origin;
    }
    return '/';
  }

  // En celulares (iOS/Android), obtenemos la IP del Metro Bundler
  const hostUri = Constants.expoConfig?.hostUri;
  const localIp = hostUri ? hostUri.split(':')[0] : '127.0.0.1';
  return `http://${localIp}:8090`;
};

const POCKETBASE_URL = getBackendUrl();
console.log('PocketBase URL:', POCKETBASE_URL);

export const pb = new PocketBase(getBackendUrl());

pb.autoCancellation(false);

// Función optimizada para obtener imágenes:
// Si hay un dominio público de R2 configurado, la carga directo desde Cloudflare (ahorrando servidor).
// Si no, hace fallback al proxy de PocketBase normal.
export const getFileUrl = (record: any, filename: string, size?: string) => {
  if (!filename) return '';
  
  const r2Url = process.env.EXPO_PUBLIC_R2_URL;
  // Solo descargamos directo de R2 si es el archivo original (sin tamaño de miniatura).
  // Los thumbnails se generan "al vuelo" (lazy) y se sirven a través del proxy de PocketBase.
  if (r2Url && !size) {
    const base = r2Url.replace(/\/$/, '');
    return `${base}/${record.collectionId}/${record.id}/${filename}`;
  }

  const options = size ? { thumb: size } : undefined;
  return pb.files.getURL(record, filename, options);
};
