# TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01 通知渠道 · 五行状态与 Secret 一致

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `platform-settings` `notifications`
- **入口**: `{BASE_URL}/kube-frontend/settings/notifications`
- **需求**: `prd/kube-frontend/platform-settings/notifications.md`

## 产品功能

['五', '个', '渠', '道', '依', '序', '显', '示', '，', '状', '态', '与', None, '<', 'c', 'h', 'a', 'n', 'n', 'e', 'l', '', 's', None, 'S', 'e', 'c', 'r', 'e', 't', None, '是', '否', '存', '在', '一', '致', '。']

### 关联需求

- `prd/kube-frontend/platform-settings/notifications.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/notifications.md`](../../../../prd/kube-frontend/platform-settings/notifications.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01** — 已知平台通知配置可读，当打开通知渠道页，则依次显示邮件、钉钉、企业微信、Slack、Webhook 五行，每行带「已配置」或「未配置」徽标，且与 `<channel>s` Secret 是否存在一致。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/notifications.md`](../../../../design/kube-frontend/platform-settings/notifications.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/notifications.md`](../../../../prd/kube-frontend/platform-settings/notifications.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认告警能不能发出去 (Priority: P1)

作为 **平台管理员**，我希望 **看到哪些渠道已配置**，以便 **在告警收不到时先排除渠道问题**。

**Independent Test**：打开通知渠道页，核对五个渠道的徽标与平台 Secret 存在性一致。

## 前置与配置

- 已登录，且有平台权限
- 可读取 kubesphere-monitoring-system 中的 Secret 列表

## 测试步骤

1. 读取平台的 Secret 名称列表
2. 打开通知渠道页
3. 逐行核对渠道名与徽标

## 期望结果

- 五行依次为 邮件、钉钉、企业微信、Slack、Webhook
- 每行的已配置/未配置与对应 Secret 是否存在一致

## 失败排查

- 徽标与 Secret 不符时看 toNotificationChannels 的命名规则

## 产品改版后如何更新自动化

- 渠道增减时改 api-client 的 NOTIFICATION_CHANNELS
