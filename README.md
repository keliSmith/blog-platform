# Blog Platform · 博客平台

一个功能完整的全栈博客系统：**FastAPI** 异步后端 + **React 19 / Vite** 前端，支持文章创作（富文本 / Markdown）、评论、点赞、收藏、全文搜索、标签分类、文件上传与管理后台。开箱即用，开发环境零配置（默认 SQLite），生产可切换 MySQL。

---

## 目录

- [整体架构](#整体架构)
- [技术栈](#技术栈)
- [项目目录结构](#项目目录结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [访问地址](#访问地址)
- [配置说明](#配置说明)
- [数据库](#数据库)
- [API 文档](#api-文档)
- [开发指南](#开发指南)
- [部署](#部署)
- [项目约定与踩坑](#项目约定与踩坑)
- [更多文档](#更多文档)

---

## 整体架构

本仓库是一个 **monorepo**，包含相互独立的两个子项目（`backend/` 与 `frontend/`），通过 HTTP API 通信。开发中前端由 Vite 反向代理把 `/api` 与 `/uploads` 转发到后端，因此前端代码里只需写相对路径。

```
┌─────────────────────────┐         ┌──────────────────────────┐
│   Frontend (React/Vite) │         │   Backend (FastAPI)       │
│   http://localhost:3000 │         │   http://localhost:8000   │
│                         │  /api   │                           │
│  src/ (pages, components│ ───────▶ │  app/                     │
│  , store, api, i18n)    │  /uploads│   ├─ api/   (routers)     │
│                         │ ◀─────── │   ├─ models/ (ORM)        │
│  Vite dev server + proxy│         │   ├─ schemas/ (Pydantic)  │
└─────────────────────────┘         │   └─ main.py (app factory)│
                                     └───────────┬──────────────┘
                                                 │ (SQLAlchemy async)
                                     ┌───────────┴──────────────┐
                                     │  MySQL 8.0 (Dev Container)│
                                     │  Redis 7  (Dev Container)│
                                     └──────────────────────────┘
```

- **请求流**：浏览器 → 前端 3000 →（Vite 代理）→ 后端 8000 → 数据库。
- **基础设施**：MySQL 8.0 与 Redis 7 由 Dev Container（`.devcontainer/docker-compose.yml`）一并提供，应用进程也在容器内运行；若选择原生本地开发，应用可直接前台运行（默认 SQLite，无需数据库服务）。
- **鉴权**：JWT（`python-jose` + `bcrypt`），通过 `Authorization: Bearer <token>` 或 Cookie 传递。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + TypeScript + Vite 6 |
| 前端 UI | Ant Design 6、Zustand 5（状态）、React Router 7 |
| 富文本 | Tiptap 3（斜杠命令 / 图片 / 任务列表 / 公式 KaTeX） |
| 图表 | ECharts 6 |
| 后端框架 | FastAPI + Uvicorn（ASGI） |
| ORM | SQLAlchemy 2.0 异步 |
| 数据库 | SQLite（开发/测试）/ MySQL 8.0（生产） |
| 认证 | JWT（python-jose）+ bcrypt |
| 校验 | Pydantic v2 + pydantic-settings |
| 图片处理 | Pillow（自动压缩为 WebP） |
| 迁移 | Alembic |
| 质量 | Ruff + MyPy + pytest |
| 基础设施 | Docker（Dev Container 全套栈） |

---

## 项目目录结构

```
blog-platform/
├── backend/                  # FastAPI 后端（见 backend/README.md）
│   ├── app/
│   │   ├── main.py           # FastAPI 应用工厂 + 生命周期（自动建表）
│   │   ├── config.py         # Pydantic Settings（dev/test/prod）
│   │   ├── database.py       # 异步引擎 & 会话
│   │   ├── dependencies.py   # 认证 / 权限 / 分页依赖注入
│   │   ├── middleware.py     # 上传 URL 重写中间件
│   │   ├── api/              # 路由：auth/articles/comments/.../admin
│   │   ├── models/           # ORM 模型：user/article/comment/...
│   │   ├── schemas/          # Pydantic 模型与统一响应 ApiResponse
│   │   └── utils/            # 响应助手 / URL 工具
│   ├── migrations/           # Alembic 迁移
│   ├── tests/                # pytest 测试套件
│   ├── uploads/              # 用户上传文件（运行时生成，已 gitignore）
│   ├── scripts/              # 开发脚本（dev.sh / dev.bat / make_admin.py）
│   ├── run.py                # 开发服务器入口（uvicorn，热重载）
│   ├── pyproject.toml        # 依赖与工具配置
│   ├── requirements.txt
│   ├── .env.example          # 环境变量模板
│   ├── Dockerfile
│   ├── Makefile
│   └── API.md                # 完整 API 端点说明
│
├── frontend/                 # React 前端（见 frontend/README.md）
│   ├── src/
│   │   ├── pages/            # 路由页面（Home/Login/ArticleEditor/Admin...）
│   │   ├── components/       # 公共组件（AppLayout/ArticleCard/编辑器...）
│   │   ├── api/              # axios 封装的接口层
│   │   ├── store/            # Zustand 状态（auth/theme）
│   │   ├── i18n/             # 中英文国际化
│   │   └── utils/ types/ styles/
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts        # 代理 /api、/uploads → :8000
│   └── package.json
│
├── scripts/                  # 仓库级启动脚本（Windows PowerShell）
│   ├── start.ps1             # 一键启动：后端 + 前端（原生，默认 SQLite）
│   ├── bootstrap.ps1         # 初始化环境（装依赖）
│   ├── migrate.ps1 / reset_db.ps1 / health_check.ps1 / check_env.ps1
│   ├── check-backend.ps1 / check-backend.bat  # 检测/修复"陈旧后端"
├── .devcontainer/            # Dev Container 全套栈（app + MySQL 8.0 + Redis 7）
└── .gitignore                # 忽略 venv / 缓存 / 数据库 / 上传文件
```

> 虚拟环境说明：后端实际使用了两个 venv——`backend/venv`（供 `scripts/bootstrap.ps1`、`migrate.ps1`、`dev.sh`/`dev.bat` 等脚本使用）与 `backend/.venv`（供编辑器/IDE 作为 Python 解释器）。根目录旧的 `.venv`（Flask 时代残留，无 FastAPI）已在整理时删除。

---

## 环境要求

- **Python** ≥ 3.10（建议使用 3.13 / 3.14）
- **Node.js** ≥ 18（建议 20+）
- **Docker / Docker Desktop**（必装，用于运行 Dev Container；其内置 MySQL 8.0 + Redis 7。若仅做纯 SQLite 原生本地开发则不需要 Docker）

---

## 快速开始

### 方式一：Dev Container（推荐，全栈一键）

前置：安装 **Docker / Docker Desktop** 与 VS Code 扩展 **Dev Containers**（Remote - Containers）。

1. 用 VS Code 打开本仓库根目录；
2. 按 `F1` 打开命令面板，执行 **`Dev Containers: Reopen in Container`**；
3. 首次会构建镜像并安装后端 `venv` 与前端 `node_modules`（稍慢，之后有缓存很快）。

容器启动即包含**全套栈**：
- 后端（FastAPI）在容器内运行，监听 `8000`；
- 前端（Vite）在容器内运行，监听 `3000`；
- **MySQL 8.0** 与 **Redis 7** 作为配套服务一并启动，应用**默认直接连容器内的 MySQL**（无需改 `.env`；若需切回 SQLite 或自定义连接，见「数据库」）。

在容器内的终端启动应用：

```bash
# 后端
cd backend && source .venv/bin/activate && python run.py
# 前端（另开一个终端）
cd frontend && npm run dev
```

浏览器打开 http://localhost:3000 即可。

### 方式二：原生本地启动（无容器，默认 SQLite）

#### 1) 一键启动（Windows）

在仓库根目录以 PowerShell 运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

`start.ps1` 会自动建 `backend/venv`、装依赖、复制 `.env`，并分别开新窗口启动后端(8000)与前端(3000)，默认使用 SQLite（零配置）。

#### 2) 分步手动启动（跨平台）

```bash
cd backend

# 创建并激活虚拟环境（项目实际用 backend/venv）
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows

# 安装依赖（[dev] 含测试/lint 工具）
pip install -e ".[dev]"

# 准备环境变量（按需修改）
cp .env.example .env

# 启动开发服务器（热重载，自动建表）
python run.py
```

后端监听 `http://localhost:8000`，表结构在启动时由 `Base.metadata.create_all` 自动创建（开发环境无需手动迁移）。

#### 3) 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器监听 `http://localhost:3000`，通过 Vite 代理把 `/api`、`/uploads` 转发到后端 8000。

> 原生方式不含 MySQL/Redis；需要 MySQL/Redis 全栈请改用「方式一 Dev Container」。

---

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端站点 | http://localhost:3000 | 博客 Web 界面 |
| 后端 API | http://localhost:8000 | REST API 根 |
| Swagger 文档 | http://localhost:8000/docs | 交互式 API 文档（DEBUG 开启时） |
| ReDoc 文档 | http://localhost:8000/redoc | 备用 API 文档 |
| MySQL | localhost:3306 | 数据库（docker） |
| Redis | localhost:6379 | 缓存/队列（docker） |

前端路由速览：`/`（首页）、`/articles/:slug`（文章详情）、`/login`、`/register`、`/write` 与 `/edit/:id`（写文章，需登录）、`/profile`、`/my-articles`、`/favorites`、`/admin`（管理后台，需 admin 角色）。

---

## 配置说明

后端使用 Pydantic Settings（`backend/app/config.py`），从 `.env` 文件与环境变量加载。复制 `.env.example` 为 `.env` 后按需修改。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_ENV` | `development` | 运行环境：`development` / `testing` / `production` |
| `DEBUG` | `True`(dev) | 调试模式（开启 Swagger/ReDoc） |
| `SECRET_KEY` | `blog-secret-key` | 应用密钥 |
| `DATABASE_URL` | (空) | 数据库连接 URI，留空则按环境取默认值 |
| `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` | `127.0.0.1`/`3306`/`blog_user`/`blog_password`/`blog` | MySQL 连接 |
| `JWT_SECRET_KEY` | `blog-secret-key` | JWT 签名密钥 |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token 有效期（分钟） |
| `UPLOAD_FOLDER` | `uploads` | 上传目录 |
| `MAX_UPLOAD_SIZE` | `5242880` | 最大上传（字节，默认 5MB） |
| `UPLOAD_BASE_URL` | (空) | 上传文件公开 URL 前缀（生产建议设置） |

环境对应数据库：

| 环境 | 数据库 | 用途 |
|------|--------|------|
| `development` | SQLite `dev.db`（原生本地）/ MySQL（Dev Container 内，默认） | 本地开发 |
| `testing` | SQLite `test.db` | 单元测试 |
| `production` | MySQL | 生产部署 |

> 设置 `DATABASE_URL` 可覆盖任何环境的默认数据库 URI。

---

## 数据库

- **Dev Container 内开发**：已默认连容器内的 MySQL——`DATABASE_URL` 由 `.devcontainer/docker-compose.yml` 的 `app` 服务注入，主机名 `db`，无需手动改 `.env` 即可用上全套栈。想临时切回 SQLite 或在 `.env` 中自定义连接，覆盖 `DATABASE_URL` 即可（进程环境变量优先级高于 `.env` 文件）。
- **原生本地开发（不在容器内）**：默认 SQLite，应用启动时自动建表，零配置，无需任何数据库服务。
- **手动使用 Dev Container 内的 MySQL（覆盖默认值）**：也可在 `backend/.env` 显式设置（主机名用 compose 服务名 `db`，**不是** `127.0.0.1`）：
  ```
  DATABASE_URL=mysql+pymysql://blog_user:blog_password@db:3306/blog?charset=utf8mb4
  ```
  异步驱动 `asyncmy` 已在 Dev Container 中预装（`post-create` 执行 `pip install -e ".[dev,mysql]"`），无需再装。
- **原生本地连自有 MySQL**：把主机名改为实际地址（如 `127.0.0.1`）并 `pip install -e ".[dev,mysql]"`。
- **迁移**：使用 Alembic（`migrations/`），配置自动从 `app.config.settings` 读取数据库 URI。
  ```bash
  alembic revision --autogenerate -m "describe change"
  alembic upgrade head
  ```
- **创建管理员**：
  ```bash
  python scripts/make_admin.py <用户名> <邮箱> <密码>
  ```

---

## API 文档

所有接口统一返回 `{ success, message, data }` 结构，路径前缀为 `/api`。

- 交互式文档：启动后访问 http://localhost:8000/docs
- 完整端点列表与示例：见 [backend/API.md](backend/API.md)
- 后端专项说明：见 [backend/README.md](backend/README.md)

主要模块：`auth`（注册/登录）、`articles`（文章 CRUD/发布/恢复）、`categories` / `tags`、`comments`（嵌套回复）、`likes` / `favorites`、`search`、`statistics`（热门）、`upload`（头像/封面/图片）、`admin`（后台）。

---

## 开发指南

仓库根 `backend/` 下提供 `Makefile` 便捷命令：

```bash
make install      # 安装依赖
make dev          # 一键开发环境
make test         # 运行测试 + 覆盖率
make test-quick   # 快速测试（无覆盖率）
make lint         # ruff + mypy
make format       # ruff format
make clean        # 清理缓存
```

常用命令（在 `backend/` 内）：

```bash
python run.py                       # 启动后端（热重载）
pytest tests/ -v -o "addopts="     # 运行测试
ruff check app/ tests/ migrations/ # 代码检查
mypy app/ --ignore-missing-imports # 类型检查
ruff format app/ tests/ migrations/# 格式化
```

前端（在 `frontend/` 内）：

```bash
npm run dev        # 开发服务器
npm run build      # 生产构建（输出 dist/）
npm run preview    # 预览构建产物
npm run lint       # ESLint
```

CI：GitHub Actions 配置于 `backend/.github/workflows/ci.yml`，包含 Lint / Test / Docker 构建。

---

## 仓库级脚本（scripts/）

仓库根目录 `scripts/` 下是一组 Windows PowerShell 启动 / 运维脚本，均需以**管理员或普通 PowerShell** 在仓库根目录运行：

```powershell
# 一键启动：docker 基础设施 + 后端 + 前端（开发首选）
powershell -ExecutionPolicy Bypass -File scripts/start.ps1

# 初始化环境（创建 venv、装依赖、初始化数据库）
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1

# 仅检查本地环境（Python / Node / Docker）
powershell -ExecutionPolicy Bypass -File scripts/check_env.ps1

# 健康检查（需先启动后端，访问 GET /api/health）
powershell -ExecutionPolicy Bypass -File scripts/health_check.ps1

# 生成并应用 Alembic 迁移（可带 -message 参数）
powershell -ExecutionPolicy Bypass -File scripts/migrate.ps1 -message "描述本次变更"

# ⚠️ 重置数据库（破坏性）：删除 SQLite dev.db/test.db 并重建 Docker MySQL 卷
powershell -ExecutionPolicy Bypass -File scripts/reset_db.ps1

# 检查运行中的后端是否对应最新代码（仅诊断，不重启）
powershell -ExecutionPolicy Bypass -File scripts/check-backend.ps1

# 检查 + 自动清理 8000 端口并以当前代码重启后端（修复"陈旧后端"）
powershell -ExecutionPolicy Bypass -File scripts/check-backend.ps1 -Fix
```

| 脚本 | 用途 | 说明 / 注意 |
|------|------|------|
| `start.ps1` | 一键启动全栈 | 自动建 `backend/venv`、按需装依赖（`pip install -e ".[dev]"`）、复制 `.env`、尽力启动 Docker（失败回退 SQLite），并分别开新窗口启动后端(8000)与前端(3000)。启动前会释放被占用的 8000/3000 端口。 |
| `bootstrap.ps1` | 初始化开发环境 | 检查环境 → 启动 Docker → 建 venv 并安装 `.[dev]` → `alembic upgrade head` 初始化表结构 → 健康检查。**注意**：早期版本用 `flask --app run.py db ...`（Flask 语法），已废弃，现为 Alembic。 |
| `check_env.ps1` | 环境预检 | 打印 Python / Node / Docker / Docker Compose 版本。Docker 非必需（开发可用 SQLite），缺失时仅报错不阻断。 |
| `health_check.ps1` | 后端健康检查 | 请求 `GET /api/health`，返回 `{"status":"ok"}` 即正常；后端未启动或异常时以非 0 退出。**注意**：早期版本请求 `/api/v1/health`（路径错误），已修正为 `/api/health`。 |
| `migrate.ps1` | 生成并应用迁移 | 接收 `-message` 参数，等价于 `alembic revision --autogenerate -m <msg>` 后 `alembic upgrade head`。**注意**：早期 `flask ... db migrate/upgrade` 已废弃。 |
| `reset_db.ps1` | 重置数据库（**破坏性**） | 删除 `backend/dev.db`、`backend/test.db`（默认 SQLite 开发库）；Dev Container 内的 MySQL/Redis 数据卷可用 `docker compose -f .devcontainer/docker-compose.yml down -v` 重置。**会清空数据，仅用于本地开发重置！** |
| `check-backend.ps1` / `check-backend.bat` | 检测 / 修复"陈旧后端" | 对比运行中后端 `GET /api/health` 返回的 `commit`（git 短哈希）与磁盘 git commit：一致则提示"已是最新代码，无需处理"；不一致即判定为"陈旧后端"（改了代码却不生效，大概率是跑着旧进程）。带 `-Fix` 会先清理 8000 端口（含 reloader 孤儿 worker）再以当前代码重启后端。`check-backend.bat` 是兼容 CMD / PowerShell 的包装器，内部自动加 `-ExecutionPolicy Bypass`，可直接 `scripts\check-backend.bat [-Fix]` 运行，无需手动放行策略。 |

> 后端代码内还有 `backend/scripts/`（如 `make_admin.py`），与上面的仓库级脚本不同。创建管理员请使用 `python scripts/make_admin.py <用户名> <邮箱> <密码>`（详见后端文档 `backend/docs/database-admin-guide.md`）。

---

## 部署

后端提供 `Dockerfile`（Uvicorn + Gunicorn 风格生产服务）。典型流程：

```bash
# 构建镜像
docker build -t blog-backend ./backend

# 运行（通过 --env-file 注入 .env）
docker run -p 8000:8000 --env-file backend/.env blog-backend
```

前端生产构建：`cd frontend && npm run build`，将 `dist/` 交由 Nginx / 静态托管，并把 `/api`、`/uploads` 反向代理到后端 8000。

---

## 项目约定与踩坑

（来自历史开发经验，避免重复踩坑）

- **bcrypt 直接调用**：密码用 `bcrypt.hashpw` / `bcrypt.checkpw`，不通过 passlib（与 bcrypt 5.x 不兼容）。
- **异步 SQLAlchemy 注意**：在 async 会话中新建对象后，不要直接访问 `lazy="selectin"` 的关系属性（会触发 `MissingGreenlet`）。创建文章时用 `insert(article_tags)` 直接操作关联表；更新时用带 `joinedload` 的查询。
- **文章可见性**：详情接口先按 int ID 解析，失败再按 slug 匹配；软删除文章对非作者/非管理员不可见。
- **上传 URL 重写**：`UploadURLRewriterMiddleware` 会把响应里的 `/uploads/...` 重写为 `UPLOAD_BASE_URL` 前缀的绝对地址，便于跨域/生产访问。
- **编辑器统一入口**：`/write` 与 `/edit/:id` 共用 `ArticleEditor.tsx`；保存草稿 → `status='draft'`，发布/更新 → `status='published'`。
- **虚拟环境**：后端使用 `backend/venv`（脚本）与 `backend/.venv`（IDE）；不要误用已删除的根 `.venv`。
- **环境变量名**：用 `APP_ENV`（非 `FLASK_ENV`）、`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`（非 `..._EXPIRES`）。
- **"陈旧后端"陷阱（改动不生效时先查这个）**：后端 `run.py` 默认 `reload=False`（显式 `APP_RELOAD=1` 才热重载）。若历史上用 `reload=True` 启动过，reloader 父进程被杀后，worker 子进程会变成**孤儿**继续监听旧代码（Windows 还会把监听者错记成已死的父 PID，导致 `netstat`/`taskkill` 全失灵）。表现就是"改了代码 / 加了接口却没生效、甚至 405 / 被引导登录"。先用 `scripts\check-backend.bat` 看运行中 `commit` 是否等于磁盘 commit；不一致就 `scripts\check-backend.bat -Fix` 一键重启到最新代码。

---

## 更多文档

- 后端详解与 API 列表：[backend/README.md](backend/README.md)、[backend/API.md](backend/API.md)
- 数据库/管理员指南：[backend/docs/database-admin-guide.md](backend/docs/database-admin-guide.md)
- 前端说明：[frontend/README.md](frontend/README.md)
