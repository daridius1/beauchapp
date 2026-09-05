import { Linking } from 'react-native';
import { pb } from './pocketbase';

export interface ConoceContact {
  id: string;
  user: string;
  instagram: string;
  whatsapp: string;
  telegram: string;
}

export type ConoceContactFields = Pick<ConoceContact, 'instagram' | 'whatsapp' | 'telegram'>;

// Contacto único por usuario, compartido por Tinder, Mascotas, Música, Películas,
// Videojuegos y Libros: se llena una vez desde ConoceBeauchefScreen y el backend lo
// blanquea para cualquiera con quien no haya match (ver conoce_contacts.pb.js).
export const conoceContactService = {
  // Cada campo se guarda por separado (un botón por fila en ConoceContactForm), así que
  // `fields` normalmente trae solo uno — PocketBase actualiza nomás lo que se le manda.
  saveMyContact: async (userId: string, fields: Partial<ConoceContactFields>, existingId: string | null): Promise<ConoceContact> => {
    if (existingId) {
      const record = await pb.collection('conoce_contacts').update(existingId, fields);
      return record as unknown as ConoceContact;
    }
    const record = await pb.collection('conoce_contacts').create({ user: userId, ...fields });
    return record as unknown as ConoceContact;
  },

  // Contacto de otra persona: si no hay match activo entre ambos, el backend ya devuelve
  // los 4 campos vacíos, así que acá no hay ninguna lógica de permisos que replicar.
  getContactForUser: async (userId: string): Promise<ConoceContact | null> => {
    try {
      const res = await pb.collection('conoce_contacts').getFirstListItem(`user = "${userId}"`);
      return res as unknown as ConoceContact;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },
};

export const openSocialLink = (type: 'instagram' | 'whatsapp' | 'telegram', value: string) => {
  let url = '';
  const cleanValue = value.replace('@', '').trim();

  if (type === 'instagram') {
    url = `https://instagram.com/${cleanValue}`;
  } else if (type === 'whatsapp') {
    const phone = cleanValue.replace(/[^0-9+]/g, '');
    url = `https://wa.me/${phone}`;
  } else if (type === 'telegram') {
    url = `https://t.me/${cleanValue}`;
  }

  if (url) {
    return Linking.openURL(url);
  }
  return Promise.resolve();
};
