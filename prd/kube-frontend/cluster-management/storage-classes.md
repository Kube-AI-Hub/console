# 存储类型（L3）

[子模块需求](./_index.md)

## 概述

集群级存储类型列表：名称（默认类型带徽标）、供应者、存储卷数、能力、回收策略、创建时间。

## 用户故事

### US1 - 确认某个存储类适合做什么 (Priority: P1)

作为 **集群管理员**，我希望 **看到供应者、回收策略与支持的能力**，以便 **判断新存储该选哪一类**。

**Independent Test**：打开存储类型页，核对默认类的徽标与各行的能力标记。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 已知集群有多个存储类型，当打开存储类型页，则显示名称、供应者、存储卷数、能力、回收策略、创建时间六列；标了默认的那一行带「默认」徽标；能力列只列出该类型实际支持的能力（不支持的不显示），且与 API 的 `allowVolumeExpansion` 等字段一致。

## 设计目标

让「这个存储类能做什么」一眼可读，而不是靠比较颜色推断。

## 约束与边界

- 读集群级 `storage.k8s.io/v1/storageclasses`，无 namespace 段。
- 默认类型取 `storageclass.kubernetes.io/is-default-class` 注解。
- 回收策略与绑定模式未设置时按 Kubernetes 默认值显示（`Delete` / `Immediate`）。

## UI 交互设计

名称旁带「默认」徽标；能力列用徽标列出支持项，无支持项显示 `-`。

## 文案与校验

- 列：名称、供应者、存储卷数、能力、回收策略、创建时间。
- 能力：扩容 / 克隆 / 快照。

## 边界情况

- 平台未上报存储卷数时显示 `-`（不是 0）。
- 没有能力字段时能力列为 `-`。

## 明确不做

- 创建与编辑存储类型（属基础设施操作）。
- 设为默认类型的操作。

## 假设

- 克隆与快照能力由存储类字段或其注解声明。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 列表六列，能力只显示支持项。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02** — 默认类型带徽标。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 名称集合与 `kubectl get storageclass` 一致。
