# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01 集群配置字典 · 编辑写入对象所属项目

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `edit`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/edit.md`

## 产品功能

编辑设置修改的是该对象所在项目的那一条，不影响其他项目的同名对象。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/edit.md`](../../../../prd/kube-frontend/cluster-configmaps/edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/edit.md`](../../../../design/kube-frontend/cluster-configmaps/edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/edit.md`](../../../../prd/kube-frontend/cluster-configmaps/edit.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为运维，在编辑配置字典上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 已登录，且为集群管理员
- 两个项目中存在同名 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 对项目 A 的对象打开「编辑设置」并改一个值保存
3. 查看项目 B 的同名对象

## 期望结果

- 项目 A 的对象值已更新
- 项目 B 的同名对象未被修改

## 失败排查

- 保存后值未变时看写请求的 namespace 是否为目标项目

## 产品改版后如何更新自动化

- 编辑弹窗字段变化时同步本文件
