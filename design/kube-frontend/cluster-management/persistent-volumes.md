# 持久卷（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/persistent-volumes.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01

## 概述

集群级只读的持久卷列表。

## 设计目标与非目标

目标：一眼看出「谁在用、释放后怎样」。非目标：任何写操作。

## 关键约束

- 集群级集合，读核心 API。
- 全量取回后本地排序与搜索。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-PERSISTENT-VOLUMES-01 — 读核心 API，不走 kapis 代理

**为什么**：同一个列表实测差异巨大——核心 `/api/v1/persistentvolumes` **24 秒**，kapis 代理 **63 秒**。页面只需要标准字段，多出来的 KubeSphere 注解不值一分钟等待。

**被否方案**：走 kapis 以复用统一的分页/排序参数。代价是两倍以上的等待，而排序在前端做即可。

**何时重新考虑**：kapis 的持久卷接口变快，或需要 KubeSphere 专有字段时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-PERSISTENT-VOLUMES-02 — 绑定声明写成 `<命名空间>/<名称>`

**为什么**：卷是集群级的，声明是命名空间级的；只写声明名会让读者无法定位。已绑定的卷给出完整路径，未绑定的显示 `-`——「没有声明」与「声明名为空」是两件事。

**被否方案**：分成「命名空间」「声明」两列。多一列，而两者总是一起出现。

**何时重新考虑**：需要按声明排序时。

## 系统现状

老 console 的集群存储页包含持久卷列表与存储类型。存储类型已迁移（见 `storage-classes.md`），
本模块补上持久卷列表，列与老页面一致（名称、状态、容量、访问模式、绑定声明、回收策略、创建时间）。

## 仓库落点

- `apps/console-next/src/pages/cluster/PersistentVolumesPage.tsx`
- `packages/api-client/src/storage.ts` 的 `persistentVolumesApi` / `toPersistentVolumeSummary`
- `src/routes/kube-frontend.clusters.$cluster/persistentvolumes/`

## 对外契约

读 `/api/v1/persistentvolumes`（集群级，无命名空间段）；只读。

## 不变量

1. 一次取全量，本地排序与搜索。
2. 绑定声明写成 `<命名空间>/<名称>`。

## 已知坑

- **性能**：实测核心 API 24 秒、kapis 代理 63 秒；页面的加载骨架因此必须覆盖重查阶段，
  否则读者会以为页面没反应。
- 回收策略缺失时 Kubernetes 的默认值是 `Retain`，显示空串会被读成「未知」。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`；用例核对行数与每卷的绑定声明。

## 后续改进

持久卷详情（挂载历史、底层磁盘）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01`
