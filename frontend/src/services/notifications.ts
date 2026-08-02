import { pb } from './pocketbase';

export interface Notification {
  id: string;
  user: string;
  sender: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  relatedId: string;
  created: string;
  updated: string;
  expand?: {
    sender?: {
      id: string;
      name: string;
      username: string;
      avatar: string;
    };
  };
}

export const notificationService = {
  /**
   * Obtiene la lista de notificaciones del usuario actual
   */
  getNotifications: async (userId: string): Promise<Notification[]> => {
    try {
      const res = await pb.collection('notifications').getList(1, 50, {
        filter: `user = "${userId}"`,
        sort: '-created',
        expand: 'sender',
      });
      return res.items as unknown as Notification[];
    } catch (err) {
      console.error('Error fetching notifications:', err);
      throw err;
    }
  },

  /**
   * Obtiene la cantidad de notificaciones no leídas del usuario
   */
  getUnreadCount: async (userId: string): Promise<number> => {
    try {
      const res = await pb.collection('notifications').getList(1, 1, {
        filter: `user = "${userId}" && read = false`,
      });
      return res.totalItems;
    } catch (err) {
      console.error('Error fetching unread count:', err);
      return 0;
    }
  },

  /**
   * Marca todas las notificaciones de un usuario como leídas
   */
  markAllAsRead: async (userId: string): Promise<void> => {
    try {
      const unreads = await pb.collection('notifications').getFullList({
        filter: `user = "${userId}" && read = false`,
      });
      for (const item of unreads) {
        await pb.collection('notifications').update(item.id, { read: true });
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  },

  /**
   * Elimina una notificación por su ID
   */
  deleteNotification: async (notifId: string): Promise<boolean> => {
    try {
      await pb.collection('notifications').delete(notifId);
      return true;
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  }
};
