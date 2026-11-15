# 应用商店列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/app-store/appstore-lists-refresh.md)

## 概述

`WorkspaceAppsPage` 与 `WorkspaceReposPage` 各自持有查询，刷新由 `useListRefresh` 提供。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_STORE-APPSTORE_LISTS_REFRESH-01

## 设计目标与非目标

目标：两个列表可主动重读。非目标：改造商店管理页的整页刷新、轮询。

## 关键约束

- 仓库页原本有 `onRefresh` 但 schema 缺 `refresh` 条目 —— `ResourceList` 只在两者同时存在时渲染按钮，所以按钮此前根本不出现（审计里表现为「无刷新」）。
- `busy` 进入 schema，schema 依赖需包含 `query.isFetching`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-APPSTORE_LISTS_REFRESH-01 — 商店管理页不动

**为什么**：它已有页面级刷新（`window.location.reload()`），再加一个列表级按钮会出现两个刷新入口且行为不同。把整页重载换成 refetch 属行为变更，另立单元评估。

**已知坑**：审计只看 `refresh:`/`onRefresh` 会漏掉这类「页面级按钮」，接入前应先打开页面数按钮。

## 系统现状

老 console 的应用/仓库列表有刷新；商店管理页已有页面级刷新。

## 仓库落点

- 页面：`appstore/{WorkspaceAppsPage,WorkspaceReposPage}.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `workspace-apps:refresh`、`workspace-repos:refresh` |
| 商店管理（既有） | `store-manage:<view>:refresh` |
| 空态出口 | `empty-state:refresh`、`empty-state:clear` |

## 不变量

1. 刷新保留搜索、排序与页码。
2. 商店管理页只有原有那一个刷新入口。

## 已知坑

- 路由是 `/kube-frontend/apps-manage/*`（平台作用域）而不是 `/store/*`。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/app-store/TC-L3-KUBE-FRONTEND-APP_STORE-APPSTORE_LISTS_REFRESH-01.yaml`

## 后续改进

- 评估把商店管理页的整页刷新改成列表 refetch。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_STORE-APPSTORE_LISTS_REFRESH-01
