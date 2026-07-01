import PocketBase from 'pocketbase';

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrl = () => {
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

export const pb = new PocketBase(POCKETBASE_URL);
