# 集群管理（L2）

[上级模块](../_index.md)

集群级视角的页面。它们不属于任何项目空间，地址形如 `/kube-frontend/clusters/<id>/<page>`，**没有 workspace 与 namespace 段**。

## 概述

- **路由**：`/kube-frontend/clusters/:cluster/{overview,nodes,namespaces,pods,deployments,statefulsets,daemonsets,jobs,cronjobs,services,ingresses,components,custom-resources,networkpolicies,ippools,storageclasses,persistentvolumes,log-collections,logs,events,audit-logs,monitor,node-usage,members,visibility,settings}`
- **谁用**：集群管理员，判断节点是否健康、集群里有哪些项目。
- **做哪几步**：先看概览（集群身份、用量、模块） → 切到节点看就绪状态与 CPU/内存使用率；切到项目 → 看项目、所属企业空间与用量。
- **看到什么**：概览分四块——基本信息（版本、就绪、连接方式）、资源用量（已用/总量 + 已分配）、Kubernetes 状态（请求速率/延迟/调度）、已启用模块；节点两行（名称 + 内网 IP）、状态徽章、角色、CPU 与内存使用率；项目两行（名称 + 描述）、状态、企业空间、CPU/内存/容器组用量。

## 用户故事

### US1 - 在集群视角下切换节点与项目 (Priority: P1)

作为 **集群管理员**，我希望 **在这两张表之间切换**，以便 **从节点看到项目而不必进任何一个项目**。

**Independent Test**：从节点切到项目再切回，核对左侧集群菜单的高亮变化且没有整页刷新。

### US2 - 明确知道自己在集群视角而不是某个项目里 (Priority: P2)

作为 **集群管理员**，我希望 **这些页面不出现项目切换器**，以便 **不会误以为筛选会生效**。

**Independent Test**：打开节点页，核对页面没有项目工作区栏。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01** — 已知已登录且有集群权限，当在左侧集群菜单的页面之间切换，则每次都显示对应页面（或空态），菜单高亮跟随，切换不产生文档请求。
- **AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-02** — 已知在集群级页面，当观察页面顶部，则**不出现**项目工作区栏（`data-ai-id="workspace-bar"`）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SORT-01** — 已知存储类型与系统组件页各有数据，当点击名称列排序，则顺序变为升序；再次点击变为降序，两次结果不同；系统组件页的初始顺序仍为不健康在前。

## 设计目标

1. 集群级页面与项目级页面共用同一套列表组件，但**不共用工作区栏**，导航放在左侧集群菜单里。
2. 节点状态只看 Ready 条件，不引入二次推断。

## 约束与边界

- 读 `/kapis/resources.kubesphere.io/v1alpha3/nodes` 与 `/namespaces`（集群级，无 namespace 段）。
- 概览读集群对象与 KubeSphere 监控；集群设置写集群对象的描述注解。
- 节点支持调度开关、标签和污点局部写入；节点终端使用独立 nodes/exec 权限，契约见 [nodes.md](./nodes.md)。
- 节点总览保持集群范围；搜索筛选、GPU/容器组指标、厂商型号与 NTP 的口径见 [nodes.md](./nodes.md)。host vGPU 模式配置需要风险确认与异步结果追踪，生产验收不切换模式。
- 节点详情的分配、健康、GPU/RDMA 与拓扑见 [nodes.md](./nodes.md)；身份侧栏和负载主栏不混淆当前节点与集群范围。概览双栏、协调刷新和既有运维入口见 [overview.md](./overview.md)，监控缺值不填零。
- 概览完整六类资源、scheduler 三种结果、用户 kubeconfig、组件分类及 Top5 均按 [overview.md](./overview.md) 原子能力验收；完整排行与首页共享读模型。组件与凭据读取按用户/集群隔离，不用配置徽标或节点分页结果代替这些事实。
- 显卡列表以物理设备分页筛选，统计保持全局；单卡监控、UUID 关联容器组及所属节点事件的边界见 [gpu.md](./gpu.md)。未确认成员集群 GPU 路由时不读取 host 代替。
- 排空节点、编辑项目、集群可见性不在本模块范围。

## UI 交互设计

