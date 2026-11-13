# 平台设置（L2）

[上级模块](../_index.md)

平台自身的配置：平台信息与通知渠道。地址形如 `/kube-frontend/settings/<page>`，不属于任何项目或集群。

## 概述

- **路由**：`/kube-frontend/settings/{info,notifications}`
- **谁用**：平台管理员，确认「平台叫什么、控制台在哪个地址、通知发得出去吗」。
- **做哪几步**：打开平台信息 → 看名称与地址；切到通知渠道 → 看五种渠道哪些已配置。
- **看到什么**：三行属性；五个渠道各带「已配置 / 未配置」。

## 用户故事

### US1 - 确认平台自称与通知渠道状态 (Priority: P1)

作为 **平台管理员**，我希望 **一眼看到平台名称、控制台地址与各通知渠道是否可用**，以便 **在告警发不出去时先排除渠道未配置**。

**Independent Test**：打开通知渠道页，核对五个渠道的徽标与平台 Secret 是否存在一致。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01** — 已知已登录且有平台权限，当在两个页签之间切换，则每次都显示对应内容，页签高亮跟随，切换不产生文档请求，且不出现项目工作区栏。

## 设计目标

1. 只读呈现，不做可能破坏平台配置的写操作。
2. 未配置是正常状态，显式说明而非留空。

## 约束与边界

- 平台信息读核心组 ConfigMap `kubesphere-system/kubesphere-config` 的 `kubesphere.yaml` 中的 `console` 段。
- 通知渠道按 `kubesphere-monitoring-system` 中是否存在 `<channel>s` Secret 判定；**不读取 Secret 内容**。
- 配置里没有 `console` 段时，三行显示 `-`（这是真实状态，不是缺陷）。

## UI 交互设计

两张卡片：平台信息（定义列表）与通知渠道（五行的列表）；底部一行说明编辑能力未提供。

## 页面结构

| 页签 | 路由 |
|---|---|
| 平台信息 | `/kube-frontend/settings/info` |
| 通知渠道 | `/kube-frontend/settings/notifications` |

## 文案与校验

- 属性名：平台名称、平台描述、控制台地址。
- 渠道：邮件、钉钉、企业微信、Slack、Webhook。
- 状态：已配置 / 未配置。

## 异常态

- 加载中：骨架；失败：错误面板 + 重试。
- 通知 Secret 列表不可读：显示全部「未配置」而不是报错（列表为空与无权限在页面上都应表现为「没有已配置的渠道」，并由此处的文案说明）。

## 功能点

| 功能点 | 需求 |
|---|---|
| 平台信息 | [info.md](./info.md) |
| 通知渠道 | [notifications.md](./notifications.md) |

## 明确不做

- 编辑平台信息与通知渠道（渠道凭据是可读性受限的 Secret）。
- 第三方登录配置（依赖外部身份提供方）。
- 读取或显示任何渠道凭据。

## 假设

- 平台配置以 `kubesphere.yaml` 单文件存放，`console` 段为可选。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01`

## 功能需求

- **FR-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01** — 两页共用区域布局，不出现项目工作区栏。
- **FR-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-02** — 未配置状态显式呈现。

## 成功标准

- **SC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01** — 渠道徽标与平台 Secret 的存在性一致。
