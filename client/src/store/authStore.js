import { create } from 'zustand';
import api from '../services/api.js';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, loading: false });
      return data;
    } catch (err) {
      const errData = err.response?.data?.error;
      const msg = typeof errData === 'string' ? errData : (errData?.message || 'Giriş başarısız.');
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (userData) => {
    const currentUser = get().user;
    const updatedUser = { ...currentUser, ...userData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
