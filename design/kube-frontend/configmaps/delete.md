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


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02 — 确认框用 ai-kit `Modal`

**为什么**：删除必须打断当前操作，且外观要和 overlays 的确认弹窗一致。`ResourceList` 的 `confirm` 字段打开同一套 `Modal`（标题为确认文案，页脚取消/确认）；生产页的 `DeleteDialog` 也建立在这个 `Modal` 上。浏览器原生 `window.confirm` 无法套主题、无法居中，看起来像系统提示。

**被否方案**：`window.confirm`：阻塞脚本是优点，但样式和焦点都不属于控制台。

**何时重新考虑**：确认需要展示键数量、关联工作负载等更多上下文时，往 `Modal` 的 body 加内容即可。


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

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01** — 确认 `Modal` 用 CSS `translate` 属性居中，不能用 Tailwind 的 `-translate-x-1/2`：后者写在 `transform` 上，会和入场动画抢同一个属性，弹窗会落在中心的右下方。
  处置：`[translate:-50%_-50%]`，单测 `modal-centering.test.ts` 锁住。
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
