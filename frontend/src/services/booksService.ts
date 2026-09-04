import { pb } from './pocketbase';

export interface BookItem {
  id: string;
  user: string;
  title: string;
  author: string;
  year: number | null;
  openLibraryId: string;
  coverUrl: string;
  deleted?: boolean;
  collectionId?: string;
  collectionName?: string;
}

export interface BookProfile {
  id: string;
  user: string;
  description: string;
}

export interface DiscoverBookProfile {
  user: string;
  description: string;
  items: BookItem[];
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

// Calco de frontend/src/services/moviesService.ts.
export const booksService = {
  getDiscoverFeed: async (): Promise<DiscoverBookProfile[]> => {
    const res = await pb.send<{ profiles: DiscoverBookProfile[] }>('/api/books/discover', { method: 'GET' });
    return res.profiles || [];
  },

  getProfileByUserId: async (userId: string): Promise<BookProfile | null> => {
    try {
      const res = await pb.collection('book_profiles').getFirstListItem(`user = "${userId}"`);
      return res as unknown as BookProfile;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createProfile: async (data: Partial<BookProfile>): Promise<BookProfile> => {
    const record = await pb.collection('book_profiles').create(data);
    return record as unknown as BookProfile;
  },

  updateProfile: async (profileId: string, data: Partial<BookProfile>): Promise<BookProfile> => {
    const record = await pb.collection('book_profiles').update(profileId, data);
    return record as unknown as BookProfile;
  },

  listMyItems: async (userId: string): Promise<BookItem[]> => {
    const res = await pb.collection('book_items').getFullList({
      filter: `user = "${userId}" && deleted = false`,
      sort: '+created',
    });
    return res as unknown as BookItem[];
  },

  createItem: async (data: Record<string, any>): Promise<BookItem> => {
    const record = await pb.collection('book_items').create(data);
    return record as unknown as BookItem;
  },

  updateItem: async (itemId: string, data: Record<string, any>): Promise<BookItem> => {
    const record = await pb.collection('book_items').update(itemId, data);
    return record as unknown as BookItem;
  },

  deleteItem: async (itemId: string): Promise<void> => {
    await pb.collection('book_items').update(itemId, { deleted: true });
  },

  getMatchesList: async (userId: string): Promise<any[]> => {
    const res = await pb.collection('book_matches').getFullList({
      filter: `userA = "${userId}" || userB = "${userId}"`,
      expand: 'userA,userB',
    });
    return res;
  },

  getMatchBetweenUsers: async (idA: string, idB: string): Promise<any> => {
    try {
      const res = await pb.collection('book_matches').getFirstListItem(`userA = "${idA}" && userB = "${idB}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createLike: async (fromUserId: string, toUserId: string, liked: boolean): Promise<any> => {
    const record = await pb.collection('book_likes').create({ fromUser: fromUserId, toUser: toUserId, liked });
    return record;
  },

  deleteLike: async (likeId: string): Promise<void> => {
    await pb.collection('book_likes').delete(likeId);
  },

  getLikeBetweenUsers: async (fromUser: string, toUser: string): Promise<any> => {
    try {
      const res = await pb.collection('book_likes').getFirstListItem(`fromUser = "${fromUser}" && toUser = "${toUser}"`);
      return res;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  unmatch: async (matchId: string, currentUserId: string): Promise<void> => {
    try {
      await pb.collection('book_matches').update(matchId, { status: 'unmatched', unmatchedBy: currentUserId });
    } catch (err) {
      await pb.collection('book_matches').delete(matchId);
    }
  },
};
