import { pb } from './pocketbase';

export interface TinderProfile {
  id: string;
  user: string;
  description: string;
  isActive: boolean;
  activatedAt: string;
  photos: string[];
  instagram: string;
  whatsapp: string;
  telegram: string;
  signal: string;
  expand?: {
    user?: {
      id: string;
      name: string;
      username: string;
      avatar: string;
    };
  };
}

export const tinderService = {
  /**
   * Obtiene el perfil de Tinder de un usuario por su ID de usuario
   */
  getProfileByUserId: async (userId: string): Promise<TinderProfile | null> => {
    try {
      const res = await pb.collection('tinder_profiles').getFirstListItem(`user = "${userId}"`);
      return res as unknown as TinderProfile;
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Crea un perfil de Tinder inicial
   */
  createProfile: async (data: Partial<TinderProfile>): Promise<TinderProfile> => {
    try {
      const record = await pb.collection('tinder_profiles').create(data);
      return record as unknown as TinderProfile;
    } catch (err) {
      console.error('Error creating tinder profile:', err);
      throw err;
    }
  },

  /**
   * Actualiza el perfil de Tinder por su ID
   */
  updateProfile: async (profileId: string, data: any): Promise<TinderProfile> => {
    try {
      const record = await pb.collection('tinder_profiles').update(profileId, data);
      return record as unknown as TinderProfile;
    } catch (err) {
      console.error('Error updating tinder profile:', err);
      throw err;
    }
  },

  /**
   * Obtiene todos los perfiles de Tinder activos (excepto el propio)
   */
  getFullActiveProfiles: async (currentUserId: string): Promise<TinderProfile[]> => {
    try {
      const res = await pb.collection('tinder_profiles').getFullList({
        filter: `isActive = true && user != "${currentUserId}"`,
        expand: 'user',
      });
      return res as unknown as TinderProfile[];
    } catch (err) {
      console.error('Error fetching active profiles:', err);
      throw err;
    }
  },

  /**
   * Obtiene todos los matches del usuario
   */
  getMatchesList: async (userId: string): Promise<any[]> => {
    try {
      const res = await pb.collection('tinder_matches').getFullList({
        filter: `userA = "${userId}" || userB = "${userId}"`,
        expand: 'userA,userB',
      });
      return res;
    } catch (err) {
      console.error('Error fetching matches list:', err);
      throw err;
    }
  },

  /**
   * Obtiene un match específico entre dos usuarios
   */
  getMatchBetweenUsers: async (idA: string, idB: string): Promise<any> => {
    try {
      const res = await pb.collection('tinder_matches').getFirstListItem(
        `userA = "${idA}" && userB = "${idB}"`
      );
      return res;
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      console.error('Error finding match between users:', err);
      throw err;
    }
  },

  /**
   * Obtiene todos los likes enviados por un usuario
   */
  getLikesList: async (fromUserId: string): Promise<any[]> => {
    try {
      const res = await pb.collection('tinder_likes').getFullList({
        filter: `fromUser = "${fromUserId}" && liked = true`,
      });
      return res;
    } catch (err) {
      console.error('Error fetching likes list:', err);
      throw err;
    }
  },

  /**
   * Crea una nueva interacción de swipe (like/pase)
   */
  createLike: async (fromUserId: string, toUserId: string, liked: boolean): Promise<any> => {
    try {
      const record = await pb.collection('tinder_likes').create({
        fromUser: fromUserId,
        toUser: toUserId,
        liked: liked,
      });
      return record;
    } catch (err) {
      console.error('Error creating swipe like:', err);
      throw err;
    }
  },

  /**
   * Elimina un like por su ID
   */
  deleteLike: async (likeId: string): Promise<boolean> => {
    try {
      await pb.collection('tinder_likes').delete(likeId);
      return true;
    } catch (err) {
      console.error('Error deleting like:', err);
      throw err;
    }
  },

  /**
   * Elimina un match por su ID
   */
  deleteMatch: async (matchId: string): Promise<boolean> => {
    try {
      await pb.collection('tinder_matches').delete(matchId);
      return true;
    } catch (err) {
      console.error('Error deleting match:', err);
      throw err;
    }
  },

  /**
   * Obtiene un registro de like específico entre dos usuarios
   */
  getLikeBetweenUsers: async (fromUser: string, toUser: string): Promise<any> => {
    try {
      const res = await pb.collection('tinder_likes').getFirstListItem(
        `fromUser = "${fromUser}" && toUser = "${toUser}"`
      );
      return res;
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      console.error('Error getting like record:', err);
      throw err;
    }
  }
};
