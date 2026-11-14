# 钉钉 / 企业微信 / Slack / Webhook 渠道（L3）

[子模块需求](./_index.md)

## 概述

除邮件外的四个通知渠道，各自一页，可保存转发配置与凭据，并能发送测试消息。它们与邮件渠道结构相同（Config / Receiver / Secret），差异只在字段与对象名。

## 用户故事

### US1 - 用团队已有的工具接收通知 (Priority: P1)

作为 **平台管理员**，我希望 **把告警接到钉钉、企业微信、Slack 或自建 Webhook**，以便 **通知落在团队实际看的地方，而不是只有一个没人配好的邮件渠道**。

**Independent Test**：打开钉钉页，选择「群机器人」，填写 Webhook 与关键词并保存；接口读回 `global-dingtalk-receiver` 的 `spec.dingtalk.chatbot` 与 `global-dingtalk-config-secret`；再打开 Slack 页，填写 Token 与频道并保存，读回 `spec.slack.channels` 与 `global-slack-config-token`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01** — 当打开任一渠道页，则显示该渠道声明的字段（钉钉的接入方式、企业微信的 Corp/Agent/Secret、Slack 的 Token 与频道、Webhook 的地址与认证方式）。
- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-02** — 当必填项为空即保存，则在发请求前拦下并逐项提示。
- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-03** — 当保存成功，则写入该渠道的 Config（Webhook 无 Config）、Secret（名称随渠道：Slack 是 `-token`）与 Receiver，且只写入**当前接入方式**那一组字段。

## 设计目标

四个渠道共用一套实现，新增渠道是加一条描述而不是写一个新页面。

## 约束与边界

- 接入方式（钉钉会话/机器人、企业微信成员/部门/标签、Webhook 认证）由单选决定，**只写当前这一组**，避免留下第二套半配置的传输。
- 凭据以 base64 写入 Secret；页面不回读，留空表示沿用；**首次保存必须填写**。
- Webhook 的认证方式写在 Receiver 的注解 `kubesphere.io/verify-type` 上，不在 spec 里。

## UI 交互设计

页头（渠道名 + 已配置徽标）、启用开关、按接入方式切换的字段组、收件人字段、保存与发送测试。

## 文案与校验

- 必填、地址（http/https）、端口范围等按字段声明校验。
- 关键词、频道、会话 ID 等列表字段用逗号分隔。

## 边界情况

- 平台校验 webhook 不可达时，保存返回 400；页面显示服务端原因。
- 企业微信的 Config 必须带 `wechatApiSecret` 的 secretKeyRef，否则平台拒绝创建（已实测）。
- 未启用时仍可保存与测试。

## 明确不做

- 通知条件（alertSelector）与告警规则绑定。
- 用户级订阅。

## 假设

- 四个渠道的对象名与老 console 相同。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01** — 四个渠道页按声明渲染字段并保存到各自对象。
- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-02** — 只写入当前接入方式的字段组。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01** — 一个参数化用例覆盖四个渠道的「字段在位 → 校验拦截 → 保存 → 读回」。
