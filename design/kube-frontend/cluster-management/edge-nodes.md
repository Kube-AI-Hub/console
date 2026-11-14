# 边缘节点终端（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/edge-nodes.md)

## 概述

边缘节点详情侧栏复用集群节点详情已经在用的 `KubeCtlModal`。有节点名时，终端仓库走 `nodes/<name>/exec`，不经过容器 exec。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01`

## 设计目标与非目标

- **目标**：在旧控制台边缘节点详情的「更多」里打开与集群节点详情相同的节点终端。
- **非目标**：不改终端协议，不把边缘节点页迁到 `/kube-frontend`。

## 关键约束

- 侧栏按钮组 `limit` 为 2：第一项留在外面，从第二项起进入「更多」。因此「打开终端」必须排在停止调度之后，才会落进「更多」。
- `isEdgeNode` 只决定失败文案写「node」还是「container」，以及是否显示集群切换。真正的连接地址由 `nodename` 决定。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01：复用集群节点详情的弹窗

- **备选**：给边缘节点单独写一个终端弹窗；或从列表页跳过去再打开。
- **选定**：在 `EdgeNodes/Detail` 的 `getOperations` 里插入与 `Nodes/Detail` 相同的一项，调用同一个 `KubeCtlModal`，并传入 `nodename` 与 `isEdgeNode`。
- **原因**：列表页已经能打开节点终端，缺的只是详情侧栏。另写弹窗会把失败文案和 WebSocket 地址再分叉一次。
- **被否方案**：把「打开终端」放在第一项。那样它会变成主按钮，停止调度被挤进「更多」，和集群节点详情不一致。
- **何时重新考虑**：新版控制台做出边缘节点页时，按新版节点详情的 `data-ai-id` 重做入口，不再依赖旧侧栏的 `data-test`。

## 系统现状

### 数据流

`边缘节点详情侧栏 → 更多 → KubeCtlModal → TerminalStore.kubeWebsocketUrl → kapis/terminal.../nodes/<name>/exec`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `src/pages/clusters/containers/EdgeNodes/Detail/index.jsx` | 把「打开终端」放进侧栏操作 | 不创建访问 Pod |
| `src/components/Modals/KubeCtl/index.jsx` | 有 `nodename` 时直接取节点 WebSocket | 不区分边缘节点和普通节点的协议 |
| `src/stores/terminal.js` | `nodename` 存在时返回 `nodes/<name>/exec` | 不改权限 |

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 页面 | `console` | `src/pages/clusters/containers/EdgeNodes/Detail/index.jsx` | 增加操作项与打开函数 |
| 状态 | `console` | `src/stores/terminal.js` | 不改 |
| 工具 | `console` | 无 | 不改 |
| 文案 | `console` | `locales/` | 不改，沿用 `OPEN_TERMINAL` |
| 接口 | `kube-server` | `pkg/models/terminal/terminal.go` | 不改 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `GET kapis/terminal.kubesphere.io/v1alpha2/nodes/<name>/exec` | WebSocket | 节点 shell，与集群节点详情相同 | 终端弹窗 |
| `data-test="detail-terminal"` | DOM | 「更多」菜单项 | 本功能的界面用例 |

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01**：只要传入 `nodename`，终端地址就是 `nodes/<name>/exec`。漏传会落到容器 exec，连到错误的对象。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01** | 侧栏对 `show` 函数只判断真假，不会调用它 | 写成函数并不能按 Ready 隐藏菜单项；要隐藏必须传布尔值 | `core/containers/Base/Detail/index.jsx` 的 `getEnabledOperations` |
| **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-02** | 边缘节点没有到 kubelet `10250` 的路由 | 终端依赖 edgeStream。隧道没开时弹窗能出现，但没有 shell 输出 | 节点上的 `edgecore.yaml` |

## 测试与可观测

- **自动化**：`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01` 打开旧控制台的边缘节点运行状态页，核对「更多」里的「打开终端」以及弹出的终端容器。
- **手动验证**：`/clusters/host/edgenodes/<node>/status`，点「更多」→「打开终端」。
- **日志 / 指标**：连接失败时看 cloudcore 的 stream 日志和边缘节点 `edgestream` 日志。

## 后续改进

新版控制台还没有边缘节点页。那一页落地时，把入口改成与新版节点详情相同的按钮标识，而不是继续使用旧侧栏的 `data-test`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01`
