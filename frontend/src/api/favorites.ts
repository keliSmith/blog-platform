import request from '../utils/request';
import type { ApiResponse } from '../types';

export const favoriteArticle = (id: number) =>
  request.post<ApiResponse<{ favorited: boolean; favorites: number }>>(`/api/articles/${id}/favorite`);

export const unfavoriteArticle = (id: number) =>
  request.delete<ApiResponse<{ favorited: boolean; favorites: number }>>(`/api/articles/${id}/favorite`);

export const getFavoriteInfo = (id: number) =>
  request.get<ApiResponse<{ favorited: boolean; favorites: number }>>(`/api/articles/${id}/favorite`);
