# 智能体可操作性 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/ai-surface.md`](../../../prd/kube-frontend/configmaps/ai-surface.md)。

## 概述

本文件说明该功能点的实现方式与取舍，不复述需求。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02`

## 设计目标与非目标

**目标**：行为可预测、失败可解释、实现可被架构测试约束。

**非目标**：不做与需求「明确不做」条目相冲突的能力。

## 关键约束

- 状态与文案分离：组件只接收 props，文案来自 `packages/locales`。
- 所有可交互元素经 `AiButton` / `actionProps`，保证 `data-ai-id` 不缺失。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01 — 句柄用 `data-ai-id` 而非 `data-testid`

**为什么**：`data-testid` 是测试专用命名，容易被当作可随时改的临时属性；`data-ai-id` 明确是对外契约的一部分，改名属于破坏性变更。

**被否方案**：复用 `data-testid`：省一个属性，但语义上把它降级为测试细节。

**何时重新考虑**：无


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02 — `aiId` 设为必填 prop

**为什么**：缺失句柄是静默失效——页面照常工作，只有自动化时才暴露。设为必填让遗漏变成编译错误。

**被否方案**：可选 prop + 测试扫描：能发现，但发现得晚。

**何时重新考虑**：无


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-03 — 契约测试扫描裸 `<button>`

**为什么**：约定最容易在「临时加一个按钮」时被绕过。扫描源码让违规在 CI 就失败，而不是等自动化找不到元素。

**被否方案**：只在文档里约定：已验证无效，第一批代码就出现了裸按钮。

**何时重新考虑**：无


## 系统现状

首个资源模块，无可继承的历史实现；行为以需求为准。

## 仓库落点

- 契约：`kube-frontend/packages/ai-surface/src/`
- 控件：`kube-frontend/packages/ui/src/ai-controls.tsx`
- 页面：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapsPage.tsx`
- 约束：`kube-frontend/config/ai-surface-contract.test.ts`

## 对外契约

见 L1 的 `/api/configmaps` 契约；本功能点不新增端点。

## 不变量

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01** — 页面只通过 `AiSurface` 发布状态，不自行拼装属性。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01** — `actionProps` 展开顺序必须在 `onClick` 之后，否则会覆盖业务 handler。
  处置：统一 `{...rest} {...actionProps(...)}`。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02** — `data-ai-state` 放在页面根元素而非 `document`：同页可能有多个区域各自加载，全局状态无法区分。
  处置：每个 `AiSurface` 自带状态。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-03** — TanStack Router 挂载时会短暂存在两棵同构树，`querySelector` 可能取到旧节点读到上一轮状态。
  处置：测试取最后一个匹配节点或先用 `waitFor` 等其出现。

## 测试与可观测

- 单元/集成：`apps/console-next/test/configmaps-page.test.tsx`
- 约束：`config/ai-surface-contract.test.ts`

## 后续改进

与需求「明确不做」保持一致，扩展时先改需求再改方案。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02`
