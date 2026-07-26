# Blog Platform · 生产部署指南 (阿里云 ECS + Docker Compose)

本目录提供一套**开箱即用的一键生产部署方案**，将整个博客平台容器化部署到一台阿里云 ECS：

- `mysql` 8.0（同机 Docker，数据卷持久化）
- `redis` 7（预留，当前后端未直接依赖，可保留）
- `backend` FastAPI（多 worker uvicorn，自动建表）
- `frontend` React 构建产物（Nginx 容器托管 + 反代 `/api`、`/uploads`）
- `certbot` Let's Encrypt 免费 HTTPS 证书（自动申请 + 续期）

前端使用相对路径 `/api`、`/uploads`，因此**单域名 + Nginx 反代**即可，无需处理 CORS。

---

## 一、前置条件

1. **一台阿里云 ECS**（建议 2 vCPU / 4 GB 起；系统任选 Alibaba Cloud Linux / CentOS / Ubuntu）。
2. **安全组放行**：入方向开放 `22`（SSH）、`80`、`443`。
3. **域名解析**：已把站点域名（如 `blog.example.com`）**以及其 `www` 子域名**的 **A 记录**都解析到 ECS 公网 IP。
   - 本项目证书同时覆盖 `你的域名` 与 `www.你的域名`（同一张证书的两个 SAN），因此两条 A 记录都要配。
   - 证书申请时 Let's Encrypt 会访问 `http://你的域名/.well-known/acme-challenge/...`，因此 80 端口与域名解析必须提前生效。
4. 把本仓库（含 `deploy/`、`backend/`、`frontend/` 等）上传到服务器，例如 `/opt/blog-platform`。

---

## 二、安装 Docker（若未安装）

```bash
cd /opt/blog-platform
sudo bash deploy/setup-host.sh
# 安装后把当前用户加入 docker 组并重新登录:
sudo usermod -aG docker $USER
```

---

## 三、配置环境变量

```bash
cd /opt/blog-platform/deploy
cp .env.prod.example .env.prod
vim .env.prod      # 编辑下列字段
```

需要你填写的字段：

| 字段 | 说明 |
|------|------|
| `DOMAIN` | 你的站点域名，如 `blog.example.com` |
| `EMAIL` | 用于 Let's Encrypt 通知/到期提醒 |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码（请设强密码） |
| `MYSQL_PASSWORD` | 应用使用的 `blog_user` 密码（强密码） |
| `SECRET_KEY` | 应用密钥；保持 `__CHANGE_ME__` 时脚本自动随机生成 |
| `JWT_SECRET_KEY` | JWT 签名密钥；同上自动生成 |

`UPLOAD_BASE_URL` 不用改，部署脚本会自动设为 `https://<你的域名>`。

---

## 四、一键部署

```bash
cd /opt/blog-platform/deploy
bash deploy.sh
```

脚本会依次：
1. 准备 `.env.prod`（含自动生成密钥）；
2. 启动 MySQL / Redis，并等待 MySQL 就绪；
3. 构建并启动后端（自动建表）；
4. 先用 HTTP 配置启动前端 Nginx；
5. 通过 `certbot` 申请 Let's Encrypt 证书（同时覆盖 `你的域名` 与 `www.你的域名`）；
6. 切换为 HTTPS 配置并 `reload` Nginx；
7. 询问是否创建管理员账号（可选，也可之后手动创建）。

完成后访问 `https://你的域名`（及 `https://www.你的域名`）即可。

> 若证书申请失败（域名未解析 / 80 端口未开放），脚本会停在证书步骤。请排查后重跑 `bash deploy.sh`（已就绪的部分会自动跳过）。

---

## 五、验证

```bash
# 站点首页
curl -I https://你的域名

# 后端健康检查
curl https://你的域名/api/health
# 返回 {"status":"ok","commit":"...","started_at":"..."}

# 容器状态
docker compose -f deploy/docker-compose.prod.yml ps
```

---

## 六、创建/管理管理员

