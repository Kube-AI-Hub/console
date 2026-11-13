# 通知渠道（L3）

[子模块需求](./_index.md)

## 概述

五种通知渠道（邮件、钉钉、企业微信、Slack、Webhook）各自显示「已配置 / 未配置」。

## 用户故事

### US1 - 确认告警能不能发出去 (Priority: P1)

作为 **平台管理员**，我希望 **看到哪些渠道已配置**，以便 **在告警收不到时先排除渠道问题**。

**Independent Test**：打开通知渠道页，核对五个渠道的徽标与平台 Secret 存在性一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01** — 已知平台通知配置可读，当打开通知渠道页，则依次显示邮件、钉钉、企业微信、Slack、Webhook 五行，每行带「已配置」或「未配置」徽标，且与 `<channel>s` Secret 是否存在一致。

## 设计目标

不读凭据也能回答「发得出去吗」。

## 约束与边界

- 只列出 `kubesphere-monitoring-system` 中 Secret 的名称，不读取内容。
- 渠道键为 `mail/dingtalk/wecom/slack/webhook`，对应 Secret 名为 `<key>s`。

## UI 交互设计

五行列表，右侧徽标。

## 文案与校验

- 渠道名：邮件、钉钉、企业微信、Slack、Webhook。
- 状态：已配置 / 未配置。

## 边界情况

- Secret 列表为空：五行全部「未配置」。
- 读取失败：同样呈现为未配置，并有说明文案。

## 明确不做

- 编辑渠道、发送测试消息、显示渠道参数。

## 假设

- 平台用 `<channel>s` 命名的 Secret 承载渠道凭据。

## 验收用例

- `AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01** — 五行渠道各带状态徽标。
- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-02** — 不读取 Secret 内容。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01** — 徽标与 Secret 存在性一致。
