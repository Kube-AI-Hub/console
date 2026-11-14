# 存储详情的快照页签 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/storage/detail-snapshots.md)

## 概述

存储卷详情新增「属性 / 快照」页签：快照页签只读列出从该卷创建的快照（名称/就绪/大小/创建时间），空态明确。数据层新增 `pages/storage/detailSnapshots.ts`：按命名空间读原始 VolumeSnapshot，按 `spec.source.persistentVolumeClaimName` 过滤。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-01

## 设计目标与非目标

目标：在卷详情上下文回答「有哪些副本、能不能恢复」；空态可解释；只读。
非目标：创建/删除快照、快照内容嵌套查看、排序筛选。

## 关键约束

- 快照按命名空间读：`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/volumesnapshots`，成员集群在组名后加 `clusters/<id>/` 段；一次 `limit=-1`。
- 归属过滤在页面侧按 `spec.source.persistentVolumeClaimName` 完成：共享的 `StorageSummary` 不带 source 字段。
- 页签只在 `kind === 'persistentvolumeclaims'` 时渲染；快照详情保持单页。
- 只读：页签内不渲染任何写控件。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-01 — 读原始 VolumeSnapshot，而不是 storageApi 的 summary

**为什么**：存储列表共用的 `StorageSummary` 不含 `spec.source`，无法按来源卷过滤；对每条快照再调一次详情会变成 N+1。直接读该项目的 VolumeSnapshot 列表（一次请求）并保留原始对象，过滤与展示都成立，且与属性页同一来源语义。
**被否方案**：先用列表 summary 再逐条 get 详情取 source。请求数随快照数量线性增长，且当前没有任何收益。
**何时重新考虑**：api-client 的 snapshot summary 开始带 source 字段时，可换回 summary。

### DEC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-02 — 页签用共享 Tabs 原语，且只有 PVC 详情有页签

**为什么**：页签切换是纯展示状态，不值得为它造路由；共享 `Tabs` 让样式与键盘行为和其他页签一致。快照详情上的「快照」页签没有语义（快照没有快照），因此只在 PVC 详情渲染页签条。
**被否方案**：为两个详情共用页签条并在快照详情隐藏第二个——等于摆一个只有一个选项的页签条。
**何时重新考虑**：快照详情增加「快照内容」页签、两个页面都需要页签条时。

## 系统现状

老 console 的存储卷详情 `Volumes/Detail/routes.js` 有「快照」页签；新 UI 第一版详情只有属性，R-22 补上。B200 上 VolumeSnapshot CRD 已安装（`snapshot.storage.k8s.io/v1` 可列），但对象为 0：本功能点交付「页签 + 明确空态」，而不是等待有数据才成立的功能。快照的创建/删除仍属写操作，不在本轮；B200 当前写类 webhook 故障也让写操作不可用。

## 仓库落点

- `apps/console-next/src/pages/storage/StorageDetailPage.tsx`（页签与快照面板）
- `apps/console-next/src/pages/storage/detailSnapshots.ts`（按来源卷读快照）
- `apps/console-next/src/pages/storage/queries.ts`（对象属性）
- 路由：`routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/{persistentvolumeclaims,volumesnapshots}/$name.tsx`

## 对外契约

| 用途 | 路径 | 参数 |
| --- | --- | --- |
| 存储卷详情 | /kapis/resources.kubesphere.io/v1alpha3/namespaces/&lt;ns&gt;/persistentvolumeclaims/&lt;name&gt; | — |
| 快照列表（按命名空间） | /kapis/resources.kubesphere.io/v1alpha3/namespaces/&lt;ns&gt;/volumesnapshots | limit=-1 |
| 成员集群前缀 | /kapis/resources.kubesphere.io/v1alpha3/clusters/&lt;id&gt;/namespaces/&lt;ns&gt;/volumesnapshots | limit=-1 |

VolumeSnapshot 每项用到的字段：`metadata.name`、`metadata.namespace`、`metadata.creationTimestamp`、`status.readyToUse`、`status.restoreSize`、`spec.source.persistentVolumeClaimName`。

## 不变量

1. 快照页签的行集合 = 命名空间内 `spec.source.persistentVolumeClaimName` 等于当前卷名的对象。
2. 页签只读：没有创建/删除/编辑入口。
3. 快照详情不出现快照页签。
4. 0 条时必须渲染空态，而不是加载中或空白。

## 已知坑

- **CRD 已装但对象为 0**：B200 现状；把 `items.length === 0` 当加载中会让页面永远转圈。
- **source 字段不在 summary**：见上文「读原始 VolumeSnapshot」决策，读原始对象。
- **成员集群段顺序**：`/kapis/.../clusters/<id>/namespaces/<ns>/volumesnapshots`，与 resourceApi 一致。
- **kind 判断**：`StorageDetailPage` 同时服务 PVC 与快照；页签只在 PVC 分支渲染，改动时别把快照详情套进去。
- **data-ai-id 字面量**：`storage-detail:tab:snapshots`、`storage-detail:snapshots-empty`、`storage-detail:snapshot:<name>`；surface 仍按 kind 命名为 `<kind>-detail:surface`，既有用例依赖它。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/storage/TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-01.yaml`
- 可观测点：`storage-detail:tab:{attributes,snapshots}`、`storage-detail:snapshots`、`storage-detail:snapshots-empty`、`storage-detail:snapshot:<name>`、`storage-detail:snapshots-retry`。

## 后续改进

- 快照创建/删除（写操作，需 webhook 可用与独立确认流程）。
- 快照内容（VolumeSnapshotContent）在当前页内展开。
- 快照按时间排序/筛选。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-01`