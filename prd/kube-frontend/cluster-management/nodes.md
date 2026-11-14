# 节点列表（L3）

[子模块需求](./_index.md)

## 概述

集群节点列表与详情：查看状态、用量、节点资源，编辑标签与污点，并在近全屏弹窗连接节点终端。

## 用户故事

### US1 - 确认节点是否就绪、还剩多少资源 (Priority: P1)

作为 **集群管理员**，我希望 **一眼看到每个节点的就绪状态与可分配资源**，以便 **判断能否继续调度**。

**Independent Test**：打开节点页，核对状态徽章与 `kubectl get nodes` 的 STATUS 列一致。

### US2 - 弄清某个节点为什么不健康 (Priority: P1)

作为 **集群管理员**，我希望 **点开一个节点看到它的状态条件、可分配量与污点**，以便 **判断它为什么不可用、还能不能再调度上去**。

**Independent Test**：从列表点进节点详情，核对条件数、可分配量与节点对象一致。

### US3 - 让节点停止接收新容器组 (Priority: P1)

作为 **集群管理员**，我希望 **一键停止/恢复节点的调度**，以便 **在维护节点前不让新容器组落上去，而不必动 kubectl**。

**Independent Test**：对节点停止调度 → 回读 `spec.unschedulable` 为 true；启动调度 → 该字段不再为 true。

### US4 - 在目标节点直接排障 (Priority: P1)

作为 **有节点终端权限的管理员**，我希望 **从列表或详情打开节点 shell**，以便 **使用原生交互命令定位主机问题**。

**Independent Test**：连接后执行 hostname 与唯一 printf 标记，验证输出来自目标节点，调整视口后核对 stty size，关闭会话。

### US5 - 查看节点关联资源并维护元数据 (Priority: P1)

作为 **集群管理员**，我希望 **查看节点的容器组、事件与趋势并编辑标签和污点**，以便 **判断调度问题而不编辑整份节点 YAML**。

**Independent Test**：增加临时标签并回读；无效污点不能提交，取消不改原污点；切换关联资源和监控页签后得到该节点数据。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02** — 已知集群可访问 metrics.k8s.io，当打开节点列表，则显示「CPU 使用率」与「内存使用率」两列，取值为 0–100 的整数百分比，等于该节点当前用量与可分配量之比（允许四舍五入差 1）；指标不可用时显示 `-`。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01** — 已知集群至少有一个节点，当打开节点页，则显示名称、状态、角色、CPU、内存五列，且状态为 Ready 或 NotReady。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03** — 已知节点列表中有节点，当点击节点名称，则进入节点详情：显示状态、角色、kubelet 版本、内网 IP、操作系统镜像、内核、容器运行时与创建时间；「可分配 / 总量」按人类可读单位显示（CPU 为核、内存与存储为 GiB/TiB）；并列出全部状态条件、标签与污点；这些值与该节点对象一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04** — 已知节点列表中有可调度节点，当对它执行「停止调度」，则该节点 `spec.unschedulable` 变为 `true`，状态列出现「已停止调度」，行操作变为「启动调度」；再执行「启动调度」，`spec.unschedulable` 不再为 `true`，徽标消失。详情提供相同操作，失败可见，写入针对当前集群。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05** — Ready 节点在列表行操作和详情提供「打开终端」，点击立即显示近全屏弹窗；真正收到远端输出后才启用输入。支持原始 ANSI、光标、Tab、历史和控制键，Esc 不关闭弹窗；1024/1280/1600 视口同步远端 PTY 行列，关闭或离开页面释放连接；无权限、启动失败、等待超时明确报错且可重连。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06** — 节点详情补充系统架构、操作系统类型、kube-proxy 与已上报的 GPU 信息，并展示全部扩展容量（GPU/RDMA 为数量，不换算为字节）。标签与污点编辑使用局部带版本写入；无效污点保留输入，取消不写入，NoExecute 风险明确。容器组按 spec.nodeName 过滤，事件按 Node 名称与类型过滤，监控展示该节点 CPU/内存/容器组趋势。列表支持刷新与每页条数。

## 设计目标

落实「节点状态只看 Ready 条件」。

## 约束与边界

- 读集群级 `nodes` 集合，无 namespace 段。
- 角色取 `node-role.kubernetes.io/*` 标签，缺省为 `worker`。
- 节点终端由后端校验 `create nodes/exec`，后端负责特权访问 Pod 生命周期；前端不能借普通 pods/exec 绕过权限。
- 标签与污点编辑带 resourceVersion；409 不覆盖其他管理员修改，保留输入并显示错误。

```mermaid
flowchart LR
  Nodes[节点列表与详情] --> Dialog[共享近全屏终端]
  Dialog --> NodeAPI[节点 JSON WebSocket]
  NodeAPI --> RBAC[nodes/exec 授权与节点访问 Pod]
```

## UI 交互设计

状态徽章：Ready 成功色，其余危险色；CPU/内存用量保留既有百分比。详情按运行状态、容器组、监控、事件分区。
节点终端只在用户点击时连接；终端模拟器与容器终端共用，不提供多余命令表单。

## 文案与校验

- 列：名称、状态、角色、CPU、内存。
- 状态：Ready / NotReady / Unknown。

## 边界情况

- 没有 Ready 条件的节点显示 Unknown。
- 没有内部 IP 时副行显示 `-`。

## 明确不做

- 节点排空与节点导入/删除；GPU 模式切换、RDMA 端口与 GPU 拓扑图仍需独立迁移，不由本批验收冒充已完成。

## 假设

- 节点状态由 kubelet 上报。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01** — 列表展示五列，状态取自 Ready 条件。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01** — 名称集合与 `kubectl get nodes` 一致。
