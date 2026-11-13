# 企业空间列表（L3）

[子模块需求](./_index.md)

## 概述

企业空间列表：名称（副行描述）、状态、集群关联、创建时间。

## 用户故事

### US1 - 看清平台上有哪些企业空间 (Priority: P1)

作为 **平台管理员**，我希望 **看到企业空间状态与集群关联**，以便 **确认归属**。

**Independent Test**：打开企业空间页，核对名称集合与 `kubectl get workspaces` 一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-02** — 已知在平台管理 → 企业空间页，当「创建」填写名称与别名，则对象存在且 `kubesphere.io/alias-name` 为填写值；当「编辑企业空间」改别名，则注解更新且名称不可改；当「删除」，则该企业空间不再出现在列表中。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01** — 已知平台上有企业空间，当打开企业空间页，则显示名称、状态、集群、创建时间四列。

## 设计目标

让归属可见。

## 约束与边界

- 读 resources 代理 `workspaces`（不是 IAM 组）。

## UI 交互设计

名称两行；状态徽章。

## 文案与校验

- 列：名称、状态、集群、创建时间。
- 集群列：`Cluster` 或 `Multi-cluster (n)`。

## 边界情况

- `spec.clusters` 为空表示主机群，显示 `Cluster`。

## 明确不做

- 企业空间的配额与成员分配（属于企业空间内部页面）。

## 假设

- 企业空间由 resources 代理服务。

## 验收用例

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01** — 列表展示四列。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01** — 名称集合与集群内企业空间一致。
