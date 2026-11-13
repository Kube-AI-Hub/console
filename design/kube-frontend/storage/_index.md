# 存储（L2）

[子模块需求](../../../prd/kube-frontend/storage/_index.md)

## 概述

存储区两个页面：存储卷与存储卷快照，共用列表与详情组件。

## 关联需求
- AC-FULL-KUBE-FRONTEND-STORAGE-01
- AC-FULL-KUBE-FRONTEND-STORAGE-02

- `prd/kube-frontend/storage/_index.md`

## 设计目标与非目标

目标：存储的交互与配置区同构，写路径按 API 组。非目标：扩容、快照创建、集群级存储页面。

## 关键约束

- 区域只影响导航，不进 URL。
- PVC 写核心组 `/api/v1`；快照写 `snapshot.storage.k8s.io/v1`（`kubePrefix` 登记）。

## 方案决策

### DEC-L2-KUBE-FRONTEND-STORAGE-01 — 两个页面共用一套组件

**为什么**：两张表只差一列（访问模式）。共用组件让空态、删除、YAML 的行为天然一致。

**被否方案**：各写一套。会立刻出现两套空态文案与两种删除确认。

**何时重新考虑**：出现结构化差异（例如快照需要树形依赖）时。

### DEC-L2-KUBE-FRONTEND-STORAGE-02 — 状态直接用 `phase`，不推断

**为什么**：PVC 的 `phase` 是 API 的结论；老 console 额外看扩容条件，只是把「正在扩容」显性化，方向仍是同一字段。

**被否方案**：用「是否被 Pod 挂载」推导状态。那需要扫描全部 Pod，代价高且与 phase 语义不同。

## 系统现状

老 console `pages/projects/containers/{Volumes,VolumeSnapshots}`，列表列与本模块一致；「挂载状态」列依赖扫描 Pod，本模块未迁移（记在待办）。

## 仓库落点

- `apps/console-next/src/pages/storage/`
- `src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/{persistentvolumeclaims,volumesnapshots}/`
- `packages/api-client/src/storage.ts`

## 对外契约

读 kapis；写原生端点；列表参数 `page`/`limit`/`sortBy`/`order`/`name`。

## 不变量

1. 两页共用同一套列表与详情组件。
2. 写路径与 API 组一致。

## 已知坑

- 快照 CRD 未安装时 kapis 返回 404，页面应落到错误态而不是崩溃。
- 集群级 PVC 查询很慢（45 条时 5s+），页面必须给加载态。

## 测试与可观测

E2E：`tests/kube-frontend/storage/`；单测：`storage.ts` 的状态与摘要映射。

## 后续改进

「挂载状态」列（需要一次性列出 Pod 的卷引用）。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-STORAGE-01`

## 页面与技术结构

- 区域声明在 `areas/registry.ts`（`storage`，两页）。
- 路由每页一个文件夹（`route/index/$name`）。
- 组件 `StorageListPage` / `StorageDetailPage`，描述符在 `pages/storage/queries.ts`。

## 状态与数据归属

- 页面只持有 UI 态；资源状态在 Query 缓存，key 含 kind。

## 关键契约与依赖

- `storageApi(api, kind)`、`kubePrefix(resource)`。

## 明确不做

- 扩容、快照创建、集群级存储类型与持久卷页面。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 列表 | `prd/…/list.md` | `design/…/list.md` |
| 详情 | `prd/…/detail.md` | `design/…/detail.md` |
| 编辑 YAML | `prd/…/edit-yaml.md` | `design/…/edit-yaml.md` |
| 删除 | `prd/…/delete.md` | `design/…/delete.md` |
