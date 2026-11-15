# TC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01 创建快照

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `create-snapshot`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/create-snapshot.md`

## 产品功能

存储卷详情的「创建快照」：按 allow-snapshot 门控，快照类按驱动过滤，无匹配类时说明原因。

### 关联需求

- `prd/kube-frontend/storage/create-snapshot.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/create-snapshot.md`](../../../../prd/kube-frontend/storage/create-snapshot.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01** — 已知存储卷的存储类型声明允许快照，当在详情点「创建快照」，则弹窗提供名称与快照类：快照类列表只包含驱动与该卷 provisioner 一致的 VolumeSnapshotClass，提交后创建出 spec.source.persistentVolumeClaimName 指向该卷的 VolumeSnapshot 并切到快照页签；集群没有匹配的快照类时显示「没有与存储驱动 <driver> 匹配的快照类」说明且确认不可用；存储类型未声明允许快照时不显示该操作。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/create-snapshot.md`](../../../../design/kube-frontend/storage/create-snapshot.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/create-snapshot.md`](../../../../prd/kube-frontend/storage/create-snapshot.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 给卷留一个可恢复的时间点 (Priority: P2)

作为 **项目成员**，我希望 **在存储卷详情里直接创建快照**，以便 **在升级或改数据之前留下可恢复的副本**。

**Independent Test**：打开一个存储类型声明允许快照的存储卷详情，点「创建快照」；有匹配快照类时可以选择并提交，没有时看到「没有与存储驱动 X 匹配的快照类」的说明且确认按钮不可用。

## 前置与配置

- 已登录；存在存储类型声明 allow-snapshot

## 测试步骤

1. 创建一个该存储类型的存储卷并等待绑定
2. 打开详情，核对「创建快照」按钮存在
3. 点开弹窗，观察快照类字段

## 期望结果

- 存储类型不允许快照时按钮不出现

## 失败排查

- 下拉为空：应显示说明
- 提交 422：快照类驱动与卷不匹配

## 产品改版后如何更新自动化

- 选择器：persistentvolumeclaims-detail:snapshot / storage-snapshot:name / storage-snapshot:class / storage-snapshot:no-class
