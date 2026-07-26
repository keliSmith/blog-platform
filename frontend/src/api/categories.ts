import request from '../utils/request';
import type { Category, CategoryFormData, ApiResponse } from '../types';

export function getCategories() {
  return request.get<ApiResponse<Category[]>>('/api/categories');
}

export function getCategory(id: number) {
  return request.get<ApiResponse<Category>>(`/api/categories/${id}`);
}

export function createCategory(data: CategoryFormData) {
  return request.post<ApiResponse<Category>>('/api/categories', data);
}

export function updateCategory(id: number, data: Partial<CategoryFormData>) {
  return request.put<ApiResponse<Category>>(`/api/categories/${id}`, data);
}

export function deleteCategory(id: number) {
  return request.delete<ApiResponse<void>>(`/api/categories/${id}`);
}

export function reorderCategories(orderedIds: number[]) {
  return request.put<ApiResponse<void>>('/api/categories/reorder', { ordered_ids: orderedIds });
}
