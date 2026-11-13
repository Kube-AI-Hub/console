# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02 集群配置字典 · 项目筛选

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/list.md`

## 产品功能

项目筛选在「全部项目」与单个项目之间切换，列表随之收窄或恢复。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/list.md`](../../../../prd/kube-frontend/cluster-configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02** — Given 列表处于「全部项目」，When 在项目筛选器中选择某个项目，Then 请求切换到该项目的命名空间并回到第 1 页，列表只剩该项目的对象；When 再次选择「全部项目」，Then 恢复跨项目结果。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/list.md`](../../../../design/kube-frontend/cluster-configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/list.md`](../../../../prd/kube-frontend/cluster-configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，一次看清集群里所有项目的配置


**Independent Test**：进入列表，默认按创建时间倒序，行来自不同项目；「项目」列显示每个对象所属项目；点击「名称」列头切换为按名称排序。

## 前置与配置

- 已登录，且为集群管理员
- 集群内至少两个项目各有 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 在项目筛选器中选择一个项目
3. 再选择「全部项目」

## 期望结果

- 选择单个项目后列表只剩该项目的对象，页码回到 1
- 选择「全部项目」后恢复跨项目结果

## 失败排查

- 筛选后为空时确认该项目下确实有 ConfigMap

## 产品改版后如何更新自动化

- 筛选器选项来自 /kapis/.../namespaces，变化时同步本文件
