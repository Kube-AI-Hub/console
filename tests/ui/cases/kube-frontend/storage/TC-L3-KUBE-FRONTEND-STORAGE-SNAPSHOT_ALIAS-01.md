# TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01 快照别名路由重定向

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `snapshot-alias`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/snapshots`
- **需求**: `prd/kube-frontend/storage/snapshot-alias.md`

## 产品功能

旧地址 /snapshots 与 /snapshots/<ns> 重定向到 /volume-snapshots。

### 关联需求

- `prd/kube-frontend/storage/snapshot-alias.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/snapshot-alias.md`](../../../../prd/kube-frontend/storage/snapshot-alias.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01** — 已知快照列表页可用，当访问 `/clusters/<c>/snapshots`（以及 `/clusters/<c>/snapshots/<namespace>`），则浏览器重定向到 `/clusters/<c>/volume-snapshots` 并显示列表，而不是 404。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/snapshot-alias.md`](../../../../design/kube-frontend/storage/snapshot-alias.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/snapshot-alias.md`](../../../../prd/kube-frontend/storage/snapshot-alias.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 旧书签仍然可用 (Priority: P3)

作为 **使用者**，我希望 **打开旧的 `/snapshots` 地址时仍能看到快照列表**，以便 **不因为一次路径调整而重新找入口**。

**Independent Test**：访问 `/clusters/<c>/snapshots`，最终落在 `/volume-snapshots` 且列表可见。

## 前置与配置

- 已登录

## 测试步骤

1. 访问 /clusters/<c>/snapshots
2. 访问 /clusters/<c>/snapshots/default

## 期望结果

- 两次都最终落在 /volume-snapshots，且列表 surface 可见

## 失败排查

- 停在 404：redirect 未生效或路由未生成（build 后重试）
- URL 对了但空白：列表页自身接口问题（分开排查）

## 产品改版后如何更新自动化

- 断言最终 URL 与 cluster-volume-snapshots:surface
