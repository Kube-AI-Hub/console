# 集群管理（L2）

[子模块需求](../../../prd/kube-frontend/cluster-management/_index.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SORT-01

- AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01
- AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-02

## 概述

集群作用域的节点与项目列表；节点支持调度、元数据、终端及 host vGPU 模式配置。

## 设计目标与非目标

目标：集群作用域有自己的布局，不借用项目布局。节点写操作的授权、并发与异步边界由 [nodes.md](./nodes.md) 定义；非目标为节点排空和项目写操作。

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

### DEC-L2-KUBE-FRONTEND-CLUSTER_MANAGEMENT-03 — 集群菜单分组，导航在 Shell 而非布局里

**为什么**：集群有 11 个页面。平铺时读者要读完 11 行才能找到目标，老 console 因此按组折叠（资源 / 配置 / 存储 / 监控告警 / 集群设置）。
导航本身放在 Shell 而不是布局里，因为切换器（当前集群）必须与菜单同处一个容器——「我在哪个集群」和「我能去哪」是同一个问题。

**分组来自 registry 的 `AreaPage.groupKey`**，不是 Shell 里另写一张表：页面清单只有一个来源，新增页面时分组自动跟随。
当前页所在的分组默认展开（ai-kit 的 Menu 按 activeKey 推导），刷新后不会丢失位置。

**被否方案**：继续用页签条。集群页签与侧栏菜单会同时存在两份导航（旧实现确实这样），且页签条放不下 11 项。

**何时重新考虑**：集群页面数量降到 5 项以内，或需要跨集群并列对比时。

### DEC-L2-KUBE-FRONTEND-CLUSTER_MANAGEMENT-04 — 配置类对象在集群域与项目域都提供列表

**为什么**：Secret / ConfigMap / ServiceAccount 是命名空间对象，但「跨项目定位一个配置」是集群管理员的日常第一步——某个 Secret 被哪个项目引用、哪些项目还留着一份过期配置、某个镜像仓库密钥有没有复制到新项目。这些问题的答案只能在集群视角得到。老 console 一直有这三页（带「项目」列与全命名空间筛选），这不是历史包袱，是这类对象的正常入口。读取本身也是原生能力：`/api/v1/{configmaps,secrets,serviceaccounts}` 的全命名空间 list 是 Kubernetes 的核心语义，不需要任何聚合接口。

**被否方案（原决策，2026-11-14 推翻）**：只在项目作用域提供，集群级不做。当时的依据有两条：①权限口径分裂——集群级列表走 clusterrole、项目级走 project role，同一对象两处可见性不同；②两套列表的维护成本。**两条都不成立**：①可以消解——集群级列表做成**只读 + 项目列 + 行内跳转到所属项目页**，写操作一律回项目作用域，读者不会遇到「同一对象两个编辑入口」；②成本真实但很小——同一份列表 schema 传 `namespace: ''` 即可复用，增量只有一列与一个筛选器。
原决策还把「跨项目按名检索」判为低频，这是把一个排障动作当成了边角需求：找「这份配置到底在哪个项目」正是排障的第一步。

**落地约定**：
1. 集群级三页只读，行内提供「在所属项目中打开」跳转；创建入口不放在集群页，避免在集群页里再造一个项目选择器。
2. 列与项目级一致，额外加「项目」列。
3. 项目列链接到 `/kube-frontend/<ws>/clusters/<c>/projects/<ns>/<page>`。

## 系统现状

节点页已独立为 NodesPage，统计、筛选、GPU/显存、容器组、厂商型号、模式及 NTP 使用后端契约；项目列表保留既有实现。

## 仓库落点

- `apps/console-next/src/pages/cluster/`
- `src/routes/kube-frontend.clusters.$cluster/{route,nodes,namespaces}/`
- `packages/api-client/src/storage.ts`（节点与命名空间模型）

## 对外契约

读集群级 kapis 集合。节点调度、元数据与终端的版本化契约见 [nodes.md](./nodes.md)；
节点终端复用共享 ExecConsoleDialog 与 TerminalView，独立 JSON 传输在 api-client，授权和访问 Pod 生命周期仍在后端。
节点列表复用 ResourceList/Table/Pagination；MultiSelect、StatisticsGroup、MetricCell 为 ai-kit 的通用展示能力。
全局统计与筛选列表使用独立缓存，模式 success=true 仅表示提交，member GPU 写路由禁止回退 host。

## 不变量

1. 集群级页面不出现项目工作区栏。
2. 节点状态等于 Ready 条件。

## 已知坑

- 集群级集合（31 个命名空间、3 个节点）在共享集群上首屏可达数秒，必须给加载态。
- 节点没有 `node-role.kubernetes.io/*` 标签时角色是 `worker`，不能显示空。

## 测试与可观测

E2E：`tests/kube-frontend/cluster-management/`。

## 后续改进

节点导入、RDMA 端口、GPU 拓扑，以及 member GPU 模式写路由。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01`

## 页面与技术结构

- 区域 `cluster-management`（`scope: 'cluster'`，两页）。
- 布局 `routes/kube-frontend.clusters.$cluster/route.tsx`：只渲染 `<Outlet/>`；导航在 Shell 的左侧集群菜单里（见下）。
- 组件 `ClusterListPage`，描述符在 `pages/cluster/queries.ts`。

## 状态与数据归属

- 页面只持有 UI 态；数据在 Query 缓存，key 含 kind 与 cluster。

## 关键契约与依赖

- `nodesApi` / `namespacesApi`（集群级，namespace 为空）。

## 明确不做

- 节点排空与项目写操作；节点调度和元数据已迁移。
- 集群网关与网关详情：网关控制器缺 Helm chart，状态到不了就绪（计划 §5.7）。
- 集群列表的卡片视图（理由见 `cluster-list.md` 的「方案决策」末条）。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 节点 | `prd/…/nodes.md` | `design/…/nodes.md` |
| 项目 | `prd/…/projects.md` | `design/…/projects.md` |
| 编辑 YAML 覆盖 | `prd/…/yaml-edit.md` | `design/…/yaml-edit.md` |
