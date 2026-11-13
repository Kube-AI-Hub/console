# 持久卷（L3）

[子模块需求](./_index.md)

## 概述

集群级持久卷列表：名称（副行为存储类型）、状态、容量、访问模式、绑定声明、回收策略、创建时间。

## 用户故事

### US1 - 判断一个持久卷被谁占用、释放后会怎样 (Priority: P1)

作为 **集群管理员**，我希望 **看到绑定声明与回收策略**，以便 **判断删除声明后数据会不会被一起删掉**。

**Independent Test**：打开持久卷页，核对某卷的绑定声明与回收策略同 `kubectl get pv` 一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01** — 已知集群存在持久卷，当打开持久卷页，则显示名称、状态、容量、访问模式、绑定声明、回收策略、创建时间七列；已绑定的卷其「绑定声明」形如 `<命名空间>/<声明名>`，未绑定的显示 `-`；行数等于核心 API 返回的数量。

## 设计目标

把「这块存储现在归谁、释放后会不会被删除」放在同一行。

## 约束与边界

- 读核心 API `/api/v1/persistentvolumes`，不走 kapis 代理。
- **只读**：删除持久卷会毁掉数据。
- 全量一次取回并在前端排序（集群内卷数量有限，接口又要 24 秒）。

## UI 交互设计

名称列第二行显示存储类型；状态用徽标（Bound 成功、Available 提示、其余警告）。

## 文案与校验

- 列：名称、状态、容量、访问模式、绑定声明、回收策略、创建时间。
- 未绑定：绑定声明显示 `-`。

## 边界情况

- `spec.capacity.storage` 缺失时显示 `-`。
- 回收策略缺失时按 Kubernetes 默认 `Retain` 显示。

## 明确不做

- 创建、删除持久卷。
- 查看卷内文件。

## 假设

- 核心 API 与 kapis 返回同一批卷。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01** — 七列展示，绑定声明为 `<命名空间>/<名称>`。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02** — 名称列可搜索、可排序。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01** — 卷名集合与 `kubectl get pv` 一致。
