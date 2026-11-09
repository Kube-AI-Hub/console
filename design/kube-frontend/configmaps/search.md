# 按名称搜索 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/search.md`](../../../prd/kube-frontend/configmaps/search.md)。

## 概述

本文件说明该功能点的实现方式与取舍，不复述需求。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02`

## 设计目标与非目标

**目标**：行为可预测、失败可解释、实现可被架构测试约束。

**非目标**：不做与需求「明确不做」条目相冲突的能力。

## 关键约束

- 状态与文案分离：组件只接收 props，文案来自 `packages/locales`。
- 所有可交互元素经 `AiButton` / `actionProps`，保证 `data-ai-id` 不缺失。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01 — 防抖 250ms

**为什么**：输入每个字符都请求会打满上游；250ms 在「感觉即时」与「请求可控」之间。用 `useEffect` + `setTimeout` 而非第三方防抖库：只有一处需要。

**被否方案**：输入即请求 + 取消前序。TanStack 会丢弃过期结果，但请求已经发出去了，浪费仍在。

**何时重新考虑**：上游限流或延迟明显时再调大


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02 — 搜索回第 1 页

**为什么**：在结果变少的情况下停在第 3 页会得到空白页，用户会以为搜索坏了。重置页码是更符合预期的行为。

**被否方案**：保持当前页并显示空态：会让用户误判「没有结果」。

**何时重新考虑**：None


## 系统现状

首个资源模块，无可继承的历史实现；行为以需求为准。

## 仓库落点

- 页面：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapsPage.tsx`
- 查询：`kube-frontend/apps/console-next/src/pages/configmaps/queries.ts`

## 对外契约

见 L1 的 `/api/configmaps` 契约；本功能点不新增端点。

## 不变量

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01** — 页面只通过 `AiSurface` 发布状态，不自行拼装属性。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01** — `setState` 在 `useEffect` 里改了 `page`，但同一次渲染中 `keyword` 仍是旧值；必须让防抖后的值同时驱动请求与页码重置，否则会发出两次请求（一次旧关键字新页、一次新关键字第 1 页）。
  处置：把重置写进同一个防抖回调。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02** — `type="search"` 在部分浏览器自带清除按钮，点它会触发 `input` 事件但 `nativeEvent` 不同；不要依赖 `change` 事件。
  处置：统一监听 `onChange`。

## 测试与可观测

- 单元/集成：`apps/console-next/test/configmaps-page.test.tsx`
- 约束：`config/ai-surface-contract.test.ts`

## 后续改进

与需求「明确不做」保持一致，扩展时先改需求再改方案。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02`
