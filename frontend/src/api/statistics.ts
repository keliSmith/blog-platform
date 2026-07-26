import request from '../utils/request';
import type { Article, ApiResponse, StatisticsItem } from '../types';

export function getHotArticles() {
  return request.get<ApiResponse<Article[]>>('/api/statistics/hot/articles');
}

export function getHotToday() {
  return request.get<ApiResponse<StatisticsItem[]>>('/api/statistics/hot/articles/today');
}

export function getAdminStats() {
  return request.get<ApiResponse<{
    total_users: number;
    total_articles: number;
    total_views: number;
    total_comments: number;
  }>>('/api/admin/stats');
}

export function getHotWeek() {
  return request.get<ApiResponse<StatisticsItem[]>>('/api/statistics/hot/articles/week');
}
