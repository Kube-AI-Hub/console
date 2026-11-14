# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01 边缘节点详情 · 更多里打开终端

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `edge-nodes`
- **入口**: `{BASE_URL}/clusters/{cluster}/edgenodes/{node}/status`
- **需求**: `prd/kube-frontend/cluster-management/edge-nodes.md`

## 产品功能

边缘节点运行状态页的「更多」里有「打开终端」，点开后是节点终端弹窗。

### 关联需求

- `prd/kube-frontend/cluster-management/edge-nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/edge-nodes.md`](../../../../prd/kube-frontend/cluster-management/edge-nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01** — 已知集群有一个 Ready 的边缘节点，当打开该节点的运行状态页并点「更多」，则菜单中有「打开终端」；点击后立即出现近全屏终端弹窗，连接目标是该节点的 `nodes/exec`，而不是某个容器的 `pods/exec`。无 `edit` 权限时不出现这一项。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/edge-nodes.md`](../../../../design/kube-frontend/cluster-management/edge-nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/edge-nodes.md`](../../../../prd/kube-frontend/cluster-management/edge-nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在边缘节点上直接排障 (Priority: P1)

作为 **有节点终端权限的管理员**，我希望 **在边缘节点详情的「更多」里打开节点 shell**，以便 **在边缘主机上执行命令，而不必回到列表页**。

**Independent Test**：打开一个 Ready 边缘节点的运行状态页，点「更多」，确认菜单里有「打开终端」；点开后出现与集群节点详情相同的近全屏终端弹窗，连接的是该节点。

## 前置与配置

- 当前账号对节点有 edit 权限
- 集群里有一个 Ready 且带 node-role.kubernetes.io/edge 的节点

## 测试步骤

1. 打开该节点的 /clusters/{cluster}/edgenodes/{node}/status
2. 点侧栏「更多」
3. 点「打开终端」

## 期望结果

- 「打开终端」出现在「更多」菜单里，不是侧栏主按钮
- 弹出的终端容器可见，请求的是该节点的 nodes/exec

## 失败排查

- 菜单没有这一项时，先看侧栏操作是否被权限滤掉
- 弹窗停在连接错误时，看边缘节点 edgeStream 是否已打开

## 产品改版后如何更新自动化

- 菜单项的 data-test 仍是 detail-terminal；改键名时同步本用例
