# IP 池（L3）

[子模块需求](./_index.md)

## 概述

集群级 Pod IP 池：列表（网段、已用 IP、归属工作空间、是否默认）与详情（基本信息、工作空间用量、使用该池的容器组）。

## 用户故事

### US1 - 看清 IP 段被谁用掉了 (Priority: P1)

作为 **平台运维**，我希望 **在集群视角看到每个 Pod IP 池的用量与归属**，以便 **判断某个网段还有多少余量、能不能交给新的企业空间**。

**Independent Test**：打开 IP 池列表，能看到每个池的网段、已用/总量、归属工作空间；点进详情能按工作空间看到用量明细，并看到使用该池的容器组。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01** — 当打开集群 IP 池页，则列出集群内全部 `ippools.network.kubesphere.io`，每行显示网段与已用 IP，默认池带「默认」徽标。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-02** — 当集群没有 IP 池，则显示空态说明「容器组直接从节点网络取地址」，不是空白表格。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-03** — 当打开某个池的详情，则显示网段、可用地址范围与按工作空间汇总的分配数。

## 设计目标

把"这个网段还剩多少、给了谁"一次说清。

## 约束与边界

- 只读：创建/删除 IP 池属于网络插件配置，不在控制台做。
- 容量未知（控制器未同步）时显示「-」或只显示已用，不显示 `0 / 0`。

## UI 交互设计

列表：名称（含默认/禁用徽标）、网段、已用 IP、工作空间、创建时间。详情：基本信息 + 工作空间用量 + 容器组列表。

## 文案与校验

空态与不可用各有独立文案，区分「没有池」与「读不到」。

## 边界情况

- 集群未安装网络插件：接口 404 时显示读取失败与重试，不假装没有池。
- 工作空间为空：显示「-」，不显示「public」（那是命名空间的默认归属，不是池的）。

## 明确不做

- 创建/删除/编辑 IP 池。
- 地址分配明细（`status.allocations` 的全量列表）。

## 假设

- `ippools` 通过 kapis 资源代理可跨命名空间读取。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01** — 列表显示网段、已用 IP、归属工作空间与默认标记。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-02** — 详情显示网段、范围与按工作空间的分配数。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01** — 一个用例覆盖「列表空态/有数据」与「详情按工作空间汇总」。
