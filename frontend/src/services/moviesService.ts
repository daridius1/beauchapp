import { pb } from './pocketbase';

export interface MovieItem {
  id: string;
  user: string;
  title: string;
  year: number | null;
  director?: string;
  genero?: string;
  image: string;
  mediaType: 'movie' | 'tv' | '';
  tmdbId: string;
  posterUrl: string;
  deleted?: boolean;
  collectionId?: string;
  collectionName?: string;
}

export interface MovieProfile {
  id: string;
  user: string;
  description: string;
}

export interface DiscoverMovieProfile {
  user: string;
  description: string;
  items: MovieItem[];
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
// (movie_items) más una descripción aparte (movie_profiles) en vez de un solo registro con
// fotos anónimas.
export const moviesService = {
  getDiscoverFeed: async (): Promise<DiscoverMovieProfile[]> => {
    const res = await pb.send<{ profiles: DiscoverMovieProfile[] }>('/api/movies/discover', {
      method: 'GET',
    });
    return res.profiles || [];
  },

  getProfileByUserId: async (userId: string): Promise<MovieProfile | null> => {
    try {
      const res = await pb.collection('movie_profiles').getFirstListItem(`user = "${userId}"`);
      return res as unknown as MovieProfile;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createProfile: async (data: Partial<MovieProfile>): Promise<MovieProfile> => {
    const record = await pb.collection('movie_profiles').create(data);
    return record as unknown as MovieProfile;
  },

  updateProfile: async (profileId: string, data: Partial<MovieProfile>): Promise<MovieProfile> => {
    const record = await pb.collection('movie_profiles').update(profileId, data);
    return record as unknown as MovieProfile;
  },

  listMyItems: async (userId: string): Promise<MovieItem[]> => {
    const res = await pb.collection('movie_items').getFullList({
      filter: `user = "${userId}" && deleted = false`,
      sort: '+created',
    });
    return res as unknown as MovieItem[];
  },

  createItem: async (data: Record<string, any>): Promise<MovieItem> => {
    const record = await pb.collection('movie_items').create(data);
    return record as unknown as MovieItem;
  },

  updateItem: async (itemId: string, data: Record<string, any>): Promise<MovieItem> => {
    const record = await pb.collection('movie_items').update(itemId, data);
    return record as unknown as MovieItem;
  },

  deleteItem: async (itemId: string): Promise<void> => {
    await pb.collection('movie_items').update(itemId, { deleted: true });
  },

  getMatchesList: async (userId: string): Promise<any[]> => {
    const res = await pb.collection('movie_matches').getFullList({
      filter: `userA = "${userId}" || userB = "${userId}"`,
      expand: 'userA,userB',
    });
    return res;
  },

  getMatchBetweenUsers: async (idA: string, idB: string): Promise<any> => {
    try {
      const res = await pb.collection('movie_matches').getFirstListItem(`userA = "${idA}" && userB = "${idB}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createLike: async (fromUserId: string, toUserId: string, liked: boolean): Promise<any> => {
    const record = await pb.collection('movie_likes').create({
      fromUser: fromUserId,
      toUser: toUserId,
      liked,
    });
    return record;
  },

  deleteLike: async (likeId: string): Promise<void> => {
    await pb.collection('movie_likes').delete(likeId);
  },

  getLikeBetweenUsers: async (fromUser: string, toUser: string): Promise<any> => {
    try {
      const res = await pb.collection('movie_likes').getFirstListItem(`fromUser = "${fromUser}" && toUser = "${toUser}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  unmatch: async (matchId: string, currentUserId: string): Promise<void> => {
    try {
      await pb.collection('movie_matches').update(matchId, {
        status: 'unmatched',
        unmatchedBy: currentUserId,
      });
    } catch (err) {
      await pb.collection('movie_matches').delete(matchId);
    }
  },
};
