# 存储类型（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/storage-classes.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01

## 概述

集群级只读的存储类型列表：名称（默认类型带徽标）、供应者、存储卷数、能力、回收策略、创建时间。

## 设计目标与非目标

目标：能力一眼可读。非目标：任何写操作（创建、编辑、设为默认）。

## 关键约束

- 集群级集合，请求的 `namespace` 为空串。
- 默认标记来自注解；回收策略与绑定模式缺省时按 Kubernetes 默认值显示。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-STORAGE-CLASSES-01 — 不支持的能力不渲染

**为什么**：第一版把三个能力徽标全部渲染、用颜色区分支持与否，结果**每一个存储类看起来都支持扩容/克隆/快照**——`openebs-hostpath` 实际不支持扩容，但要靠比较颜色才能发现。改为只渲染支持项，无支持项显示 `-`。

**被否方案**：渲染全部 + 图标区分。仍然要求读者解读配色，而配色不是可靠的信息通道（色弱、深色模式、打印）。

**何时重新考虑**：需要按能力筛选存储类时，改为筛选器并只在支持时显示。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-STORAGE-CLASSES-02 — 平台未上报存储卷数时显示 `-`

**为什么**：`kubesphere.io/pvc-count` 并非每个集群都有。显示 0 会被读成「这类存储没被用过」，与事实相反。

**被否方案**：显示 0。简单但与事实不符。

**何时重新考虑**：改为实时统计 PVC 时（有成本）。

## 系统现状

老 console `clusters/containers/Storage/StorageClasses`：名称、存储卷数、是否默认、克隆/快照/扩容能力、供应者。本模块把三项能力合成一列徽标集合。

## 仓库落点

- `apps/console-next/src/pages/cluster/StorageClassesPage.tsx`
- `packages/api-client/src/storage.ts` 的 `toStorageClassSummary`
- `src/routes/kube-frontend.clusters.$cluster/storageclasses/`

## 对外契约

读 `/apis/storage.k8s.io/v1/storageclasses`（集群级）；只读。

## 不变量

1. 能力列只渲染支持项。
2. 平台未上报存储卷数时显示 `-`。

## 已知坑

- `reclaimPolicy` 与 `volumeBindingMode` 可能缺省，默认值分别是 `Delete` 与 `Immediate`。
- 默认标记有两个注解拼写（正式名与 beta 名），都要认。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`；单测覆盖 `toStorageClassSummary` 的默认值与能力判定。

## 后续改进

按能力筛选、显示每个存储类下的实际 PV 数量。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01`
