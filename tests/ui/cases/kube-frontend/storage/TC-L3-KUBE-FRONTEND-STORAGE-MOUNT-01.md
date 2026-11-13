# TC-L3-KUBE-FRONTEND-STORAGE-MOUNT-01 存储卷列表 · 挂载状态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-MOUNT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `mount`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/csghub/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/mount.md`

## 产品功能

存储卷列表有「挂载状态」列：已被 Pod 挂载的显示「已挂载」，否则「未挂载」；扫描未完成时显示「计算中」。

### 关联需求

- `prd/kube-frontend/storage/mount.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/mount.md`](../../../../prd/kube-frontend/storage/mount.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-MOUNT-01** — （需求里找不到这条 AC，请先补需求或改 `covers`）

### 关联设计

- 技术方案 [`design/kube-frontend/storage/mount.md`](../../../../design/kube-frontend/storage/mount.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/mount.md`](../../../../prd/kube-frontend/storage/mount.md)，与用例的 `story` 对应；改需求即改这里。

- **US1** —（需求里找不到这条用户故事，请先补需求或改 `story`）
## 前置与配置

- 已登录，且在 host 集群的项目空间（该项目同时有已挂载与未挂载的存储卷）

## 测试步骤

1. 打开存储卷列表
2. 记录出现「计算中」的行（若有）
3. 等待挂载状态全部解析
4. 用 API 统计挂载了各存储卷的 Pod

## 期望结果

- 表头含「挂载状态」
- 解析完成后不再出现「计算中」
- 每行的已挂载/未挂载与 API 统计一致

## 失败排查

- 一直停在「计算中」说明 Pod 列表请求失败或项目为空
- 与 API 不符时检查 mountsOf 是否把非 PVC 卷算进来

## 产品改版后如何更新自动化

- 列变化时改 pages/storage.py
