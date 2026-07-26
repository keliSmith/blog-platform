import request from '../utils/request';
import type { ApiResponse } from '../types';

export function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post<ApiResponse<{ url: string }>>('/api/upload/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function uploadCover(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post<ApiResponse<{ url: string }>>('/api/upload/cover', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post<ApiResponse<{ url: string }>>('/api/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
