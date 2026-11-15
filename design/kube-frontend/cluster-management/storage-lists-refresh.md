# 集群存储列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/storage-lists-refresh.md)

## 概述

五个集群存储页面各自持有查询，刷新由共享的 `@/components/resource/useListRefresh` 提供。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01

## 设计目标与非目标

目标：五个列表都能主动重读，空态有出口。非目标：轮询、watch。

## 关键约束

- `busy` 进入 schema，因此 schema 的 useMemo 依赖必须包含 `query.isFetching`，否则按钮会停留在忙碌状态（已在企业空间控制台与监控告警两批踩到）。
- `ResourceList` 只在 `schema.refresh` 与 `onRefresh` 同时存在时渲染按钮。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01 — 每页只刷新自己的查询

**为什么**：五个页面的读取互不依赖，聚合刷新会把慢的那一个拖到所有页面上；读者点哪页的刷新，就只该重读那页。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-02 — 快照页在 CRD 缺失时仍保留刷新

**为什么**：没有快照能力时页面显示空态说明，但「刷新」是读者在安装驱动后确认页面是否恢复的唯一入口，不能随空态一起消失。

## 系统现状

老 console 的集群存储列表都有刷新；新 UI 此前没有（审计：54 个列表 0 个刷新按钮）。

## 仓库落点

- 页面：`cluster/{StorageClassesPage,PersistentVolumesPage,ClusterPersistentVolumeClaimsPage,ClusterVolumeSnapshotsPage,ClusterVolumeSnapshotClassesPage}.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `storageclasses:refresh`、`persistentvolumes:refresh`、`cluster-persistentvolumeclaims:refresh`、`cluster-volume-snapshots:refresh`、`cluster-snapshot-classes:refresh` |
| 空态出口 | `empty-state:refresh`、`empty-state:clear` |

## 不变量

1. 刷新只重发当前查询（保留页码、搜索与筛选）。
2. 忙碌状态与实际请求一致。

## 已知坑

- 忘记把 `isFetching` 放进 schema 依赖 → 按钮永久禁用。
- `dist` 需重新构建才会反映到本地 5178。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01.yaml`

## 后续改进

- 与 R-27（实时刷新）一起评估轮询。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01
