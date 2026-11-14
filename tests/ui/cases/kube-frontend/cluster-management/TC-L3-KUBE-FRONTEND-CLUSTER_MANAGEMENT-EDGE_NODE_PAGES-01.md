# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01 边缘节点列表与详情

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `edge-node-pages`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/edgenodes`
- **需求**: `prd/kube-frontend/cluster-management/edge-node-pages.md`

## 产品功能

边缘节点独立列表（反向标签选择器），详情复用节点详情，返回链接回到边缘列表。

### 关联需求

- `prd/kube-frontend/cluster-management/edge-node-pages.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/edge-node-pages.md`](../../../../prd/kube-frontend/cluster-management/edge-node-pages.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01** — 已知集群至少有一个边缘节点，当打开边缘节点列表，则只显示同时带 `node-role.kubernetes.io/edge` 标签的节点（行数等于该选择器返回数），每行显示名称、状态、内网 IP、创建时间；点击名称进入节点详情（运行状态页签），返回链接回到边缘节点列表而不是常规节点列表；集群没有边缘节点时显示明确空态。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/edge-node-pages.md`](../../../../design/kube-frontend/cluster-management/edge-node-pages.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/edge-node-pages.md`](../../../../prd/kube-frontend/cluster-management/edge-node-pages.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 找到可能间歇在线的边缘节点 (Priority: P2)

作为 **集群管理员**，我希望 **在一个列表里看到本集群的边缘节点**，以便 **不必先怀疑它们为什么不在常规节点列表里**。

**Independent Test**：打开边缘节点页，行数等于带 `node-role.kubernetes.io/edge` 标签且属于本集群的节点数；点击名称进入详情并看到运行状态。

## 前置与配置

- 已登录且集群至少有一个 edge 标签节点

## 测试步骤

1. 打开集群边缘节点列表
2. 核对行数与标签选择器结果
3. 点击第一个边缘节点名称
4. 检查 URL 与运行状态页签
5. 点击返回

## 期望结果

- 只读断言

## 失败排查

- 行数为 0：集群确实没有边缘节点（跳过）
- 详情 404：路由未注册

## 产品改版后如何更新自动化

- 选择器：edgenodes:surface / edgenodes:link:<name>
