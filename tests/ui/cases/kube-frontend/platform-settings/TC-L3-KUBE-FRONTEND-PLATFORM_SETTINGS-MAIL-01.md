# TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01 邮件通知渠道 · 校验、保存与测试

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `platform-settings` `mail`
- **入口**: `{BASE_URL}/kube-frontend/settings/mail`
- **需求**: `prd/kube-frontend/platform-settings/mail.md`

## 产品功能

邮件渠道页可读取/回显已保存配置（密码除外），校验非法输入，保存三个通知对象，并能发送测试邮件。

### 关联需求

- `prd/kube-frontend/platform-settings/mail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/mail.md`](../../../../prd/kube-frontend/platform-settings/mail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01** — 已登录平台管理，当填写合法的 SMTP 与收件人并保存，则创建/更新 `default-email-config`、`global-email-receiver` 与 `global-email-config-secret`（密码 base64），配置里只保留对 Secret 的引用。
- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-02** — 当字段非法（端口非数字、邮箱格式错误、缺必填），则在发请求前拦下并逐项提示。
- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-03** — 当点击「发送测试邮件」，则把当前表单提交到 `/verification`，并按响应体里的 `Status` 给出成功或失败（HTTP 200 不代表成功）。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/mail.md`](../../../../design/kube-frontend/platform-settings/mail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/mail.md`](../../../../prd/kube-frontend/platform-settings/mail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 配好邮件通知并验证它能发出去 (Priority: P1)

作为 **平台管理员**，我希望 **填写 SMTP 并发送一封测试邮件**，以便 **确认告警真的能通知到人，而不是等出了事才发现配置是错的**。

**Independent Test**：填写 SMTP 与收件人 → 保存 → 读回三个通知对象（config/receiver/secret）→ 刷新页面字段回显；再点「发送测试邮件」，成功与失败都有明确结果。

## 前置与配置

- 已登录平台管理
- 平台已安装通知模块（configs/receivers/verification 可用）

## 测试步骤

1. 打开 /settings/mail，确认字段齐全
2. 提交非法端口与非法收件人，确认在发请求前被拦下
3. 填写合法 SMTP 与收件人并保存
4. 读回 config/receiver/secret 核对与输入一致（secret 为 base64）
5. 删除三个对象恢复原状
6. /settings/notifications 应重定向到 /settings/mail

## 期望结果

- 页面 6 个字段在位
- 非法输入显示逐项提示且没有产生写入请求
- 保存后 config.spec.email.smartHost 与页面一致、receiver.spec.email.to 为拆分的数组、secret.data.authPassword 是 base64
- 重定向到 /settings/mail

## 失败排查

- 保存返回 405：创建必须 POST 到集合端点 /configs，而不是对象路径
- 保存返回 400 且提到 vconfig webhook：平台通知组件不可用，属环境问题

## 产品改版后如何更新自动化

- 字段变化时改 MailChannelPage 的 ai-field-* id
