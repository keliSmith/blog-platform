import axios, { type AxiosRequestConfig } from 'axios';
import { getT } from '../i18n';
import { useThemeStore } from '../store/themeStore';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

const request = axios.create({
  baseURL: '/',
  timeout: 15000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
    }
  return config;
});

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Auth failures (401 invalid/missing/expired token) should clear the
    // local token and send the user back to login so they can re-authenticate.
    // NOTE: 422 is a *request validation* error (bad params), NOT an auth
    // failure — do NOT treat it as "logged out", otherwise unrelated 422s
    // (e.g. a malformed body) would wrongly bounce the user to /login.
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    const data = error.response?.data as { message?: string } | undefined;
    const msg = data?.message || error.message || getT(useThemeStore.getState().lang)('requestFailed');
    return Promise.reject(new Error(msg));
  }
);

type PatchedRequest = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
};

export default request as unknown as PatchedRequest;
