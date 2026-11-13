# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01 添加集群 · 导入 kubeconfig 并出现在列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `add-cluster`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/add-cluster.md`

## 产品功能

集群列表的主操作「添加集群」用 kubeconfig 导入集群；提交后创建 Cluster 对象并刷新列表。

### 关联需求

- `prd/kube-frontend/cluster-management/add-cluster.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 已登录平台管理，当在集群列表点「添加集群」并提交合法的名称与 kubeconfig，则创建出 `cluster.kubesphere.io/v1alpha1` 的 Cluster 对象，`spec.connection.type` 为 `direct`、`spec.connection.kubeconfig` 为 kubeconfig 的 base64、`spec.joinFederation` 为 `true`，且列表中立即出现该集群。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/add-cluster.md`](../../../../design/kube-frontend/cluster-management/add-cluster.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 把已有集群接入平台 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表里粘贴成员集群的 kubeconfig 完成接入**，以便 **在不离开控制台的情况下把新集群纳入管理**。

**Independent Test**：在集群列表点「添加集群」，填入名称与 kubeconfig 并确认；列表中应出现该集群，且集群对象中存在 base64 编码的 kubeconfig。

## 前置与配置

- 已登录，且有平台管理权限
- 平台启用多集群联邦

## 测试步骤

1. 打开集群列表，点「添加集群」
2. 分别提交非法名称与非 kubeconfig 内容，确认被拦下且未发请求
3. 填入合法名称与 kubeconfig 并确认
4. 读回 Cluster 对象核对 connection 与 joinFederation
5. 清理：删除该集群对象

## 期望结果

- 名称非法时提示「名称只能包含小写字母、数字与连字符…」
- 内容非 kubeconfig 时提示「这段内容不像 kubeconfig…」
- 合法提交后对话框关闭，列表出现该集群
- 对象的 spec.connection.type 为 direct，kubeconfig 为 base64，joinFederation 为 true

## 失败排查

- 对话框不打开：主操作要用 onAction 承接，primaryAction 上的 onClick 无效
- 对象创建了但列表没变：检查列表查询是否失效

## 产品改版后如何更新自动化

- 字段变化时改 pages/cluster_management.py 的 add 相关选择器
