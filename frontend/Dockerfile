# 单阶段 Nginx: 构建已移至 CI (GitHub Actions runner) 完成, 这里只负责托管。
# dist 由宿主机通过 bind mount 注入 (见 docker-compose.prod.yml 的
# ./../frontend/dist:/usr/share/nginx/html:ro), 镜像内不再跑 npm ci / vite build。
#
# 这样把吃内存/CPU 的前端打包从"小服务器"挪到了 GitHub runner, 服务器只做秒级
# `docker compose up` 与 `nginx -s reload`, 不再因 vite build 卡死。
#
# 用法:
#   cd deploy && docker compose -f docker-compose.prod.yml up -d --build frontend

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html
# 默认 nginx 根目录即 /usr/share/nginx/html, 与 deploy/nginx/default.conf 中
# location /assets/ 与 location / 的 root 一致, dist 由宿主机 bind mount 覆盖。
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
