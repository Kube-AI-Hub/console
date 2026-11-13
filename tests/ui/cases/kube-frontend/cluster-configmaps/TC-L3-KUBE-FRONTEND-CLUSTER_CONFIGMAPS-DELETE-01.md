# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01 集群配置字典 · 删除按项目定位

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `delete`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/delete.md`

## 产品功能

删除只影响所选对象；跨项目批量选择时拒绝执行。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/delete.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/delete.md`](../../../../prd/kube-frontend/cluster-configmaps/delete.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/delete.md`](../../../../design/kube-frontend/cluster-configmaps/delete.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/delete.md`](../../../../prd/kube-frontend/cluster-configmaps/delete.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为运维，在删除配置字典上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 已登录，且为集群管理员
- 两个项目中存在同名 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 对项目 A 的对象执行删除并确认
3. 查看项目 B 的同名对象
4. 同时选中两个项目的行并点批量删除

## 期望结果

- 项目 A 的对象消失
- 项目 B 的同名对象仍在
- 跨项目批量删除被拒绝并提示先按项目筛选

## 失败排查

- 删除后仍在时确认删除请求的 namespace

## 产品改版后如何更新自动化

- 删除弹窗文案变化时同步本文件
