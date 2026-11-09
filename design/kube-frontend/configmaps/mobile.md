# 移动端适配 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/mobile.md`](../../../prd/kube-frontend/configmaps/mobile.md)。

## 概述

本文件说明该功能点的实现方式与取舍，不复述需求。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02`

## 设计目标与非目标

**目标**：行为可预测、失败可解释、实现可被架构测试约束。

**非目标**：不做与需求「明确不做」条目相冲突的能力。

## 关键约束

- 状态与文案分离：组件只接收 props，文案来自 `packages/locales`。
- 所有可交互元素经 `AiButton` / `actionProps`，保证 `data-ai-id` 不缺失。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01 — 断点决策进应用壳

**为什么**：侧栏/抽屉由 `AppShell` 用 `useIsMobile()` 决定，页面只负责列折叠。若每页各写一遍，新增路由时必然遗漏。

**被否方案**：纯 CSS 媒体查询隐藏侧栏：无法在打开抽屉时锁定滚动与焦点。

**何时重新考虑**：无


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02 — 触控下限写在 `AiButton`

**为什么**：`min-h-11 sm:min-h-9` 集中在一处，所有按钮自动满足 44px。散落到页面就回到「这个页面忘了」。

**被否方案**：每个页面自己加 padding：不可维护。

**何时重新考虑**：无


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-03 — 列折叠用条件 className

**为什么**：`hidden sm:table-cell` 让同一份列定义在两端共用，不需要维护两套列。

**被否方案**：用 `useIsMobile` 过滤列数组：切换视口时列会重排，且首帧可能错。

**何时重新考虑**：列数多到需要完全不同的移动布局时


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

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01** — 页面只通过 `AiSurface` 发布状态，不自行拼装属性。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01** — `100vh` 在移动端地址栏收起时跳变，必须用 `100dvh`。
  处置：布局高度用 `dvh`。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02** — 表格容器需 `overscroll-x-contain`，否则横滑到边缘会触发浏览器返回手势，页面直接被划走。
  处置：容器同时设置 `overflow-x-auto` 与 `overscroll-x-contain`。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-03** — jsdom 的 `matchMedia` 默认不存在，组件首次渲染会抛错；测试必须在 setup 里补 stub。
  处置：setup.ts 里补 no-match 实现。

## 测试与可观测

- 单元/集成：`apps/console-next/test/configmaps-page.test.tsx`
- 约束：`config/ai-surface-contract.test.ts`

## 后续改进

与需求「明确不做」保持一致，扩展时先改需求再改方案。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02`