部署脚本末尾可交互创建；也可随时手动执行：

```bash
cd /opt/blog-platform/deploy
docker compose -f docker-compose.prod.yml exec -T backend \
  python scripts/make_admin.py <用户名> <邮箱> <密码>
```

后台地址：`https://你的域名/admin`

---

## 七、更新 / 重新部署

代码更新后（例如 `git pull`）：

```bash
cd /opt/blog-platform/deploy
bash deploy.sh
```

脚本带 `--build`，会重建 backend / frontend 镜像并滚动重启；数据库卷与上传卷不受影响。

---

## 八、证书自动续期

Let's Encrypt 证书 90 天有效。添加系统定时任务：

```bash
# 编辑当前用户 crontab
crontab -e
# 加入（把路径换成实际路径）:
0 3 * * * /opt/blog-platform/deploy/certbot-renew.sh >> /var/log/certbot-renew.log 2>&1
```

脚本会执行 `certbot renew` 并在续期成功后 `reload` Nginx。

---

## 九、备份与恢复

- **数据库**：
  ```bash
  docker compose -f deploy/docker-compose.prod.yml exec -T mysql \
    mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" blog > blog-$(date +%F).sql
  ```
- **上传文件**（头像/封面/图片）：位于 `backend_uploads` 卷，可用 `docker volume inspect deploy_backend_uploads` 找到宿主机路径后打包。

---

## 十、常用运维命令

```bash
cd /opt/blog-platform/deploy
F=docker-compose.prod.yml

docker compose -f $F ps                 # 状态
docker compose -f $F logs -f backend    # 后端日志
docker compose -f $F logs -f frontend   # Nginx 日志
docker compose -f $F restart backend    # 重启后端
docker compose -f $F down               # 停止全部（不删数据卷）
docker compose -f $F down -v            # 停止并删除数据卷（危险！会清空数据）
```

---

## 十一、故障排查

| 现象 | 可能原因 / 处理 |
|------|----------------|
| 证书申请失败 | 域名 A 记录未生效、80 端口未开放、或 Let's Encrypt 频率限制。本项目证书同时申请 `你的域名` 与 `www.你的域名`，两条 A 记录都要生效。先用 `dig 你的域名` 与 `dig www.你的域名` 确认都解析到公网 IP，并确认安全组放行 80。 |
| 访问 502 | 后端未就绪。看 `docker compose -f $F logs backend`，常见为 MySQL 未就绪或 `DATABASE_URL` 驱动问题（必须用 `asyncmy`，已内置）。 |
| 上传图片 404 | `/app/uploads` 未创建或卷未挂载。已在 Dockerfile 中 `mkdir -p /app/uploads` 并挂载 `backend_uploads` 卷。 |
| 改了代码不生效 | 重新跑 `bash deploy.sh` 重建镜像；或 `docker compose -f $F up -d --build backend frontend`。 |
| Nginx 启动报错 | 检查 `deploy/nginx/default.conf` 是否被正确生成（含真实域名，无 `{{DOMAIN}}` 占位符）。 |

---

## 文件清单

| 文件 | 作用 |
|------|------|
| `deploy/docker-compose.prod.yml` | 生产编排（mysql/redis/backend/frontend/certbot） |
| `deploy/.env.prod.example` | 环境变量模板 |
| `deploy/nginx/default.conf.http` | 申请证书前的 HTTP 临时配置（模板） |
| `deploy/nginx/default.conf.https` | 证书就绪后的 HTTPS 配置（模板） |
| `deploy/deploy.sh` | 一键部署脚本 |
| `deploy/certbot-renew.sh` | 证书续期脚本（供 cron 调用） |
| `deploy/setup-host.sh` | 服务器安装 Docker |
| `backend/Dockerfile` | 后端生产镜像（多 worker + uploads 目录） |
| `backend/.dockerignore` | 构建排除项 |
| `frontend/Dockerfile` | 前端多阶段构建（node build → nginx） |
| `frontend/.dockerignore` | 构建排除项 |
