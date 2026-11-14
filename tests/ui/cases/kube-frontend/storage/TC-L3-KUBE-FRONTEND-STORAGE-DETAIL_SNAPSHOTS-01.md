# TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-01 存储卷详情 · 快照页签（只读）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `detail-snapshots`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/detail-snapshots.md`

## 产品功能

存储卷详情新增「快照」只读页签：列出从该卷创建的 VolumeSnapshot（名称/就绪状态/大小/创建时间）；没有快照时显示「还没有快照」空态。

### 关联需求

- `prd/kube-frontend/storage/detail-snapshots.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/detail-snapshots.md`](../../../../prd/kube-frontend/storage/detail-snapshots.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-01** — 已知打开一个存储卷的详情，当切到「快照」页签，则列出从该卷创建的快照的名称、就绪状态、大小与创建时间；该卷没有快照时显示「还没有快照」空态（集群已装 VolumeSnapshot CRD 但对象为 0 时也是这个空态，而不是加载中）；页签只读，不提供创建或删除快照。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/detail-snapshots.md`](../../../../design/kube-frontend/storage/detail-snapshots.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/detail-snapshots.md`](../../../../prd/kube-frontend/storage/detail-snapshots.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 从存储卷详情查看它的快照 (Priority: P2)

作为 **项目成员**，我希望 **在存储卷详情里切到「快照」页签看到该卷的快照**，以便 **判断能不能从快照恢复、最近一次副本有多新**，而不必回到卷列表按名字再找一遍。

**Independent Test**：打开一个存储卷详情，切到「快照」页签；有快照时逐行显示名称/状态/大小/创建时间，没有快照时显示「还没有快照」空态。

## 前置与配置

- 已登录，且能读取目标项目的存储卷
- 集群已安装 VolumeSnapshot CRD；对象数可以为 0（B200 现状）

## 测试步骤

1. 用 API 读存储卷与命名空间，取一个存储卷及其 workspace
2. 读该命名空间的 volumesnapshots，并按 spec.source.persistentVolumeClaimName 过滤出该卷的快照
3. 打开存储卷详情，核对「属性 / 快照」两个页签可见
4. 切到快照页签，核对内容区可见
5. 有快照时核对行数、表头与行句柄；没有快照时核对空态文案
6. 核对页签内没有创建/删除按钮

## 期望结果

- storage-detail:tab:snapshots 可见且可点击
- storage-detail:snapshots 可见
- 行数 = 按来源卷过滤后的快照数
- 0 条时 storage-detail:snapshots-empty 可见，文案含「还没有快照」
- 有数据时表头含 名称/状态/大小/创建时间；行句柄为 storage-detail:snapshot:<name>
- 页签内没有创建/删除按钮（只读）

## 失败排查

- 页签不出现：只有 PVC 详情应有页签，确认 kind 判断
- 一直加载：快照接口失败或未处理 CRD 已装但 0 对象的情况
- 行数含别的卷的快照：没有按 spec.source.persistentVolumeClaimName 过滤
- 空态不显示：把 items.length === 0 当成了 loading

## 产品改版后如何更新自动化

- 选择器见 pages/storage.py 与 @/pages/storage/StorageDetailPage.tsx；快照行句柄是 storage-detail:snapshot:<name>
