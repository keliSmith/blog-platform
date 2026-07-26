# 博客平台后端 · 数据库查看与管理员账户设置 操作说明

> 适用目录：`blog-platform/backend/`
> 环境：开发默认 SQLite，生产用 MySQL（见 `app/config.py`）

---

## 0. 关于本次「无法解析导入 "fastapi.responses"」报错

这是 **VS Code / Pylance 的“找不到模块”提示**，并不是代码本身的错误。

- 代码 `from fastapi.responses import JSONResponse` 写法完全正确，`fastapi.responses` 是 FastAPI 的合法子模块。
- 我们在本机验证过：在项目的 `.venv` 虚拟环境里该导入**完全正常**（运行时可解析）。
- 真正原因：编辑器当前选中的 Python 解释器里**没有安装 FastAPI**（例如本机系统 Python 3.14 并未安装 fastapi），Pylance 找不到模块就报红。

**已修复**：通过 `backend/.vscode/settings.json`（以及根目录 `.vscode/settings.json`）把解释器固定到项目虚拟环境 `.venv`。在 VS Code 里执行 **“重新加载窗口”**（Ctrl+Shift+P → Reload Window），红线即消失。

---

## 一、查看项目数据库

### 1. 数据库文件在哪里？

| 环境 | 位置 | 说明 |
| --- | --- | --- |
| 开发 `APP_ENV=development` | `backend/dev.db` | SQLite 文件（默认） |
| 测试 `APP_ENV=testing` | `backend/test.db` | SQLite 文件 |
| 生产 `production` | MySQL | 由 `.env` 的 `DATABASE_URL` 或 `MYSQL_*` 决定 |

> 当 `.env` 中 `DATABASE_URL` 为空时，开发/默认环境自动使用 SQLite（见 `app/config.py` 的 `_default_database_uri`）。

### 2. 方式 A：SQLite 命令行（本机已安装）

```bash
cd blog-platform/backend
sqlite3 dev.db
sqlite> .tables                       # 列出所有表
sqlite> .schema users                # 查看 users 表结构
sqlite> SELECT id, username, email, role FROM users;
sqlite> .quit
```

一键查看管理员账号：

```bash
sqlite3 dev.db "SELECT id, username, role FROM users WHERE role='admin';"
```

> 若终端提示找不到 `sqlite3`，可用完整路径（本机位于 miniconda 内）：
> `/d/miniconda3/Library/bin/sqlite3 dev.db`

### 3. 方式 B：图形化工具（推荐，最直观）

- **DB Browser for SQLite**（免费：https://sqlitebrowser.org）直接打开 `backend/dev.db`
- **DBeaver** / **SQLiteStudio**：新建 SQLite 连接，选择 `dev.db`
- 生产 MySQL：用 DBeaver 填入 `.env` 中的 `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` 连接

### 4. 方式 C：用项目虚拟环境的 Python

```bash
cd blog-platform/backend
.venv\Scripts\activate                # Windows；Linux/macOS 用 source .venv/bin/activate
python -c "import sqlite3, pprint; c=sqlite3.connect('dev.db'); pprint.pprint(c.execute('SELECT id,username,email,role FROM users').fetchall())"
```

---

## 二、设置管理员权限账户

### 原理

- 用户角色存于 `users.role` 字段，**默认值为 `'user'`**，管理员为 `'admin'`。
- 后端通过 `app/dependencies.py` 的 `get_current_admin` 校验 `role == 'admin'`，否则返回 **403 权限不足**。
- 注册接口 `/api/register` **不会**自动赋予 admin，需要手动提升。

### 方式 A：使用脚本（推荐，可新建或提升，一条命令）

```bash
cd blog-platform/backend
.venv\Scripts\activate
python scripts/make_admin.py <用户名> <邮箱> <密码>
```

- 用户已存在（按用户名或邮箱匹配）→ 提升为 `admin`；
- 用户不存在 → 新建一个 `admin` 账户；
- 密码使用与 API 完全相同的 bcrypt 哈希（`app.dependencies.hash_password`），创建后可直接登录；
- 脚本幂等，可重复运行，不会重复建号或报错。

示例：

```bash
python scripts/make_admin.py admin admin@example.com StrongPass123
# → [OK] Created admin user: id=1 username=admin email=admin@example.com
```

指定其他环境（如测试库）：

```bash
APP_ENV=testing python scripts/make_admin.py admin admin@example.com StrongPass123
```

### 方式 B：先注册普通用户，再提升为管理员

1) 注册：

```bash
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice\",\"email\":\"alice@x.com\",\"password\":\"Pass1234\"}"
```

2) 直接改库提升（立即生效，无需重启服务）：

```bash
sqlite3 dev.db "UPDATE users SET role='admin' WHERE username='alice';"
```

### 方式 C：仅改库（适用于已有用户）

```bash
sqlite3 dev.db "UPDATE users SET role='admin' WHERE username='你的用户名';"
```

> 注：SQLite 直接改库**立即生效**；生产 MySQL 用 `mysql` 客户端执行同一句 SQL 即可。

### 验证管理员是否生效

```bash
sqlite3 dev.db "SELECT username, role FROM users WHERE role='admin';"
```

或：用该账号登录拿到 token，调用任意管理员接口（如 `/api/admin` 下的路由），应返回 **200** 而非 **403**。

---

## 三、注意事项 / 常见问题

- **虚拟环境**：项目里同时存在 `venv/` 与 `.venv/` 两个目录。`venv/` 是 Flask→FastAPI 迁移前**遗留的旧环境**（仍含 `Flask-SQLAlchemy` 残留），`.venv/` 才是 `scripts/dev.sh` / `dev.bat` 使用的**正式开发环境**（含全部依赖与 dev 工具）。若再出现“找不到 fastapi”，请确认 VS Code 底部状态栏选中的是 `.venv`。
- 修改 `*.db` 时，不要直接用文本编辑器打开二进制数据库文件；使用上文工具更安全。
- 生产环境切勿把 `DATABASE_URL` 指向本地 SQLite；使用 MySQL，并妥善保管 `.env` 中的 `JWT_SECRET_KEY` / `SECRET_KEY`。
