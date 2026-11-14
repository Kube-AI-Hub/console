# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01 集群级网络策略 · 跨项目列表与跳转

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `network-policies`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/networkpolicies`
- **需求**: `prd/kube-frontend/cluster-management/network-policies.md`

## 产品功能

跨项目列出 NetworkPolicy，带「项目」列；空态指向项目内的「网络隔离」；行内名称链接到所属项目的网络隔离页。

### 关联需求

- `prd/kube-frontend/cluster-management/network-policies.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/network-policies.md`](../../../../prd/kube-frontend/cluster-management/network-policies.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01** — 当打开集群网络策略页，则列出集群内全部 NetworkPolicy，带「项目」列。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-02** — 当集群没有策略，则空态说明策略在项目内创建，并指向项目设置 › 网络隔离。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-03** — 当点击某行名称，则进入该策略所属项目（含其企业空间段）的网络隔离页。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/network-policies.md`](../../../../design/kube-frontend/cluster-management/network-policies.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/network-policies.md`](../../../../prd/kube-frontend/cluster-management/network-policies.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 知道整个集群哪里做了网络隔离 (Priority: P2)

作为 **平台运维**，我希望 **在一个页面看到所有项目的网络策略**，以便 **判断哪些项目已经隔离流量、哪些还没有**，而不必逐个项目点开。

**Independent Test**：打开集群网络策略页，能看到跨项目的策略列表与所属项目列；点击某行的名称能进到该策略所属项目的网络隔离页。

## 前置与配置

- 已登录平台管理

## 测试步骤

1. 打开集群网络策略页
2. 核对列：名称、项目、策略类型、规则数、创建时间
3. 若存在策略：点击第一行名称，确认进入该项目的网络隔离页
4. 若不存在：确认空态说明「策略在项目内创建」

## 期望结果

- 列表或空态渲染，且一定有「项目」列
- 链接包含企业空间与项目段

## 失败排查

- 页签为空：registry 的 path 与路由目录不一致
- 链接拼错：namespace→workspace 映射缺失时应回退 public

## 产品改版后如何更新自动化

- 列变化时同步 ClusterNetworkPoliciesPage 与用例
