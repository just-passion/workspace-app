import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      workspaceId: null,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        set({ user: data.user, token: data.token, workspaceId: data.workspaceId });
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        return data;
      },

      register: async (name, email, password) => {
        const { data } = await api.post('/auth/register', { name, email, password });
        set({ user: data.user, token: data.token, workspaceId: data.workspaceId });
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        return data;
      },

      logout: () => {
        set({ user: null, token: null, workspaceId: null });
        delete api.defaults.headers.Authorization;
      },

      initAuth: () => {
        const { token } = get();
        if (token) api.defaults.headers.Authorization = `Bearer ${token}`;
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ user: s.user, token: s.token, workspaceId: s.workspaceId }) }
  )
);
