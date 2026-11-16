# 平台信息（L3）

[子模块需求](../../../prd/kube-frontend/platform-settings/info.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01

## 概述

平台信息三行。

## 设计目标与非目标

只读呈现。非目标：编辑。

## 关键约束

- 核心组 ConfigMap；`console` 段可选。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01 — 缺少 console 段时显示 `-` 而不是隐藏卡片

**为什么**：卡片存在但值为空，传达的是「这项没有配置」；隐藏卡片传达的是「这项不存在」，会让管理员以为页面不支持该配置。

**被否方案**：无值时整卡隐藏。信息量下降，且难以区分「未配置」与「页面遗漏」。

**何时重新考虑**：配置中该段变为必填时。

## 系统现状

老 console 平台信息页可编辑标题与描述；本模块只读。

## 仓库落点

- `pages/platform/PlatformInfoPage.tsx`（`/kube-frontend/settings/info`）
- `packages/api-client/src/access.ts` 的 `configScalar`

## 对外契约

读 `/api/v1/namespaces/kubesphere-system/configmaps/kubesphere-config`。

## 不变量

三行始终渲染。

## 已知坑

- resources 代理对该 ConfigMap 返回 500，必须走核心组。

## 测试与可观测

E2E 见 `tests/kube-frontend/platform-settings/`；单测覆盖 `configScalar` 的分段边界。

## 后续改进

编辑平台信息。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01`
