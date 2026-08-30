import { pb } from './pocketbase';

export interface PetRecord {
  id: string;
  user: string;
  name: string;
  description: string;
  photos: string[];
  deleted: boolean;
  commentCount: number;
  quoteCount: number;
  like_count: number;
  created: string;
  expand?: {
    user?: {
      id: string;
      name: string;
      username: string;
      avatar: string;
    };
  };
}

export const petsService = {
  /**
   * Perfil de mascota del usuario (uno solo por persona). Null si aún no lo ha creado.
   */
  getMyPet: async (userId: string): Promise<PetRecord | null> => {
    try {
      const res = await pb.collection('pets').getFirstListItem(`user = "${userId}"`);
      return res as unknown as PetRecord;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createPet: async (data: any): Promise<PetRecord> => {
    const record = await pb.collection('pets').create(data);
    return record as unknown as PetRecord;
  },

  updatePet: async (petId: string, data: any): Promise<PetRecord> => {
    const record = await pb.collection('pets').update(petId, data);
    return record as unknown as PetRecord;
  },

  /**
   * Todas las mascotas para la pestaña Explorar: se navega una por una (como el feed de
   * Tinder Beauchef, tinderService.getFullActiveProfiles), no una grilla paginada.
   */
  listAllPets: async (): Promise<PetRecord[]> => {
    const res = await pb.collection('pets').getFullList({
      filter: 'deleted = false',
      sort: '-created',
      expand: 'user',
    });
    return res as unknown as PetRecord[];
  },

  getOne: async (petId: string): Promise<PetRecord> => {
    const record = await pb.collection('pets').getOne(petId, { expand: 'user' });
    return record as unknown as PetRecord;
  },

  /**
   * Mismo patrón que activityService.checkUserInteractions/toggleLike: like a la mascota
   * misma, en su propia colección de unión (pet_likes), no un array en el registro.
   */
  checkIsLiked: async (petId: string, userId: string): Promise<{ liked: boolean; likeRecordId?: string }> => {
    if (!userId || !petId) return { liked: false };
    try {
      const res = await pb.collection('pet_likes').getList(1, 1, {
        filter: `pet = "${petId}" && user = "${userId}"`,
      });
      if (res.items.length > 0) return { liked: true, likeRecordId: res.items[0].id };
      return { liked: false };
    } catch (err) {
      console.error('No se pudo comprobar el like propio de la mascota:', err);
      return { liked: false };
    }
  },

  toggleLike: async (petId: string, userId: string, currentLikeRecordId?: string): Promise<boolean> => {
    if (!userId || !petId) return false;
    if (currentLikeRecordId) {
      await pb.collection('pet_likes').delete(currentLikeRecordId);
      return false;
    }
    await pb.collection('pet_likes').create({ pet: petId, user: userId });
    return true;
  },
};