左侧是**集群菜单**：顶部为当前集群卡片（点击可切换集群），下面按组折叠（资源 / 配置 / 存储 / 监控告警 / 集群设置 / 扩展），概览不归组、始终在顶部；没有项目切换器。节点复用 ai-kit 工具栏、表格与分页，列可选择显隐，窄屏横向滚动而不隐藏核心指标。

## 页面结构

| 菜单项 | 路由 |
|---|---|
| 集群概览 | `/kube-frontend/clusters/<id>/overview` |
| 节点 | `/kube-frontend/clusters/<id>/nodes` |
| 项目 | `/kube-frontend/clusters/<id>/namespaces` |
| 集群设置 | `/kube-frontend/clusters/<id>/settings` |
| 集群监控 | `/kube-frontend/clusters/<id>/monitor` |
| 节点用量 | `/kube-frontend/clusters/<id>/node-usage` |
| 自定义资源 | `/kube-frontend/clusters/<id>/custom-resources` |

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
| 边缘节点终端 | [edge-nodes.md](./edge-nodes.md) |
| 项目 | [projects.md](./projects.md) |
| 集群设置 | [settings.md](./settings.md) |
| 集群监控 | [monitor.md](./monitor.md) |
| 节点用量 | [node-usage.md](./node-usage.md) |
| 自定义资源 | [custom-resources.md](./custom-resources.md) |
| 集群级配置 | [cluster-config.md](./cluster-config.md) |
| 显卡 | [gpu.md](./gpu.md) |
| 集群级告警 | [cluster-alerting.md](./cluster-alerting.md) |
| 集群级存储卷声明 | [cluster-pvc.md](./cluster-pvc.md) |
| gpu-resource | [gpu-resource.md](./gpu-resource.md) |
| juicefs | [juicefs.md](./juicefs.md) |
| monitor-resource | [monitor-resource.md](./monitor-resource.md) |
| 编辑 YAML 覆盖 | [yaml-edit.md](./yaml-edit.md) |
| 添加集群 | [add-cluster.md](./add-cluster.md) |

## 明确不做

- 节点排空、项目创建/编辑/删除。
- 集群可见性与可插拔组件开关：需要平台侧写接口，当前迁移范围外（集群描述/别名/标签/供应商已可在列表与集群设置页编辑）。
- 集群概览的趋势曲线与历史：需要指标历史接口，概览只取当前值（见 [overview.md](./overview.md)）。
- 节点详情的容器组、事件与硬件按页签读取；运行状态首屏取当前负载与一类趋势，全部趋势在监控页按需读取。

## 重纳能力（2026-11-17 产品复核）

集群网关的创建 / 编辑 / 删除，以及详情补 4 个页签（监控 / 日志 / 资源状态 / 元数据），原登记为「不做」。**2026-11-17 产品复核决定重纳**（N-29，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)）。

**登记口径是「重纳 + 环境阻塞」，不是「不做」，也不是「已可验收」**：

- 阻塞事实：本集群网关控制器缺 Helm chart，Gateway 对象只能到 `Deployed=True`，`spec` 被重写为空、Service 不创建。这属于环境阻塞——代码与规格可以推进，**验收等控制器就绪**。
- 控制器未就绪时，这几项**不得**标记为已迁移或已验收；页面必须明确说明「缺什么」，不能把未就绪对象显示成可用。
- 项目作用域的网关页已交付，不受影响。

详见 [cluster-gateways.md](./cluster-gateways.md) 与 [gateway-detail.md](./gateway-detail.md)。

**待补登记**：本节对应的 `US` / `AC` 尚未编号，与实现同批补齐——新增 AC 若无用例覆盖会让 `check_docs.py --strict` 报「没有被任何用例覆盖」。

## 假设

- 节点可分配资源在 `status.allocatable` 中以 Kubernetes 数量字符串给出。

## 验收用例
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01`

- `TC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01`

## 功能需求

- **FR-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01** — 两个页面共用列表组件，差异由描述符表达。
- **FR-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-02** — 集群级页面不渲染项目工作区栏。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01** — 概览的静态事实来自集群对象，测量值来自 KubeSphere 监控，两者独立降级。

## 成功标准

- **SC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01** — 节点名称集合与 `kubectl get nodes` 一致。
