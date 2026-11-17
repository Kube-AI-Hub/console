# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01 添加集群 · 导入 kubeconfig 并出现在列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `add-cluster`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/add-cluster.md`

## 产品功能

集群列表的主操作「添加集群」用 kubeconfig 导入集群；对话框分「基本信息」与「连接设置」两段，提交后创建 Cluster 对象并刷新列表。

### 关联需求

- `prd/kube-frontend/cluster-management/add-cluster.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 已登录平台管理，当在集群列表点「添加集群」，对话框分为「基本信息」与「连接设置」两段；基本信息包含名称、别名、标签、供应商与描述（标签下拉含生产/开发/测试/演示四项，供应商可从七个预设中选或自行输入），连接设置包含连接方式与 kubeconfig；提交合法的名称与 kubeconfig 后创建出 `cluster.kubesphere.io/v1alpha1` 的 Cluster 对象，`spec.connection.type` 为 `direct`、`spec.connection.kubeconfig` 为 kubeconfig 的 base64、`spec.joinFederation` 为 `true`，所选标签写入 `cluster.kubesphere.io/group` 标签、供应商写入 `spec.provider`，列表中立即出现该集群。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02** — 已知填写了可选的别名与描述并选择「代理连接」，当提交，则对象的 `spec.connection` 只有 `type: proxy`（**没有 kubeconfig 键**），`kubesphere.io/alias-name` 与 `kubesphere.io/description` 注解等于填写值，列表行显示别名与对象名；该集群在部署代理前保持未就绪，状态列显示原因。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/add-cluster.md`](../../../../design/kube-frontend/cluster-management/add-cluster.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 把已有集群接入平台 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表里粘贴成员集群的 kubeconfig 完成接入**，以便 **在不离开控制台的情况下把新集群纳入管理**。

**Independent Test**：在集群列表点「添加集群」，填入名称与 kubeconfig 并确认；列表中应出现该集群，且集群对象中存在 base64 编码的 kubeconfig。

### US2 - 接入时就填好别名与描述 (Priority: P2)

作为 **平台管理员**，我希望 **在接入时顺便起一个好认的别名并写一句描述**，以便 **列表与切换器里显示的是我认得出的名字，而不是对象名**。

**Independent Test**：用代理连接创建一个带别名与描述的集群，回读注解与列表行。

## 前置与配置

- 已登录，且有平台管理权限
- 平台启用多集群联邦

## 测试步骤

1. 打开集群列表，点「添加集群」
2. 核对对话框的两段标题与基本信息字段（名称/别名/标签/供应商/描述）
3. 分别提交非法名称与非 kubeconfig 内容，确认被拦下且未发请求
4. 选择标签「演示」与供应商「Kube AI Hub」，填入合法名称与 kubeconfig 并确认
5. 读回 Cluster 对象核对 connection、joinFederation、labels 与 provider
6. 清理：删除该集群对象

## 期望结果

- 对话框出现「基本信息」与「连接设置」两段
- 标签下拉含生产/开发/测试/演示四项；供应商可从预设中选择
- 名称非法时提示「名称只能包含小写字母、数字与连字符…」
- 内容非 kubeconfig 时提示「这段内容不像 kubeconfig…」
- 合法提交后对话框关闭，列表出现该集群，并弹出「集群 {name} 已接入」通知
- 对象的 spec.connection.type 为 direct，kubeconfig 为 base64，joinFederation 为 true
- metadata.labels['cluster.kubesphere.io/group'] 为 demo，spec.provider 为 Kube AI Hub

## 失败排查

- 对话框不打开：主操作要用 onAction 承接，primaryAction 上的 onClick 无效
- 对象创建了但列表没变：检查列表查询是否失效
- 编辑器无法填值：kubeconfig 是 CodeMirror，需定位 .cm-content 后用键盘输入

## 产品改版后如何更新自动化

- 字段变化时改 pages/cluster_management.py 的 add 相关选择器
