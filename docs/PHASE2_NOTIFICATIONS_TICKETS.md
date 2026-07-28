# 工程 Ticket 拆解 — 站内通知系统（PRD §4.1）

> 配套文档：`docs/PHASE2_PRD.md` 功能域 4.1
> 范围：P0（本期全做）+ P1（聚合/邮件）+ P2（WebSocket 实时）留接口
> 代码约定（已核对）：响应信封 `{success,message,data}`（`app/utils/response.py` 的 `ok()`/`error()`）；`CurrentUser` 注入即 `user_id: int`；模型基类 `app.database.Base`；前端 API 在 `frontend/src/api/*`，类型在 `frontend/src/types/index.ts`，i18n 用 `useTranslation()` 的 `t('key')` 且支持插值 `t('minutesAgo',{n})`；Header 在 `frontend/src/components/AppLayout.tsx`。

---

## 数据模型与迁移

### NTF-1 · Notification 表 + Alembic 迁移（DB）
- **类型**：DB / 后端
- **字段**：

  | 字段 | 类型 | 约束 |
  |---|---|---|
  | id | int PK autoincrement | |
  | user_id | int FK→users.id (CASCADE) | 接收方，**非触发方** |
  | type | varchar(20) | `comment` / `reply` / `like` / `favorite` / `follow` |
  | payload | JSON / TEXT | 冗余渲染字段，见 NTF-2 |
  | is_read | bool | default False |
  | created_at | DateTime UTC | default now |

- **索引**：复合索引 `(user_id, is_read, created_at)` 支撑"我的未读 + 分页"。
- **迁移**：用项目既有 Alembic（`bash scripts/make-migration.sh "add notifications"`），保持 MySQL/SQLite 双兼容（用通用类型，避免 `BigInteger`）。
- **AC**：迁移在 dev（SQLite）与 CI（MySQL）均可成功 applied；建表后 `user_id` 删除级联生效。

---

## 后端接口

### NTF-2 · GET /api/notifications（列表 + 未读计数）
- **类型**：后端
- **鉴权**：`CurrentUser`（仅查自己）。
- **Query**：`page`(默认1)、`page_size`(默认20)、`unread_only`(bool, 可选)。
- **返回 data**：
  ```json
  {
    "items": [
      {
        "id": 1, "type": "comment", "is_read": false,
        "created_at": "2026-07-28T01:23:45Z",
        "actor": { "id": 7, "username": "alice", "avatar": "https://..." },
        "article": { "id": 42, "title": "xxx", "slug": "xxx" },
        "comment_snippet": "前 80 字…",   // type=comment/reply 时
        "target_url": "/article/42"          // 点击跳转
      }
    ],
    "pagination": { "page":1, "page_size":20, "total": 53, "pages": 3 },
    "unread_count": 5
  }
  ```
- **注意**：`payload` 落库存原始数据，序列化时展开为上述**冗余字段**，前端零解析直接渲染（避免在每个前端重复算路由/标题）。
- **AC**：
  1. 仅返回 `user_id == 当前用户` 的记录。
  2. `unread_only=true` 时 `total` 为未读数；响应 `unread_count` 始终为实时未读数。
  3. 无 N+1（加载 actor/article 用 `joinedload`/`selectin`，注意异步会话 `lazy="selectin"` 触发 `MissingGreenlet` 的坑——沿用 `articles.py` 的 `_get_article_or_404(joinedload)` 写法）。

### NTF-3 · POST /api/notifications/read（标记已读）
- **类型**：后端
- **Body**（二选一）：
  ```json
  { "ids": [1,2,3] }      // 标记指定条
  { "all": true }         // 全部已读
  ```
- **返回**：`{ updated: <int> }`（data 内）。
- **AC**：标记后 `GET /api/notifications` 的 `unread_count` 同步减少；越权 id（非本人）静默忽略，不报错。

### NTF-4 · NotificationService（触发源接入）
- **类型**：后端 / 跨模块
- **新增** `app/services/notification.py`：`async def notify(session, recipient_id, type, payload)` → 写库 + `await session.flush()`。
- **接入点**（注意防自通知 `if recipient_id == actor_id: return`）：
  - `api/comments.py · create_comment`：通知**文章作者** + **被回复人**（`parent_id` 存在时），二者均 ≠ 触发者。
  - `api/likes.py` 点赞创建时：通知文章作者（若点赞对象为文章）。
  - `api/favorites.py` 收藏创建时：通知文章作者。
  - **关注触发**：⚠️ 当前代码盘点未发现 follows 端点（见下方 Open Question Q6），follow 类型通知**暂缓**，待关注功能确认后再接。
