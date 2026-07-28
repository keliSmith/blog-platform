# 工程 Ticket 拆解 — 邮件 / 手机验证全流程（PRD §4.8）

> 配套文档：`docs/PHASE2_PRD.md` §4.8 · 范围：P0（修复假验证 + 验证端点）+ P1（验证状态 UI + 重发 + 受限拦截）
> 代码约定（已逐行核对，非凭空设计）：
> - 响应信封 `{success,message,data}`（`app/utils/response.py` 的 `ok()`），`CurrentUser` 注入即 `user_id: int`。
> - 验证码表已存在 `app/models/verification_code.py`（`verification_codes`），`send-code`/`register`/`reset-password` 已在 `app/api/auth.py`，后端 `notifications.py` 已支持 SMTP + console 兜底（SMS 仅 stub → `_send_sms_provider` 警告后退回 console）。
> - **关键现状 bug**：`auth.py:228/231` 注册时直接 `email_verified=True / phone_verified=True`，验证形同虚设——本 Ticket 首要修复。
> - 前端注册页 `pages/Register.tsx` 已有双通道（email/sms）与 `SendCodeButton` 倒计时组件；`User` 类型已含 `email_verified/phone_verified`；`Profile.tsx` 当前**无验证状态展示**；i18n 用 `t('key')` + 插值 `t('resendIn',{n})` 风格（`Register.tsx:303` 用 `replace('{n}',...)`）。

---

## 后端

### VF-1 · 修复注册"假验证" + 字段默认值（P0，阻断项）
- **类型**：后端 / 安全
- **改动点**：`app/api/auth.py · register()`
  - 删除 `user.email_verified = True`（行 228）与 `user.phone_verified = True`（行 231）。
  - 改为：注册成功即 `email_verified=False` / `phone_verified=False`（模型默认已是 `False`，此处**不要覆盖**即可）。
  - 注册响应 `_serialize_user` 已含 `email_verified/phone_verified`，无需改返回结构。
- **AC**：
  1. 新注册用户 `GET /api/user/profile` 返回 `email_verified=false`（或 `phone_verified=false`）。
  2. 仅当用户**走完 VF-2 验证流程**后字段才变 true（见 VF-2）。
- **注意**：这是 §4.8 的核心修复，须与 VF-2 同迭代上线，否则"未验证"状态无处消解。

### VF-2 · 验证端点：`POST /api/auth/verify-email` + `POST /api/auth/verify-phone`（P0）
- **类型**：后端
- **复用**：沿用 `auth.py` 既有 `_consume_code()`（按 `target/channel/purpose` 取最新未消费、未过期、未超限的码）。新增 purpose 常量 `"verify"`。
- **请求体（统一）**：
  ```json
  { "code": "123456" }   // target 由当前登录用户推导（email 或 phone），不信任客户端传入
  ```
- **逻辑**：
  - 必须 `CurrentUser`（已登录）。
  - 取 `user.email`（verify-email）或 `user.phone`（verify-phone）作为 `target`。
  - 调 `_consume_code(target, channel, "verify", code)`：
    - 成功 → `user.email_verified = True`（或 `phone_verified=True`）、`await session.flush()`，返回 `ok(message="验证成功")`。
    - 失败 → `error(err)`（沿用既有错误文案"验证码无效或已过期…"）。
- **AC**：
  1. 已登录用户凭有效码将对应 `verified` 置 true；重复验证幂等（已 true 再验证返回成功）。
  2. 未登录调用返回 401（依赖 JWT 依赖）。
  3. 用户无 email（纯手机注册）调用 verify-email 返回 400"未绑定邮箱"。

### VF-3 · 重发验证：`POST /api/auth/resend-verify`（P1）
- **类型**：后端
- **复用**：`send-code` 的 `_rate_limited()`（60s 重发窗口，`VERIFICATION_CODE_RESEND_SECONDS`）+ `_invalidate_previous_codes()`。
- **Body**：`{ "channel": "email" | "sms" }`；`target` 由 `CurrentUser` 推导（**非客户端传**）。
- **逻辑**：
  - 校验该 `target` 是否已验证：已验证则 `error("该联系方式已验证")`。
  - 触发 `send_verification_code(channel, target, code, "verify")`，返回 `ok({expires_in})`（保留 `EXPOSE_DEV_CODE` 回显 `dev_code` 便于本地测）。
- **AC**：
  1. 已验证的邮箱重发被拒（400）。
  2. 60s 内重复重发被拒（429），文案"验证码发送过于频繁"。
  3. 未验证用户触发后收到 console/SMTP 验证码（与注册同链路）。

### VF-4 · 受限操作拦截（P1，可选但建议）
- **类型**：后端 / 鉴权
- **策略**（在 `dependencies.py` 或各接口内）：若用户 **注册 > 7 天且仍 `email_verified=false && phone_verified=false`**，对以下操作返回 `error("请先验证邮箱或手机", status=403)`：
  - 发布公开评论（接 `api/comments.py · create_comment`）
  - 收藏（接 `api/favorites.py`）
  - 点赞（接 `api/likes.py`）
- **AC**：未验证老账号执行上述操作被明确拒绝并附引导文案；已验证/新注册（7天内宽限期）不受限。
- **注意**：本条与 §4.7 限流同属"信任"主题，可在 2a 一并评估是否纳入；若 2b 才做，VF-2/VF-3 仍独立可用。

---

## 前端

