# 存储类型（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/storage-classes.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03

## 概述

集群级只读的存储类型列表：名称（默认类型带徽标）、供应者、存储卷数、能力、回收策略、创建时间。详情页展示行为、驱动参数，以及按 `storageClassName` 实查的关联存储卷。

## 设计目标与非目标

目标：能力一眼可读；详情能把「哪些存储卷在用这个类」列出来。非目标：任何写操作（创建、编辑、设为默认、删除关联的 PVC）。

## 关键约束

- 集群级集合，请求的 `namespace` 为空串。
- 默认标记来自注解；回收策略与绑定模式缺省时按 Kubernetes 默认值显示。
- 关联存储卷读集群级 PVC 集合一次，按 `spec.storageClassName` 在页面侧过滤：kapis 代理忽略 `fieldSelector`（迁移计划 §52），服务端过滤不可用。
- 一次读取上限 500 条 PVC；超过时只展示已读到的部分（不假装完整）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-STORAGE-CLASSES-01 — 不支持的能力不渲染

**为什么**：第一版把三个能力徽标全部渲染、用颜色区分支持与否，结果**每一个存储类看起来都支持扩容/克隆/快照**——`openebs-hostpath` 实际不支持扩容，但要靠比较颜色才能发现。改为只渲染支持项，无支持项显示 `-`。

**被否方案**：渲染全部 + 图标区分。仍然要求读者解读配色，而配色不是可靠的信息通道（色弱、深色模式、打印）。

**何时重新考虑**：需要按能力筛选存储类时，改为筛选器并只在支持时显示。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03 — 关联存储卷在页面侧按 storageClassName 过滤

**为什么**：PVC 列表接口没有可用于「按 storageClass 过滤」的服务端参数，`fieldSelector` 又被 kapis 代理忽略（实测，迁移计划 §52）；一次读回集群 PVC（22 条量级）在页面里过滤，比逐个存储类发请求或引入新聚合接口都简单，且数据与列表页同源。
**被否方案**：对每个类调用一次带 `labelSelector`/`fieldSelector` 的 PVC 查询。返回的是全量且会随类数量放大请求数。
**何时重新考虑**：代理开始支持 fieldSelector，或 PVC 数量增长到一次读取不可接受时（届时加服务端参数或分页）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-STORAGE-CLASSES-02 — 平台未上报存储卷数时显示 `-`

**为什么**：`kubesphere.io/pvc-count` 并非每个集群都有。显示 0 会被读成「这类存储没被用过」，与事实相反。

**被否方案**：显示 0。简单但与事实不符。

**何时重新考虑**：改为实时统计 PVC 时（有成本）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-STORAGE_CLASSES-02 — 驱动参数按原样成对展示

**为什么**：`parameters` 是驱动自定义的键值对，不同 CSI 驱动的键完全不同；把它们塞进固定列只会适配某一个驱动。

**被否方案**：固定列展示常见参数（如 `type`/`csi.storage.k8s.io/*`）。换个驱动就成空列。

**何时重新考虑**：平台为参数提供统一 schema 时。

## 系统现状

老 console `clusters/containers/Storage/StorageClasses`：名称、存储卷数、是否默认、克隆/快照/扩容能力、供应者。本模块把三项能力合成一列徽标集合。老 console 的存储类型详情还有「关联存储卷」列表页签（`StorageClasses/Detail/routes.js:24-31`），新 UI 第一版只有属性与参数，R-16 补上该列表（只读，链接回项目存储页）。

## 仓库落点

- `apps/console-next/src/pages/cluster/StorageClassesPage.tsx`
- `apps/console-next/src/pages/cluster/StorageClassDetailPage.tsx`（关联存储卷区块）
- `apps/console-next/src/pages/cluster/useClusterProjectIndex.ts`（项目内链接的 workspace 索引）
- `packages/api-client/src/storage.ts` 的 `toStorageClassSummary`
- `src/routes/kube-frontend.clusters.$cluster/storageclasses/`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 存储类型 | /apis/storage.k8s.io/v1/storageclasses（集群级） |
| 关联存储卷 | /kapis/resources.kubesphere.io/v1alpha3/persistentvolumeclaims（集群级，`limit=500`） |

只读；`persistentvolumeclaims` 的每项用 `metadata.namespace`、`metadata.name`、`spec.storageClassName`、`status.phase`、`spec.resources.requests.storage`。

## 不变量

1. 能力列只渲染支持项。
2. 平台未上报存储卷数时显示 `-`。
3. 关联存储卷行数 = 返回的 PVC 中 `spec.storageClassName` 等于该类型的条数。
4. 每行名称链接到 `/kube-frontend/<workspace>/clusters/<cluster>/projects/<namespace>/persistentvolumeclaims/<name>`。

## 已知坑

- `reclaimPolicy` 与 `volumeBindingMode` 可能缺省，默认值分别是 `Delete` 与 `Immediate`。
- 默认标记有两个注解拼写（正式名与 beta 名），都要认。
- **注解里的 pvc-count 可能滞后**：与关联列表不一致时以列表为准；详情同时显示两者，读者能看到差异。
- **被删除的存储类仍可能被 PVC 引用**：在类详情里按当前类过滤，找不到属于任何现存类，这是对象状态而不是页面漏行。
- **fieldSelector 被忽略**：不要试图给 PVC 列表加 `fieldSelector=spec.storageClassName=…`，它会返回全量。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`；单测覆盖 `toStorageClassSummary` 的默认值与能力判定。
可观测点：`sc-detail:surface`、`sc-detail:pvcs`、`sc-detail:pvcs-empty`、`sc-detail:pvc:<namespace>/<name>`（行）、`:pvcs-retry`。

## 后续改进

按能力筛选；关联存储卷支持分页/搜索（当前一次读取 500 条）；从关联列表直接跳到该 PV 的绑定详情。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03`
