# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04 节点列表 · 停止调度与启动调度

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

节点行操作提供「停止调度 / 启动调度」，写 spec.unschedulable；状态列出现「已停止调度」，行操作随状态互换。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04** — 已知节点列表中有可调度节点，当对它执行「停止调度」，则该节点 `spec.unschedulable` 变为 `true`，状态列出现「已停止调度」，行操作变为「启动调度」；再执行「启动调度」，`spec.unschedulable` 被移除（不再为 `true`），徽标消失。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 让节点停止接收新容器组 (Priority: P1)

作为 **集群管理员**，我希望 **一键停止/恢复节点的调度**，以便 **在维护节点前不让新容器组落上去，而不必动 kubectl**。

**Independent Test**：对节点停止调度 → 回读 `spec.unschedulable` 为 true；启动调度 → 该字段不再为 true。

## 前置与配置

- 已登录，且对 host 集群有节点管理权限
- 用例记录节点原始 spec.unschedulable，finally 中还原

## 测试步骤

1. 用 API 读取第一个节点，记下 spec.unschedulable
2. 打开节点列表，对可调度节点执行「停止调度」
3. 回读节点，核对 spec.unschedulable 为 true，状态列出现「已停止调度」
4. 打开该行菜单，核对操作变为「启动调度」
5. 执行「启动调度」，回读并核对不再为 true

## 期望结果

- 停止调度后 spec.unschedulable 为 true
- 状态列出现「已停止调度」提示
- 行操作在「停止调度 / 启动调度」之间互换（互斥，不是同一个标签）
- 启动调度后该字段不再为 true

## 失败排查

- 操作后行操作没变：列表未按正确 query key 失效（应为 ['cluster', kind]）
- 回读仍为 true：写的是 annotations 或没写 spec
- 菜单两个操作同时出现：visible 条件写反

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterListPage.tsx
