import { pb } from './pocketbase';

export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  created: string;
  updated: string;
}

export const announcementsService = {
  getLatestAnnouncement: async (): Promise<AnnouncementRecord | null> => {
    try {
      const res = await pb.collection('announcements').getList<AnnouncementRecord>(1, 1, {
        sort: '-created',
      });
      return res.items[0] || null;
    } catch (err) {
      console.error('Error fetching latest announcement:', err);
      return null;
    }
  },

  markSeen: async (userId: string, announcementId: string): Promise<void> => {
    await pb.collection('users').update(userId, { last_seen_announcement: announcementId });
  },
};
