# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01 集群配置字典 · 创建必须选项目

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `create`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/create.md`

## 产品功能

创建入口在未选项目时阻止进入下一步，选定项目后可创建。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/create.md`](../../../../prd/kube-frontend/cluster-configmaps/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/create.md`](../../../../design/kube-frontend/cluster-configmaps/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/create.md`](../../../../prd/kube-frontend/cluster-configmaps/create.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为运维，在创建配置字典上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 已登录，且为集群管理员
- 集群内至少一个项目

## 测试步骤

1. 在筛选器选择「全部项目」
2. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
3. 点击「创建」
4. 不选项目直接下一步
5. 选择项目、填写名称与键值后提交

## 期望结果

- 未选项目时提示必须选择项目且停留在第一步
- 提交成功后列表可按该项目筛选到新对象

## 失败排查

- 创建失败时确认对目标项目的 configmaps 有 create 权限

## 产品改版后如何更新自动化

- 创建弹窗字段变化时同步本文件
