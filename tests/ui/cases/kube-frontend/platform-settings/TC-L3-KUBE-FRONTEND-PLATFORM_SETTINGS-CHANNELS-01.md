# TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01 钉钉 / 企业微信 / Slack / Webhook：字段、校验与保存

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `platform-settings` `channels`
- **入口**: `{BASE_URL}/kube-frontend/settings/{channel}`
- **需求**: `prd/kube-frontend/platform-settings/channels.md`

## 产品功能

四个通知渠道各有一页，按渠道声明的字段渲染；必填为空不发请求；保存写入该渠道的 Config/Receiver/Secret（Webhook 无 Config）。

### 关联需求

- `prd/kube-frontend/platform-settings/channels.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/channels.md`](../../../../prd/kube-frontend/platform-settings/channels.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01** — 当打开任一渠道页，则显示该渠道声明的字段（钉钉的接入方式、企业微信的 Corp/Agent/Secret、Slack 的 Token 与频道、Webhook 的地址与认证方式）。
- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-02** — 当必填项为空即保存，则在发请求前拦下并逐项提示。
- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-03** — 当保存成功，则写入该渠道的 Config（Webhook 无 Config）、Secret（名称随渠道：Slack 是 `-token`）与 Receiver，且只写入**当前接入方式**那一组字段。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/channels.md`](../../../../design/kube-frontend/platform-settings/channels.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/channels.md`](../../../../prd/kube-frontend/platform-settings/channels.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 用团队已有的工具接收通知 (Priority: P1)

作为 **平台管理员**，我希望 **把告警接到钉钉、企业微信、Slack 或自建 Webhook**，以便 **通知落在团队实际看的地方，而不是只有一个没人配好的邮件渠道**。

**Independent Test**：打开钉钉页，选择「群机器人」，填写 Webhook 与关键词并保存；接口读回 `global-dingtalk-receiver` 的 `spec.dingtalk.chatbot` 与 `global-dingtalk-config-secret`；再打开 Slack 页，填写 Token 与频道并保存，读回 `spec.slack.channels` 与 `global-slack-config-token`。

## 前置与配置

- 已登录平台管理
- 平台已安装通知模块

## 测试步骤

1. 打开渠道页，确认声明的字段都在
2. 清空一个必填项后保存，确认被拦下且无写入请求
3. 填写并保存
4. 通过接口读回 receiver 与 secret，核对渠道键与凭据
5. 删除写入的对象恢复原状

## 期望结果

- 字段在位
- 校验拦截有效
- receiver 的 spec 含该渠道键（dingtalk/wechat/slack/webhook）
- secret 在渠道对应的名称下（Slack 为 -token）

## 失败排查

- 400 且提到 vconfig/vreceiver webhook：平台通知组件不可用，环境问题
- 企业微信 400 缺 wechatApiSecret：Config 需要 secretKeyRef

## 产品改版后如何更新自动化

- 字段变化时同步 channelDescriptors.ts 与用例里的 field 列表
