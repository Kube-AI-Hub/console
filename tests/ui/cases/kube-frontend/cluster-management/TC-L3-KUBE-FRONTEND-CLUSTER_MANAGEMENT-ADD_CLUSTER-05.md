# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05 添加集群 · 无写权限时主操作禁用

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `add-cluster`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/add-cluster.md`

## 产品功能

没有 clusters:create 权限的账号看到禁用的「添加集群」，旁边说明原因，点击不打开对话框。

### 关联需求

- `prd/kube-frontend/cluster-management/add-cluster.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05** — 已知当前账号对 `clusters@cluster.kubesphere.io` 没有 `create` 权限，当打开集群列表，则「添加集群」主操作处于禁用态并在旁边说明缺少权限，点击不打开对话框；有权限时按钮可用。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/add-cluster.md`](../../../../design/kube-frontend/cluster-management/add-cluster.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 把已有集群接入平台 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表里粘贴成员集群的 kubeconfig 完成接入**，以便 **在不离开控制台的情况下把新集群纳入管理**。

**Independent Test**：在集群列表点「添加集群」，填入名称与 kubeconfig 并确认；列表中应出现该集群，且集群对象中存在 base64 编码的 kubeconfig。

## 前置与配置

- 已登录，且当前账号对 clusters@cluster.kubesphere.io 没有 create 权限

## 测试步骤

1. 拦截 POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews，返回 status.allowed=false
2. 打开集群列表
3. 观察主操作的状态与旁边的说明
4. 尝试点击主操作

## 期望结果

- 「添加集群」按钮带 disabled 属性
- 按钮旁出现「当前账号没有接入集群的权限，请联系平台管理员。」，句柄 clusters:add:disabled-hint
- 点击后不出现对话框（role=dialog 数量为 0）
- 不发出任何 POST /apis/cluster.kubesphere.io/v1alpha1/clusters

## 失败排查

- 按钮仍可点：确认 SSAR 响应被拦截且 status.allowed 明确为 false
- 有权限时也被禁用：门控是 fail-open，只有明确的 false 才禁用

## 产品改版后如何更新自动化

- 门控条件变化时同步用例与 design 的 DEC-10
