# 集群管理（L2）

[上级模块](../_index.md)

集群级视角的页面。它们不属于任何项目空间，地址形如 `/kube-frontend/clusters/<id>/<page>`，**没有 workspace 与 namespace 段**。

## 概述

- **路由**：`/kube-frontend/clusters/:cluster/{overview,nodes,namespaces,components,storageclasses,persistentvolumes,configmaps}`
- **谁用**：集群管理员，判断节点是否健康、集群里有哪些项目。
- **做哪几步**：先看概览（集群身份、用量、模块） → 切到节点看就绪状态与 CPU/内存使用率；切到项目 → 看项目、所属企业空间与用量。
- **看到什么**：概览分四块——基本信息（版本、就绪、连接方式）、资源用量（已用/总量 + 已分配）、Kubernetes 状态（请求速率/延迟/调度）、已启用模块；节点两行（名称 + 内网 IP）、状态徽章、角色、CPU 与内存使用率；项目两行（名称 + 描述）、状态、企业空间、CPU/内存/容器组用量。

## 用户故事

### US1 - 在集群视角下切换节点与项目 (Priority: P1)

作为 **集群管理员**，我希望 **在这两张表之间切换**，以便 **从节点看到项目而不必进任何一个项目**。

**Independent Test**：从节点切到项目再切回，核对页签高亮变化且没有整页刷新。

### US2 - 明确知道自己在集群视角而不是某个项目里 (Priority: P2)

作为 **集群管理员**，我希望 **这些页面不出现项目切换器**，以便 **不会误以为筛选会生效**。

**Independent Test**：打开节点页，核对页面没有项目工作区栏。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01** — 已知已登录且有集群权限，当在两个页签之间切换，则每次都显示对应列表（或空态），页签高亮跟随，切换不产生文档请求。
- **AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-02** — 已知在集群级页面，当观察页面顶部，则**不出现**项目工作区栏（`data-ai-id="workspace-bar"`）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SORT-01** — 已知存储类型与系统组件页各有数据，当点击名称列排序，则顺序变为升序；再次点击变为降序，两次结果不同；系统组件页的初始顺序仍为不健康在前。

## 设计目标

1. 集群级页面与项目级页面共用同一套列表与页签组件，但**不共用工作区栏**。
2. 节点状态只看 Ready 条件，不引入二次推断。

## 约束与边界

- 读 `/kapis/resources.kubesphere.io/v1alpha3/nodes` 与 `/namespaces`（集群级，无 namespace 段）。
- 概览读集群对象与 KubeSphere 监控；集群设置写集群对象的描述注解。
- 其余只读：排空节点、编辑项目、集群可见性不在本模块范围。

## UI 交互设计

区域页签（节点、项目）在最上方；没有项目切换器；列表列固定，窄屏依次折叠。

## 页面结构

| 页签 | 路由 |
|---|---|
| 集群概览 | `/kube-frontend/clusters/<id>/overview` |
| 节点 | `/kube-frontend/clusters/<id>/nodes` |
| 项目 | `/kube-frontend/clusters/<id>/namespaces` |
| 集群设置 | `/kube-frontend/clusters/<id>/settings` |
| 集群监控 | `/kube-frontend/clusters/<id>/monitor` |

## 文案与校验

- 节点列：名称、状态、角色、CPU、内存。
- 项目列：名称、状态、企业空间、创建时间。
- 节点角色默认「worker」；控制面节点显示其角色标签值。

## 异常态

- 加载中：骨架；空：空态且不渲染表头；失败：错误面板 + 重试。
- 集群级列表数据量大时首屏较慢，页面必须给出加载态。

## 功能点

| 功能点 | 需求 |
|---|---|
| 集群概览 | [overview.md](./overview.md) |
| 节点 | [nodes.md](./nodes.md) |
| 项目 | [projects.md](./projects.md) |
| 集群设置 | [settings.md](./settings.md) |
| 集群监控 | [monitor.md](./monitor.md) |

## 明确不做

- 节点排空/污点编辑、项目创建/编辑/删除。
- 集群设置（编辑描述、可见性、可插拔组件开关）：需要平台侧写接口，当前迁移范围外。
- 集群概览的趋势曲线与历史：需要指标历史接口，概览只取当前值（见 [overview.md](./overview.md)）。
- 节点详情的 Pod 列表（需要按节点过滤 Pod）。

## 假设

- 节点可分配资源在 `status.allocatable` 中以 Kubernetes 数量字符串给出。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01`

## 功能需求

- **FR-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01** — 两个页面共用列表组件，差异由描述符表达。
- **FR-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-02** — 集群级页面不渲染项目工作区栏。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01** — 概览的静态事实来自集群对象，测量值来自 KubeSphere 监控，两者独立降级。

## 成功标准

- **SC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01** — 节点名称集合与 `kubectl get nodes` 一致。
