# 边缘节点页面（L3）

[子模块需求](./_index.md)

## 概述

边缘节点列表与详情。新 UI 的常规节点列表刻意排除边缘节点（`labelSelector=!node-role.kubernetes.io/edge`），因此边缘节点需要自己的列表与入口，详情复用节点详情（运行状态/容器组/监控/终端）。

## 用户故事

### US1 - 找到可能间歇在线的边缘节点 (Priority: P2)

作为 **集群管理员**，我希望 **在一个列表里看到本集群的边缘节点**，以便 **不必先怀疑它们为什么不在常规节点列表里**。

**Independent Test**：打开边缘节点页，行数等于带 `node-role.kubernetes.io/edge` 标签且属于本集群的节点数；点击名称进入详情并看到运行状态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01** — 已知集群至少有一个边缘节点，当打开边缘节点列表，则只显示同时带 `node-role.kubernetes.io/edge` 标签的节点（行数等于该选择器返回数），每行显示名称、状态、内网 IP、创建时间；点击名称进入节点详情（运行状态页签），返回链接回到边缘节点列表而不是常规节点列表；集群没有边缘节点时显示明确空态。

## 设计目标

1. 边缘节点与常规节点分开列，与老 console 一致。
2. 详情复用而不是复制：同一份运行状态/容器组/监控/终端。

## 约束与边界

- 读 `/kapis/resources.kubesphere.io/v1alpha3/nodes?labelSelector=node-role.kubernetes.io/edge`；不新增后端接口。
- 只读；边缘节点接入（join）属后续批次。

## UI 交互设计

- 列表：名称（链到详情）、状态徽标、内网 IP、创建时间；搜索、排序、刷新。
- 详情：与常规节点详情同一页面，返回链接指回边缘节点列表。

## 文案与校验

- 无边缘节点时说明「接入后会显示在这里」，并注明接入入口属下一批。

## 边界情况

- 边缘节点 NotReady：状态徽标为异常，仍可进入详情查看条件。
- 读取失败：错误面板 + 重试，不渲染空表。

## 明确不做

- 边缘节点接入/移除（`edgeruntime.kubesphere.io/v1alpha1/nodes/join` 属写操作，另立批次）。
- 设备/设备模板（老 console 的边缘节点详情未包含，属边缘运行时模块）。

## 假设

- 边缘节点与常规节点由同一节点对象表示，仅标签区分（实测：`sg` 节点带 edge 标签且 Ready）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01** — 边缘节点列表页 + 复用节点详情 + 列表链接。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01** — 边缘节点列表行数等于标签选择结果；详情可达且返回链接正确。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01`
