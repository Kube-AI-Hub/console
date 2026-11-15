# 其余独立列表页刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/remaining-lists-refresh.md)

## 概述

六页各自持有查询，刷新由 `@/components/resource/useListRefresh` 提供。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01

## 设计目标与非目标

目标：六页可主动重读。非目标：面板型列表（另立单元）、轮询。

## 关键约束

- `busy` 进入 schema，schema 依赖必须包含查询的 `isFetching`。
- JuiceFS 页的 schema 以 `rowKey` 开头（没有 `title`），插入 `refresh` 要放在 schema 根对象，不能落进第一个列定义（本批踩过一次，按钮因此不渲染）。
- 插入 import 时不要落在多行 import 块中间（本批踩过一次，出现 `import {` 后紧跟新 import 的语法错误）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01 — 页签持有的列表只在该页签给刷新

**为什么**：JuiceFS 页的「用量」「性能」页签读取的是指标，不是列表；在页签外放一个刷新会让读者期待它重读指标。刷新跟随持有列表的那个页签。

## 系统现状

老 console 的对应列表有刷新；新 UI 此前没有。

## 仓库落点

- 页面：`devops/DevopsProjectsPage.tsx`、`cluster/{JuiceFSStoragePage,ClusterCustomMonitoringPage}.tsx`、`app-workloads/{CanaryReleasesPage,ImageBuilderPage}.tsx`、`serviceaccounts/ServiceAccountsPage.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `devops:refresh`、`cluster-juicefs:refresh`、`custom-monitoring:refresh`、`grayrelease:refresh`、`image-builder:refresh`、`serviceaccounts:refresh` |
| 空态出口 | `empty-state:refresh`、`empty-state:clear` |

## 不变量

1. 刷新保留搜索、排序与页码。
2. JuiceFS 刷新只出现在「卷」页签。

## 已知坑

- 忘记把 `isFetching` 放进 schema 依赖 → 按钮永久禁用。
- schema 没有 `title` 时不要用 title 定位插入点。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01.yaml`

## 后续改进

- 与 R-27 一起评估轮询；面板型列表在父页接入。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01
