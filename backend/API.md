# Blog Platform API Documentation

Base URL: `http://localhost:8000`

## Authentication

Most endpoints require JWT authentication via `Authorization: Bearer <token>` header.

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <jwt_token>` |
| `Content-Type` | `application/json` |

---

## 1. 用户认证 (Auth)

### POST /api/register
注册新用户。

**Request Body:**
```json
{"username": "string", "email": "string", "password": "string"}
```

**Response 200:**
```json
{"success": true, "message": "注册成功", "data": {"token": "jwt..."}}
```

### POST /api/login
用户登录。

**Request Body:**
```json
{"username": "string", "password": "string"}
```

**Response 200:**
```json
{"success": true, "message": "登录成功", "data": {"token": "jwt..."}}
```

---

## 2. 用户 (User)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/me | ✅ JWT | 获取当前用户信息 |
| GET | /api/user/profile | ✅ JWT | 获取用户详细资料 |
| PUT | /api/user/profile | ✅ JWT | 更新用户资料 |
| PUT | /api/user/password | ✅ JWT | 修改密码 |
| GET | /api/user/articles | ✅ JWT | 获取我的文章列表 |
| GET | /api/user/comments | ✅ JWT | 获取我的评论（分页） |
| GET | /api/user/favorites | ✅ JWT | 获取我的收藏（分页） |

### GET /api/me
```json
{"success": true, "data": {"id": 1, "username": "...", "email": "...", "created_at": "..."}}
```

### PUT /api/user/profile
```json
{"username": "string", "email": "string"}
```

### PUT /api/user/password
```json
{"old_password": "string", "new_password": "string"}
```

### GET /api/user/comments?page=1&page_size=10
### GET /api/user/favorites?page=1&page_size=10

---

## 3. 文章 (Articles)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/articles | ❌ 公开 | 文章列表（分页） |
| POST | /api/articles | ✅ JWT | 创建文章 |
| GET | /api/articles/:id | ❌ 公开 | 文章详情（按ID） |
| GET | /api/articles/:slug | ❌ 公开 | 文章详情（按slug） |
| PUT | /api/articles/:id | ✅ JWT | 更新文章 |
| DELETE | /api/articles/:id | ✅ JWT | 删除文章（软删除） |
| PUT | /api/articles/:id/restore | ✅ JWT | 恢复已删除文章 |
| PUT | /api/articles/:id/publish | ✅ JWT | 发布文章 |
| PUT | /api/articles/:id/unpublish | ✅ JWT | 取消发布 |
| GET | /api/articles/search | ❌ 公开 | 搜索文章 |

### GET /api/articles?page=1&page_size=10&keyword=&category=&status=published&sort=latest
**Query Parameters:**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码，默认1 |
| page_size | int | 每页数量，默认10 |
| keyword | string | 搜索关键词 |
| category | string | 分类slug |
| status | string | 状态：draft / published |
| sort | string | 排序：latest / views |

**Response:**
```json
{"success": true, "data": {"items": [...], "pagination": {"page": 1, "page_size": 10, "total": 100, "pages": 10}}}
```

### POST /api/articles
```json
{"title": "string", "slug": "string", "content": "string", "summary": "string", "status": "draft", "category_id": 1, "tags": [1,2]}
```

### GET /api/articles/:id
**Response:**
```json
{"success": true, "data": {"id": 1, "title": "...", "slug": "...", "content": "...", "author": {"id": 1, "username": "..."}, "category": {"id": 1, "name": "...", "slug": "..."}, "tags": [...], "views": 10, "likes": 5, "liked": false}}
```

### PUT /api/articles/:id
```json
{"title": "string", "slug": "string", "content": "string", "status": "published", "cover_image": "url", "tags": [1,2]}
```

### GET /api/articles/search?keyword=xxx&page=1&page_size=10
支持 FULLTEXT 搜索 + 分类/标签筛选。

---

## 4. 分类 (Categories)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/categories | ❌ 公开 | 获取所有分类 |
| POST | /api/categories | ✅ JWT | 创建分类 |
| GET | /api/categories/:slug | ❌ 公开 | 分类详情（含文章） |
| PUT | /api/categories/:id | ✅ JWT | 更新分类 |
| DELETE | /api/categories/:id | ✅ JWT | 删除分类 |

### POST /api/categories
```json
{"name": "string", "slug": "string", "description": "string"}
```

### GET /api/categories/:slug
**Response:** 分类信息 + 该分类下所有文章列表

---

## 5. 标签 (Tags)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/tags | ❌ 公开 | 获取所有标签 |
| POST | /api/tags | ✅ JWT | 创建标签 |
| GET | /api/tags/:slug | ❌ 公开 | 标签详情（含文章） |
| PUT | /api/tags/:id | ✅ JWT | 更新标签 |
| DELETE | /api/tags/:id | ✅ JWT | 删除标签 |

### POST /api/tags
```json
{"name": "string", "slug": "string", "description": "string"}
```

---

## 6. 评论 (Comments)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/comments | ✅ JWT | 发表评论 |
| GET | /api/comments/article/:articleId | ❌ 公开 | 获取文章评论 |
| DELETE | /api/comments/:id | ✅ JWT | 删除评论 |

### POST /api/comments
```json
{"article_id": 1, "content": "string", "parent_id": null}
```
`parent_id` 可选，用于回复评论。

### GET /api/comments/article/:articleId
返回评论树（顶级评论 + 嵌套回复）。

```json
{"success": true, "data": {"items": [{"id": 1, "content": "...", "user": {"id": 1, "username": "..."}, "replies": [...]}]}}
```

---

## 7. 点赞 (Likes)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/articles/:id/like | ✅ JWT | 点赞文章 |
| DELETE | /api/articles/:id/like | ✅ JWT | 取消点赞 |
| GET | /api/articles/:id/like | ❌ 公开 | 获取点赞数 |

---

## 8. 收藏 (Favorites)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/articles/:id/favorite | ✅ JWT | 收藏文章 |
| DELETE | /api/articles/:id/favorite | ✅ JWT | 取消收藏 |
| GET | /api/articles/:id/favorite | ✅ JWT | 获取收藏状态 |
| GET | /api/user/favorites | ❌ 公开 | 获取用户收藏列表 |

---

## 9. 搜索 (Search)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/search/articles | ❌ 公开 | 全文搜索文章 |

### GET /api/search/articles?keyword=xxx&category_id=1&tag_id=1&page=1&page_size=10
使用 MySQL FULLTEXT 搜索，支持分类/标签筛选。

**Response:**
```json
{"success": true, "data": {"items": [...], "pagination": {...}}}
```

---

## 10. 文件上传 (Upload)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/upload/avatar | ✅ JWT | 上传头像 |
| POST | /api/upload/cover | ✅ JWT | 上传文章封面 |

使用 `multipart/form-data` 格式上传文件。

**Request:** FormData with `file` field
**Response:**
```json
{"success": true, "data": {"url": "/uploads/avatar/xxx.webp"}}
```

支持格式: jpg, jpeg, png, gif, webp
最大文件大小: 5MB
图片自动压缩为 WebP 格式。

---

## 11. 统计 (Statistics)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/statistics/hot/articles | ❌ 公开 | 热门文章 |
| GET | /api/statistics/hot/today | ❌ 公开 | 今日热门 |
| GET | /api/statistics/hot/week | ❌ 公开 | 本周热门 |

### GET /api/statistics/hot/articles?limit=10
**Response:**
```json
{"success": true, "data": [{"id": 1, "title": "...", "views": 100, "today_views": 5}]}
```

---

## 12. 后台管理 (Admin)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/admin/comments | ✅ JWT + Admin | 评论管理列表 |
| PUT | /api/admin/comments/:id/status | ✅ JWT + Admin | 更新评论状态 |

### GET /api/admin/comments?status=pending
`status` 可选值: pending, approved, rejected

### PUT /api/admin/comments/:id/status
```json
{"status": "approved"}
```

---

## Error Response Format

### 400 Bad Request
```json
{"success": false, "message": "错误描述"}
```

### 401 Unauthorized
```json
{"success": false, "message": "Missing Authorization Header"}
```

### 403 Forbidden
```json
{"success": false, "message": "无管理员权限"}
```

### 404 Not Found
```json
{"success": false, "message": "文章不存在"}
```

### 413 Payload Too Large
```json
{"success": false, "message": "图片不能超过5MB"}
```

### 500 Server Error
```json
{"success": false, "message": "服务器内部错误"}
```

---

## 通用响应格式

### 成功
```json
{"success": true, "message": "success", "data": {...}}
```

### 分页成功
```json
{"success": true, "data": {"items": [...], "pagination": {"page": 1, "page_size": 10, "total": 100, "pages": 10}}}
```

### 失败
```json
{"success": false, "message": "错误信息"}
```
