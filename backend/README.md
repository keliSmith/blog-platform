# Blog Platform Backend

基于 **FastAPI** 的博客平台后端 API，支持文章管理、评论系统、点赞收藏、全文搜索、文件上传等功能。
使用 SQLAlchemy 2.0 异步 ORM，开发环境默认使用 SQLite（零配置），生产环境可切换 MySQL。

## 技术栈

| 类别 | 技术 |
|------|------|
| **Web 框架** | FastAPI + Uvicorn (ASGI) |
| **ORM** | SQLAlchemy 2.0 (async) |
| **数据库** | SQLite (开发/测试) / MySQL 8.0 (生产) |
| **认证** | JWT (python-jose) + bcrypt |
| **数据验证** | Pydantic v2 + pydantic-settings |
| **图片处理** | Pillow (WebP 压缩) |
| **数据库迁移** | Alembic |
| **代码质量** | Ruff + MyPy + Black |
| **测试** | pytest + pytest-asyncio + httpx |
| **部署** | Docker + Uvicorn |

## 项目结构

```
backend/
├── app/                        # 应用主包
│   ├── __init__.py
│   ├── main.py                 # FastAPI 应用工厂 + 生命周期
│   ├── config.py               # Pydantic Settings (dev/test/prod)
│   ├── database.py             # 异步 SQLAlchemy 引擎 & 会话
│   ├── dependencies.py         # 认证、权限、分页依赖注入
│   ├── exceptions.py           # 全局异常处理器
│   ├── middleware.py           # 上传 URL 重写中间件
│   ├── api/                    # 路由模块
│   │   ├── __init__.py         # 路由注册
│   │   ├── auth.py             # 注册 / 登录
│   │   ├── articles.py         # 文章 CRUD + 发布/恢复
│   │   ├── categories.py       # 分类管理
│   │   ├── tags.py             # 标签管理
│   │   ├── comments.py         # 评论 (嵌套回复)
│   │   ├── likes.py            # 点赞
│   │   ├── favorites.py        # 收藏
│   │   ├── search.py           # 搜索
│   │   ├── statistics.py       # 热门统计
│   │   ├── upload.py           # 文件上传 (头像/封面/图片)
│   │   ├── users.py            # 用户资料/密码/我的文章
│   │   └── admin.py            # 后台管理
│   ├── models/                 # ORM 模型
│   │   ├── user.py             # 用户
│   │   ├── article.py          # 文章 + article_tags 关联表
│   │   ├── category.py         # 分类
│   │   ├── tag.py              # 标签
│   │   ├── comment.py          # 评论 (自引用嵌套)
│   │   └── interaction.py      # 点赞/收藏/浏览记录
│   ├── schemas/                # Pydantic 模型
│   │   ├── __init__.py         # ApiResponse / ok() / fail()
│   │   └── auth.py             # 注册/登录请求
│   └── utils/                  # 工具函数
│       ├── response.py         # JSON 响应助手
│       └── urls.py             # URL 重写工具
├── tests/                      # 测试套件
│   ├── conftest.py             # pytest fixtures
│   ├── test_auth.py            # 认证测试
│   └── test_articles.py        # 文章测试
├── migrations/                 # Alembic 迁移
│   ├── env.py
│   └── init.sql                # 初始化 SQL
├── uploads/                    # 用户上传文件
├── scripts/                    # 开发脚本
│   ├── dev.sh                  # FastAPI 启动脚本（Linux/macOS）
│   └── dev.bat                 # FastAPI 启动脚本（Windows）
├── pyproject.toml              # 项目元数据 & 依赖 & 工具配置
├── requirements.txt            # pip 依赖
├── .env.example                # 环境变量模板
├── Dockerfile                  # 容器镜像
├── Makefile                    # 任务运行器
├── alembic.ini                 # Alembic 配置
└── API.md                      # API 文档
```

## 快速开始

### 前置要求

- Python >= 3.10
- pip / venv

### 方式零：一键启动脚本（推荐）

项目提供跨平台的一键启动脚本，自动完成「创建虚拟环境 → 安装依赖 → 准备 `.env` → 启动 FastAPI 开发服务器（uvicorn + 热重载）」：

