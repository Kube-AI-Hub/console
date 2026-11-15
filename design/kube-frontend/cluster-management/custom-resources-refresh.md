# 扩展资源列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/custom-resources-refresh.md)

## 概述

`CustomResourcesPage` 接 `query`（CRD 列表），`CustomResourceDetailPage` 接 `instances`（某个 CRD 下的实例）。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01

## 设计目标与非目标

目标：两层列表都能主动重读。非目标：轮询、watch。

## 关键约束

- 实例页的 schema 依赖数组原来包含 `apiPath` 等，需补 `instances.isFetching`。
- 实例列表的 `ResourceList` 位于条件渲染块中（`rows.length` 判断），插入 `onRefresh` 时要落在列表本体而非空态块。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01 — 刷新只重发当前 CRD 的查询

**为什么**：实例列表按 CRD 的 apiPath 取数；把 CRD 列表也一起刷新会让切换 CRD 时的请求变多，而读者点的是「当前这张表的刷新」。

## 系统现状

老 console 的扩展资源列表有刷新；新 UI 此前没有。

## 仓库落点

- 页面：`cluster/{CustomResourcesPage,CustomResourceDetailPage}.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `custom-resources:refresh`、`custom-resource:refresh` |
| 空态出口 | `empty-state:refresh`、`empty-state:clear` |

## 不变量

1. 刷新保留排序与页码。
2. 实例页刷新只针对当前 CRD。

## 已知坑

- 忘记把 `isFetching` 放进 schema 依赖 → 按钮永久禁用。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01.yaml`

## 后续改进

- 与 R-27 一起评估轮询。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01
