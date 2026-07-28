import axios, { type AxiosRequestConfig } from 'axios';
import { Modal } from 'antd';
import { getT } from '../i18n';
import { useThemeStore } from '../store/themeStore';

// Guard so a burst of 403 need_verify responses doesn't stack multiple modals.
let verifyGuideShown = false;

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
    } else if (status === 403) {
      // Trust-restricted action (PRD §4.8 VF-4): the account is unverified and
      // past the grace period. Guide the user to the verification page instead
      // of just showing a toast.
      const data = error.response?.data as { message?: string; data?: { need_verify?: boolean } } | undefined;
      if (data?.data?.need_verify && !verifyGuideShown) {
        verifyGuideShown = true;
        const lang = useThemeStore.getState().lang;
        Modal.confirm({
          title: getT(lang)('verifyTitle'),
          content: data?.message || getT(lang)('verifyReminder'),
          okText: getT(lang)('verifyNow'),
          cancelText: getT(lang)('cancel'),
          onOk: () => {
            window.location.href = '/profile';
          },
          onClose: () => {
            verifyGuideShown = false;
          },
          afterClose: () => {
            verifyGuideShown = false;
          },
        });
      }
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
