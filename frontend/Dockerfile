# 多阶段构建: 在容器内完成 npm install + vite build, 部署不再依赖服务器预先生成 dist
#
# 用法:
#   cd deploy && bash deploy.sh
#   (deploy.sh 内部执行 `docker compose build frontend`, 本 Dockerfile 自动完成
#    依赖安装与构建, 无需在服务器上手动 npm run build 或上传 frontend/dist)
#
# 说明:
#   - 阶段1 用 node:22-alpine 安装依赖并构建, 产物落在 /app/dist
#   - 阶段2 用 nginx:1.27-alpine 仅托管构建产物 (与之前 COPY dist ./ 的对外行为一致)
#   - 使用国内 npm 镜像 (registry.npmmirror.com) 避免官方源在服务器上超时卡死
#   - 构建上下文内的 node_modules/dist 已被 .dockerignore 排除, 不会污染镜像

# ---------- 阶段 1: 构建 ----------
FROM node:22-alpine AS build
WORKDIR /app

# 国内 npm 镜像, 避免官方源超时
RUN npm config set registry https://registry.npmmirror.com

# 先拷依赖清单并利用层缓存 (package.json / package-lock.json 不变则不重装)
COPY package.json package-lock.json ./
RUN npm ci

# 再拷源码并构建
COPY . .
RUN npm run build

# ---------- 阶段 2: 托管 ----------
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
# default.conf 由 deploy/nginx 在运行时通过 bind mount 注入 (见 docker-compose.prod.yml)
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
