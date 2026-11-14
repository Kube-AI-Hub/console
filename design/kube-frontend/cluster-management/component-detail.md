# 系统组件详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/component-detail.md)

## 概述

`apps/console-next/src/pages/cluster/ComponentDetailPage.tsx` + 路由 `kube-frontend/clusters/$cluster/components/$name`。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-01

## 设计目标与非目标

目标：一步定位到具体 Pod。非目标：组件写操作。

## 关键约束

- 组件接口 `GET /kapis/resources.kubesphere.io/v1alpha3/components` 返回**裸数组**，每项是聚合（healthyBackends/totalBackends/startedAt/namespace），没有单对象接口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-01 — 按名称前缀找后端容器组

**为什么**：标签在各模块不一致（ks-console 用 `app=`，minio 用 `release=`），按标签查会漏；组件 Pod 名都以组件名为前缀，这是对所有组件都成立的判据。

**被否方案**：按 `app=<组件名>`（minio 等漏）、逐组件维护标签映射（版本升级即失效）。

**已知限制**：前缀匹配在「组件名是另一组件名前缀」时会多算（当前 49 个组件无此情况）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-02 — 详情从列表数据里挑行，不新增单对象接口

**为什么**：没有单组件接口；列表一次返回 49 行，挑行零成本，且与列表页共享同一 query key（缓存）。

## 系统现状

老 console 的系统组件详情显示副本数与 Pod 列表。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ComponentDetailPage.tsx`
- 路由：`routes/kube-frontend.clusters.$cluster/components/$name.tsx`
- 列表链接：`ComponentsPage.tsx`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 组件聚合列表 | /kapis/resources.kubesphere.io/v1alpha3/components |
| 命名空间容器组 | /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/pods |

## 不变量

1. 找不到后端时必须渲染空态文案（不是空表）。
2. 组件名不存在时给出「不存在」而不是错误页。

## 已知坑

- 组件接口是裸数组，走不了统一 `resourceApi`（会解析成空列表）。
- Pod 标签不可靠，别用标签选择器。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-01.yaml`
句柄：`component-detail`、`component-detail:pods`、`component-detail:no-pods`。

## 后续改进

- 组件详情加「最近事件」页签。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-01
