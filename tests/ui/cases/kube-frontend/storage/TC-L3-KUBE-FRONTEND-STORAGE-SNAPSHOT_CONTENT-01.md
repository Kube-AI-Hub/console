# TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01 快照内容只读详情

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `snapshot-content`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/volume-snapshot-content/<name>`
- **需求**: `prd/kube-frontend/storage/snapshot-content.md`

## 产品功能

一条 VolumeSnapshotContent 的只读详情：驱动、快照句柄、所属快照、恢复大小、可恢复、删除策略、创建时间。

### 关联需求

- `prd/kube-frontend/storage/snapshot-content.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/snapshot-content.md`](../../../../prd/kube-frontend/storage/snapshot-content.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01** — 已知集群存在/不存在快照内容，当访问 `/clusters/<c>/volume-snapshot-content/<name>`，则存在时显示驱动、快照句柄、所属快照（项目/名称）、恢复大小、可恢复、删除策略与创建时间；不存在时显示「这条快照内容不存在」而不是空白页。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/snapshot-content.md`](../../../../design/kube-frontend/storage/snapshot-content.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/snapshot-content.md`](../../../../prd/kube-frontend/storage/snapshot-content.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 从快照追到后端真实句柄 (Priority: P2)

作为 **存储运维**，我希望 **看到快照对应的后端句柄与驱动**，以便 **判断快照是真存在还是只有对象**。

**Independent Test**：打开一条快照内容的详情，核对驱动/句柄/恢复大小与 `volumesnapshotcontents` 对象一致；打开不存在的名字时得到明确的「不存在」提示。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- snapshot.storage.k8s.io/v1 已安装

## 测试步骤

1. 用 API 读 volumesnapshotcontents 列表（可能为空）
2. 有对象时打开第一条详情，核对其字段
3. 打开一个不存在的名字，核对提示

## 期望结果

- 存在时字段与对象一致
- 不存在时出现错误面板且含「不存在」提示

## 失败排查

- 页面空白：路由未生成（build 后重试）
- 404 文案不可定制：ResourceErrorPanel 无 notFoundText（已知坑）

## 产品改版后如何更新自动化

- 选择器见 snapshot-content:surface / snapshot-content:basic
