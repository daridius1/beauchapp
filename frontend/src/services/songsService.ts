import { pb } from './pocketbase';

export interface SongRecord {
  id: string;
  user: string;
  title: string;
  author: string;
  year: number;
  description: string;
  audio: string;
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

export const songsService = {
  /**
   * Perfil de canción del usuario (uno solo por persona). Null si aún no lo ha creado.
   */
  getMySong: async (userId: string): Promise<SongRecord | null> => {
    try {
      const res = await pb.collection('songs').getFirstListItem(`user = "${userId}"`);
      return res as unknown as SongRecord;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  createSong: async (data: any): Promise<SongRecord> => {
    const record = await pb.collection('songs').create(data);
    return record as unknown as SongRecord;
  },

  updateSong: async (songId: string, data: any): Promise<SongRecord> => {
    const record = await pb.collection('songs').update(songId, data);
    return record as unknown as SongRecord;
  },

  getOne: async (songId: string): Promise<SongRecord> => {
    const record = await pb.collection('songs').getOne(songId, { expand: 'user' });
    return record as unknown as SongRecord;
  },

  /**
   * Todas las canciones para la pestaña Explorar: se navega una por una, como en Mascotas.
   */
  listAllSongs: async (): Promise<SongRecord[]> => {
    const res = await pb.collection('songs').getFullList({
      filter: 'deleted = false',
      sort: '-created',
      expand: 'user',
    });
    return res as unknown as SongRecord[];
  },

  checkIsLiked: async (songId: string, userId: string): Promise<{ liked: boolean; likeRecordId?: string }> => {
    if (!userId || !songId) return { liked: false };
    try {
      const res = await pb.collection('song_likes').getList(1, 1, {
        filter: `song = "${songId}" && user = "${userId}"`,
      });
      if (res.items.length > 0) return { liked: true, likeRecordId: res.items[0].id };
      return { liked: false };
    } catch (err) {
      console.error('No se pudo comprobar el like propio de la canción:', err);
      return { liked: false };
    }
  },

  toggleLike: async (songId: string, userId: string, currentLikeRecordId?: string): Promise<boolean> => {
    if (!userId || !songId) return false;
    if (currentLikeRecordId) {
      await pb.collection('song_likes').delete(currentLikeRecordId);
      return false;
    }
    await pb.collection('song_likes').create({ song: songId, user: userId });
    return true;
  },
};
