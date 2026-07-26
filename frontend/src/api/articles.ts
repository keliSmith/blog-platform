import request from '../utils/request';
import type { Article, ArticleFormData, ApiResponse, PaginatedResponse } from '../types';
import { dedupeConcurrent } from './dedup';

export interface ArticleListParams {
  page?: number;
  page_size?: number;
  category_id?: number;
  tag_id?: number;
  status?: 'draft' | 'published';
  keyword?: string;
  /** 排序方式：'views' 按热度(浏览量)降序，'latest' 按发布时间降序（默认） */
  sort?: 'views' | 'latest';
}

export function getArticles(params?: ArticleListParams) {
  return request.get<ApiResponse<PaginatedResponse<Article>>>('/api/articles', { params });
}

export function getMyArticles(params?: ArticleListParams) {
  return request.get<ApiResponse<PaginatedResponse<Article>>>('/api/articles/mine', { params });
}

export function getArticle(id: number, opts?: { track_view?: boolean }) {
  return request.get<ApiResponse<Article>>(`/api/articles/${id}`, {
    params: opts?.track_view === false ? { track_view: false } : undefined,
  });
}

export function getArticleBySlug(slug: string, opts?: { track_view?: boolean }) {
  const params = opts?.track_view === false ? { track_view: false } : undefined;
  const key = `GET /api/articles/${slug}?${JSON.stringify(params)}`;
  return dedupeConcurrent(key, () =>
    request.get<ApiResponse<Article>>(`/api/articles/${slug}`, { params }),
  );
}

export function createArticle(data: ArticleFormData) {
  return request.post<ApiResponse<Article>>('/api/articles', data);
}

export function updateArticle(id: number, data: Partial<ArticleFormData>) {
  return request.put<ApiResponse<Article>>(`/api/articles/${id}`, data);
}

export function deleteArticle(id: number) {
  return request.delete<ApiResponse<void>>(`/api/articles/${id}`);
}

export function restoreArticle(id: number) {
  return request.put<ApiResponse<void>>(`/api/articles/${id}/restore`);
}

export function publishArticle(id: number) {
  return request.put<ApiResponse<Article>>(`/api/articles/${id}/publish`);
}

export function unpublishArticle(id: number) {
  return request.put<ApiResponse<Article>>(`/api/articles/${id}/unpublish`);
}
