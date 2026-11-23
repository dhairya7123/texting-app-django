import { create } from 'zustand';
import api from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user_info') || 'null'),
  token: localStorage.getItem('access_token') || null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login/', { username, password });
      const { access, refresh, user } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user_info', JSON.stringify(user));

      set({
        user,
        token: access,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    } catch (err) {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        'Login failed. Please check your credentials.';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register/', userData);
      const { access, refresh, user } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user_info', JSON.stringify(user));

      set({
        user,
        token: access,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    } catch (err) {
      let errorMsg = 'Registration failed.';
      if (err.response?.data) {
        const firstKey = Object.keys(err.response.data)[0];
        const val = err.response.data[firstKey];
        errorMsg = Array.isArray(val) ? `${firstKey}: ${val[0]}` : val;
      }
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await api.post('/auth/logout/', { refresh: refreshToken });
      }
    } catch (e) {

    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },

  updateProfile: async (formData) => {
    try {
      const isMultipart = formData instanceof FormData;
      const res = await api.patch('/auth/me/', formData, {
        headers: isMultipart ? { 'Content-Type': 'multipart/form-data' } : {},
      });
      const updatedUser = res.data;
      localStorage.setItem('user_info', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return { success: true, user: updatedUser };
    } catch (err) {
      return { success: false, error: err.response?.data || 'Failed to update profile' };
    }
  },

  fetchProfile: async () => {
    try {
      const res = await api.get('/auth/me/');
      localStorage.setItem('user_info', JSON.stringify(res.data));
      set({ user: res.data, isAuthenticated: true });
    } catch (err) {
      if (err.response?.status === 401) {
        get().logout();
      }
    }
  },
}));
