# 集群管理（L2）

[子模块需求](../../../prd/kube-frontend/cluster-management/_index.md)

## 关联需求

- AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01
- AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-02

## 概述

集群作用域的两张只读表：节点与项目。

## 设计目标与非目标

目标：集群作用域有自己的布局，不借用项目布局。非目标：集群写操作。

## 关键约束

- 路径 `/kube-frontend/clusters/:cluster/<page>`，无 workspace、无 namespace。
- 列表请求的 namespace 为空串，表示集群级集合。

## 方案决策

### DEC-L2-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01 — 集群作用域用独立的布局路由

**为什么**：项目布局同时渲染工作区栏（项目切换器）与区域页签。集群页若复用它，就会出现一个「切换项目」控件，而它对页面没有任何影响——这是最容易让人误判的界面元素。

**被否方案**：复用项目布局并用开关隐藏工作区栏。开关会让两个作用域的行为只差一个布尔值，日后必然有人忘记传。

**何时重新考虑**：若将来集群级页面确实需要「按项目过滤」（例如集群级 ConfigMap 已有 `?namespace=`），再把过滤做成显式的筛选器，而不是工作区栏。

### DEC-L2-KUBE-FRONTEND-CLUSTER_MANAGEMENT-02 — 节点状态只看 Ready 条件

**为什么**：Ready 条件是 kubelet 与集群对节点可用性的正式结论。旧页面还有时间同步、磁盘压力等附加判断，那些属于节点详情，不适合折进一个状态列。

**被否方案**：把多种 conditions 合成一个状态。会让「Ready 但磁盘压力大」的节点显示成非 Ready，与 `kubectl get nodes` 不一致。

## 系统现状

老 console `pages/clusters/containers/{Nodes,Projects}`，通过平台切换器进入集群管理；节点列含状态、角色、GPU、CPU/内存使用率，本模块先做静态可分配量与角色。

## 仓库落点

- `apps/console-next/src/pages/cluster/`
- `src/routes/kube-frontend.clusters.$cluster/{route,nodes,namespaces}/`
- `packages/api-client/src/storage.ts`（节点与命名空间模型）

## 对外契约

读集群级 kapis 集合；只读。

## 不变量

1. 集群级页面不出现项目工作区栏。
2. 节点状态等于 Ready 条件。

## 已知坑

- 集群级集合（31 个命名空间、3 个节点）在共享集群上首屏可达数秒，必须给加载态。
- 节点没有 `node-role.kubernetes.io/*` 标签时角色是 `worker`，不能显示空。

## 测试与可观测

E2E：`tests/kube-frontend/cluster-management/`。

## 后续改进

GPU 列、使用率列（需要 metrics 接口）、集群概览与设置页。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01`

## 页面与技术结构

- 区域 `cluster-management`（`scope: 'cluster'`，两页）。
- 布局 `routes/kube-frontend.clusters.$cluster/route.tsx`：只渲染区域页签与 `<Outlet/>`。
- 组件 `ClusterListPage`，描述符在 `pages/cluster/queries.ts`。

## 状态与数据归属

- 页面只持有 UI 态；数据在 Query 缓存，key 含 kind 与 cluster。

## 关键契约与依赖

- `nodesApi` / `namespacesApi`（集群级，namespace 为空）。

## 明确不做

- 节点与项目的写操作、其余集群页面。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 节点 | `prd/…/nodes.md` | `design/…/nodes.md` |
| 项目 | `prd/…/projects.md` | `design/…/projects.md` |
