# 配置字典列表 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/list.md`](../../../prd/kube-frontend/configmaps/list.md)。

## 概述

本文件说明该功能点的实现方式与取舍，不复述需求。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03`

## 设计目标与非目标

**目标**：行为可预测、失败可解释、实现可被架构测试约束。

**非目标**：不做与需求「明确不做」条目相冲突的能力。

## 关键约束

- 状态与文案分离：组件只接收 props，文案来自 `packages/locales`。
- 所有可交互元素经 `AiButton` / `actionProps`，保证 `data-ai-id` 不缺失。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01 — 简化排序状态

**为什么**：用两个 useState（sortBy / order）而不是一个对象。列头只需要知道「是不是我」和「方向」，两个值足够，也不需要担心对象引用变化触发多余渲染。

**被否方案**：把排序塞进 URL query：便于分享，但本期路由未做搜索参数序列化，先不放。

**何时重新考虑**：需要分享排序后的链接时


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02 — 列定义放组件内

**为什么**：列数组在页面组件里就地定义，类型由 `TableColumn<ConfigMapSummary>` 约束。抽出去会让「这个资源有哪些列」与「这个页面怎么展示」分离，首期两种需求还没出现分化。

**被否方案**：立刻抽成通用 `resourceColumns` 注册表：在没有第二个使用者前属于提前抽象。

**何时重新考虑**：第二个资源模块出现、且列结构重复时


## 系统现状

首个资源模块，无可继承的历史实现；行为以需求为准。

## 仓库落点

- 页面：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapsPage.tsx`
- 查询：`kube-frontend/apps/console-next/src/pages/configmaps/queries.ts`

## 对外契约

见 L1 的 `/api/configmaps` 契约；本功能点不新增端点。

## 不变量

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — 页面只通过 `AiSurface` 发布状态，不自行拼装属性。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — `aria-sort` 只能有一个 `ascending`/`descending`，其余列必须是 `none` 或省略。全部给 `none` 会让读屏软件把每列都读成可排序，而实际只有两列可排。
  处置：只给可排序列加 `aria-sort`。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02** — 列宽用 `style={{ width }}` 而不是 Tailwind 类：`ListColumn.width` 可能是数字或百分比，动态类名不会被 Tailwind 扫描到。
  处置：宽度走 inline style。

## 测试与可观测

- 单元/集成：`apps/console-next/test/configmaps-page.test.tsx`
- 约束：`config/ai-surface-contract.test.ts`

## 后续改进

与需求「明确不做」保持一致，扩展时先改需求再改方案。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03`
