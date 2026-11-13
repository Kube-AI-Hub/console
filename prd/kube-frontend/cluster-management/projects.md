# 项目列表（L3）

[子模块需求](./_index.md)

## 概述

集群内全部项目空间的列表：名称（副行描述）、状态、企业空间、创建时间。

## 用户故事

### US1 - 看到集群里有哪些项目 (Priority: P1)

作为 **集群管理员**，我希望 **一次看到所有项目及其所属企业空间**，以便 **确认归属关系**。

**Independent Test**：打开项目页，核对名称集合与 `kubectl get ns` 一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-02** — 已知集群可访问 metrics.k8s.io，当打开项目列表，则显示「CPU 使用率」「内存使用率」「容器组数」三列，其中容器组数与该项目的 Pod 数一致，用量为该项目所有 Pod 容器用量之和（非全 0）。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01** — 已知集群内至少有一个项目，当打开项目页，则显示名称、状态、企业空间、创建时间四列。

## 设计目标

让归属关系可见：项目名相同但企业空间不同是常见情况。

## 约束与边界

- 读集群级 `namespaces` 集合。
- 企业空间取 `kubesphere.io/workspace` 标签。

## UI 交互设计

名称两行；状态徽章 Active 成功色。

## 文案与校验

- 列：名称、状态、企业空间、创建时间。
- 状态：Active / Terminating。

## 边界情况

- 没有企业空间标签时显示 `-`。

## 明确不做

- 项目创建、编辑、删除。

## 假设

- KubeSphere 用命名空间承载项目。

## 验收用例

- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01** — 列表展示四列，企业空间取自标签。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01** — 名称集合与 `kubectl get ns` 一致。
