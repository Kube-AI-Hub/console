# 存储类型（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/storage-classes.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-06

## 概述

集群级只读的存储类型列表：名称（默认类型带徽标）、供应者、存储卷数、能力、回收策略、创建时间。详情页展示行为、驱动参数，以及按 `storageClassName` 实查的关联存储卷。

## 设计目标与非目标

目标：能力一眼可读；详情能把「哪些存储卷在用这个类」列出来；写能力（创建 / 编辑 / 删除 / 设为默认 / 卷功能 / 自动扩容）已由 2026-11-17 重纳，见 DEC-…-STORAGE_CLASSES-04。非目标：在关联存储卷列表里编辑或删除存储卷（回项目存储页）。

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

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-STORAGE_CLASSES-04 — 写能力重纳，删除以 PVC 依赖为前置（2026-11-17）

**新决定**：提供创建、编辑信息、编辑 YAML、删除、批量删除、设为默认、卷功能（克隆/快照/扩容）与自动扩容。**2026-11-17 产品复核决定重纳**（N-12，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)）。

**原判断（保留，不删除）**：PRD 曾登记「创建与编辑存储类型（属基础设施操作）不做」「设为默认类型的操作不做」；本文件非目标曾写「任何写操作」。

**为什么当时判断错了**：把「改存储类型会影响未来所有声明」当成拒绝入口的理由，但这条风险恰恰应该由**删除拦截**来兜，而不是靠没有按钮。老 console 的实现里就有这层保护（`StorageClasses/index.jsx:42-57` 在选中项关联 PVC 非零时直接 `Notify.error` 并中止），新实现删掉入口等于连这层保护一起删掉——管理员转去 kubectl 反而没有任何拦截。

**落地约定**：
1. **删除前置校验**：删除前统计 `storageClassName` 等于该类的 PVC 数（复用详情页那次集群级 PVC 读的同一份数据与同一口径），非零时不发请求，提示「有 N 个 PVC 在使用该存储类型」；批量删除逐项校验并汇总。
2. **设为默认**：写 `storageclass.kubernetes.io/is-default-class` 注解（同时认 beta 拼写）；已有默认类时提示将替换谁，不静默切换。
3. **能力开关与自动扩容**：卷功能写 `storageclass.kubesphere.io/allow-{clone,snapshot}` 注解，自动扩容写 `allowVolumeExpansion`；三者与列表「能力」列读同一组字段，避免开关与徽标不一致。
4. 写路径走 `storage.k8s.io/v1`（对象的真实组），不走 kapis 代理——kapis 的 resources 端点只注册 GET。

**何时重新考虑**：若平台提供「存储类型变更影响预览」接口，可把删除拦截从「拒绝」改为「列出受影响的 PVC 并二次确认」。

**交付（2026-11-17）**：`storageClassesApi` 增加 `create` / `updateInfo`（merge-patch，清空键 null）/ `setDefault`（先清旧默认三种拼写再写正式键）/ `setFeatures`（关闭时移除字段而非写 false）/ `remove`（逐条）；写路径全走 `/apis/storage.k8s.io/v1`（成员集群加 `/apis/clusters/<c>` 段）。列表提供创建对话框、多选批量删除与行操作；详情提供编辑信息/编辑 YAML/设为默认/卷功能/删除。删除拦截用**实时 PVC 集合**（同一 query key 与详情共享），PVC 读取失败时单条入口停用、批量操作不渲染（不把失败当 0）。设为默认前有「替换现有默认」提示。E2E 见 `TC-…-04`；单测见 `storage-class-writes.test.ts` / `app .../storage-class-writes.test.tsx`。

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
| 创建 | POST /apis/storage.k8s.io/v1/storageclasses |
| 编辑信息 | PATCH /apis/storage.k8s.io/v1/storageclasses/&lt;name&gt;（merge-patch，metadata.annotations） |
| 编辑 YAML / 能力 | GET 后 PUT（整对象，带 resourceVersion）；能力开关用 PATCH（annotations + spec.allowVolumeExpansion） |
| 设为默认 | GET 列表后 PATCH 旧默认（清三种拼写）+ PATCH 新默认（写 storageclass.kubernetes.io/is-default-class=true） |
| 删除 | DELETE /apis/storage.k8s.io/v1/storageclasses/&lt;name&gt;（逐条） |

写路径用对象真实组；成员集群按 paths.ts 的约定把 `clusters/&lt;c&gt;` 放在 `/apis` 之后。

## 不变量

1. 能力列只渲染支持项。
2. 平台未上报存储卷数时显示 `-`。
3. 关联存储卷行数 = 返回的 PVC 中 `spec.storageClassName` 等于该类型的条数。
4. 每行名称链接到 `/kube-frontend/<workspace>/clusters/<cluster>/projects/<namespace>/persistentvolumeclaims/<name>`。
5. 删除 = 实时 PVC 计数为 0 且 PVC 读取成功；任一不满足都不发 DELETE（单条 disabled、批量跳过/隐藏）。
6. 一次默认切换结束后只有一个默认类（旧三种拼写注解全部清空）。
7. 能力关闭时字段/注解被移除，而不是保留 false。

## 已知坑

- `reclaimPolicy` 与 `volumeBindingMode` 可能缺省，默认值分别是 `Delete` 与 `Immediate`。
- 默认标记有两个注解拼写（正式名与 beta 名），都要认。
- **注解里的 pvc-count 可能滞后**：与关联列表不一致时以列表为准；详情同时显示两者，读者能看到差异。
- **被删除的存储类仍可能被 PVC 引用**：在类详情里按当前类过滤，找不到属于任何现存类，这是对象状态而不是页面漏行。
- **fieldSelector 被忽略**：不要试图给 PVC 列表加 `fieldSelector=spec.storageClassName=…`，它会返回全量。

## 测试与可观测

E2E 见 `tests/ui/tests/kube-frontend/cluster-management/`：TC-01/02/03 读取与关联卷，TC-04 覆盖创建、编辑信息/YAML、设为默认、能力开关、单删/批删与 PVC 守卫。单测：`packages/api-client/test/storage-class-writes.test.ts`（创建 body/成员路径、merge-patch null、默认切换、能力移除、逐条删除）、`apps/console-next/test/storage-class-writes.test.tsx`（删除守卫两因、创建表单校验/提交）。
可观测点：`storageclasses:surface/create/create-dialog/create-name/create-provisioner/create-reclaim/create-binding/create-expand|clone|snapshot/create-submit/create-error`、`:select:<name>`、`:bulk-delete`、`:batch-result`（deleted/skipped/failed 属性）、`:delete-policy`、`:claims-unavailable`、`sc-detail:edit-info|edit-yaml|set-default|features|delete|delete-protected|features-dialog|feature:<expansion|cloning|snapshot>`。

## 后续改进

按能力筛选；关联存储卷支持分页/搜索（当前一次读取 500 条）；从关联列表直接跳到该 PV 的绑定详情。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04`
