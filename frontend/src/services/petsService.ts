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
  created: string;
  collectionId?: string;
  collectionName?: string;
  expand?: {
    user?: {
      id: string;
      name: string;
      username: string;
      avatar: string;
    };
  };
}

export interface DiscoverPetItem {
  id: string;
  name: string;
  description: string;
  image: string;
  collectionId?: string;
  collectionName?: string;
}

export interface PetProfile {
  id: string;
  user: string;
  description: string;
}

export interface DiscoverPetProfile {
  user: string;
  description: string;
  items: DiscoverPetItem[];
  isLiked: boolean;
  likeId: string | null;
  expand?: {
    user?: {
      id: string;
      name: string;
      username: string;
      avatar: string;
    };
  };
}

// Calco de frontend/src/services/moviesService.ts. Cada mascota ya trae su propio nombre y
// descripción, y además hay una descripción a nivel de perfil (pet_profiles) — qué tipo de
// mascotas te gustan, no de una mascota puntual.
export const petsService = {
  getOne: async (petId: string): Promise<PetRecord> => {
    const record = await pb.collection('pets').getOne(petId, { expand: 'user' });
    return record as unknown as PetRecord;
  },

  getDiscoverFeed: async (): Promise<DiscoverPetProfile[]> => {
    const res = await pb.send<{ profiles: DiscoverPetProfile[] }>('/api/pets/discover', { method: 'GET' });
    return res.profiles || [];
  },

  getProfileByUserId: async (userId: string): Promise<PetProfile | null> => {
    try {
      const res = await pb.collection('pet_profiles').getFirstListItem(`user = "${userId}"`);
      return res as unknown as PetProfile;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createProfile: async (data: Partial<PetProfile>): Promise<PetProfile> => {
    const record = await pb.collection('pet_profiles').create(data);
    return record as unknown as PetProfile;
  },

  updateProfile: async (profileId: string, data: Partial<PetProfile>): Promise<PetProfile> => {
    const record = await pb.collection('pet_profiles').update(profileId, data);
    return record as unknown as PetProfile;
  },

  listMyItems: async (userId: string): Promise<PetRecord[]> => {
    const res = await pb.collection('pets').getFullList({
      filter: `user = "${userId}" && deleted = false`,
      sort: '+created',
    });
    return res as unknown as PetRecord[];
  },

  createItem: async (data: FormData): Promise<PetRecord> => {
    const record = await pb.collection('pets').create(data);
    return record as unknown as PetRecord;
  },

  updateItem: async (petId: string, data: FormData): Promise<PetRecord> => {
    const record = await pb.collection('pets').update(petId, data);
    return record as unknown as PetRecord;
  },

  deleteItem: async (petId: string): Promise<void> => {
    await pb.collection('pets').update(petId, { deleted: true });
  },

  getMatchesList: async (userId: string): Promise<any[]> => {
    const res = await pb.collection('pet_matches').getFullList({
      filter: `userA = "${userId}" || userB = "${userId}"`,
      expand: 'userA,userB',
    });
    return res;
  },

  getMatchBetweenUsers: async (idA: string, idB: string): Promise<any> => {
    try {
      const res = await pb.collection('pet_matches').getFirstListItem(`userA = "${idA}" && userB = "${idB}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createLike: async (fromUserId: string, toUserId: string, liked: boolean): Promise<any> => {
    const record = await pb.collection('pet_likes').create({ fromUser: fromUserId, toUser: toUserId, liked });
    return record;
  },

  deleteLike: async (likeId: string): Promise<void> => {
    await pb.collection('pet_likes').delete(likeId);
  },

  getLikeBetweenUsers: async (fromUser: string, toUser: string): Promise<any> => {
    try {
      const res = await pb.collection('pet_likes').getFirstListItem(`fromUser = "${fromUser}" && toUser = "${toUser}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  unmatch: async (matchId: string, currentUserId: string): Promise<void> => {
    try {
      await pb.collection('pet_matches').update(matchId, { status: 'unmatched', unmatchedBy: currentUserId });
    } catch (err) {
      await pb.collection('pet_matches').delete(matchId);
    }
  },
};
