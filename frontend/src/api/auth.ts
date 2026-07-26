import request from '../utils/request';

export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: import('../types').User;
}

export function login(data: LoginData) {
  return request.post<import('../types').ApiResponse<AuthResult>>('/api/auth/login', data);
}

export function register(data: RegisterData) {
  return request.post<import('../types').ApiResponse<AuthResult>>('/api/auth/register', data);
}
