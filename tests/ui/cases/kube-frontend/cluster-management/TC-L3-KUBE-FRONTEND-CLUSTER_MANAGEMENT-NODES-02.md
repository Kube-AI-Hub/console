# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02 节点列表 · CPU 与内存使用率

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

节点列表显示 CPU 与内存使用率百分比，取值来自 metrics.k8s.io 与节点可分配量之比。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02** — 已知集群可访问 metrics.k8s.io，当打开节点列表，则显示「CPU 使用率」与「内存使用率」两列，取值为 0–100 的整数百分比，等于该节点当前用量与可分配量之比（允许四舍五入差 1）；指标不可用时显示 `-`。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认节点是否就绪、还剩多少资源 (Priority: P1)

作为 **集群管理员**，我希望 **一眼看到每个节点的就绪状态与可分配资源**，以便 **判断能否继续调度**。

**Independent Test**：打开节点页，核对状态徽章与 `kubectl get nodes` 的 STATUS 列一致。

## 前置与配置

- 已登录，且有集群权限
- 集群可访问 metrics.k8s.io（不可用时降级为 -）

## 测试步骤

1. 用 API 读取节点指标与节点可分配量
2. 打开节点列表
3. 读取 CPU 使用率与内存使用率单元格

## 期望结果

- 表头含「CPU 使用率」「内存使用率」
- 每格为 0–100 的整数百分比，或为 -（指标不可用）
- 百分比与 API 数值相符（允许四舍五入差 1）

## 失败排查

- 全部为 - 说明 metrics.k8s.io 不可用（需 metrics-server）
- 出现 3000% 之类说明单位未换算（n 与 m 混用）

## 产品改版后如何更新自动化

- 列变化时改 pages/cluster_management.py
