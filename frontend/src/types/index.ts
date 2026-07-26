export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  role?: string;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  description?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  cover_image?: string;
  views: number;
  status: 'draft' | 'published';
  author_id?: number;
  author_name?: string;
  author?: { id: number; username: string };
  category_id?: number;
  category_name?: string;
  category?: Category | null;
  tags?: Tag[];
  likes?: number;
  like_count?: number;
  liked?: boolean;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Comment {
  id: number;
  content: string;
  article_id?: number;
  user_id?: number;
  user?: { id: number; username: string };
  parent_id?: number | null;
  status?: string;
  replies?: Comment[];
  created_at?: string;
  article?: { id: number; title: string };
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T = unknown> {
  items: T[];
  pagination: Pagination;
}

export interface ArticleFormData {
  title: string;
  slug?: string;
  content: string;
  summary?: string;
  status?: 'draft' | 'published';
  category_id?: number;
  tags?: number[];
  cover_image?: string;
}

export interface CategoryFormData {
  name: string;
  slug: string;
  description?: string;
}

export interface TagFormData {
  name: string;
  slug: string;
  description?: string;
}

export interface StatisticsItem {
  id: number;
  title: string;
  cover_image?: string;
  views: number;
  today_views?: number;
}
