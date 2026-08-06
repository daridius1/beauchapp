import PocketBase, { AsyncAuthStore } from 'pocketbase';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const AUTH_STORAGE_KEY = 'pb_auth';

// En web, el SDK usa por defecto LocalAuthStore (window.localStorage), que ya persiste
// la sesión entre recargas. En nativo (iOS/Android) no hay backing store por defecto,
// así que la sesión se perdía en cada reinicio del proceso — se respalda con AsyncStorage.
const nativeAuthStore = Platform.OS === 'web'
  ? undefined
  : new AsyncAuthStore({
      save: async (serialized) => AsyncStorage.setItem(AUTH_STORAGE_KEY, serialized),
      clear: async () => AsyncStorage.removeItem(AUTH_STORAGE_KEY),
      initial: AsyncStorage.getItem(AUTH_STORAGE_KEY),
    });

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

export const pb = new PocketBase(POCKETBASE_URL, nativeAuthStore);

pb.autoCancellation(false);

// Función optimizada para obtener imágenes:
// Si hay un dominio público de R2 configurado, la carga directo desde Cloudflare (ahorrando servidor).
// Si no, hace fallback al proxy de PocketBase normal.
export const getFileUrl = (record: any, filename: string, size?: string) => {
  if (!filename) return '';
  
  // Si ya es una URL completa o un blob local, lo retornamos tal cual sin procesar
  if (filename.startsWith('blob:') || filename.startsWith('data:') || filename.startsWith('http:') || filename.startsWith('https:')) {
    return filename;
  }

  const recordObj = typeof record === 'string' 
    ? { collectionId: 'posts', collectionName: 'posts', id: record } 
    : { ...record, collectionName: record?.collectionName || record?.collectionId || 'posts' };
  
  const r2Url = process.env.EXPO_PUBLIC_R2_URL;
  // Si NO se solicita miniatura (foto HD completa) y hay R2 URL, traer directo del CDN público de R2
  if (r2Url && !size) {
    const base = r2Url.replace(/\/$/, '');
    const col = recordObj.collectionId || recordObj.collectionName || 'posts';
    return `${base}/${col}/${recordObj.id}/${filename}`;
  }

  // Si se solicita miniatura (ej: '100x100'), usar el proxy de PocketBase para que las genere lazily en R2 si no existen
  const options = size ? { thumb: size } : undefined;
  return pb.files.getURL(recordObj, filename, options);
};
