# 聚合型列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/aggregate-lists-refresh.md)

## 概述

三处聚合列表各自把「多个来源」合成为一个刷新源，再交给 `useListRefresh`。

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01

## 设计目标与非目标

目标：聚合表的刷新覆盖全部来源。非目标：拆分页面、轮询。

## 关键约束

- `useListRefresh` 接受 `ListRefreshSource`（`isFetching` + `refetch`），聚合页提供 `{ isFetching: a || b, refetch: () => { a.refetch(); b.refetch(); } }` 即可，不需要伪造查询对象。
- 成员详情的表**没有**查询（行由父级传入），因此它用 `useQueryClient().invalidateQueries()` 作为 `refetch`；这比把回调逐层传下来更不容易漏。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01 — 刷新取所有来源的并集

**为什么**：聚合表的一行由多个来源拼成；只刷新其中一半会让表格出现「新指标 + 旧归属」，读者会以为是数据错误。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-02 — 表格自己发起失效，而不是接受回调

**为什么**：成员详情页的两个调用点共用同一个表组件；回调需要两处传参，漏一处就有一个页签不能刷新。让表格自己 `invalidateQueries()` 只有一个实现。

## 系统现状

老 console 的对应列表都有刷新；新 UI 此前没有。面板型列表（NodeResourcesPanel / NodeRankingPanel）已由并行交付带刷新，本批未重复接线。

## 仓库落点

- 页面：`cluster/ResourceMonitorPage.tsx`、`workspace/{WorkspaceUserGroupsPage,WorkspaceMemberDetailPage}.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `cluster-resource-monitor:refresh`、`workspace-user-groups:refresh`、`workspace-member-<tab>:refresh` |

## 不变量

1. 刷新触发聚合表的**全部**来源。
2. 忙碌状态是来源并集。

## 已知坑

- 面板型列表（NodeRankingPanel / NodeResourcesPanel）已带刷新，重复接入会出现两个按钮。
- 在组件解构参数里插入对象字段时不要插在 props 列表中间（本批踩过一次，出现 `refresh: listRefresh.refresh,` 出现在解构里）。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/project-settings/TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01.yaml`

## 后续改进

- 与 R-27 一起评估轮询。

## 验收用例

- TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01