### VF-5 · 验证邮件/短信发送（已有，仅确认）
- **类型**：前端 / 现有复用
- `pages/Register.tsx` 的 `sendCode()` + `SendCodeButton` 已可发送 `purpose="register"` 的码，并支持 dev_code 回显。**无需改动**，但需在文档注明：注册页是"注册时验证"，与 VF-2 的"注册后补验证"是两条链路。

### VF-6 · 个人页验证状态展示 + 引导（P1，核心前端）
- **类型**：前端 / 组件改动
- **文件**：`pages/Profile.tsx`
- **改动**：
  - 在 `Descriptions`（行 232）中新增两行：邮箱验证 / 手机验证，用 `antd Tag` 显示 `t('verified')`（绿色）或 `t('unverified')`（红色/橙色）。
  - 若任一未验证，在该 `Card` 顶部加一条 `Alert`（type="warning"）：`t('verifyReminder')` + 对应通道的"去验证"按钮。
  - 新增"验证"交互：点击按钮弹 `Modal`，内含 `Input` 输码 + "发送验证码"按钮（调 VF-3 `resend-verify` + 倒计时复用 `SendCodeButton` 模式）+ "确认验证"按钮（调 VF-2）。验证成功后 `setUser` 刷新全局状态，关闭 Modal，Toast 成功。
- **依赖**：`api/user.ts` 无需改（profile 已返回 verified 字段）；新增 `api/auth.ts` 两个方法（VF-7）。
- **AC**：未验证账号在个人页看到醒目提醒与去验证入口；验证后 Tag 立即变绿、Alert 消失。

### VF-7 · 前端 API 补充（P1）
- **类型**：前端 / 基建
- **`api/auth.ts` 新增**：
  ```ts
  export function verifyContact(channel: Channel, code: string) {
    return request.post<ApiResponse<unknown>>(
      channel === 'email' ? '/api/auth/verify-email' : '/api/auth/verify-phone',
      { code },
    );
  }
  export function resendVerify(channel: Channel) {
    return request.post<ApiResponse<{ expires_in?: number; dev_code?: string }>>(
      '/api/auth/resend-verify', { channel },
    );
  }
  ```
- **`types/index.ts`**：`User` 已有 `email_verified/phone_verified`，**无需改**。

### VF-8 · i18n 新增 key（P1）
- **类型**：前端 / i18n
- **`i18n/index.ts`**（中/英各一份，沿用现有插值，勿重名）：
  `verified` / `unverified` / `verifyReminder` / `verifyEmail` / `verifyPhone` /
  `verifyTitle` / `verifyPlaceholder` / `verifySuccess` / `verifyFailed` /
  `resendVerify` / `alreadyVerified` / `unboundEmail`（"未绑定邮箱"）
  （前端文案与后端错误文案对齐，避免出现两套语言。）

### VF-9 · 受限拦截的前端提示（P1，若 VF-4 落地）
- **类型**：前端 / 体验
- **文件**：`request.ts` 统一错误拦截——当收到 `message` 含"请先验证"类（或后端返回特定 code，建议后端在 403 时附带 `data:{need_verify:true}`）时，弹 `Modal` 引导去 `/profile` 验证，而非普通 Toast。
- **AC**：受限操作被拒时用户明确知道"去哪验证"，而非一脸懵。

---

## 数据模型与配置

### VF-10 · 无需新表（确认）
- **类型**：DB
- `verification_codes` 表已支持 `purpose="verify"`（字段 `purpose:String(20)`，枚举值不强制）；`users` 表 `email_verified/phone_verified` 已存在。
- **仅需**：若要在 DB 层约束 purpose 取值，可在应用层校验（不改动表结构）。本期**无 Alembic 迁移**（仅改 `auth.py` 赋值逻辑 + 新增端点）。

### VF-11 · 配置确认（运维）
- **类型**：配置
- 生产 `.env`：确保 `EXPOSE_DEV_CODE=false`（已默认）、`EMAIL_BACKEND=smtp` 且 SMTP_* 填真实值；`SMS_BACKEND` 仍 `console`（**SMS 验证在生产环境实际不发送**，仅在 console 打印 → 见 Open Q3）。
- **AC**：生产发验证邮件真实送达；短信仅日志可见，前端验证短信流程可走通但收不到真实短信。

---

## 验收总闸（Definition of Done — 验证域）

- [ ] 新注册用户 `verified` 字段默认为 **false**（修复假验证）。
- [ ] 用户可在个人页通过邮件/短信验证码将字段置 true，UI 状态实时更新。
- [ ] 重发验证码受 60s 限速保护，已验证通道拒绝重发。
- [ ] 未验证用户在受限操作（评论/收藏/点赞，若 VF-4 落地）被明确引导去验证。
- [ ] 生产环境验证邮件真实发送；SMS 限制已在发布说明标注。
- [ ] dev 环境 `EXPOSE_DEV_CODE=true` 仍可回显码完成全流程自测。

## Open Questions（需确认）

- **Q1（已默认）**：验证 target 由服务端从 `CurrentUser` 推导，是否同意？→ 默认同意（防客户端篡改邮箱/手机）。
- **Q2**：受限拦截（VF-4）放 2a 还是 2b？→ 建议与 §4.7 限流同评估；不影响 VF-2/VF-3 上线。
- **Q3（重要）**：**SMS 在生产仍 console 兜底**，手机验证流程"能走通但收不到真短信"。是否接受本期仅邮件验证为真实可用通道？→ 文档默认接受，发布说明须标注；真短信待接入网关（非本期）。
- **Q4**：注册宽限期 7 天（VF-4 用）是否合适？过长削弱验证意义，过短打扰新用户。
