import request from '../utils/request';
import type { ApiResponse } from '../types';

export const likeArticle = (id: number) =>
  request.post<ApiResponse<{ liked: boolean; like_count: number }>>(`/api/articles/${id}/like`);

export const unlikeArticle = (id: number) =>
  request.delete<ApiResponse<{ liked: boolean; like_count: number }>>(`/api/articles/${id}/like`);

export const getLikeInfo = (id: number) =>
  request.get<ApiResponse<{ liked: boolean; like_count: number }>>(`/api/articles/${id}/like`);
