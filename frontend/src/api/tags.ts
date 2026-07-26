import request from '../utils/request';
import type { Tag, TagFormData, ApiResponse } from '../types';

export function getTags() {
  return request.get<ApiResponse<Tag[]>>('/api/tags');
}

export function getTag(id: number) {
  return request.get<ApiResponse<Tag>>(`/api/tags/${id}`);
}

export function createTag(data: TagFormData) {
  return request.post<ApiResponse<Tag>>('/api/tags', data);
}

export function updateTag(id: number, data: Partial<TagFormData>) {
  return request.put<ApiResponse<Tag>>(`/api/tags/${id}`, data);
}

export function deleteTag(id: number) {
  return request.delete<ApiResponse<void>>(`/api/tags/${id}`);
}

export function reorderTags(orderedIds: number[]) {
  return request.put<ApiResponse<void>>('/api/tags/reorder', { ordered_ids: orderedIds });
}
