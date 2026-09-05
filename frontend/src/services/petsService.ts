import { pb } from './pocketbase';

// La colección "pets" (varias mascotas por persona, cada una con nombre/fotos propias) ya
// no recibe creaciones nuevas — ver pet_profiles más abajo — pero se deja el tipo y
// `getOne` porque hay citas/quotes viejas desde el feed que apuntan a mascotas puntuales
// ahí (PetProfileCard.tsx las sigue mostrando).
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

export interface PetProfile {
  id: string;
  user: string;
  name: string;
  description: string;
  photos: string[];
  collectionId?: string;
  collectionName?: string;
}

export interface DiscoverPetProfile {
  id: string;
  user: string;
  name: string;
  description: string;
  photos: string[];
  collectionId?: string;
  collectionName?: string;
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

// Calco de frontend/src/services/tinder.ts: un solo perfil por persona (nombre libre,
// descripción, hasta 10 fotos), no una lista de ítems como games/movies/songs/books.
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

  createProfile: async (data: FormData | Record<string, any>): Promise<PetProfile> => {
    const record = await pb.collection('pet_profiles').create(data);
    return record as unknown as PetProfile;
  },

  updateProfile: async (profileId: string, data: FormData | Record<string, any>): Promise<PetProfile> => {
    const record = await pb.collection('pet_profiles').update(profileId, data);
    return record as unknown as PetProfile;
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
