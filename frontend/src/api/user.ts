import request from '../utils/request';
import type { User, Article, Comment, ApiResponse, PaginatedResponse } from '../types';

export interface ProfileUpdateData {
  username?: string;
  email?: string;
  avatar?: string;
}

export interface PasswordUpdateData {
  old_password: string;
  new_password: string;
}

export function getProfile() {
  return request.get<ApiResponse<User>>('/api/user/profile');
}

export function updateProfile(data: ProfileUpdateData) {
  return request.put<ApiResponse<User>>('/api/user/profile', data);
}

export function getMyArticles(params?: { page?: number; page_size?: number }) {
  return request.get<ApiResponse<PaginatedResponse<Article>>>('/api/user/articles', { params });
}

export function getMyComments(params?: { page?: number; page_size?: number }) {
  return request.get<ApiResponse<PaginatedResponse<Comment>>>('/api/user/comments', { params });
}

export function getMyFavorites(params?: { page?: number; page_size?: number }) {
  return request.get<ApiResponse<PaginatedResponse<Article>>>('/api/user/favorites', { params });
}

export function updatePassword(data: PasswordUpdateData) {
  return request.put<ApiResponse<void>>('/api/user/password', data);
}