```bash
# Linux / macOS
./scripts/dev.sh

# Windows (PowerShell 或 CMD)
scripts\dev.bat
```

脚本以原生方式运行后端，默认使用 SQLite（开发环境建表由应用启动时 `Base.metadata.create_all` 自动完成）。MySQL/Redis 全栈由项目根目录的 Dev Container（`.devcontainer/docker-compose.yml`）提供，无需本机单独安装；如需在容器外使用 MySQL，可自行准备 MySQL 实例。

### 方式一：零配置启动（SQLite，推荐新手）

开发环境默认使用 SQLite，无需安装 MySQL：

```bash
# 1. 创建虚拟环境
python -m venv venv
source venv/bin/activate        # Linux/macOS
venv\Scripts\activate           # Windows

# 2. 安装依赖
pip install -e ".[dev]"

# 3. 配置环境变量
cp .env.example .env

# 4. 启动开发服务器
python run.py
```

启动后访问：
- API 服务: http://localhost:8000
- Swagger 文档: http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc

数据库文件 `dev.db` 会自动创建，表结构在启动时自动生成。

### 方式二：使用 MySQL

项目推荐通过 **Dev Container** 获得全套栈（应用 + MySQL 8.0 + Redis 7，已内置 `asyncmy` 异步驱动）：

```bash
# 在 VS Code 中执行 Dev Containers: Reopen in Container 后，MySQL/Redis 已随容器启动。
# 只需在 backend/.env 中设置（注意主机名是 compose 服务名 db，不是 127.0.0.1）：
DATABASE_URL=mysql+pymysql://blog_user:blog_password@db:3306/blog?charset=utf8mb4
```

若以原生方式（不使用 Dev Container）连接本机/自有 MySQL，则把主机名改为实际地址并安装驱动：

```bash
# 在 .env 中配置数据库（127.0.0.1 为示例，指向你自己的 MySQL 实例）
DATABASE_URL=mysql+pymysql://blog_user:blog_password@127.0.0.1:3306/blog?charset=utf8mb4

# 安装 MySQL 异步驱动（Dev Container 已预装，可跳过）
pip install -e ".[dev,mysql]"

# 启动服务器
python run.py
```

### 方式三：Docker 部署

```bash
docker build -t blog-backend .
docker run -p 8000:8000 --env-file .env blog-backend
```

## 环境配置

项目使用 Pydantic Settings (`app/config.py`) 管理配置，自动从 `.env` 文件和环境变量加载。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_ENV` | `development` | 运行环境：`development` / `testing` / `production` |
| `DEBUG` | `True` (dev) | 调试模式（开启 Swagger 文档） |
| `LOG_LEVEL` | `DEBUG` (dev) | 日志级别 |
| `SECRET_KEY` | `blog-secret-key` | 应用密钥 |
| `DATABASE_URL` | (空) | 数据库连接 URI，留空则按环境使用默认值 |
| `MYSQL_HOST` | `127.0.0.1` | MySQL 主机 |
| `MYSQL_PORT` | `3306` | MySQL 端口 |
| `MYSQL_USER` | `blog_user` | MySQL 用户名 |
| `MYSQL_PASSWORD` | `blog_password` | MySQL 密码 |
| `MYSQL_DATABASE` | `blog` | MySQL 数据库名 |
| `JWT_SECRET_KEY` | `blog-secret-key` | JWT 签名密钥 |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token 过期时间（分钟） |
| `UPLOAD_FOLDER` | `uploads` | 上传目录 |
| `MAX_UPLOAD_SIZE` | `5242880` | 最大上传大小（字节，默认 5MB） |
| `UPLOAD_BASE_URL` | (空) | 上传文件公开 URL 前缀 |

### 环境配置类

| 环境 | 配置类 | 数据库 | 用途 |
|------|--------|--------|------|
| `development` | `DevelopmentSettings` | SQLite (`dev.db`) | 本地开发 |
| `testing` | `TestingSettings` | SQLite (`test.db`) | 单元测试 |
| `production` | `ProductionSettings` | MySQL (需配置) | 生产部署 |

通过 `APP_ENV` 环境变量切换：

```bash
export APP_ENV=production
```

> **提示**：设置 `DATABASE_URL` 可覆盖任何环境的默认数据库 URI。

## 开发命令

### Makefile

| 命令 | 说明 |
|------|------|
| `make dev` | 一键启动开发环境 |
| `make install` | 安装全部依赖 |
| `make test` | 运行测试 + 覆盖率报告 |
| `make test-quick` | 快速运行测试（无覆盖率） |
| `make lint` | 运行代码检查 (ruff + mypy) |
| `make format` | 格式化代码 (ruff format) |
| `make clean` | 清理缓存文件 |
| `make db-init` | 初始化数据库结构 |

### 常用命令

```bash
# 启动开发服务器（热重载）
python run.py

