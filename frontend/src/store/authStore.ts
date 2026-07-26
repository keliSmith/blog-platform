import { create } from 'zustand';
import type { User, ApiResponse } from '../types';
import request from '../utils/request';
import { getT } from '../i18n';
import { useThemeStore } from './themeStore';
import * as authApi from '../api/auth';
import type { RegisterData } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (username: string, password: string) => Promise<string>;
  register: (data: RegisterData) => Promise<string>;
  resetPassword: (data: authApi.ResetPasswordData) => Promise<string>;
  fetchProfile: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,

  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
    set({ token });
  },

  login: async (username, password) => {
    const res = await authApi.login({ username, password });
    if (res?.success && res?.data?.token) {
      localStorage.setItem('token', res.data.token);
      set({ token: res.data.token, user: res.data.user });
      return getT(useThemeStore.getState().lang)('loginSuccess');
    }
    throw new Error(res?.message || getT(useThemeStore.getState().lang)('loginFail'));
  },

  register: async (data) => {
    const res = await authApi.register(data);
    if (res?.success && res?.data?.token) {
      localStorage.setItem('token', res.data.token);
      set({ token: res.data.token, user: res.data.user });
      return getT(useThemeStore.getState().lang)('registerSuccess');
    }
    throw new Error(res?.message || getT(useThemeStore.getState().lang)('registerFail'));
  },

  resetPassword: async (data) => {
    const res = await authApi.resetPassword(data);
    if (res?.success) {
      return getT(useThemeStore.getState().lang)('resetSuccess');
    }
    throw new Error(res?.message || getT(useThemeStore.getState().lang)('resetFail'));
  },

  fetchProfile: async () => {
    try {
      const res = await request.get<ApiResponse<User>>('/api/me');
      if (res?.success && res?.data) {
        set({ user: res.data });
      }
    } catch {
      set({ user: null, token: null });
      localStorage.removeItem('token');
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, loading: false });
  },
}));
