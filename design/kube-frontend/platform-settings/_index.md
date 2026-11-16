# 平台设置（L2）

[子模块需求](../../../prd/kube-frontend/platform-settings/_index.md)

## 关联需求

- AC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01

## 概述

平台信息与通知渠道两个只读页面。

## 设计目标与非目标

目标：只读、无副作用、未配置显式。非目标：任何写入。

## 关键约束

- 平台配置读核心组 ConfigMap；渠道只看 Secret 是否存在。

## 方案决策

### DEC-L2-KUBE-FRONTEND-PLATFORM_SETTINGS-01 — 用缩进扫描读 YAML，而不是引入 YAML 解析器

**为什么**：只需要 `console:` 段下的三个标量。为三个字符串引入解析器，会把它带进首屏 bundle；缩进扫描的规则简单到可以逐行审阅。

**被否方案**：`js-yaml` 解析全文件。首屏成本与收益不成比例。

**何时重新考虑**：需要读取嵌套较深或数量可变的配置项时。

### DEC-L2-KUBE-FRONTEND-PLATFORM_SETTINGS-02 — 渠道只报「是否配置」，不读凭据

**为什么**：渠道凭据是 Secret，读出来对页面没有用处（页面也不显示），却扩大了敏感数据的暴露面。存在性足以回答「告警为什么发不出去」。

**被否方案**：读取 Secret 并显示渠道的部分配置（如 SMTP 主机）。收益是排查更细，代价是把凭据带进前端内存与网络传输。

**何时重新考虑**：平台提供脱敏的渠道状态接口时。

## 系统现状

老 console 平台设置有平台信息页与五种渠道的独立配置页（可编辑）。本模块只做只读呈现。

## 仓库落点

- `apps/console-next/src/pages/platform/PlatformInfoPage.tsx`（平台信息）与 `ChannelConfigPage.tsx`（五种通知渠道）
- `packages/api-client/src/access.ts` 的 `configScalar` / `toPlatformInfo` / `toNotificationChannels`
- `src/routes/kube-frontend.settings/`

## 对外契约

读 `/api/v1/namespaces/kubesphere-system/configmaps/kubesphere-config` 与 `/api/v1/namespaces/kubesphere-monitoring-system/secrets`。

## 不变量

1. 不读取 Secret 内容。
2. 配置缺失时显示 `-`，不显示错误。

## 已知坑

- 目标集群的 `kubesphere.yaml` 里**没有 `console` 段**，三行会显示 `-`。这是配置现状，不是页面缺陷；用例据此断言。
- resources 代理对该 ConfigMap 返回 500，必须走核心组。

## 测试与可观测

E2E：`tests/kube-frontend/platform-settings/`。

## 后续改进

渠道编辑（需要平台侧表单与凭据写入）。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01`

## 页面与技术结构

- 区域 `platform-settings`（两页），布局 `kube-frontend.settings/route.tsx`。
- 组件 `PlatformInfoPage`（平台信息）与 `ChannelConfigPage`（按 `channel` 渲染一个通知渠道）；两者共用 `DefinitionRow` 的只读呈现。

## 状态与数据归属

- 两页各用自己的 Query key；渠道列表不缓存凭据（从不读取）。

## 关键契约与依赖

- `platformInfoApi`、`toNotificationChannels`。

## 明确不做

- 编辑平台信息与通知渠道、第三方登录配置。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 平台信息 | `prd/…/info.md` | `design/…/info.md` |
| 通知渠道 | `prd/…/notifications.md` | `design/…/notifications.md` |
