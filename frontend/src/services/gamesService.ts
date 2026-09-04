import { pb } from './pocketbase';

export interface GameItem {
  id: string;
  user: string;
  title: string;
  year: number | null;
  director?: string;
  genero?: string;
  image: string;
  igdbId: string;
  coverUrl: string;
  deleted?: boolean;
  collectionId?: string;
  collectionName?: string;
}

export interface GameProfile {
  id: string;
  user: string;
  description: string;
}

export interface DiscoverGameProfile {
  user: string;
  description: string;
  items: GameItem[];
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

// Calco de frontend/src/services/tinder.ts, adaptado a que el "perfil" son varias filas
// (game_items) más una descripción aparte (game_profiles) en vez de un solo registro con
// fotos anónimas.
export const gamesService = {
  getDiscoverFeed: async (): Promise<DiscoverGameProfile[]> => {
    const res = await pb.send<{ profiles: DiscoverGameProfile[] }>('/api/games/discover', {
      method: 'GET',
    });
    return res.profiles || [];
  },

  getProfileByUserId: async (userId: string): Promise<GameProfile | null> => {
    try {
      const res = await pb.collection('game_profiles').getFirstListItem(`user = "${userId}"`);
      return res as unknown as GameProfile;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createProfile: async (data: Partial<GameProfile>): Promise<GameProfile> => {
    const record = await pb.collection('game_profiles').create(data);
    return record as unknown as GameProfile;
  },

  updateProfile: async (profileId: string, data: Partial<GameProfile>): Promise<GameProfile> => {
    const record = await pb.collection('game_profiles').update(profileId, data);
    return record as unknown as GameProfile;
  },

  listMyItems: async (userId: string): Promise<GameItem[]> => {
    const res = await pb.collection('game_items').getFullList({
      filter: `user = "${userId}" && deleted = false`,
      sort: '+created',
    });
    return res as unknown as GameItem[];
  },

  createItem: async (data: Record<string, any>): Promise<GameItem> => {
    const record = await pb.collection('game_items').create(data);
    return record as unknown as GameItem;
  },

  updateItem: async (itemId: string, data: Record<string, any>): Promise<GameItem> => {
    const record = await pb.collection('game_items').update(itemId, data);
    return record as unknown as GameItem;
  },

  deleteItem: async (itemId: string): Promise<void> => {
    await pb.collection('game_items').update(itemId, { deleted: true });
  },

  getMatchesList: async (userId: string): Promise<any[]> => {
    const res = await pb.collection('game_matches').getFullList({
      filter: `userA = "${userId}" || userB = "${userId}"`,
      expand: 'userA,userB',
    });
    return res;
  },

  getMatchBetweenUsers: async (idA: string, idB: string): Promise<any> => {
    try {
      const res = await pb.collection('game_matches').getFirstListItem(`userA = "${idA}" && userB = "${idB}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createLike: async (fromUserId: string, toUserId: string, liked: boolean): Promise<any> => {
    const record = await pb.collection('game_likes').create({
      fromUser: fromUserId,
      toUser: toUserId,
      liked,
    });
    return record;
  },

  deleteLike: async (likeId: string): Promise<void> => {
    await pb.collection('game_likes').delete(likeId);
  },

  getLikeBetweenUsers: async (fromUser: string, toUser: string): Promise<any> => {
    try {
      const res = await pb.collection('game_likes').getFirstListItem(`fromUser = "${fromUser}" && toUser = "${toUser}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  unmatch: async (matchId: string, currentUserId: string): Promise<void> => {
    try {
      await pb.collection('game_matches').update(matchId, {
        status: 'unmatched',
        unmatchedBy: currentUserId,
      });
    } catch (err) {
      await pb.collection('game_matches').delete(matchId);
    }
  },
};
