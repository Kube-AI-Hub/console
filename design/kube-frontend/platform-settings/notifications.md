# 通知渠道（L3）

[子模块需求](../../../prd/kube-frontend/platform-settings/notifications.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01

## 概述

五种渠道的配置状态。

## 设计目标与非目标

不读凭据地报告状态。非目标：编辑与测试发送。

## 关键约束

- 只取 Secret 名称列表。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01 — 读失败与未配置同样呈现

**为什么**：对管理员的行动而言两者等价——都意味着「现在依赖这个渠道发告警是不可靠的」。区分它们需要额外文案与分支，收益很小。

**被否方案**：读失败显示错误面板。会让整页变红，而实际结论（没有可用渠道）已经得到。

**何时重新考虑**：平台能区分「无权限读取」与「确实未配置」时。

## 系统现状

老 console 五种渠道各有独立配置页，可编辑并测试。

## 仓库落点

- `pages/platform/PlatformSettingsPage.tsx`（notifications 视图）
- `packages/api-client/src/access.ts` 的 `toNotificationChannels`

## 对外契约

读 `/api/v1/namespaces/kubesphere-monitoring-system/secrets?limit=-1`（仅名称）。

## 不变量

≤ 五行，顺序固定。

## 已知坑

- Secret 数量多时逐个读取会很慢；这里只请求列表。

## 测试与可观测

E2E 见 `tests/kube-frontend/platform-settings/`。

## 后续改进

渠道编辑与测试发送。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01`
