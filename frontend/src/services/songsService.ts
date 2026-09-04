import { pb } from './pocketbase';

export interface SongRecord {
  id: string;
  user: string;
  title: string;
  author: string;
  year: number;
  description: string;
  audio: string;
  cover: string;
  spotifyTrackId: string;
  spotifyImageUrl: string;
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

export interface SongProfile {
  id: string;
  user: string;
  description: string;
}

export interface DiscoverSongProfile {
  user: string;
  description: string;
  items: SongRecord[];
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

// Calco de frontend/src/services/moviesService.ts, adaptado a que cada canción también
// lleva audio (el mismo mecanismo de recorte de SongTrimmer, sin cambios) además de la
// carátula.
export const songsService = {
  getOne: async (songId: string): Promise<SongRecord> => {
    const record = await pb.collection('songs').getOne(songId, { expand: 'user' });
    return record as unknown as SongRecord;
  },

  getDiscoverFeed: async (): Promise<DiscoverSongProfile[]> => {
    const res = await pb.send<{ profiles: DiscoverSongProfile[] }>('/api/songs/discover', { method: 'GET' });
    return res.profiles || [];
  },

  getProfileByUserId: async (userId: string): Promise<SongProfile | null> => {
    try {
      const res = await pb.collection('song_profiles').getFirstListItem(`user = "${userId}"`);
      return res as unknown as SongProfile;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createProfile: async (data: Partial<SongProfile>): Promise<SongProfile> => {
    const record = await pb.collection('song_profiles').create(data);
    return record as unknown as SongProfile;
  },

  updateProfile: async (profileId: string, data: Partial<SongProfile>): Promise<SongProfile> => {
    const record = await pb.collection('song_profiles').update(profileId, data);
    return record as unknown as SongProfile;
  },

  listMyItems: async (userId: string): Promise<SongRecord[]> => {
    const res = await pb.collection('songs').getFullList({
      filter: `user = "${userId}" && deleted = false`,
      sort: '+created',
    });
    return res as unknown as SongRecord[];
  },

  createItem: async (data: Record<string, any>): Promise<SongRecord> => {
    const record = await pb.collection('songs').create(data);
    return record as unknown as SongRecord;
  },

  updateItem: async (songId: string, data: Record<string, any>): Promise<SongRecord> => {
    const record = await pb.collection('songs').update(songId, data);
    return record as unknown as SongRecord;
  },

  deleteItem: async (songId: string): Promise<void> => {
    await pb.collection('songs').update(songId, { deleted: true });
  },

  getMatchesList: async (userId: string): Promise<any[]> => {
    const res = await pb.collection('song_matches').getFullList({
      filter: `userA = "${userId}" || userB = "${userId}"`,
      expand: 'userA,userB',
    });
    return res;
  },

  getMatchBetweenUsers: async (idA: string, idB: string): Promise<any> => {
    try {
      const res = await pb.collection('song_matches').getFirstListItem(`userA = "${idA}" && userB = "${idB}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createLike: async (fromUserId: string, toUserId: string, liked: boolean): Promise<any> => {
    const record = await pb.collection('song_likes').create({ fromUser: fromUserId, toUser: toUserId, liked });
    return record;
  },

  deleteLike: async (likeId: string): Promise<void> => {
    await pb.collection('song_likes').delete(likeId);
  },

  getLikeBetweenUsers: async (fromUser: string, toUser: string): Promise<any> => {
    try {
      const res = await pb.collection('song_likes').getFirstListItem(`fromUser = "${fromUser}" && toUser = "${toUser}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  unmatch: async (matchId: string, currentUserId: string): Promise<void> => {
    try {
      await pb.collection('song_matches').update(matchId, { status: 'unmatched', unmatchedBy: currentUserId });
    } catch (err) {
      await pb.collection('song_matches').delete(matchId);
    }
  },
};
