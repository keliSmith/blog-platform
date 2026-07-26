import request from '../utils/request';
import type { ApiResponse, User } from '../types';

export type Channel = 'email' | 'sms';
export type CodePurpose = 'register' | 'reset';

export interface SendCodeData {
  target: string;
  channel: Channel;
  purpose: CodePurpose;
}

export interface RegisterData {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  email_code?: string;
  phone_code?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface ResetPasswordData {
  target: string;
  channel: Channel;
  code: string;
  new_password: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export function sendCode(data: SendCodeData) {
  return request.post<ApiResponse<{ expires_in?: number; dev_code?: string }>>(
    '/api/auth/send-code',
    data,
  );
}

export function register(data: RegisterData) {
  return request.post<ApiResponse<AuthResult>>('/api/register', data);
}

export function login(data: LoginData) {
  return request.post<ApiResponse<AuthResult>>('/api/login', data);
}

export function resetPassword(data: ResetPasswordData) {
  return request.post<ApiResponse<unknown>>('/api/auth/reset-password', data);
}
