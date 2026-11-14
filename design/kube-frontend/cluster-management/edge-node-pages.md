# 边缘节点页面 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/edge-node-pages.md)

## 概述

`pages/cluster/EdgeNodesPage.tsx` + 路由 `…/clusters/$cluster/edgenodes`，详情复用 `NodeDetailPage`。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01

## 设计目标与非目标

目标：边缘节点有独立列表与可达详情。非目标：接入/移除与设备管理。

## 关键约束

- 常规节点列表用 `labelSelector=!node-role.kubernetes.io/edge` 排除边缘节点（实测请求可见），因此边缘列表用反向选择器读同一 kapis 集合。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01 — 详情复用 NodeDetailPage，而不是复制一份

**为什么**：边缘节点的运行状态、容器组、监控、终端与常规节点完全同构；复制一份意味着两份终端协议与两套条件渲染，第二份一定会漂移。

**被否方案**：新建 EdgeNodeDetailPage 复制页签。

**代价**：`NodeDetailPage` 增加可选 `name` / `backTo` 两个属性，页面在缺省时仍按节点路由取参。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-02 — 列表用反向标签选择器，不改后端

**为什么**：接口本来就能按标签过滤；新增一个边缘专用端点会让「边缘」成为服务端概念，而它目前只是节点标签。

## 系统现状

老 console 有 `/clusters/:cluster/edgenodes` 列表与详情；新 UI 此前只有常规节点页，边缘节点在列表里不可见（也不应出现）。

## 仓库落点

- 页面：`pages/cluster/EdgeNodesPage.tsx`
- 详情：`pages/cluster/NodeDetailPage.tsx`（可选 `name`/`backTo`）
- 路由：`routes/kube-frontend.clusters.$cluster/edgenodes/{route,index,$name}.tsx`
- 导航：registry 集群区域 `edgenodes`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 边缘节点集合 | /kapis/resources.kubesphere.io/v1alpha3/nodes?labelSelector=node-role.kubernetes.io/edge |

## 不变量

1. 常规节点列表不出现边缘节点；边缘列表只出现边缘节点。
2. 详情返回链接指回边缘列表。

## 已知坑

- kapis 的节点集合还包含不属于本集群视图的节点（如别的边缘节点），列表以标签选择器为准，用例按选择器结果核对行数。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01.yaml`
句柄：`edgenodes:surface`、`edgenodes:link:<name>`、`edgenodes:retry`。

## 后续改进

- 边缘节点接入向导；设备状态卡片。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01
