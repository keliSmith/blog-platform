import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 监听 0.0.0.0，便于 Dev Container / VS Code 端口转发从宿主访问
    port: 3000,
    strictPort: true, // 端口被占用时直接报错，避免静默切换到 3001 导致访问 3000 无响应
    // 允许通过转发/代理主机访问（Dev Container 场景常见），避免 Vite 6 的 host 校验拦截
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
