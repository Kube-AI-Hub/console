# 删除配置字典 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/delete.md`](../../../prd/kube-frontend/configmaps/delete.md)。

## 概述

本文件说明该功能点的实现方式与取舍，不复述需求。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02`

## 设计目标与非目标

**目标**：行为可预测、失败可解释、实现可被架构测试约束。

**非目标**：不做与需求「明确不做」条目相冲突的能力。

## 关键约束

- 状态与文案分离：组件只接收 props，文案来自 `packages/locales`。
- 所有可交互元素经 `AiButton` / `actionProps`，保证 `data-ai-id` 不缺失。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01 — 逐个删除

**为什么**：上游批量删除无事务。串行执行让「第几个失败」可确定，也避免瞬时并发冲击。

**被否方案**：`Promise.all` 并行：更快，但失败信息会丢失顺序。

**何时重新考虑**：上游支持真正的批量接口时


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02 — 确认框用 `window.confirm`

**为什么**：首期没有确认弹窗组件，`window.confirm` 是唯一既阻止误操作、又天然阻塞自动化脚本的方式。自动化无法在确认前绕过它，这是刻意的。

**被否方案**：自己画一个 Modal：需要处理焦点陷阱与 Esc，属于 ai-kit 已有的 Modal，但本期未接入。

**何时重新考虑**：确认需要展示更多上下文（键数量、关联工作负载）时


## 系统现状

首个资源模块，无可继承的历史实现；行为以需求为准。

## 仓库落点

- 页面：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapsPage.tsx`
- 查询：`kube-frontend/apps/console-next/src/pages/configmaps/queries.ts`

## 对外契约

见 L1 的 `/api/configmaps` 契约；本功能点不新增端点。

## 不变量

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01** — 页面只通过 `AiSurface` 发布状态，不自行拼装属性。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01** — `window.confirm` 在 jsdom 中未实现，测试需要 stub 返回值；否则 `mutateAsync` 永远不触发。
  处置：测试内 `vi.spyOn(window, 'confirm')`。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02** — 删除后必须 `invalidateQueries`，只 `setQueryData` 移除行会让总数与分页错位。
  处置：统一失效 `['configmaps']` 前缀。

## 测试与可观测

- 单元/集成：`apps/console-next/test/configmaps-page.test.tsx`
- 约束：`config/ai-surface-contract.test.ts`

## 后续改进

与需求「明确不做」保持一致，扩展时先改需求再改方案。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02`
