import PocketBase from 'pocketbase';

// URL por defecto para PocketBase local.
// NOTA: Si estás probando en un celular físico con Expo Go, reemplaza '127.0.0.1' 
// con la dirección IP local de tu computador (ej. 'http://192.168.1.15:8090').
const POCKETBASE_URL = 'http://127.0.0.1:8090';

export const pb = new PocketBase(POCKETBASE_URL);
