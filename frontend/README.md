# Frontend · 博客平台前端

基于 **React 19 + TypeScript + Vite 6 + Ant Design 6** 的博客 Web 界面，包含文章浏览/创作、评论、个人中心、收藏与管理后台。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript + Vite 6 |
| UI | Ant Design 6 |
| 路由 | React Router 7 |
| 状态 | Zustand 5 |
| 富文本 | Tiptap 3（斜杠命令 / 图片 / 任务列表 / 公式 KaTeX） |
| 图表 | ECharts 6 |
| 请求 | Axios |
| 国际化 | 自研 i18n（中文 / English） |

## 目录结构

```
src/
├── pages/        # 路由页面
│   ├── Home.tsx          # 首页（热门/最新/分类筛选）
│   ├── ArticleDetail.tsx # 文章详情
│   ├── ArticleEditor.tsx # 写文章 / 编辑（/write、/edit/:id 共用）
│   ├── Login.tsx / Register.tsx
│   ├── Profile.tsx / MyArticles.tsx / Favorites.tsx
│   └── admin/            # 管理后台（Dashboard/文章/分类/标签/评论）
├── components/   # 公共组件（AppLayout、ArticleCard、ProtectedRoute、编辑器...）
├── api/          # axios 接口层（articles/auth/comments/.../admin）
├── store/        # Zustand 状态（authStore / themeStore）
├── i18n/         # 中英文文案
├── utils/ types/ styles/
├── main.tsx      # 入口（挂载 antd ConfigProvider + Router）
└── App.tsx       # 路由表
```

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器（默认 http://localhost:3000）
npm run build    # 生产构建（输出 dist/）
npm run preview  # 预览构建产物
npm run lint     # ESLint
```

## 与后端联调

`vite.config.ts` 已配置代理，开发时前端只需写相对路径 `/api/...`：

```ts
server: {
  port: 3000,
  proxy: {
    '/api':     { target: 'http://localhost:8000', changeOrigin: true },
    '/uploads': { target: 'http://localhost:8000', changeOrigin: true },
  },
}
```

后端需先在 `../backend` 启动（见根目录 README 快速开始）。统一响应格式为
`{ success, message, data }`，接口层据此解包。

## 约定

- 网格统一用 `<Row gutter>` + `<Col xs={24} sm={12} md={8}>`（3 列），卡片组件 `ArticleCard` 在首页/列表/我的文章/收藏/Profile 复用。
- 写文章入口在「我的文章」页；草稿发布走 `publishArticle(id)`。
- `i18n` 的 `t` 是函数，调用写成 `t('key')`，插值 `t('minutesAgo', { n })`。
- 编辑器状态由按钮决定：保存草稿 → `status='draft'`，发布/更新 → `status='published'`。
