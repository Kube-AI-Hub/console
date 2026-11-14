# TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01 飞书渠道：字段、空态与保存

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `platform-settings` `feishu`
- **入口**: `{BASE_URL}/kube-frontend/settings/feishu`
- **需求**: `prd/kube-frontend/platform-settings/feishu.md`

## 产品功能

飞书渠道页按声明渲染三种接入方式（用户 ID / 部门 ID / 群机器人）的字段：默认用户方式显示 App ID、App Secret 与用户 ID；切到部门方式显示部门 ID；切到群机器人方式显示 Webhook、签名密钥与关键词；未配置时徽标为「未配置」。保存写入 default-feishu-config / global-feishu-receiver / global-feishu-config-secret（群机器人方式没有 Config）。

### 关联需求

- `prd/kube-frontend/platform-settings/feishu.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/feishu.md`](../../../../prd/kube-frontend/platform-settings/feishu.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01** — 已知平台已安装通知模块，当打开 `/kube-frontend/settings/feishu`，则页面按接入方式渲染字段：用户 ID 方式显示 App ID、App Secret、用户 ID；部门 ID 方式显示 App ID、App Secret、部门 ID；群机器人方式显示 Webhook、签名密钥、关键词；未配置时徽标显示「未配置」，切换方式只显示当前方式的字段。必填为空时保存被拦下且不发请求。保存写入 `default-feishu-config` / `global-feishu-receiver` / `global-feishu-config-secret`：Config 带 appID/appSecret 的 secretKeyRef，Receiver 的 `spec.feishu` 带所选方式的键与 `enabled`，Secret 带对应凭据；群机器人方式不创建 Config。平台校验 webhook 不可用时保存返回 400 且页面显示服务端原因（此时自动化用例跳过并写明环境原因）。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/feishu.md`](../../../../design/kube-frontend/platform-settings/feishu.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/feishu.md`](../../../../prd/kube-frontend/platform-settings/feishu.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 用飞书接收平台通知 (Priority: P1)

作为 **平台管理员**，我希望 **把告警接到飞书（应用推送给用户或部门，或群机器人推给群）**，以便 **通知落在团队实际看的飞书会话里**。

**Independent Test**：打开飞书页，切换三种接入方式核对字段组；填写应用凭据与用户 ID 保存，接口读回 Config 的 `spec.feishu.appID/appSecret` 引用、Receiver 的 `spec.feishu.user` 与 Secret 的 `appkey/appsecret`。

## 前置与配置

- 已登录平台管理
- 平台已安装通知模块

## 测试步骤

1. 打开 /kube-frontend/settings/feishu，等页面数据加载完成
2. 确认默认用户方式下 App ID、App Secret、用户 ID 字段可见，部门 ID 与群机器人字段不可见，徽标为「未配置」
3. 切换到部门 ID 方式，确认部门 ID 字段出现、用户 ID 字段隐藏，App ID/App Secret 仍在
4. 切换到群机器人方式，确认 Webhook、签名密钥、关键词出现，App ID 与用户/部门字段隐藏
5. 群机器人方式下 Webhook 留空直接保存，确认被前端校验拦下且没有发出写入请求
6. 切回用户方式，填写 App ID、App Secret、用户 ID 并保存
7. 若平台通知组件的校验 webhook 不可用（400 且提到 webhook/notification-manager），skip 并写明原因；否则通过接口读回 config/receiver/secret，刷新页面确认回显，最后清理三个对象

## 期望结果

- 三种接入方式的字段组正确切换，未配置徽标在空态出现
- 必填校验在发请求之前拦下
- 平台正常时保存写入三个对象：Config 带 appID/appSecret 的 secretKeyRef，Receiver 的 spec.feishu.user 有值，Secret 中存在 appkey/appsecret
- 平台校验 webhook 不可用时用例 skip，并在原因里写出平台返回的错误

## 失败排查

- 400 且提到 vconfig/vreceiver webhook：平台通知组件不可用，环境问题，用例将 skip
- 徽标一直「未配置」：确认 /kapis/notification.kubesphere.io/v2beta2/receivers/global-feishu-receiver 是否存在
- 字段切不出来：channelDescriptors.ts 里 visibleWhen 的 mode 取值与 inferMode 是否一致

## 产品改版后如何更新自动化

- 字段变化时同步 channelDescriptors.ts 与用例里的 field 列表
