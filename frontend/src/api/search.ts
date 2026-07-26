import request from '../utils/request';
import type { Article, ApiResponse, PaginatedResponse } from '../types';

export function searchArticles(params: Record<string, unknown>) {
  return request.get<ApiResponse<PaginatedResponse<Article>>>('/api/search/articles', { params });
}
