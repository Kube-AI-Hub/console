# 创建快照（L3）

[子模块需求](./_index.md)

## 概述

从存储卷详情为某个存储卷创建卷快照。快照必须指定一个与存储驱动匹配的快照类（VolumeSnapshotClass）；集群没有匹配类时无法创建，页面必须如实说明。

## 用户故事

### US1 - 给卷留一个可恢复的时间点 (Priority: P2)

作为 **项目成员**，我希望 **在存储卷详情里直接创建快照**，以便 **在升级或改数据之前留下可恢复的副本**。

**Independent Test**：打开一个存储类型声明允许快照的存储卷详情，点「创建快照」；有匹配快照类时可以选择并提交，没有时看到「没有与存储驱动 X 匹配的快照类」的说明且确认按钮不可用。

## 验收场景

- **AC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01** — 已知存储卷的存储类型声明允许快照，当在详情点「创建快照」，则弹窗提供名称与快照类：快照类列表只包含驱动与该卷 provisioner 一致的 VolumeSnapshotClass，提交后创建出 spec.source.persistentVolumeClaimName 指向该卷的 VolumeSnapshot 并切到快照页签；集群没有匹配的快照类时显示「没有与存储驱动 <driver> 匹配的快照类」说明且确认不可用；存储类型未声明允许快照时不显示该操作。

## 设计目标

1. 快照类按驱动过滤：选错驱动的类会被存储层拒绝。
2. 没有可用类时说明原因，不渲染空下拉。

## 约束与边界

- 创建 `POST …/volumesnapshots`，body 由 `snapshotManifest` 生成。
- 门控：存储类型注解 `storageclass.kubesphere.io/allow-snapshot` 为 true。
- 驱动来源：卷的 `volume.kubernetes.io/storage-provisioner`（或 beta 拼写）注解。

## UI 交互设计

- 详情头部「创建快照」；弹窗：名称（默认 `<卷名>-snapshot`）+ 快照类（下拉显示「名称（驱动）」）。

## 文案与校验

- 名称必填且符合 DNS-1123；必须选择快照类；失败显示服务端原因。

## 边界情况

- 集群未安装快照 API：快照类列表按空处理，说明与「没有匹配类」一致。
- 快照对象创建后可能长时间未 ready：状态由快照列表反映，不在此弹窗承诺成功。

## 明确不做

- 快照调度策略（定时快照）。
- 删除快照：属快照列表/详情的删除操作。

## 假设

- 平台安装时写入 allow-snapshot 注解；驱动提供对应的 VolumeSnapshotClass。

## 功能需求

- **FR-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01** — 详情「创建快照」入口与快照类过滤。

## 成功标准

- **SC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01** — 有匹配类时可创建结构正确的 VolumeSnapshot；无匹配类时给出可行动的说明。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01