# 运行测试
pytest tests/ -v -o "addopts="

# 运行测试 + 覆盖率
pytest tests/ -v

# 代码检查
ruff check app/ tests/ migrations/
mypy app/ --ignore-missing-imports

# 代码格式化
ruff format app/ tests/ migrations/
```

## 数据库迁移

项目使用 Alembic 管理数据库迁移，迁移配置会自动从 `app.config.settings` 读取数据库 URI。

```bash
# 生成迁移脚本
alembic revision --autogenerate -m "add_comments_table"

# 查看状态
alembic current

# 应用迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

> **注意**：开发环境下表结构在应用启动时自动创建（`Base.metadata.create_all`），无需手动迁移。

## API 概览

所有 API 返回统一的响应格式：

```json
{
  "success": true,
  "message": "操作描述",
  "data": { ... }
}
```

### 端点列表

| 模块 | 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|------|
| **认证** | POST | `/api/register` | - | 用户注册 |
| | POST | `/api/login` | - | 用户登录 |
| **用户** | GET | `/api/me` | ✓ | 获取当前用户 |
| | GET | `/api/user/profile` | ✓ | 获取个人资料 + 统计 |
| | PUT | `/api/user/profile` | ✓ | 修改资料 |
| | PUT | `/api/user/password` | ✓ | 修改密码 |
| | GET | `/api/user/articles` | ✓ | 我的文章 |
| | GET | `/api/user/comments` | ✓ | 我的评论 |
| | GET | `/api/user/favorites` | ✓ | 我的收藏 |
| **文章** | POST | `/api/articles` | ✓ | 创建文章 |
| | GET | `/api/articles` | - | 文章列表 (分页/筛选/排序) |
| | GET | `/api/articles/mine` | ✓ | 我的文章 (分页) |
| | GET | `/api/articles/{id_or_slug}` | - | 文章详情 |
| | PUT | `/api/articles/{id}` | ✓ | 更新文章 |
| | DELETE | `/api/articles/{id}` | ✓ | 删除文章 (软删除) |
| | PUT | `/api/articles/{id}/restore` | ✓ | 恢复文章 |
| | PUT | `/api/articles/{id}/publish` | ✓ | 发布草稿 |
| **分类** | POST | `/api/categories` | ✓ | 创建分类 |
| | GET | `/api/categories` | - | 分类列表 |
| | GET | `/api/categories/{slug}` | - | 分类下的文章 |
| | PUT | `/api/categories/{id}` | ✓ | 更新分类 |
| | DELETE | `/api/categories/{id}` | ✓ | 删除分类 |
| **标签** | POST | `/api/tags` | ✓ | 创建标签 |
| | GET | `/api/tags` | - | 标签列表 |
| | GET | `/api/tags/{slug}` | - | 标签下的文章 |
| | PUT | `/api/tags/{id}` | ✓ | 更新标签 |
| | DELETE | `/api/tags/{id}` | ✓ | 删除标签 |
| **评论** | POST | `/api/comments/article/{id}` | ✓ | 发表评论 |
| | GET | `/api/comments/article/{id}` | - | 评论列表 (树形) |
| | DELETE | `/api/comments/{id}` | ✓ | 删除评论 |
| **点赞** | POST | `/api/articles/{id}/like` | ✓ | 点赞 |
| | DELETE | `/api/articles/{id}/like` | ✓ | 取消点赞 |
| | GET | `/api/articles/{id}/like` | - | 点赞状态 |
| **收藏** | POST | `/api/articles/{id}/favorite` | ✓ | 收藏 |
| | DELETE | `/api/articles/{id}/favorite` | ✓ | 取消收藏 |
| | GET | `/api/articles/{id}/favorite` | ✓ | 收藏状态 |
| **搜索** | GET | `/api/search/articles?keyword=` | - | 搜索文章 |
| **统计** | GET | `/api/statistics/hot/articles` | - | 热门文章 (总浏览) |
| | GET | `/api/statistics/hot/today` | - | 今日热门 |
| | GET | `/api/statistics/hot/week` | - | 本周热门 |
| **上传** | POST | `/api/upload/avatar` | ✓ | 上传头像 |
| | POST | `/api/upload/cover` | ✓ | 上传封面 |
| | POST | `/api/upload/image` | ✓ | 上传文章图片 |
| **管理** | GET | `/api/admin/stats` | admin | 后台仪表盘 |
| | GET | `/api/admin/comments` | admin | 评论管理列表 |
| | PUT | `/api/admin/comments/{id}/status` | admin | 更新评论状态 |