- **AC**：
  1. 评论自己文章不给自己发通知。
  2. 回复场景下被回复人收到 `reply` 类型、文章作者收到 `comment` 类型。
  3. 通知写入失败不影响主流程（try/except 包裹，记日志）。

---

## 前端

### NTF-5 · Header 通知铃铛（NotificationBell.tsx）
- **类型**：前端 / 组件
- **位置**：`AppLayout.tsx` 右上 `Space`（桌面）；移动端放入 `mobileItems` 下拉顶部。
- **依赖新增**：`import { NotificationOutlined } from '@ant-design/icons'`。
- **行为**：
  - 挂载时拉一次 `unread_count`（NTF-2 接口）；用 `antd Badge` 显示角标（>99 显示 99+）。
  - 轮询：进入页面 `setInterval(60s)` 刷新未读；`document.visibilitychange` 回前台时立即刷新一次（**Phase 2a 用轮询，WebSocket 放 P2，见 Q1**）。
  - 未登录不显示铃铛。
  - 点击：打开 `antd Drawer`（右侧），渲染 NTF-6 列表。
- **AC**：未读角标与实际未读数一致；轮询不造成重复请求风暴（用 `dedupeConcurrent` 思路或简单节流）。

### NTF-6 · 通知抽屉列表 + 状态
- **类型**：前端 / 组件
- **内容**：
  - 列表项按 `type` 套 i18n 模板拼文案（如 `t('notif.comment', {user: actor.username, title: article.title})`）。
  - 相对时间：复用既有插值 `t('minutesAgo',{n})` / 小时 / 天。
  - 顶部"全部已读"按钮 → 调 NTF-3 `all:true`；单项点击 → 跳 `target_url` 并调 `read(ids:[id])`。
  - 分页：简单"加载更多"（page+1），到底显示"没有更多"。
  - 空态：`t('notif.empty')`。
- **AC**：点击通知后该条 `is_read=true` 且角标 -1；"全部已读"后角标归零。

### NTF-7 · 前端 API + 类型 + i18n
- **类型**：前端 / 基建
- **`api/notifications.ts`**：
  - `getNotifications({page,page_size,unread_only})` → `request.get<ApiResponse<{items, pagination, unread_count}>>('/api/notifications')`
  - `markRead({ids?, all?})` → `request.post('/api/notifications/read', body)`
- **`types/index.ts`**：新增 `Notification` 接口（字段同 NTF-2 返回）。
- **i18n（`i18n/index.ts`）新增 key**：
  `notification` / `notifications` / `markAllRead` / `notif.empty` /
  `notif.comment` / `notif.reply` / `notif.like` / `notif.favorite` / `notif.follow`
  （中英文各一份，沿用现有插值语法，勿与已有 key 重名）。

---

## P1 / P2 增强（不在 2a 强制交付，预留接口）

### NTF-8 · 通知聚合 + 邮件通知（P1）
- **后端**：同 `(recipient_id, article_id, type=comment)` 在 24h 窗口内合并为"N 条新评论"；邮件走既有 `app/utils/notifications.py` SMTP，新增"每日汇总"模式 + 频率开关（站点设置里配，见 §4.4）。
- **AC**：高频评论不刷屏；邮件可关闭。

### NTF-9 · WebSocket 实时推送（P2）
- **依赖**：Redis（Docker Compose 已含）。替换 NTF-5 轮询为 `ws://` 订阅；服务端在 `notify()` 后 publish 到用户频道。
- **AC**：新通知秒级到达，无轮询开销。

---

## 验收总闸（Definition of Done — 通知域）

- [ ] 评论/点赞/收藏均生成正确通知，且**不通知触发者本人**。
- [ ] 作者登录见未读红点；点开可见结构化文案与跳转。
- [ ] 标记已读/全部已读后角标准确归零。
- [ ] 跨用户访问接口返回 403（后端 `user_id` 校验）。
- [ ] 通知写入异常被隔离，不拖垮评论/点赞主流程。
- [ ] 列表/计数查询无 N+1，dev+CI 通过。

## Open Questions（需确认）

- **Q1（已默认）**：2a 用轮询还是 WebSocket？→ 默认轮询（成本低、先上线），WebSocket 放 NTF-9/P2。
- **Q6（新增）**：**关注（follow）功能当前代码未实现**，NTF-4 的 `follow` 触发与"关注作者发新文章"通知需先确认 follow 功能是否在 2a 范围内；若不在，该触发从本期移除，仅保留 comment/reply/like/favorite 四类。
