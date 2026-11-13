# 邮件通知渠道（L3）

[子模块需求](./_index.md)

## 概述

配置平台通过邮件发送告警/通知时使用的 SMTP：服务器与端口、TLS、SMTP 用户名与密码、发件人、收件人，以及是否启用。支持保存与「发送测试邮件」。

## 用户故事

### US1 - 配好邮件通知并验证它能发出去 (Priority: P1)

作为 **平台管理员**，我希望 **填写 SMTP 并发送一封测试邮件**，以便 **确认告警真的能通知到人，而不是等出了事才发现配置是错的**。

**Independent Test**：填写 SMTP 与收件人 → 保存 → 读回三个通知对象（config/receiver/secret）→ 刷新页面字段回显；再点「发送测试邮件」，成功与失败都有明确结果。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01** — 已登录平台管理，当填写合法的 SMTP 与收件人并保存，则创建/更新 `default-email-config`、`global-email-receiver` 与 `global-email-config-secret`（密码 base64），配置里只保留对 Secret 的引用。
- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-02** — 当字段非法（端口非数字、邮箱格式错误、缺必填），则在发请求前拦下并逐项提示。
- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-03** — 当点击「发送测试邮件」，则把当前表单提交到 `/verification`，并按响应体里的 `Status` 给出成功或失败（HTTP 200 不代表成功）。

## 设计目标

一个页面完成「填、存、试」三件事，失败时说得清是哪一步、为什么。

## 约束与边界

- 一个渠道是**三个对象**：Config（传输）、Receiver（收件人与启用）、Secret（密码）。平台的模型如此，老 console 也如此。
- 密码以 base64 写入 Secret；页面**不回读**密码，留空表示沿用。
- 全局对象（无 namespace），与老 console 一致。

## UI 交互设计

- 页头：渠道名 + 已配置/未配置徽标。
- 启用开关；服务器设置（地址/端口/TLS/用户名/密码/发件人）；收件人设置。
- 底部：保存、发送测试邮件；结果就地显示。

## 文案与校验

- 端口 1–65535；发件人与收件人为合法邮箱；收件人至少一个，多个用逗号分隔。
- 「留空表示沿用已保存的密码」。

## 边界情况

- 平台未安装通知模块：页面给出说明并可重试，不把 404 当"未配置"。
- 保存中断：保留表单内容，提示失败发生在哪一步。
- 平台校验 webhook 不可用：显示服务端返回的原因（如 webhook 调用超时），不吞掉。
- 未启用：仍可保存与测试，但页面提示不会发送通知。

## 明确不做

- 其余四个渠道（钉钉/企业微信/Slack/Webhook）——下一轮，同一表单引擎。
- 用户级订阅（个人收件箱）。

## 假设

- 平台管理员可创建全局通知对象；对象名与老 console 相同。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01** — 读取并回显已保存的邮件配置（密码除外）。
- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-02** — 保存写入 Config/Secret/Receiver 三对象，创建用集合 POST、更新用带 resourceVersion 的 PUT。
- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-03** — 发送测试按响应体 `Status` 判定结果。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01** — 保存后接口读回的三个对象与页面输入一致。