> 完整的 API 请求/响应示例请查看 [API.md](API.md) 或启动后访问 http://localhost:8000/docs

## 认证机制

- **注册**：`POST /api/register` → 创建用户，密码使用 bcrypt 哈希存储
- **登录**：`POST /api/login` → 验证密码，返回 JWT Token
- **认证**：请求头 `Authorization: Bearer <token>` 或 Cookie `access_token`
- **权限**：普通用户 (`role='user'`) 和管理员 (`role='admin'`)
- **文章权限**：仅作者可编辑/删除自己的文章，管理员可查看所有文章

## 代码质量

| 工具 | 用途 | 配置 |
|------|------|------|
| **Ruff** | 代码规范检查 + 格式化 | `pyproject.toml` → `[tool.ruff]` |
| **MyPy** | 类型检查 | `pyproject.toml` → `[tool.mypy]` |
| **Black** | 代码格式化 (兼容) | `pyproject.toml` → `[tool.black]` |
| **pytest** | 单元测试 + 覆盖率 | `pyproject.toml` → `[tool.pytest]` |

```bash
# 检查代码规范
ruff check app/ tests/ migrations/

# 类型检查
mypy app/ --ignore-missing-imports

# 运行全部测试
pytest tests/ -v

# 格式化代码
ruff format app/ tests/ migrations/
```

## 测试

测试使用 SQLite（无需 MySQL），通过 `APP_ENV=testing` 自动切换。

```bash
# 运行测试
pytest tests/ -v -o "addopts="

# 运行测试 + 覆盖率报告
pytest tests/ -v
# 覆盖率报告: htmlcov/index.html
```

测试覆盖：
- 用户注册（成功 / 重复用户名）
- 用户登录（成功 / 密码错误）
- JWT 认证（有/无 Token）
- 文章 CRUD（创建 / 列表 / 详情 / 更新）
- 搜索 & 统计接口

## 文件上传

上传的图片会通过 Pillow 自动压缩为 WebP 格式：

| 类型 | 最大尺寸 | 压缩质量 | 路径 |
|------|----------|----------|------|
| 头像 | 800×800 | 85% | `/uploads/avatar/` |
| 封面 | 1200×1200 | 85% | `/uploads/cover/` |
| 文章图片 | 1600×1600 | 85% | `/uploads/image/` |

支持的格式：JPG、PNG、GIF、WebP（最大 5MB）。

上传 URL 会通过中间件自动重写为绝对路径，便于跨域访问。

## CI/CD

GitHub Actions 配置在 `.github/workflows/`，包含：

1. **Lint** — Ruff 规范检查 + MyPy 类型检查
2. **Test** — 运行测试套件 + 覆盖率报告
3. **Docker** — 构建生产容器镜像
