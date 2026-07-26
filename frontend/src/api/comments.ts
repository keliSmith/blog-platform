import request from '../utils/request';
import type { Comment, ApiResponse } from '../types';
import { dedupeConcurrent } from './dedup';

export interface CommentFormData {
  content: string;
  parent_id?: number | null;
}

export function getArticleComments(articleId: number) {
  const key = `GET /api/comments/article/${articleId}`;
  return dedupeConcurrent(key, () =>
    request.get<ApiResponse<{ items: Comment[] }>>(`/api/comments/article/${articleId}`),
  );
}

export function createComment(articleId: number, data: CommentFormData) {
  return request.post<ApiResponse<Comment>>(`/api/comments/article/${articleId}`, data);
}

export function deleteComment(commentId: number) {
  return request.delete<ApiResponse<void>>(`/api/comments/${commentId}`);
}
