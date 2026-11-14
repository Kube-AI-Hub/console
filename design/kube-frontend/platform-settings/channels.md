# 钉钉 / 企业微信 / Slack / Webhook 渠道（L3）

[子模块需求](../../../prd/kube-frontend/platform-settings/channels.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01
- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-02
- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-03

## 概述

四个渠道的实现方式：一张声明表 + 一个通用页面。

## 系统现状

老 console 每个渠道一个容器与一个表单组件（`settings/containers/Notification/*`、`components/Forms/Notification/*Form`），五份高度相似的表单；新 UI 原先只有一个只读概览。

## 仓库落点

- `apps/console-next/src/pages/platform/channelDescriptors.ts`（声明表：对象名、字段路径、校验、模式）
- `apps/console-next/src/pages/platform/ChannelConfigPage.tsx`（通用页面）
- `routes/kube-frontend.settings/{mail,dingtalk,wecom,slack,webhook}/`
- `packages/api-client/src/notification.ts`（读写与验证）

## 对外契约

| 渠道 | Config | Receiver | Secret | 备注 |
| --- | --- | --- | --- | --- |
| 钉钉 | `default-dingtalk-config` | `global-dingtalk-receiver` | `global-dingtalk-config-secret` | `spec.dingtalk.{conversation,chatbot}` |
| 企业微信 | `default-wechat-config` | `global-wechat-receiver` | `global-wechat-config-secret` | Config 必须含 `wechatApiSecret` 的 secretKeyRef |
| Slack | `default-slack-config` | `global-slack-receiver` | `global-slack-config-token` | Secret 名是 `-token` |
| Webhook | **无** | `global-webhook-receiver` | `global-webhook-config-secret` | 认证方式在注解 `kubesphere.io/verify-type` |

## 设计目标与非目标

目标：新增渠道是加一条描述。非目标：把五个渠道改成单个"通用表单页"（每渠道一页与老 console 一致，也便于按渠道授权）。

## 关键约束

- 字段路径**相对 `spec` 绝对书写**（`['wechat','toUser']`），`toBodies` 不再拼 `specKey`——早期拼过一次，产出 `spec.email.email.to`，被平台以 `to: Required value` 拒绝。
- 只写当前接入方式的字段组；另一组的历史值保留在对象里但本次不发送。
- 凭据留空 = 沿用；无 Secret 时视为必填。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01 — 声明表 + 通用页

**为什么**：五个渠道的差别是数据不是逻辑；一份声明表让字段路径、校验、对象名集中在一处，审查时看一张表即可。

**被否方案**：照搬老 console 写五个页面。五份几乎相同的代码，改一处要改五遍，而且很容易让某个渠道的路径与事实不一致。

**何时重新考虑**：某渠道需要完全不同的交互（例如带预览的分步向导）。

## 不变量

1. 路径以 `spec` 为根；`enabled` 在 `spec.<channel>.enabled`。
2. 接入方式可从已保存的 Receiver 推断（哪个键存在即哪种方式）。
3. 首次保存必须带凭据；已有 Secret 时留空表示沿用。

## 已知坑

- 企业微信缺 `spec.wechat.wechatApiSecret` 时平台直接拒绝创建 Config。
- Slack 的 Secret 名是 `global-slack-config-token`。
- Webhook 没有 Config，验证时只发 receiver。
- 环境侧：通知组件的校验 webhook 不稳定时，保存会 400，用例据此跳过。

## 测试与可观测

- 单测：`test/channel-descriptors.test.ts`（12 条，覆盖五渠道的对象形状与校验）。
- E2E：四个渠道一个参数化用例，逐渠道断言字段、拦截、保存与读回。

## 后续改进

- 通知条件（alertSelector）。
- 渠道启用状态的总览页（若读者需要横向比较）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01`
