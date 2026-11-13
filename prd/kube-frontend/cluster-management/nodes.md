# 节点列表（L3）

[子模块需求](./_index.md)

## 概述

集群节点的列表：名称（副行内网 IP）、状态、角色、CPU、内存。

## 用户故事

### US1 - 确认节点是否就绪、还剩多少资源 (Priority: P1)

作为 **集群管理员**，我希望 **一眼看到每个节点的就绪状态与可分配资源**，以便 **判断能否继续调度**。

**Independent Test**：打开节点页，核对状态徽章与 `kubectl get nodes` 的 STATUS 列一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02** — 已知集群可访问 metrics.k8s.io，当打开节点列表，则显示「CPU 使用率」与「内存使用率」两列，取值为 0–100 的整数百分比，等于该节点当前用量与可分配量之比（允许四舍五入差 1）；指标不可用时显示 `-`。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01** — 已知集群至少有一个节点，当打开节点页，则显示名称、状态、角色、CPU、内存五列，且状态为 Ready 或 NotReady。

## 设计目标

落实「节点状态只看 Ready 条件」。

## 约束与边界

- 读集群级 `nodes` 集合，无 namespace 段。
- 角色取 `node-role.kubernetes.io/*` 标签，缺省为 `worker`。

## UI 交互设计

状态徽章：Ready 成功色，其余危险色；CPU/内存为可分配量（Kubernetes 数量字符串原样显示）。

## 文案与校验

- 列：名称、状态、角色、CPU、内存。
- 状态：Ready / NotReady / Unknown。

## 边界情况

- 没有 Ready 条件的节点显示 Unknown。
- 没有内部 IP 时副行显示 `-`。

## 明确不做

- 节点排空、污点编辑、Pod 列表。

## 假设

- 节点状态由 kubelet 上报。

## 验收用例

- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01** — 列表展示五列，状态取自 Ready 条件。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01** — 名称集合与 `kubectl get nodes` 一致。
