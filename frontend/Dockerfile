# 只托管预构建产物, 服务器不再跑 npm install / vite build (避免卡顿/超时)
#
# 用法 (在本地或 CI 完成构建, 再把 dist 放到 frontend/ 下再部署):
#   本地:  cd frontend && npm install && npm run build
#   然后把 frontend/dist 传到服务器 frontend/ 目录 (如 scp -r dist user@host:/.../frontend/)
#   最后:  cd deploy && bash deploy.sh   (deploy.sh 内的 docker compose build frontend 只 COPY dist)
#
# 注意: 必须保证 frontend/dist 存在, 否则 build 会因 COPY 失败而快速报错 (而非长时间卡住)。
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html
COPY dist ./
# default.conf is injected at runtime via bind mount (see deploy/nginx)
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
