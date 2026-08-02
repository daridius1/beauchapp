import { pb, getFileUrl } from './pocketbase';
import { User } from '../context/AuthContext';

export interface ActivityRecord {
  id: string;
  organization: string;
  title: string;
  description?: string;
  location: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  category?: string;
  banner?: string;
  price?: string;
  external_link?: string;
  like_count?: number;
  attendee_count?: number;
  comment_count?: number;
  quote_count?: number;
  deleted?: boolean;
  created: string;
  updated: string;
  expand?: {
    organization?: User;
  };
}

export const activityService = {
  /**
   * Obtiene la lista de actividades.
   * Si tab === 'following' y currentUserId existe, filtra por las organizaciones que el usuario sigue.
   */
  async getActivities(
    tab: 'all' | 'following' = 'all',
    currentUserId?: string,
    dateRange?: { start?: string; end?: string }
  ): Promise<ActivityRecord[]> {
    let filterParts: string[] = ['deleted = false'];

    if (tab === 'following' && currentUserId) {
      // 1. Obtener los IDs de organizaciones seguidas + incluir al propio usuario si es organización
      try {
        const followsRes = await pb.collection('follows').getList(1, 200, {
          filter: `follower = "${currentUserId}"`,
        });
        const followedUserIds = followsRes.items.map(f => f.following);

        if (!followedUserIds.includes(currentUserId)) {
          followedUserIds.push(currentUserId);
        }

        if (followedUserIds.length === 0) {
          return [];
        }

        const orgFilter = followedUserIds.map(id => `organization = "${id}"`).join(' || ');
        filterParts.push(`(${orgFilter})`);
      } catch (err) {
        console.error('Error obteniendo seguidos en activityService:', err);
        return [];
      }
    }

    if (dateRange?.start && dateRange?.end) {
      filterParts.push(`date >= "${dateRange.start}" && date <= "${dateRange.end}"`);
    } else if (dateRange?.start) {
      filterParts.push(`date >= "${dateRange.start}"`);
    }

    const filterStr = filterParts.join(' && ');

    try {
      const result = await pb.collection('activities').getList<ActivityRecord>(1, 100, {
        filter: filterStr,
        sort: 'date,start_time',
        expand: 'organization',
      });
      return result.items;
    } catch (err) {
      console.error('Error cargando actividades:', err);
      return [];
    }
  },

  /**
   * Obtiene una actividad por su ID.
   */
  async getActivityById(activityId: string): Promise<ActivityRecord | null> {
    try {
      return await pb.collection('activities').getOne<ActivityRecord>(activityId, {
        expand: 'organization',
      });
    } catch (err) {
      console.error('Error cargando actividad por ID:', err);
      return null;
    }
  },

  /**
   * Crea una nueva actividad (requiere que el usuario autenticado sea de tipo 'organization').
   */
  async createActivity(formData: FormData): Promise<ActivityRecord> {
    return await pb.collection('activities').create<ActivityRecord>(formData, {
      expand: 'organization',
    });
  },

  /**
   * Verifica si el usuario actual le dio Like y/o Asistirá a la actividad.
   */
  async checkUserInteractions(activityId: string, userId: string): Promise<{ liked: boolean; attending: boolean; likeRecordId?: string; attendeeRecordId?: string }> {
    if (!userId || !activityId) {
      return { liked: false, attending: false };
    }

    let liked = false;
    let attending = false;
    let likeRecordId: string | undefined;
    let attendeeRecordId: string | undefined;

    try {
      const likesRes = await pb.collection('activity_likes').getList(1, 1, {
        filter: `activity = "${activityId}" && user = "${userId}"`,
      });
      if (likesRes.items.length > 0) {
        liked = true;
        likeRecordId = likesRes.items[0].id;
      }
    } catch (e) {}

    try {
      const attendeesRes = await pb.collection('activity_attendees').getList(1, 1, {
        filter: `activity = "${activityId}" && user = "${userId}"`,
      });
      if (attendeesRes.items.length > 0) {
        attending = true;
        attendeeRecordId = attendeesRes.items[0].id;
      }
    } catch (e) {}

    return { liked, attending, likeRecordId, attendeeRecordId };
  },

  /**
   * Alterna el me gusta del usuario en una actividad.
   */
  async toggleLike(activityId: string, userId: string, currentLikeRecordId?: string): Promise<boolean> {
    if (!userId || !activityId) return false;

    if (currentLikeRecordId) {
      await pb.collection('activity_likes').delete(currentLikeRecordId);
      return false;
    } else {
      await pb.collection('activity_likes').create({
        activity: activityId,
        user: userId,
      });
      return true;
    }
  },

  /**
   * Alterna la confirmación de asistencia ("Asistiré") del usuario en una actividad.
   */
  async toggleAttendance(activityId: string, userId: string, currentAttendeeRecordId?: string): Promise<boolean> {
    if (!userId || !activityId) return false;

    if (currentAttendeeRecordId) {
      await pb.collection('activity_attendees').delete(currentAttendeeRecordId);
      return false;
    } else {
      await pb.collection('activity_attendees').create({
        activity: activityId,
        user: userId,
      });
      return true;
    }
  },

  /**
   * Helper para obtener la URL de la imagen de portada de la actividad.
   */
  getBannerUrl(record: ActivityRecord): string | null {
    if (!record || !record.banner) return null;
    return getFileUrl(record, record.banner);
  }
};
