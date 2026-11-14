# 存储类型（L3）

[子模块需求](./_index.md)

## 概述

集群级存储类型列表：名称（默认类型带徽标）、供应者、存储卷数、能力、回收策略、创建时间。

## 用户故事

### US1 - 确认某个存储类适合做什么 (Priority: P1)

作为 **集群管理员**，我希望 **看到供应者、回收策略与支持的能力**，以便 **判断新存储该选哪一类**。

**Independent Test**：打开存储类型页，核对默认类的徽标与各行的能力标记。

### US2 - 判断一个存储类型的行为 (Priority: P1)

作为 **集群管理员**，我希望 **看到存储类型的绑定模式、回收策略与能力开关**，以便 **判断在它上面申请卷会得到什么行为**。

**Independent Test**：从列表点进存储类型详情，核对绑定模式与能力开关与该对象一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 已知集群有多个存储类型，当打开存储类型页，则显示名称、供应者、存储卷数、能力、回收策略、创建时间六列；标了默认的那一行带「默认」徽标；能力列只列出该类型实际支持的能力（不支持的不显示），且与 API 的 `allowVolumeExpansion` 等字段一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02** — 已知集群中有存储类型，当点击名称进入详情，则显示供应者、回收策略、绑定模式、创建时间、是否允许扩容/克隆/快照与已绑定声明数，并列出该驱动声明的参数（无参数时明确说明）；这些值与该存储类型对象一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03** — 已知一个存储类型被若干存储卷使用，当打开该存储类型详情，则「关联存储卷」列出这些存储卷的名称、命名空间、状态与容量；行数等于 `storageClassName` 等于该类型的 PVC 数；名称链接到该卷所属项目内的存储卷详情；没有任何关联存储卷时给出明确说明。

## 设计目标

让「这个存储类能做什么」一眼可读，而不是靠比较颜色推断。

## 约束与边界

- 读集群级 `storage.k8s.io/v1/storageclasses`，无 namespace 段。
- 默认类型取 `storageclass.kubernetes.io/is-default-class` 注解。
- 回收策略与绑定模式未设置时按 Kubernetes 默认值显示（`Delete` / `Immediate`）。

## UI 交互设计

名称旁带「默认」徽标；能力列用徽标列出支持项，无支持项显示 `-`。

详情页在属性与驱动参数之后追加「关联存储卷」区块：表头为名称、命名空间、状态、容量；名称可点进项目内的存储卷详情。区块标题旁显示实际条数。

## 文案与校验

- 列：名称、供应者、存储卷数、能力、回收策略、创建时间。
- 能力：扩容 / 克隆 / 快照。
- 关联存储卷列：名称（链接）、命名空间、状态、容量；空态「该存储类型还没有关联的存储卷。」
- 状态沿用存储列表的中文用词（已绑定 / 等待中 / 已丢失 / 扩容中）。

## 边界情况

- 平台未上报存储卷数时显示 `-`（不是 0）。
- 没有能力字段时能力列为 `-`。
- 类上标注的「已绑定声明数」来自注解、可能滞后；「关联存储卷」区块显示的是按 `storageClassName` 实查的结果，两者不一致时以列表为准并在文档里说明。
- 引用该类的 PVC 超过一次批量读取的上限（当前 500 条）时只展示已读到的部分，不假装完整。

## 明确不做

- 创建与编辑存储类型（属基础设施操作）。
- 设为默认类型的操作。
- 在关联存储卷列表里删除或编辑存储卷：这里只是入口，操作回项目存储页。

## 假设

- 克隆与快照能力由存储类字段或其注解声明。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 列表六列，能力只显示支持项。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02** — 默认类型带徽标。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03** — 详情按 `storageClassName` 列出关联的存储卷，含项目内详情链接与空态。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 名称集合与 `kubectl get storageclass` 一致。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02** — 关联存储卷行数 = 该 `storageClassName` 的 PVC 数；每行名称链接含项目与 `persistentvolumeclaims/<name>` 段。
