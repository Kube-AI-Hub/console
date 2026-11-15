# 企业空间控制台的列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-lists-refresh.md)

## 概述

`WorkspaceRolesPage`、`WorkspaceProjectsPage`、`WorkspaceQuotaPage` 各自持有 `useQuery`，刷新能力由共享的 `@/components/resource/useListRefresh` 提供。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-01

## 设计目标与非目标

目标：三个列表都能主动重读，空态有出口。非目标：轮询、watch、跨列表统一刷新。

## 关键约束

- `ResourceList` 只在同时拿到 `schema.refresh` 与 `onRefresh` 时渲染按钮；`useListRefresh` 一次给出两者，避免只接一半。
- `busy` 取查询自身的 `isFetching`，后台重取也会反映。
- 空态按钮由组件在存在 `onRefresh`/`onSearchChange` 时渲染；`emptyLabels` 只是覆盖默认文案。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-01 — 每个列表刷新自己的查询

**为什么**：三个页面的查询互不依赖，一个聚合刷新会把三个请求耦合在一起，某个列表变慢时读者无法判断是哪一个。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-02 — 空态文案与工具栏同源

**为什么**：空态里的「刷新」与工具栏的「刷新」是同一个动作；两处文案来自同一份 `emptyLabels`/`refresh`，避免写成两种说法。

## 系统现状

老 console 的企业空间控制台列表都有刷新；新 UI 的三个页面此前没有（审计：54 个列表 0 个刷新按钮）。

## 仓库落点

- 页面：`apps/console-next/src/pages/workspace/{WorkspaceRolesPage,WorkspaceProjectsPage,WorkspaceQuotaPage}.tsx`
- 共享能力：`apps/console-next/src/components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 说明 |
| --- | --- |
| 刷新句柄 | `<prefix>:refresh`（`workspace-roles` / `workspace-projects` / `workspace-quota`） |
| 空态出口 | `empty-state:clear`、`empty-state:refresh` |

## 不变量

1. 刷新只重发当前查询（保留页码、搜索与筛选）。
2. 空态在存在刷新或搜索时总有出口。

## 已知坑

- `dist` 需要重新构建才会反映到本地 5178；只跑 tsc 不会更新页面。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-01.yaml`
句柄：`workspace-roles:refresh`、`workspace-projects:refresh`、`workspace-quota:refresh`、`empty-state:clear`

## 后续改进

- 与 R-27（实时刷新）一起评估是否需要轮询。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-01
