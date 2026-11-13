# TC-FULL-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-01 集群配置字典 · 与 kubectl 逐项核对

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `cluster-configmaps` `page`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/_index.md`

## 产品功能

页面展示的是集群内全部项目的 ConfigMap，与 kubectl get configmap -A 一致。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/_index.md`](../../../../prd/kube-frontend/cluster-configmaps/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-CLUSTER-CONFIGMAPS-01** — Given 集群中多个项目都有 ConfigMap，When 打开集群配置字典，Then 表头为 名称 / 项目 / 字段 / 创建时间，首行来自任意项目且「项目」列非空；分页总数与 `kubectl get configmap -A` 的条目数一致。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/_index.md`](../../../../design/kube-frontend/cluster-configmaps/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/_index.md`](../../../../prd/kube-frontend/cluster-configmaps/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，一次看清集群里所有项目的配置


**Independent Test**：进入页面，列表跨多个项目返回对象；「项目」列显示每个对象所属的项目；按名称搜索 `kubeconfig` 能命中其他项目里的对象。

### US2 - 作为集群运维，就地修正某个项目里的一条配置


**Independent Test**：在列表里对一条对象打开「编辑设置」修改键值并保存，刷新后值已更新；再用 `kubectl -n <项目> get configmap <名称> -o yaml` 确认与页面一致。

### US3 - 作为集群运维，创建到指定项目


**Independent Test**：点击「创建」，在第一步选择一个项目并填名称，提交后在列表里按该项目筛选能看到新对象。

## 前置与配置

- 已登录，且为集群管理员
- 集群内至少两个项目各有 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 记录表头、首行与分页总数
3. 用 kubectl get configmap -A 导出同一份数据并比对总数

## 期望结果

- 表头为 名称、项目、字段、创建时间
- 首行来自任意项目且「项目」列非空
- 分页总数与 kubectl 返回的条目数一致

## 失败排查

- 总数不一致时先确认是否有项目被 RBAC 过滤

## 产品改版后如何更新自动化

- 路由变化时同步本文件
