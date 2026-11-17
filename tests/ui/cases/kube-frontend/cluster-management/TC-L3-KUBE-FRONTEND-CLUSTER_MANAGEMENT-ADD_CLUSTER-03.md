# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03 添加集群 · 校验失败时在对话框展示原因

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `add-cluster`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/add-cluster.md`

## 产品功能

添加集群的校验或创建失败时，对话框留下可操作原因并弹出通知，不创建 Cluster 对象；服务端用 kube Status JSON 或纯文本回答都能映射。

### 关联需求

- `prd/kube-frontend/cluster-management/add-cluster.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03** — 已知对话框已填写合法名称与结构完整的 kubeconfig，当校验或创建接口返回失败（400/409/5xx 或超时），则对话框保持打开、输入保留，`role="alert"` 的 `clusters:add-error` 展示可操作原因（jwtSecret 不一致、clusterRole 非法、API 不可达、名称冲突或内部错误），页面同时弹出失败通知，且未创建 Cluster 对象；服务端以 kube Status JSON（`{"kind":"Status","message":…}`）或纯文本回答时都能映射到同一套说明。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/add-cluster.md`](../../../../design/kube-frontend/cluster-management/add-cluster.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 接入失败时看见失败原因 (Priority: P1)

作为 **平台管理员**，我希望 **校验或创建失败时在添加集群对话框里看到服务端原因，并弹出通知**，以便 **当场改正 kubeconfig、网络或成员集群配置，而不是只看到「失败」或「网络异常」**。

**Independent Test**：提交一段结构合法但校验被拒绝的 kubeconfig（例如 jwtSecret 不一致的 400 原文），对话框保持打开，`clusters:add-error` 出现可操作说明，列表中不出现该集群。

## 前置与配置

- 已登录，且有平台管理权限

## 测试步骤

1. 打开集群列表，点「添加集群」
2. 拦截 POST /kapis/cluster.kubesphere.io/v1alpha1/clusters/validation 为 400，正文为 kube Status JSON（message 含 clusterRole of the member cluster must be）
3. 填入合法名称与结构完整的 kubeconfig 并确认
4. 重复一次，把正文换成纯文本（含 Jwt is not equal）

## 期望结果

- 对话框保持打开
- clusters:add-error 出现含 clusterRole 的说明（JSON 形态）
- 第二次出现含 jwtSecret 的说明（纯文本形态），并保留原文作为次要细节
- 列表与 API 中都不存在该名称的 Cluster 对象

## 失败排查

- 提示条不出现：确认校验请求被拦截且前端未把 400 当成网络异常
- 对象被创建：校验失败后仍调用了 POST /apis/.../clusters

## 产品改版后如何更新自动化

- 映射文案变化时改 tests/ui/tests/kube-frontend/cluster-management/test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ADD_CLUSTER_03.py
