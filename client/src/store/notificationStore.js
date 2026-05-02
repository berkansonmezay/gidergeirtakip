import { create } from 'zustand';
import api from '../services/api';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/notifications');
      set({ notifications: data.notifications, unreadCount: data.unreadCount });
    } catch (error) {
      console.error('Bildirimler alınamadı:', error);
    } finally {
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      // Update local state
      const { notifications, unreadCount } = get();
      const updated = notifications.map(n => 
        n.id === id ? { ...n, is_read: 1 } : n
      );
      // Recalculate unread count
      const newUnreadCount = updated.filter(n => n.is_read === 0).length;
      set({ notifications: updated, unreadCount: newUnreadCount });
    } catch (error) {
      console.error('Bildirim okundu olarak işaretlenemedi:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all');
      // Update local state
      const { notifications } = get();
      const updated = notifications.map(n => ({ ...n, is_read: 1 }));
      set({ notifications: updated, unreadCount: 0 });
    } catch (error) {
      console.error('Bildirimler okundu olarak işaretlenemedi:', error);
    }
  },
  
  deleteNotification: async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      // Update local state
      const { notifications } = get();
      const updated = notifications.filter(n => n.id !== id);
      const newUnreadCount = updated.filter(n => n.is_read === 0).length;
      set({ notifications: updated, unreadCount: newUnreadCount });
    } catch (error) {
      console.error('Bildirim silinemedi:', error);
    }
  }
}));

export default useNotificationStore;
