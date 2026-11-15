# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01 集群存储列表刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `storage-lists-refresh`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/persistentvolumes`
- **需求**: `prd/kube-frontend/cluster-management/storage-lists-refresh.md`

## 产品功能

集群作用域的存储类型、持久卷、存储卷声明、卷快照、快照类五个列表提供刷新入口。

### 关联需求

- `prd/kube-frontend/cluster-management/storage-lists-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/storage-lists-refresh.md`](../../../../prd/kube-frontend/cluster-management/storage-lists-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01** — 已知集群的存储类型、持久卷、存储卷声明、卷快照、快照类五个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求，刷新期间按钮处于忙碌状态并在返回后恢复；句柄分别为 `storageclasses:refresh`、`persistentvolumes:refresh`、`cluster-persistentvolumeclaims:refresh`、`cluster-volume-snapshots:refresh`、`cluster-snapshot-classes:refresh`。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/storage-lists-refresh.md`](../../../../design/kube-frontend/cluster-management/storage-lists-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/storage-lists-refresh.md`](../../../../prd/kube-frontend/cluster-management/storage-lists-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读集群存储状态 (Priority: P1)

作为 **集群管理员**，我希望 **在存储类型、持久卷、存储卷声明、卷快照、快照类这五个列表上直接刷新**，以便 **在创建卷或安装驱动后立刻确认状态，而不必退出页面再进来**。

**Independent Test**：打开集群持久卷列表点击「刷新」，列表重新发起请求；打开存储类型列表，刷新按钮存在且空闲时可用。

## 前置与配置

- 已登录且有集群管理员权限

## 测试步骤

1. 依次打开存储类型、持久卷、存储卷声明、卷快照、快照类页面，确认各自的刷新入口存在且可用
2. 点击持久卷列表的刷新，观察是否重新发起请求

## 期望结果

- 刷新期间按钮忙碌；返回后恢复

## 失败排查

- 按钮永久禁用：schema 依赖数组缺少 isFetching
- 快照页没有刷新：空态分支丢失了列表

## 产品改版后如何更新自动化

- 选择器：storageclasses:refresh / persistentvolumes:refresh / cluster-persistentvolumeclaims:refresh / cluster-volume-snapshots:refresh / cluster-snapshot-classes:refresh
