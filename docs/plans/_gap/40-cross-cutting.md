# 跨页面功能层缺口分析（40-cross-cutting）

> 当前状态：**2026-11-17 复验**（下面 §0）。旧正文（2026-11-14）保留为附录 A，仅作源码线索，**不得据其「无/真缺失」判定当前状态**。
> 方法见[迁移指南](../../legacy-ui-migration-guide.md) §3.3/§5/§6；当前待复核台账见[能力矩阵](../capability-matrix.md) §0。

## 2026-11-17 复验

### 0.1 复验口径

- **页面级 ✅ ≠ 能力完整**：逐项按原子能力核对（迁移指南 §3.3）。
- **判定能不能做要探测接口，不读模块开关**（指南 §2.3）。本轮为纯静态源码分析：接口存在性以 `api-client` 端点为证，**未**对部署发请求，凡需真实响应才能定论的标「未核实」。
- 状态取值：`已交付`（有源码证据）/ `部分` / `待补` / `批准不做`（须有理由）/ `环境阻塞`（须有证据）/ `未核实`。
- 计数自数，不复制旧数字；每条结论给 `路径:行号`。
- 唯一写入文件：本文件。

### 0.2 一句话结论

2026-11-14 判定的**四个“架构级缺失”已全部推翻**：BFF 已有 `upgrade`，容器 exec / kubectl / 节点 shell / 容器日志 tail 四条通道都已建立并接入页面。本轮真正剩下的是**能力细节的缺口**（日志检索的筛选维度与导出、少数资源的 YAML/写、企业空间角色的写、实时 watch 只接了 1 页），而不是通道缺失。

### 0.3 八个前置事实（本轮新证据）

| # | 事实 | 证据 |
| --- | --- | --- |
| 1 | BFF 已有 WebSocket upgrade 转发，且只放行 exec 路径 | `server/src/upgrade.ts:51-57`（`isExecUpgradePath`）、`server/src/index.ts:214`（`server.on('upgrade', createUpgradeHandler(deps.config))`） |
| 2 | 鉴权走 `bearer.<token>` 子协议，不用 query（避免 token 进访问日志） | `server/src/upgrade.ts:25-35,77-86` |
| 3 | 容器 exec 用 kube `v5.channel.k8s.io` 帧协议，`/api/v1/.../exec` | `packages/api-client/src/exec.ts:26-42,130-161` |
| 4 | 节点 shell 用 kapis `terminal.kubesphere.io/v1alpha2/.../nodes/<name>/exec`，JSON 信封 | `packages/api-client/src/node-terminal.ts:13-16,19-96` |
| 5 | 前端终端是**真 xterm**（不是 `<pre>`） | `packages/ai-kit/src/terminal/TerminalView.tsx:2-4,51-56`；经 `packages/ui/src/terminal.ts:1` 再导出 |
| 6 | 容器日志走 HTTP 分块流（`follow=true`），**不是** WebSocket；且实测 `follow` 不能带 `tailLines` | `packages/api-client/src/logs.ts:3-13,71-102` |
| 7 | 列表实时用 `?watch=true` 的 HTTP watch 流，非 WebSocket | `packages/api-client/src/watch.ts:22-35`、`apps/console-next/src/components/resource/useCollectionWatch.ts:41-73` |
| 8 | 老 console 的 DEC 已把“不做 WebSocket”写成**被否方案** | `design/kube-frontend/_index.md:91-102`（DEC-CORE-KUBE-FRONTEND-08，含“2026-11-14 推翻”记录） |

### 1. 终端与运维

| 子能力 | 老 console | 新 UI 现状 | 状态 | 证据（新） |
| --- | --- | --- | --- | --- |
| 容器 exec | `components/Modals/ContianerTerminal/index.jsx:100-151`（含容器切换 + 状态/镜像/命令/资源面板） | 有：全屏 `size="console"` 弹窗，xterm 渲染，resize 上报，失败可见可重试 | **已交付** | `components/resource/ExecConsoleDialog.tsx:53-78`；入口 `pages/app-workloads/ContainerTerminal.tsx:19` ← `ContainerDetailPage.tsx:212` |
| kubectl | `components/Modals/KubeCtl/index.jsx:103-118` + 独立窗口 `pages/terminal/index.jsx:70-78` | 有：独立页面 `/clusters/<c>/kubectl`，先取 kubectl Pod 再连 exec | **已交付（形态改进）** | `pages/cluster/KubectlPage.tsx:21-23`；`components/resource/KubectlConsoleDialog.tsx:24-41`；`packages/api-client/src/kubectl.ts:23-31` |
| 节点 shell | `stores/terminal.js:61-65` | 有：节点列表/节点详情/集群列表三处入口，带危险操作提示 | **已交付（环境受限）** | `NodesPage.tsx:163`、`NodeDetailPage.tsx:183`、`ClusterListPage.tsx:350`、`ExecConsoleDialog.tsx:61` |
| 独立新窗口承载 | `core/terminal.js:71` 单独 webpack entry | 无独立窗口，改为页内近全屏弹窗 | **有替代（批准）** | 迁移指南 §5 第 151 行要求“独立近全屏弹窗”；`ExecConsoleDialog.tsx:53` `dismissOnEscape={false}` |
| 容器文件上传/下载 | **老 console 也没有** | 无 | 不构成缺口 | 旧正文已反向核实 |
| 会话就绪判定 | 老无（连上即用） | 以首次输出为就绪；握手 101 不算成功 | **改进** | `node-terminal.ts:64-82`（注释“Upgrade is not readiness”） |

> **本轮推翻**：旧 §1 的 6 条“真缺失”（含“架构级缺失”定性）全部不成立。

### 2. 日志

#### 2.1 交付面（先确认“在不在”）

| 能力 | 新 UI | 证据 |
| --- | --- | --- |
| 容器日志 tail（实时） | 有：`follow=true` 分块流，xterm 渲染，开关式实时 | `pages/app-workloads/ContainerLogsDialog.tsx:46-68` |
| 容器日志（非实时检索） | 有：走日志检索 API，最近 1h / 200 条 | `ContainerLogsDialog.tsx:22-35` |
| 日志查询页 | 有：`/clusters/<c>/logs` | `routes/kube-frontend.clusters.$cluster/logs`；`pages/cluster/ClusterLogsPage.tsx:30` |
| 审计日志页 | 有：`/clusters/<c>/audit-logs` | `pages/cluster/ClusterAuditLogsPage.tsx:29` |
| 事件检索页 | 有：`/clusters/<c>/events` | `pages/cluster/ClusterEventsPage.tsx:44` |
| 侧栏入口 | 三页都在「监控告警」组 | `areas/registry.ts:269-271` |
| 日志收集配置 | 有（只读，批准不做编辑） | `areas/registry.ts:201`；旧正文 parity:37 |

#### 2.2 与老 console 的逐项差异

| # | 老能力 | 老证据 | 新现状 | 状态 |
| --- | --- | --- | --- | --- |
| L1 | 集群筛选（多集群时选集群） | `Modals/LogSearch/Logging/Search/index.jsx:446-454` | 无：`ClusterLogsPage` 的 `cluster` 参数**未被使用**（`cluster: _cluster`，`ClusterLogsPage.tsx:30`）；`logSearchApi` 也无 cluster 入参（`search.ts:61-68`） | **待补** |
| L2 | 工作负载（workload）维度筛选 | 同上 `:468-471`（`workload_query`） | 无：只有 namespace/pod/container/keyword（`ClusterLogsPage.tsx:96-112`） | **待补** |
| L3 | 精确/模糊查询模式 | `Search/index.jsx:140-143,482-487` | 无 | **待补** |
| L4 | 自定义时间区间（起止 + step） | `SearchInput/index.jsx:26-28`（DefaultRange/CustomRange） | 只有 4 档预设（`ClusterLogsPage.tsx:23-28`） | **部分** |
| L5 | 直方图点击下钻到该时间桶 | `Search/index.jsx:226-234,550-556`（`onBarClick`） | 日志/审计页直方图是**不可点的 div**（`ClusterLogsPage.tsx:128-138`）；事件页可点（`ClusterEventsPage.tsx:178-196`） | **部分** |
| L6 | 导出/下载 `logs.log` | `Search/index.jsx:391-415` | 无（两页均无下载入口） | **待补** |
| L7 | 关键字高亮 + ANSI 着色 | `Search/index.jsx:284-332`（esMark / ansi_up） | 纯文本渲染（`ClusterLogsPage.tsx:161`） | **待补** |
| L8 | 实时轮询 + 刷新频率 5/10/15s | `Search/index.jsx:135-138,275-282,334-348` | 日志/审计页无；事件页有 5s 实时开关（`ClusterEventsPage.tsx:80-89,233-241`） | **部分** |
| L9 | 无限滚动「加载更多」 | `Search/index.jsx:236-254` | 改为上一页/下一页（`ClusterLogsPage.tsx:167-190`） | **有替代（更优）** |
| L10 | 列显隐（时间/项目/容器可隐藏） | `Search/index.jsx:76-121`（`hidden`） | 日志页是自绘行、无列概念；审计页是固定 6 列表格 | **部分** |
| L11 | 点击行进入日志详情 | `Search/index.jsx:422-425` | 无 | **待补** |
| L12 | 审计按 namespace / 响应码筛选 | 老 AuditingSearch 有对应输入 | API 支持（`search.ts:174,178`）但页面只暴露 verb/resource/user/workspace（`ClusterAuditLogsPage.tsx:31-34`） | **部分** |
| L13 | 容器日志「查看更多」（每次 +1000 行） | `Cards/ContainerLog/index.jsx:130-135` | 无：非实时路径固定 1h/200 条 | **待补** |
| L14 | 容器日志下载 `.log` | `Cards/ContainerLog/index.jsx:144-167` | 无下载按钮（`ContainerLogsDialog.tsx:76-88` 只有实时/搜索/刷新） | **待补** |
| L15 | 事件按 message/namespace/kind/name/reason/type 筛选 + 直方图下钻 + 实时 | 老 EventSearch | **全部有**，且直方图与列表共用同一组过滤条件 | **已交付（优于旧）**（`ClusterEventsPage.tsx:36-42,137-141,158-199`） |

> 结论：**三页都在，但日志/审计两页只覆盖了老能力的约六成**；差距集中在筛选维度、导出、高亮、实时与下钻交互。

### 3. 监控图表

| 子能力 | 老 console | 新 UI | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| 图表组件 | 自建 `components/Charts`（Area×5、Bar×3、Pie、Custom Tooltip） | `TrendChart`：多序列、可选坐标轴/网格/面积、键盘可导航、NaN 断点不填 0 | **已交付（类型减少）** | `packages/ai-kit/src/primitives/TrendChart.tsx:4-55,96-165`；经 `packages/ui/src/index.ts:56` 导出 |
| 集群物理资源指标 | 14 类（`Monitor/PhysicalResource/index.jsx:32-302`） | **26 张卡**，按 GPU/主机/磁盘 I/O/网络/RDMA 五组 | **已交付** | `ClusterMonitorPage.tsx:64-120`（`CHARTS` 定义）、分组注释 `:55-60` |
| 系统组件监控 | etcd/apiserver/scheduler 三页 | 页内三子组（APIServer 速率/延迟按 verb 多序列、Scheduler 按 result、etcd 6 图） | **已交付** | `ClusterMonitorPage.tsx:10`；`componentMonitorQueries.ts` |
| 时间区间 | `MonitoringController`（step/times 参数化，含自定义） | 4 档预设（1h/6h/24h/7d），各页一致 | **部分** | `ClusterMonitorPage.tsx:31-36`、`GpuResourcePage.tsx:32-38`、`DashboardPanelsPage.tsx:44-51`、`OverviewResourcePanel.tsx:164` |
| 节点用量排行 | `Monitor/Cluster/Ranking` | 有独立页 `node-usage` + `NodeRankingPanel` | **已交付** | `areas/registry.ts:207`；`NodeRankingPanel.tsx` |
| 项目/空间用量排行与趋势 | `Overview/{ResourceUsage,UsageRanking}` | 项目概览 CPU/内存 Top5 + 1h/6h/24h 趋势；空间概览用量 + 项目排行 | **已交付** | `ProjectOverviewPage.tsx`；`WorkspaceOverviewPage.tsx`；能力矩阵 §0 两行记录 |
| GPU 资源页 | `Monitor/Cluster/GPUResource/**` | `gpu-resource` 页 + `GpuMonitorPanel`（单卡五指标） | **已交付** | `areas/registry.ts:260`；`GpuResourcePage.tsx:32-38`；`GpuMonitorPanel.tsx:9-29` |
| 饼图（节点厂商分布） | `Monitor/Cluster/Overview/index.jsx:201-274`（recharts Pie） | 无饼图；厂商/型号以**节点列表筛选统计**呈现 | **有替代（非等价）** | `NodesPage.tsx:64`（`stats.data.vendors` 作为筛选项）；全仓无 Pie/Donut 组件 |
| 堆叠柱 / 时间柱（TimeBar） | `Charts/Bar/{SimpleBar,StackedBar,TimeBar}` | 无；日志/审计直方图是自绘 div 条 | **待补** | `ClusterLogsPage.tsx:128-138` |
| 服务拓扑图 | `components/Graph/**` | 无 | **未核实**（是否随 servicemesh 一并批准不做，旧正文未给依据） | — |

### 4. 编辑能力矩阵（重做）

> 列定义：**YAML**=编辑 YAML；**信息**=编辑别名/描述；**表单**=资源定制编辑表单；**删除**=单条删除。
> 只填本轮直接读到的证据；未读到的写「未核实」。

| 资源 | YAML | 信息 | 表单 | 删除 | 证据（新 UI） |
| --- | --- | --- | --- | --- | --- |
| Deployment | 有 | 有 | 有 | 有 | `WorkloadListPage.tsx:247,263`；`WorkloadDetailPage.tsx:787-788` |
| StatefulSet | 有 | 有 | 有 | 有 | 同上（同一通用页/弹窗） |
| DaemonSet | 有 | 有 | 有 | 有 | 同上 |
| CronJob | 有 | 有 | 有 | 有 | 同上；`EditWorkloadDialog.tsx:21` |
| Job | 有 | 有 | **无（Pod 模板不可变，设计决定）** | 有 | `EditWorkloadDialog.tsx:22-23` |
| Pod | 有 | 有 | 无 | 有 | 同一通用页 |
| Service | 有 | 有 | 有（端口） | 有 | `WorkloadListPage.tsx:254-262`；`ServicePortsDialog.tsx` |
| Ingress | 有 | 有 | 有（规则） | 有 | `WorkloadListPage.tsx:249-251`；`IngressRulesDialog.tsx` |
| ConfigMap | 有 | 有 | 有（键值） | 有 | `ConfigMapsPage.tsx:251`；`ConfigMapEditDialogs.tsx` |
| Secret | 有 | 有 | 有（数据） | 有 | `SecretsPage.tsx:235`；`SecretEditDialogs.tsx` |
| ServiceAccount | 有 | 有 | 有（角色） | 有 | `ServiceAccountsPage.tsx`；`ServiceAccountRoleDialog.tsx` |
| PVC | 有 | 有 | 有（扩容/克隆/快照） | 有 | `StorageListPage.tsx:354`；`StorageDetailPage.tsx:259,273` |
| VolumeSnapshot | 有 | 有 | 无 | 有 | `StorageListPage.tsx`（kind 参数化） |
| PV | 有 | 无 | 无 | 有 | `PersistentVolumeDetailPage.tsx`（含 YamlDialog/删除） |
| StorageClass | 有（详情页） | 无 | 无 | **无** | `StorageClassDetailPage.tsx`；`StorageClassesPage.tsx` 无 rowActions 写 |
| NetworkPolicy | 有 | 未核实 | 有 | 有 | `NetworkPolicyDetailPage.tsx`；`NetworkIsolationPage.tsx:152` |
| IPPool | **无** | 无 | 无 | **无** | `IpPoolsPage.tsx` 无 actions；`IpPoolDetailPage.tsx` 无 edit/yaml |
| Node | 有 | 有（标签/污点） | 有（标签/污点） | — | `NodeDetailPage.tsx:113,145,146` |
| CRD 实例 | **无（只读）** | 无 | 无 | 无 | `CustomResourceDetailPage.tsx` 无 yaml/edit 匹配 |
| 告警策略（rule group） | 有 | 有 | 有 | 有 | `RuleGroupDetailPage.tsx`；`RuleGroupsPage.tsx`；`RuleGroupDialog.tsx` |
| 告警消息 | 无 | 无 | 无 | **无（仅详情）** | `ClusterAlertingMessagesPage.tsx:168` |
| 自定义监控 | 有 | 有 | 有 | 有 | `ClusterCustomMonitoringPage.tsx`；`ProjectCustomMonitoringPage.tsx` |
| 日志收集 | 无 | 无 | 无 | 无 | 批准不做（parity:37） |
| 集群级配置字典/保密字典/服务账户 | 无 | 无 | 无 | 无 | 设计上只读、跳转项目页（`ClusterSecretsPage.tsx:21`） |
| 命名空间 | 无 | 无 | 无 | 无 | 设计只读（`NamespaceDetailPage.tsx:23`） |
| 集群网关 | 无 | 无 | 无 | 无 | 设计只读（`GatewayDetailPage.tsx:17`） |
| VolumeSnapshotContent | **无** | **无** | 无 | 无 | `VolumeSnapshotContentPage.tsx:12` 声明只读 |
| 镜像构建器 | 有 | 有 | 有 | 有 | `ImageBuilderPage.tsx`；`ImageBuilderDetailPage.tsx` |
| DevOps 工程 | 未核实 | 有 | 有 | 有 | `DevopsProjectDetailPage.tsx`（EditInfoDialog） |
| 联邦项目 | 有（资源详情） | 有 | 有 | 有 | `FederatedResourceDetailPage.tsx`；`FederatedProjectDetailPage.tsx` |
| 边节点 | 未核实 | 未核实 | 未核实 | 未核实 | `EdgeNodesPage.tsx` 无 edit/yaml 匹配 |

**矩阵结论**（逐行数）：31 行里 YAML 可编辑 **21 行**（2026-11-14 基线是 13 行，新增 PV、StorageClass、NetworkPolicy、Node、告警策略、自定义监控、镜像构建器、联邦资源共 8 行）；仍缺 3 行：**CRD 实例、IPPool、VolumeSnapshotContent**；1 行未核实（DevOps 工程）。

### 5. 成员 / 角色 / 授权矩阵（重做）

| 作用域 | 邀请 | 改角色 | 移除 | 批量移除 | 建角色 | 改规则 | 已授权用户 | 用户组 | 状态 | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 平台用户 | 有（创建账号） | 有 | 有 | 有（批量启停） | — | — | — | — | **已交付** | `PlatformListPage.tsx:93,243-249,355-358`；`UserCreateDialog.tsx`；`UserRoleDialog.tsx`；`UserResetPasswordDialog.tsx` |
| 平台角色 | — | — | 有 | — | 有 | **有（规则可增删、动词勾选）** | 有 | — | **已交付** | `PlatformListPage.tsx:95`；`RoleEditorDialog.tsx:13-41`；`ClusterRoleDetailPage.tsx:34-87` |
| 企业空间 · 成员 | 有 | 有 | 有 | 有 | — | — | — | — | **已交付** | `WorkspaceMembersPage.tsx:94,100-102`；`WorkspaceMemberDialog.tsx` |
| 企业空间 · 角色 | — | — | — | — | **无** | **无** | 未核实 | — | **待补**（页面明写只读理由） | `WorkspaceRolesPage.tsx:24-25`；`WorkspaceRoleDetailPage.tsx` |
| 企业空间 · 用户组 | — | — | — | — | 有 | 有（空间角色） | — | 有 | **已交付** | `WorkspaceUserGroupsPage.tsx:46-50,150-164`；`WorkspaceUserGroupDialog.tsx` |
| 集群 · 成员 | 有 | 有 | 有 | 有 | — | — | — | — | **已交付** | `ClusterMembersPage.tsx:26-41,133` |
| 集群 · 角色 | — | — | — | — | — | — | 有（走平台角色详情） | — | **有替代** | 能力矩阵 §0 R-12（登记 ELSEWHERE） |
| 项目 · 成员 | 有 | 有 | 有 | 有 | — | — | — | — | **已交付** | `SettingsListPage.tsx:213,217`；`MemberDialog.tsx` |
| 项目 · 角色 | — | — | 有 | — | 有 | 有 | 有（规则页签 + 授权对象页签） | — | **已交付** | `SettingsListPage.tsx:209`；`RoleCreateDialog.tsx`；`RolePermissionsDialog.tsx`；`RoleDetailPage.tsx:17-55` |
| DevOps · 成员 | 有 | 未核实 | 有 | 无 | — | — | — | — | **部分** | `DevopsProjectDetailPage.tsx:312-331,661-705` |
| DevOps · 角色 | — | — | — | — | — | 未核实 | 未核实 | — | **未核实** | `DevopsProjectDetailPage.tsx:81-93`（页签存在） |

**矩阵结论**：11 个作用域行里 **8 行已交付**、1 行有替代、1 行部分（DevOps 成员无改角色）、1 行待补（企业空间角色写）。

### 6. 创建能力矩阵（重做）

| 资源 | 老 console | 新 UI | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| 工作负载（Deploy/STS/DS） | 有 | 有 | 已交付 | `WorkloadListPage.tsx:150`；`WorkloadCreateDialog.tsx` |
| Job / CronJob | 有 | 有（manifest 表单） | 已交付 | `WorkloadListPage.tsx:492`；`JobCreateDialog.tsx:51` |
| Service | 有 | 有 | 已交付 | `WorkloadListPage.tsx:484`；`CreateServiceDialog.tsx` |
| Ingress | 有 | 有 | 已交付 | `WorkloadListPage.tsx:488`；`CreateIngressDialog.tsx` |
| ConfigMap / Secret / ServiceAccount | 有 | 有（含 YAML 模式） | 已交付 | `ConfigMapsPage.tsx:132`；`SecretsPage.tsx:155`；`ServiceAccountsPage.tsx:145` |
| PVC | 有 | 有 | 已交付 | `StorageListPage.tsx:126,354`；`CreateVolumeDialog.tsx` |
| VolumeSnapshot | 有 | 有（+ 克隆） | 已交付 | `StorageDetailPage.tsx:259,273`；`CreateSnapshotDialog.tsx` |
| NetworkPolicy | 有 | 有 | 已交付 | `NetworkIsolationPage.tsx:152`；`NetworkPolicyDialog.tsx` |
| 用户 / 平台角色 / 企业空间 | 有 | 有 | 已交付 | `PlatformListPage.tsx:93-97` |
| 项目角色 / 成员 | 有 | 有 | 已交付 | `SettingsListPage.tsx:209-213` |
| 企业空间成员 / 用户组 | 有 | 有 | 已交付 | `WorkspaceMembersPage.tsx:94`；`WorkspaceUserGroupsPage.tsx:150` |
| 集群成员 / 集群 | 有 | 有 | 已交付 | `ClusterMembersPage.tsx:133`；`AddClusterDialog.tsx`；能力矩阵 §0 |
| 告警策略 / 自定义监控 | 有 | 有 | 已交付 | `RuleGroupsPage.tsx:275`；`ClusterCustomMonitoringPage.tsx:117` |
| 镜像构建器 / 灰度 / 联邦项目 / 应用仓库 | 有 | 有 | 已交付 | `ImageBuilderPage.tsx:97`；`CanaryReleasesPage.tsx:156`；`FederatedProjectsPage.tsx:231`；`WorkspaceReposPage.tsx:250` |
| **StorageClass** | 有 | **无** | **待补** | `StorageClassesPage.tsx` 无 primaryAction/创建弹窗 |
| **IPPool** | 有 | **无** | **待补** | `IpPoolsPage.tsx` 无创建入口 |
| **VolumeSnapshotContent** | 有 | **无** | **待补** | `VolumeSnapshotContentPage.tsx` 只读 |
| 命名空间（项目） | 有 | 无 | 批准不做 | 能力矩阵 §0 R-09 / 项目创建登记不做 |
| 节点添加 | 有 | 未核实 | 未核实 | `AddClusterDialog` 是集群导入，不是加节点 |

**矩阵结论**（逐行数）：19 行里 **14 行已交付**（覆盖 17 类以上资源，含分组行）、**3 行待补**（StorageClass / IPPool / VolumeSnapshotContent）、**1 行批准不做**（命名空间）、**1 行未核实**（节点添加）。

### 7. 壳层

| 子能力 | 老 console | 新 UI | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| 404 兜底 | `/404` 路由 + NotFound | 有 catch-all `$.tsx` | **已交付** | `routes/$.tsx:4-7`；`components/NotFoundPage.tsx` |
| 关于（版本） | `Layout/LoginInfo/index.jsx:87-89` | 有：产品名 + 两个版本串，读失败不阻塞 | **已交付** | `shell/AboutDialog.tsx:9-40`；`AppShell.tsx:956-958` |
| 帮助/文档入口 | `Layout/Header/index.jsx:110-122` | 无 | **批准不做**（部署无文档站点，链接会落到 SPA 兜底页） | 能力矩阵 §0 CHECK-09 |
| 语言切换 | 用户设置里 `spec.lang` | 顶栏独立按钮（zh/en） | **已交付（改进）** | `AppShell.tsx:640-650,796-800` |
| 主题切换 | 无 | 有 | **新增** | `AppShell.tsx:813`；终端主题跟随 `TerminalView.tsx:44-50,77-78` |
| 用户菜单 | 设置/退出/关于 | 邮箱/用户设置/关于/退出 | **已交付** | `AppShell.tsx:923-973` |
| 浮动工具箱（6 工具） | `components/KubeTools/index.jsx:74-135` | 无浮动件；6 个工具拆成页面/弹窗 | **有替代（逐项等价，见下）** | — |
| ├ 容器日志查询 | `/logquery` | `/clusters/<c>/logs` | 等价（细节见 §2.2） | `ClusterLogsPage.tsx` |
| ├ 事件检索 | `/eventsearch` | `/clusters/<c>/events` | 等价（优于旧） | `ClusterEventsPage.tsx` |
| ├ 审计检索 | `/auditingsearch` | `/clusters/<c>/audit-logs` | 等价（细节见 §2.2） | `ClusterAuditLogsPage.tsx` |
| ├ kubectl | `/terminal/kubectl` | `/clusters/<c>/kubectl` | 等价 | `KubectlPage.tsx` |
| ├ kubeconfig | `Modals/KubeConfig` | 集群概览的 `UserKubeconfigDialog` + 服务账号 kubeconfig 下载 | 等价 | `ClusterOverviewPage.tsx:19`；`ServiceAccountSecretsSection.tsx:118,188` |
| └ 计量账单 | `/bill`（metering） | 无 | **批准不做**（metering 未开启） | 能力矩阵 §3.1 建议表 |
| 顶栏死链接（应用商店 / 应用商店管理） | 老受 `enableAppStore` 开关控制 | 路由已存在 | **已修复** | `routes/kube-frontend.apps`、`routes/kube-frontend.apps-manage` |
| 移动端抽屉侧栏 | 无 | 有 | **新增** | `AppShell.tsx:820-829` |
| 跳到主内容 | 无 | 有 | **新增** | `AppShell.tsx` 的 skip-link |

### 8. 列表通用能力

| 能力 | 老 console | 新 UI | 状态 | 计数与证据 |
| --- | --- | --- | --- | --- |
| 每页档位 | `PAGESIZE_OPTION=[10,20,50,100]` | `pageSizeOptions` 已接入 | **已交付（多数）** | **35 个** `pages/**` 文件（`pageSizeOptions` 36 处）；`useResourceListState.ts:17-18,34,77-82` |
| 列显隐 | `Tables/Base/CustomColumns` | `hideable: true` + 持久化 | **已交付** | **53 个** 页面文件、**243** 处 `hideable:` |
| 刷新按钮 | `Tables/Base/index.jsx:335-340` | `useListRefresh` | **已交付（多数）** | **44 个** 页面文件（`useListRefresh` 90 处） |
| 空态出口 | `Tables/Base/index.jsx:365-399` | `schema.empty` 必填 + 契约测试 | **已交付** | **65 个** 页面文件含 `empty:`；`config/empty-state-contract.test.ts`（能力矩阵 §0） |
| 排序 | 列头 sorter，服务端 | `sortableKeys` 白名单 + 服务端 | **已交付** | `useResourceListState.ts:71-75` |
| 批量操作 | 选中后切标题栏 | `selection:'multiple'` + `actions` | **部分** | 有批量删除/批量移除/批量启停；其余资源仍无批量动作 |
| 实时刷新（watch） | 组列表 WebSocket watch | `watchCollection` 已有，**仅 1 页接入** | **部分** | `ClusterPodsPage.tsx:63-67,194` 是唯一消费者（`useCollectionWatch` 全仓仅此一处） |
| 卡片视图 | `ToggleView`（实为“高级设置”折叠，非卡片切换） | 无 | 不构成缺口 | 旧正文已纠正该误读 |

**计数口径**：以上数字是 `apps/console-next/src/pages/**` 下命中该标记的**文件数**（含页面内弹窗/子组件），不是“页面数”；`areas/registry.ts` 现有 **93** 个 `status: 'ready'` 页面，故档位/刷新尚未覆盖全部页面。

### 9. 仍然缺失（本轮复验后仍成立）

| ID | 缺口 | 类型 | 影响 | 证据 |
| --- | --- | --- | --- | --- |
| C-01 | 日志/审计检索无集群维度 | 待补 | 多集群部署下无法限定集群 | `ClusterLogsPage.tsx:30`；`search.ts:61-68` |
| C-02 | 日志检索缺 workload 维度、精确/模糊、自定义区间 | 待补 | 定位「某工作负载某时间段」要多跳一次 | `ClusterLogsPage.tsx:96-125` |
| C-03 | 日志/审计无导出下载 | 待补 | 无法带走证据 | 两页均无下载入口 |
| C-04 | 日志/审计无关键字高亮与 ANSI 着色 | 待补 | 长日志里找关键字靠肉眼 | `ClusterLogsPage.tsx:161` |
| C-05 | 日志/审计无实时开关；直方图不可点下钻 | 部分 | 与事件页体验不一致 | `ClusterLogsPage.tsx:128-138` vs `ClusterEventsPage.tsx:178-196` |
| C-06 | 容器日志无下载、无「查看更多」 | 待补 | 非实时路径固定 1h/200 条 | `ContainerLogsDialog.tsx:22-35,76-88` |
| C-07 | 审计缺 namespace / 响应码筛选 | 部分 | API 支持但未暴露 | `search.ts:174,178` vs `ClusterAuditLogsPage.tsx:31-34` |
| C-08 | 无饼图/堆叠柱/时间柱 | 待补 | 分布类与堆叠类图表无法表达 | 全仓仅 `TrendChart` |
| C-09 | 图表无自定义时间区间 | 部分 | 只能 4 档预设 | 各监控页 `WINDOWS` |
| C-10 | CRD 实例无 YAML 编辑 | 待补 | 只能看不能改 | `CustomResourceDetailPage.tsx` |
| C-11 | IPPool 无任何写（无 YAML/无创建/无删除） | 待补 | IP 池只能由 YAML/kubectl 维护 | `IpPoolsPage.tsx`、`IpPoolDetailPage.tsx` |
| C-12 | VolumeSnapshotContent 无 YAML/编辑信息（老有） | 待补 | 快照内容不可改注解 | `VolumeSnapshotContentPage.tsx:12`；老 `SnapshotContent/Detail/index.jsx:75,87` |
| C-13 | StorageClass 无创建、无编辑信息、无删除（老有 set-default/卷功能/自动扩容/授权） | 待补 | 存储类只能安装期定 | `StorageClassesPage.tsx`、`StorageClassDetailPage.tsx` |
| C-14 | 企业空间角色只读（老可创建/编辑/删除） | 待补 | 空间内无法新建角色 | `WorkspaceRolesPage.tsx:24-25` |
| C-15 | DevOps 成员无「改角色」 | 部分 | 只能移除后重邀 | `DevopsProjectDetailPage.tsx:312-331,661-705` |
| C-16 | 告警消息只读（老有静默/通知/删除） | 批准不做 | 已登记 | 旧正文 parity:114 |
| C-17 | 列表实时 watch 仅 1 页接入 | 部分 | 「改完看到的是不是真的」仍靠手刷 | `useCollectionWatch` 唯一消费者 `ClusterPodsPage.tsx:67` |
| C-18 | 每页档位/刷新未覆盖全部 93 个 ready 页面 | 部分 | 剩余页面仍固定档位 | §8 计数 |
| C-19 | 帮助/文档入口 | 批准不做 | 部署无文档站点 | 能力矩阵 CHECK-09 |
| C-20 | 计量账单 | 批准不做 | metering 未开启 | 能力矩阵 §3.1 |
| C-21 | 节点 shell 在 B200 无数据帧（后端不起 node access pod） | 环境阻塞 | 用例按环境跳过 | 能力矩阵 §1 R-13 |
| C-22 | 服务拓扑图 | 未核实 | 是否随 servicemesh 批准不做缺依据 | 旧正文未给理由 |

**计数**：待补 **11**（C-01/02/03/04/06/08/10/11/12/13/14）、部分 **6**（C-05/07/09/15/17/18）、批准不做 **3**（C-16/19/20）、环境阻塞 **1**（C-21）、未核实 **1**（C-22），合计 **22**。

### 10. 本轮推翻的旧结论

| # | 2026-11-14 旧结论 | 复验事实 | 证据 |
| --- | --- | --- | --- |
| X-01 | “新 UI 的 BFF 与 api-client 都没有流式通道，终端/日志 tail 属架构级缺失” | **推翻**：BFF 有 `upgrade`，api-client 有 exec/logs/watch/node-terminal/kubectl 五个模块 | `server/src/upgrade.ts`；`packages/api-client/src/{exec,logs,watch,node-terminal,kubectl}.ts` |
| X-02 | “容器 exec 真缺失（架构级）” | **推翻**：已交付，含全屏 xterm 与容器详情入口 | `ExecConsoleDialog.tsx`；`ContainerDetailPage.tsx:212` |
| X-03 | “kubectl 真缺失（架构级）” | **推翻**：独立页面 + 共享控制台 | `KubectlPage.tsx`；`KubectlConsoleDialog.tsx` |
| X-04 | “节点 shell 真缺失（架构级）” | **推翻**：三处入口可用（B200 环境受限） | `NodesPage.tsx:163` 等 |
| X-05 | “容器日志查看（tail/实时/下载）真缺失” | **部分推翻**：tail 与实时已交付；**下载仍缺** | `ContainerLogsDialog.tsx:46-68` |
| X-06 | “`/logquery`、`/eventsearch`、`/auditingsearch` 真缺失” | **推翻**：三页都已交付 | `areas/registry.ts:269-271` |
| X-07 | “图表能力整体退化（只有 4 张手写 SVG 折线）” | **推翻**：`TrendChart` 多序列可交互；集群监控 26 卡 + 组件面板 | `TrendChart.tsx`；`ClusterMonitorPage.tsx:64-120` |
| X-08 | “集群物理资源 14 类指标 / GPU 资源监控真缺失” | **推翻**：26 张卡覆盖 GPU/磁盘/网络/RDMA + 独立 GPU 页 | 同上；`GpuResourcePage.tsx` |
| X-09 | “工作负载无编辑设置（容器模板）” | **推翻**：`EditWorkloadDialog` 覆盖镜像/副本/环境变量/拉取策略/更新策略/节点选择/优雅终止/安全上下文/IP 池/标签注解/存储/探针 | `EditWorkloadDialog.tsx:9-29` 与全文 |
| X-10 | “Node 污点/标签编辑真缺失” | **推翻**：节点详情有编辑标签/污点 + 6 页签 + YAML | `NodeDetailPage.tsx:113,132-137,145-146` |
| X-11 | “PV / StorageClass / NetworkPolicy 编辑 YAML 退化” | **推翻**：三者详情页都有 YamlDialog | `PersistentVolumeDetailPage.tsx`、`StorageClassDetailPage.tsx`、`NetworkPolicyDetailPage.tsx` |
| X-12 | “平台角色无规则编辑器” | **推翻**：规则可增删、动词逐项勾选，且编辑前先读回 | `RoleEditorDialog.tsx:13-41` |
| X-13 | “集群成员只读” | **推翻**：邀请/改角色/单条与批量移除齐备，含自我保护 | `ClusterMembersPage.tsx:26-41` |
| X-14 | “企业空间整层不存在” | **推翻**：`/kube-frontend/workspaces/<ws>/…` 已有 members/roles/user-groups/quota/projects/overview 等 | `routes/kube-frontend.workspaces.$workspace/`；`pages/workspace/` |
| X-15 | “用户组真缺失” | **推翻**：企业空间用户组树 + 创建/编辑/删除 + 成员增删 | `WorkspaceUserGroupsPage.tsx:150-164` |
| X-16 | “Service / Ingress 无法创建” | **推翻**：两个专用创建弹窗 | `CreateServiceDialog.tsx`；`CreateIngressDialog.tsx` |
| X-17 | “PVC / 快照 / StorageClass 创建真缺失” | **部分推翻**：PVC、快照、克隆已交付；**StorageClass 仍缺** | `CreateVolumeDialog.tsx`、`CreateSnapshotDialog.tsx`、`CloneVolumeDialog.tsx` |
| X-18 | “无 404 兜底页” | **推翻**：catch-all 路由 | `routes/$.tsx` |
| X-19 | “无关于（版本）” | **推翻** | `shell/AboutDialog.tsx` |
| X-20 | “顶栏应用商店/应用商店管理是死链接” | **推翻**：两个路由组都已存在 | `routes/kube-frontend.apps/`、`routes/kube-frontend.apps-manage/` |
| X-21 | “列表固定 10 条、无列显隐、无刷新、空态无出口” | **推翻**：四项都已交付并有契约测试 | §8 |
| X-22 | “无实时刷新” | **部分推翻**：通道与 hook 已有，仅 1 页接入 | `useCollectionWatch.ts`；`ClusterPodsPage.tsx:67` |
| X-23 | “`/bill`、帮助入口、日志收集编辑为有意不迁移” | **维持**（本轮无变化，理由已在能力矩阵登记） | 能力矩阵 CHECK-07/09 |

### 11. 规模

| 维度 | 数量 |
| --- | --- |
| 复验能力类 | 8 |
| 旧结论被推翻/修正 | **22**（X-01…X-22；X-23 维持） |
| 仍成立缺口 | **22 项**（待补 11 / 部分 6 / 批准不做 3 / 环境阻塞 1 / 未核实 1） |
| 重做矩阵 | 3 张（编辑 31 行 × 4 能力、授权 11 行 × 8 能力、创建 19 行） |

**一句话**：本轮复验把 2026-11-14 的“通道级缺失”全部推翻——终端、kubectl、节点 shell、日志 tail 都已建成；剩下的是**日志检索的深度（集群/工作负载维度、导出、高亮、实时、下钻）、3 类资源的写（CRD 实例 / IPPool / StorageClass）、企业空间角色写、以及实时 watch 与列表能力的覆盖广度**。

---

## 附录 A：2026-11-14 历史基线（原文保留）

> 以下为 2026-11-14 原文，**章节编号（§0–§10）保持原样**，与上文 §0.1–§11 不是同一套编号。
> 原文中的「无 / 真缺失 / 架构级缺失 / 疑似回归」均已被上文 §10 逐条推翻或修正，只作源码线索使用。

> **历史证据，2026-11-14 基线。** 本文的接口/通道/表单数量和“不做”理由不作实时状态；不重复迁移已交付能力。
> 现行方法见[迁移指南](../../legacy-ui-migration-guide.md)，待复核项见[能力矩阵](../capability-matrix.md)。

> 作用域：**不按页面、按能力**。老 console 的这些能力散落在很多页面里，逐页对照时最容易被漏掉，所以单独成文。
> 事实源：老 `console/src`（KubeSphere 3.1 fork），新 `console/kube-frontend/apps/console-next`。
> 判定口径见 `console/docs/legacy-ui-migration-guide.md` §2.1（以源码为准）、§3（照搬/改进/不迁移）、§5（子页面也要对照）。
> 「有意不迁移」的登记出处一律引 `console/docs/plans/page-parity-report.md`（下称 parity 报告）。
> 本文件只做静态源码分析，未起 dev server、未开浏览器。

## 0. 两个前置结论（影响后面所有判断）

**0.1 ai-kit 的活包是 `console/packages/ai-kit`，不是 `console/kube-frontend/packages/ai-kit`（后者不存在）。**

- 证据：`console/kube-frontend/apps/console-next/package.json:19` → `"@kube-ai-hub/ai-kit": "link:../../packages/ai-kit"`；`console/kube-frontend/packages/ui/package.json:24` → `"link:../../../packages/ai-kit"`。
- `console/kube-frontend/packages/` 下只有 `ai-surface` / `api-client` / `locales` / `ui` 四个包，没有 `ai-kit`。
- 新 UI 实际可用的组件全集 = `console/kube-frontend/packages/ui/src/index.ts:24-62` 的 re-export 清单（Badge/Button/ResourceForm/Switch/Drawer/Dropdown/Empty/Icon/Input/InputPassword/Label/Alert/Menu/Pagination/ResourceList/Select/Skeleton/Table/Textarea/AccentToggle/ThemeProvider/ThemeToggle/Tooltip/Modal/cn/useIsMobile/useMediaQuery），外加 `./editor` 子路径的 `YamlEditor`（`packages/ui/package.json:12-15`）。**清单里没有图表、没有终端、没有 Tree、没有 Card/ToggleView、没有 Tabs。**

**0.2 新 UI 的 BFF 与 api-client 都没有流式通道，终端/日志 tail 属架构级缺失。**

- `console/kube-frontend/packages/api-client/src/` 共 17 个文件，无 `exec` / `logs` / `stream` 端点（逐个读过目录清单与 `iam.ts:619` 的日志收集段：那里只有"收集器配置"的四张列表，不是日志读取）。
- `console/kube-frontend/server/src/proxy.ts` 全文只有 HTTP 转发（`proxy.ts:32-33` 讲的是 kubectl-proxy 模式的路径重写），**没有 `upgrade` 事件处理**。
- 老 console 的终端是 WebSocket：`console/src/components/Terminal/index.jsx:35-39` 拼 `ws(s)://<host><getClusterUrl(url)>`。
- 影响：容器终端、kubectl、节点 shell、容器日志实时 tail 这四件事，新 UI **不是"页面没做"，是通道没做**。补齐需要 BFF 支持 upgrade + 前端 xterm 类组件，工作量与"补一个页面"不在一个量级。

---

## 1. 容器与节点运维（终端 / kubectl / 节点 shell）

### 1.1 老 console 的实现（事实）

| 子能力 | 老实现 | 证据 |
| --- | --- | --- |
| 独立新窗口承载 | 单独 webpack entry，`render(<TerminalApp />)` | `console/src/core/terminal.js:71` |
| 三种模式路由 | 按 path 分段判定：`/terminal/kubectl/:cluster`、`/terminal/nodename/:node`、`/terminal/cluster/:c/projects/:ns/pods/:pod/containers/:ctr` | `console/src/pages/terminal/index.jsx:57-91` |
| 容器 exec 的 websocket 路径 | `kapis/terminal.kubesphere.io/v1alpha2/klusters/{cluster}/namespaces/{ns}/pods/{pod}/exec?container=..&shell=bash`，404 时回退到不带 `/exec` 的路径 | `console/src/stores/terminal.js:66-87` |
| 节点 exec | `kapis/terminal.kubesphere.io/v1alpha2/klusters/{cluster}/nodes/{nodename}/exec` | `console/src/stores/terminal.js:61-65` |
| kubectl 会话初始化 | 先 GET `kapis/resources.kubesphere.io/v1alpha2/klusters/{cluster}/users/{username}/kubectl` 拿到 kubectl pod 的 ns/pod/container，再连 exec | `console/src/stores/terminal.js:90-111` |
| 容器终端旁的容器切换与基本信息 | 容器下拉 + 状态/镜像/命令/requests/limits/重启次数 | `console/src/components/Modals/ContianerTerminal/index.jsx:100-151` |
| kubectl 的使用说明面板 | 右侧 markdown `KUBECTL_TIP`，可折叠（`localStorageKey="kubectl-doc"`） | `console/src/components/Modals/KubeCtl/index.jsx:121-138` |
| 多集群时选集群 | kubectl 弹窗顶部 TypeSelect（仅在 `isMultiCluster` 且未指定 cluster 时出现） | `console/src/components/Modals/KubeCtl/index.jsx:124-132` |
| 入口：容器 | 容器详情页与容器卡片各一处 | `console/src/pages/projects/containers/Pods/Containers/Detail.jsx:189`、`console/src/components/Cards/Containers/Item.jsx:76` |
| 入口：节点 | 节点列表/详情的行操作传 `nodename` | `console/src/pages/clusters/containers/Nodes/index.jsx:254`、`.../Nodes/Detail/index.jsx:393` |
| 入口：kubectl（管理员工具箱） | 浮动工具箱的「控制工具」组，`hidden: !globals.app.isPlatformAdmin` | `console/src/components/KubeTools/index.jsx:122-132` |
| 入口：kubectl（集群概览卡片） | `data-url={\`/terminal/kubectl/${cluster}\`}` | `console/src/pages/clusters/containers/Overview/Dashboard/Tools/index.jsx:52` |
| 文件上传 / 下载 | **老 console 也没有**（Pods/Containers 与 Terminal 组件内检索不到 upload/download；`upload` 只出现在 S2I 二进制上传、NetworkPolicy ipBlock、Grafana 上传器） | 反向核实：`console/src/components/Forms/ImageBuilder/B2IForm/BinaryFileUploader/index.jsx` 等，与容器文件无关 |

### 1.2 新 UI 现状

| 子能力 | 新 UI | 证据 |
| --- | --- | --- |
| 容器 exec | 无 | 全仓 grep `WebSocket|xterm|terminal` 在 `apps/console-next/src` 只命中正则 `.exec()` 与文案；无终端组件 |
| kubectl | 无 | 同上；`ClusterOverviewPage.tsx:516` 的 `terminal` 只是 configz 模块名的 i18n key，不是功能 |
| 节点 shell | 无 | 同上 |
| 后端通道 | 无 | `server/src/proxy.ts` 无 upgrade（见 §0.2） |
| 文件上传下载 | 无 | 同上；且老 console 也无，**不计缺口** |

### 1.3 差距与影响

| # | 差距 | 类型 | 影响（用户做不到什么） |
| --- | --- | --- | --- |
| 1 | 容器 exec 终端（含容器切换、状态/镜像/命令/资源面板） | **真缺失**（架构级） | 排障时无法进容器；这是 KubeSphere 日常最高频的运维动作 |
| 2 | kubectl 交互式终端 | **真缺失**（架构级） | 平台管理员失去唯一的"图形界面里的 kubectl"，只能本地配 kubeconfig |
| 3 | 节点 shell | **真缺失**（架构级） | 节点层面的排查（磁盘、kubelet、网络）只能出控制台 |
| 4 | 独立新窗口 + 关闭即断连的承载方式 | **真缺失** | 老 console 故意用新窗口，让终端不被 SPA 路由切换打断；新 UI 连窗口都没有 |
| 5 | 多集群 kubectl 的集群选择 | **真缺失** | 与 2 同因 |
| 6 | kubectl 使用说明（KUBECTL_TIP） | **真缺失** | 新用户没有上手引导（低优先级） |

> 登记情况：parity 报告 §cluster-management「集群概览」只写了「kubectl / kubeconfig 快捷工具：老 console 用新窗口打开独立页面，新 UI 无对应页面」（`page-parity-report.md:41`），**容器终端与节点 shell 没有任何登记**——按纪律应列为「疑似回归，需复核」（见 §9）。

---

## 2. 日志（查询 / tail / 下载 / 收集配置）

### 2.1 老 console

| 子能力 | 老实现 | 证据 |
| --- | --- | --- |
| 容器日志页签 | 容器详情页四个页签之一（resource-status / monitors / env / logs） | `console/src/pages/projects/containers/Pods/Containers/routes.js:39-50` |
| 日志卡片 | `ContainerLog`：ANSI 着色、时间戳剥离、每页 1000 行「查看更多」、实时开关、刷新、下载 | `console/src/components/Cards/ContainerLog/index.jsx:124-167`、`220-274` |
| 实时 tail | `follow: isRealtime` + `store.watchLogs(...)`（离开页面 `stopWatchLogs`） | `console/src/components/Cards/ContainerLog/index.jsx:68-106` |
| 下载 .log | `fetchAllLogs` → Blob → `saveAs(\`${name}.log\`)` | `console/src/components/Cards/ContainerLog/index.jsx:144-167` |
| 网关日志 | 同一组件通过 `gatewayName/gatewayNamespace` 复用于网关 | `console/src/components/Cards/ContainerLog/index.jsx:94-101` |
| 日志全文检索 | 独立页面 `/logquery` + 三步向导（选集群 → 输入条件 → 看详情） | `console/src/pages/console/containers/LogQuery/index.jsx:21-35`、`console/src/components/Modals/LogSearch/index.jsx:97-119` |
| 检索条件 | query/start/end/durationAlias/queryMode 六个维度 | `console/src/components/Modals/LogSearch/index.jsx:62-79` |
| 事件检索 | `/eventsearch` | `console/src/pages/console/routes/index.js:30` 附近（EventSearch 容器）、`console/src/components/Modals/EventSearch/Event/**` |
| 审计检索 | `/auditingsearch` | `console/src/components/Modals/AuditingSearch/Auditing/**` |
| 工具箱入口 | 三个检索 + 计量账单 + kubeconfig + kubectl 共 6 项，按模块开关隐藏 | `console/src/components/KubeTools/index.jsx:74-135` |
| 日志收集配置 | 集群级 `LogCollections` 列表 + 详情（Configuration / YamlModal 两个页签） | `console/src/pages/clusters/containers/LogCollections/Detail/routes.js`、`.../Detail/index.jsx:80,116` |

### 2.2 新 UI

| 子能力 | 新 UI | 证据 |
| --- | --- | --- |
| 日志收集配置页 | 有（集群级 + 项目级各一个） | `src/areas/registry.ts:172`（项目）、`:201`（集群） |
| 配置的修改 | 无（只读） | parity 报告 `page-parity-report.md:37`「修改收集器/输入/输出：需要专门的编辑与校验流程」= 有意不迁移 |
| 容器日志 tail | 无 | Pod 详情共用 `WorkloadDetailPage.tsx`（`apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx:54` 的 dialog 只有 `editYaml|editInfo|scale|delete`），无 logs 页签 |
| 日志全文检索 | 无 | 无 `logquery` 路由（`src/routes/` 全量目录里没有） |
| 事件 / 审计检索 | 无 | 同上 |
| 下载日志 | 无 | — |

### 2.3 差距与影响

| # | 差距 | 类型 | 影响 |
| --- | --- | --- | --- |
| 7 | 容器日志查看（含实时 tail、翻页、ANSI 着色） | **真缺失**（架构级） | 排查启动失败、CrashLoopBackOff 时看不到任何日志 |
| 8 | 日志下载 | **真缺失** | 无法把日志带走去比对/提工单 |
| 9 | 日志全文检索 `/logquery`（跨 Pod/工作负载/关键字/时间区间） | **真缺失** | 有日志存储也查不了，只能 kubectl logs 逐个捞 |
| 10 | 事件检索 `/eventsearch` | **真缺失**（依赖 events 模块） | 集群事件无法按对象/时间检索 |
| 11 | 审计检索 `/auditingsearch` | **真缺失**（依赖 auditing 模块） | 合规审计无从查 |
| 12 | 计量账单 `/bill` | **真缺失**（依赖 metering 模块） | 无法看资源消耗统计 |
| 13 | 日志收集的编辑 | **有意不迁移**（parity:37） | 只能看不能改；可接受 |

> 注：`/logquery` 与容器日志在老 console 里是**两个不同入口、同一套能力**（`LogSearch` 模态 vs `ContainerLog` 卡片）。新 UI 两者皆无。

---

## 3. 监控图表

### 3.1 老 console

| 子能力 | 老实现 | 证据 |
| --- | --- | --- |
| 图表库 | 自建 `components/Charts`（Area: MediumArea/MultiArea/PercentArea/SimpleArea/TinyArea、Bar: SimpleBar/StackedBar/TimeBar、Pie、Custom Tooltip）+ recharts 饼图 | `console/src/components/Charts/`、`console/src/pages/clusters/containers/Monitor/Cluster/Overview/index.jsx:30-36` |
| 时间区间选择 | `MonitoringController` 统一提供（`step`/`times` 参数化） | `console/src/pages/clusters/containers/Monitor/Cluster/Monitor/PhysicalResource/index.jsx:308-317` |
| 集群物理资源监控 | 14 类曲线：GPU 显存/利用率/分配、CPU、内存、load1/5/15、磁盘用量、inode、磁盘吞吐、IOPS、网络、Pod 状态、RDMA 6 类 | `.../Monitor/PhysicalResource/index.jsx:32-302` |
| 集群监控总览 | 节点在线状态环、节点厂商分布饼图（可 hover 出占比）、组件健康（ks/k8s/istio/monitoring/logging/devops）、核心组件状态（etcd/controller-manager/scheduler） | `.../Monitor/Cluster/Overview/index.jsx:345-521` |
| 组件专用监控 | etcd / apiserver / scheduler 三个独立页面 | `.../Monitor/Cluster/routes.js:42-60` |
| 节点用量排行 | 独立页面 `/monitor-cluster/ranking` | `.../Monitor/Cluster/routes.js:61-66` |
| GPU 资源 | GPUResource 三个子页（Overview/PhysicalMonitoring/Ranking） | `console/src/pages/clusters/containers/Monitor/Cluster/GPUResource/**` |
| 项目概览用量 | ResourceUsage + UsageRanking + Quota + LimitRange | `console/src/pages/projects/containers/Overview/{ResourceUsage,UsageRanking,Quota,LimitRange}/**` |
| 服务拓扑图 | `components/Graph`（节点-边拓扑、Detail/Monitors/Pods、PolicyForm） | `console/src/components/Graph/**` |

### 3.2 新 UI

| 子能力 | 新 UI | 证据 |
| --- | --- | --- |
| 时序曲线 | 有，但**手写 inline SVG 折线**（4 张卡，无坐标轴、无交互、无 tooltip） | `apps/console-next/src/pages/cluster/ClusterMonitorPage.tsx:11-25`、`:270-307` |
| 时间区间 | 有，4 档（1h/6h/24h/7d） | `ClusterMonitorPage.tsx:30-35` |
| 指标数 | 4 个：CPU 率、内存率、运行 Pod 数、在线节点数 | `ClusterMonitorPage.tsx:47-58` |
| 节点用量排行 | 有（表格，不是图） | `src/areas/registry.ts:207` + `pages/cluster/NodeUsagePage.tsx` |
| 图表库 | 无（明确取舍：ai-kit 无图表，加库成本高于页面本身） | `ClusterMonitorPage.tsx:16-20` |
| etcd/apiserver/scheduler | 无 | parity 报告 `:38`「etcd / apiserver / scheduler 专用监控页：需要各自的组件指标面板」= 有意不迁移 |
| 集群组件健康 / 节点厂商饼图 / 核心组件状态 | 无 | 未在 `ClusterOverviewPage.tsx` 找到对应区块（该页只有 configz 模块列表与用量条） |
| GPU 资源 | 无 | 无 `gpu-resource` 路由；`ClusterOverviewPage.tsx:505` 只有模块名 `gpu` |
| 项目用量排行 | 无 | parity 报告 `:126`「用量排行（需要监控区间查询）」= 有意不迁移 |
| 服务拓扑 | 无 | 无 Graph 组件；`packages/ui/src/index.ts` 清单无拓扑 |

### 3.3 差距与影响

| # | 差距 | 类型 | 影响 |
| --- | --- | --- | --- |
| 14 | 图表能力（多序列、堆叠、饼图、tooltip、百分比面积图） | **真缺失**（有意取舍，见 `ClusterMonitorPage.tsx:16-20`，但**未登记进 parity 报告**） | 只能看 4 条单线；IOPS/磁盘/网络/RDMA 等曲线看不到 |
| 15 | 时间区间粒度与自定义区间 | **部分**（只有 4 个固定档） | 定位"昨晚 22:00 的抖动"做不到 |
| 16 | 集群物理资源 14 类指标 | **真缺失** | 磁盘、网络、inode、负载、RDMA 全部无 |
| 17 | GPU 资源监控与排行 | **真缺失** | 本仓库是 AI 平台，GPU 是核心资源，这块缺口影响最大 |
| 18 | 组件健康 / 核心组件状态 / 节点厂商分布 | **真缺失**（parity:41 只登记了"节点 Top5"，未登记这三块） | 无法一眼判断集群是否健康 |
| 19 | etcd / apiserver / scheduler 监控页 | **有意不迁移**（parity:38） | 可接受 |
| 20 | 节点/容器组下钻与排行 | **部分**（节点有表格排行，无下钻） | parity:38 已登记 |

---

## 4. YAML 与编辑能力（矩阵）

### 4.1 老 console 的能力载体

- 编辑信息：`resource.baseinfo.edit`（`console/src/actions/resource.edit.js:27-82`），85 处调用点。
- 编辑 YAML：`resource.yaml.edit`（`console/src/actions/resource.edit.js:83-114`），72 处调用点；提交前注入 `metadata.resourceVersion` 做乐观锁（`:94`）。
- 差异对比：`components/DiffYaml`，**只有一处使用**——Deployments 的版本控制（`console/src/pages/projects/containers/Deployments/Detail/RevisionControl/index.jsx:113`）。
- 各资源「编辑设置」是**按资源独立 action**，不是通用组件：`workload.template.edit` / `configmap.edit` / `secret.edit` / `service.edit` / `router.rules.edit` / `workload.hpa.edit` / `volume.expand` / `role.edit` / `member.edit` / `alerting.rule.edit` / `log.collection.edit` / `serviceaccount.role.edit` / `project.quota.edit` / `workspace.quota.edit` / `node.taint` / `node.labels` / `storageclass.*` 等（`console/src/actions/*.js` 全量 action 名）。

### 4.2 表 4-A 老 console「资源 × 编辑能力」矩阵

| 资源 | 编辑信息 | 编辑设置 | 编辑 YAML | 版本差异 | 证据（老侧） |
| --- | --- | --- | --- | --- | --- |
| Deployment | 有 | 有（容器模板） | 有 | 有（DiffYaml） | `projects/containers/Deployments/index.jsx:98,108`；`Detail/index.jsx:130`；`RevisionControl/index.jsx:113` |
| StatefulSet | 有 | 有（模板 + 服务） | 有 | 无 | `projects/containers/StatefulSets/index.jsx:97,107`；`Detail/index.jsx:104` |
| DaemonSet | 有 | 有（模板） | 有 | 无 | `projects/containers/DaemonSets/index.jsx:97,107` |
| Job | 有 | 无 | 有 | 无 | `projects/containers/Jobs/index.jsx:75`；`Detail/index.jsx:112` |
| CronJob | 有 | 无 | 有 | 无 | `projects/containers/CronJobs/index.jsx:74,84` |
| Pod | 无 | 无 | 有 | 无 | `projects/containers/Pods/index.jsx:56`；`Detail/index.jsx:86` |
| Service | 有 | 有（service.edit） | 有 | 无 | `projects/containers/Services/index.jsx:93,113` |
| Ingress(Route) | 有 | 有（规则 + 注解） | 有 | 无 | `projects/containers/Routes/index.jsx:97,107`；`actions/router.js:82,101` |
| ConfigMap | 有 | 有 | 有 | 无 | `projects/containers/ConfigMaps/index.jsx:46,56,66` |
| Secret | 有 | 有 | 有 | 无 | `projects/containers/Secrets/index.jsx:46,56,66` |
| ServiceAccount | 有 | 有（改角色） | 有 | 无 | `projects/containers/ServiceAccounts/index.jsx:64,74` |
| PVC(Volume) | 有 | 有（扩容 + 模板） | 有 | 无 | `projects/containers/Volumes/index.jsx:74,84`；`Detail/index.jsx:188` |
| VolumeSnapshot | 有 | 无 | 有 | 无 | `projects/containers/Volumes/**`；`actions/volume.js:177`（`volume.snapshot.yaml.edit`） |
| PV | 有 | 无 | 有 | 无 | `clusters/containers/Storage/PV/index.jsx:57,69` |
| StorageClass | 无 | 有（默认类/卷功能/自动扩容/授权） | 有 | 无 | `clusters/containers/Storage/StorageClasses/Detail/index.jsx:149`；`actions/storageclass.js` |
| VolumeSnapshotClass | 有 | 无 | 无 | 无 | `clusters/containers/Storage/VolumeSnapshotClasses/index.jsx:31` |
| NetworkPolicy | 有 | 有（加规则） | 有 | 无 | `projects/containers/Network/Policies/Detail/index.jsx:73,85` |
| IPPool | 有 | 有（授权企业空间） | 有 | 无 | `clusters/containers/Network/IPPools/index.jsx:55,65` |
| Node | 无 | 有（污点/标签） | 无 | 无 | `actions/node.js:79,107,123` |
| CRD 实例 | 无 | 无 | 有 | 无 | `clusters/containers/CustomResources/Detail/ResourceStatus/index.jsx:74,86` |
| AlertingRule | 有 | 有（规则） | 有 | 无 | `projects/containers/Alerting/Policies/index.jsx:149`；`actions/alerting.js`（baseinfo/yaml/rule 三件套） |
| CustomMonitoring | 有 | 有 | 有 | 无 | `projects/containers/CustomMonitoring/index.jsx:76,86` |
| LogCollection | 无 | 有（含启停开关） | 有 | 无 | `clusters/containers/LogCollections/Detail/index.jsx:80,116` |
| Project | 有 | 有（配额 + 默认资源） | 无 | 无 | `projects/containers/BaseInfo/index.jsx:131,178` |
| Workspace | 有 | 有（配额） | 无 | 无 | `workspaces/containers/BaseInfo/index.jsx:111,229` |
| Role（各级） | 有 | 有（权限规则） | 无 | 无 | `projects/containers/Roles/index.jsx:54,66`；`actions/role.js:62` |
| Member（各级） | 无 | 有（改角色/批量移除） | 无 | 无 | `projects/containers/Members/index.jsx:79`；`actions/member.js:50` |
| User（平台账号） | 有 | 有（个人设置） | 无 | 无 | `actions/user.js`（`user.edit` / `user.setting` / `user.modifypassword`） |
| Cluster | 有 | 无 | 无 | 无 | `clusters/containers/Clusters/index.jsx:122` |

### 4.3 表 4-B 新 UI「资源 × 编辑能力」矩阵

| 资源 | 编辑信息 | 编辑设置 | 编辑 YAML | 版本差异 | 证据（新侧） |
| --- | --- | --- | --- | --- | --- |
| Deployment | 有 | 无（只有副本数扩缩容） | 有 | 无 | `WorkloadListPage.tsx:247,263`；`WorkloadDetailPage.tsx:54,126,149` |
| StatefulSet | 有 | 无 | 有 | 无 | 同上（同一通用页） |
| DaemonSet | 有 | 无 | 有 | 无 | 同上 |
| Job | 有 | 无 | 有 | 无 | 同上 |
| CronJob | 有 | 无 | 有 | 无 | 同上 |
| Pod | 有 | 无 | 有 | 无 | 同上（Pod 共用 `WorkloadDetailPage`） |
| Service | 有 | 有（端口） | 有 | 无 | `WorkloadListPage.tsx:254-262`；`ServicePortsDialog.tsx` |
| Ingress | 有 | 有（规则） | 有 | 无 | `WorkloadListPage.tsx:249-251`；`IngressRulesDialog.tsx` |
| ConfigMap | 有 | 有（键值） | 有 | 无 | `ConfigMapsPage.tsx:239-243,383-415`；`ConfigMapEditDialogs.tsx` |
| Secret | 有 | 有（数据） | 有 | 无 | `SecretsPage.tsx:220,343,378`；`SecretEditDialogs.tsx` |
| ServiceAccount | 有 | 有（改角色） | 有 | 无 | `ServiceAccountsPage.tsx:347,384`；`ServiceAccountRoleDialog.tsx` |
| PVC | 有 | 有（扩容） | 有 | 无 | `StorageListPage.tsx:311,325,346`；`StorageDetailPage.tsx:131` |
| VolumeSnapshot | 有 | 无 | 有 | 无 | 同一 `StorageListPage`（kind 参数化） |
| PV | 无 | 无 | 无 | 无 | `PersistentVolumesPage.tsx` 无 YamlDialog/EditInfoDialog 引用 |
| StorageClass | 无 | 无 | 无 | 无 | `StorageClassesPage.tsx` 无编辑弹窗 |
| VolumeSnapshotClass | 无 | 无 | 无 | 无 | 无对应路由 |
| NetworkPolicy | 无 | 有（创建/删除，编辑走 YAML——但 YAML 也没有） | **无** | 无 | `NetworkIsolationPage.tsx:201` 只有 DeleteDialog；`NetworkPolicyDialog.tsx` 是创建 |
| IPPool | 无 | 无 | 无 | 无 | 无对应路由 |
| Node | 无 | 无（污点/标签均无） | 无 | 无 | `NodeDetailPage.tsx` 未找到编辑入口 |
| CRD 实例 | 无 | 无 | **无** | 无 | parity 报告 `:36`「CRD 实例的 YAML 编辑（只读展示）」= 有意不迁移 |
| AlertingRule | 无 | 有（规则组编辑器） | 无 | 无 | `monitoring/RuleGroupDialog.tsx`；`RuleGroupsPage.tsx` |
| CustomMonitoring | 无 | 无 | 无 | 无 | 无对应路由 |
| LogCollection | 无 | 无 | 无 | 无 | parity:37 有意不迁移 |
| Project | 无 | 有（配额） | 无 | 无 | `settings/QuotaEditDialog.tsx` |
| Workspace | 有 | 无 | 无 | 无 | `platform/WorkspaceEditorDialog.tsx` |
| Role（项目） | 有 | 有（权限规则） | 无 | 无 | `settings/SettingsListPage.tsx:172-207,285,336`；`RolePermissionsDialog.tsx` |
| Role（平台） | 有 | 无（无规则编辑器） | 无 | 无 | `platform/RoleEditorDialog.tsx`（只有 alias/description）；`ClusterRoleDetailPage.tsx` |
| Member（项目） | 无 | 有（邀请/改角色/移除单条） | 无 | 无 | `settings/MemberDialog.tsx`；`SettingsListPage.tsx:311-324` |
| Member（集群） | 无 | **无**（只读） | 无 | 无 | `cluster/ClusterMembersPage.tsx:17-18`（注释即声明只读） |
| User（平台账号） | 有 | 有（改平台角色/启停） | 无 | 无 | `platform/UserEditDialog.tsx`；`UserRoleDialog.tsx`；`PlatformListPage.tsx:225-243` |
| Cluster | 有（描述） | 无 | 无 | 无 | `cluster/ClusterEditDialog.tsx` |

### 4.4 表 4-C 差异汇总（有 → 无/部分 的格子）

| 资源 | 退化的能力 | 严重度 | 备注 |
| --- | --- | --- | --- |
| Deployment / StatefulSet / DaemonSet | **编辑设置（容器模板）** | 高 | 老 `workload.template.edit` 可改镜像、环境变量、资源限额、存储、亲和性、更新策略；新 UI 只有副本数（`ReplicasDialog`），改镜像必须编辑整份 YAML |
| Deployment | 版本差异对比 | 中 | 新 UI 有版本表（`WorkloadDetailPage.tsx:402-419`）但无 diff；parity 报告 `:98` 已登记为有意不迁移 |
| Node | 污点 / 标签编辑 | 高 | 老 `node.taint`/`node.labels`（含批量污点）；新 UI 完全没有，parity 报告 `:40` 登记为有意不迁移 |
| PV / StorageClass / VolumeSnapshotClass | 编辑 YAML / 编辑信息 | 中 | 老 PV 有 yaml.edit + baseinfo.edit；新 UI 只读 |
| NetworkPolicy | 编辑 YAML（以及策略编辑） | 高 | 新 UI 能创建/删除，**但连"看/改 YAML"都没有**，改一条规则无路可走；parity `:125` 只登记了"策略的编辑"，没登记 YAML |
| CRD 实例 | 编辑 YAML | 中 | 有意不迁移（parity:36） |
| AlertingRule | 编辑 YAML / 编辑信息 | 中 | 新 UI 有规则组编辑器（表单），没有 YAML 视图 |
| CustomMonitoring | 全部 | 中 | 无对应页面（属未迁移页面，见 30-project / 20-cluster 作用域） |
| IPPool | 全部 | 低 | 无对应页面 |
| LogCollection | 编辑 | 低 | 有意不迁移（parity:37） |
| Member（集群） | 改角色 / 移除 / 邀请 | 高 | 老集群成员可邀请、改 clusterrole、批量移除；新 UI 只读 |
| Member（项目） | 批量移除 | 低 | 老有 `member.remove.batch`（`projects/containers/Members/index.jsx:126-138`），新 UI 只有单条 |
| Role（平台） | 权限规则编辑 | 高 | 老 `role.edit` 可改平台角色规则；新 `RoleEditorDialog.tsx` 只改 alias/description |
| Project | 编辑项目信息 | 中 | parity `:121` 有意不迁移 |
| Cluster | 可见性/region/zone 等 | 中 | parity `:44` 有意不迁移 |
| Workspace | 配额 | 中 | 老 `workspace.quota.edit`；新 UI 无 |

> **矩阵结论**（按表 4-A / 4-B 逐行数）：
> - **编辑 YAML**：老 console **21 类资源**有（工作负载 6 + 网络 2 + 配置 3 + 存储 5 + 监控 3 + CRD 实例 + Service/Ingress），新 UI **13 类**（工作负载 8 + 配置 3 + 存储 2）。
> - **编辑设置**：老侧是**按资源定制的 21 种**表单（容器模板、服务端口、路由规则、键值、污点标签、配额、权限规则…），新侧只剩 **9 种**，其中 Deployment 只剩「副本数」这一项，属实质退化。
> - **差异对比**：老侧 1 处（Deployment 版本 diff），新侧 0 处。
> - **编辑信息**：老侧 **23 类**资源有，新侧 **18 类**；**PV / NetworkPolicy / AlertingRule / Project / VolumeSnapshotClass / IPPool** 六类从「有」变「无」（其中后三类新 UI 连页面都没有）。

---

## 5. 成员 / 角色 / 授权（矩阵）

### 5.1 老 console 的层级

| 层级 | 成员 | 角色 | 用户组 |
| --- | --- | --- | --- |
| 平台 | `/access/accounts`（用户列表）+ `:name`（含登录历史页签） | `/access/roles` + `:name`（权限页签 + 已授权用户页签） | 无 |
| 企业空间 | `/workspaces/:ws/members` + `:name`（项目/DevOps 两个页签） | `/workspaces/:ws/roles` + `:name`（权限 + 已授权用户） | `/workspaces/:ws/groups`（用户组树 + 组内成员） |
| 集群 | `/clusters/:c/members` | `/clusters/:c/roles` + `:name` | 无 |
| 项目 | `/projects/:ns/members` | `/projects/:ns/roles` + `:name` | 无 |
| DevOps | `/:ws/clusters/:c/devops/:d/members` | `.../roles` + `:name` | 无 |

证据：`console/src/pages/access/containers/Accounts/Detail/routes.js`（LOGIN_HISTORY）、`access/containers/Roles/Detail/routes.js`（authorizations/users）、`workspaces/containers/Members/Detail/routes.js`（projects/devops）、`workspaces/containers/Roles/Detail/routes.js`（复用 access 的两个子页）、`workspaces/containers/Groups/index.jsx:39-45`、`clusters/containers/Members/index.jsx:31-36`、`projects/containers/Members/index.jsx:32-38`、`projects/containers/Roles/index.jsx:31-35`。

### 5.2 表 5-A 老 console「作用域 × 授权能力」矩阵

| 作用域 | 邀请成员 | 改成员角色 | 移除成员 | 批量移除 | 创建角色 | 编辑角色信息 | 编辑角色规则 | 删除角色 | 模板角色只读 | 已授权用户/权限查看 | 用户组 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 平台 | 有（`user.create`） | 有（`user.edit`） | 有 | 有 | 有（`role.create`） | 有 | 有（`role.edit`） | 有 | 有 | 有（两个页签） | 无 |
| 企业空间 | 有（`member.invite`） | 有（`member.edit`） | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | **有** |
| 集群 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 无 |
| 项目 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 无 |
| DevOps | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 无 |

证据（以项目为例，其余同级）：邀请 `projects/containers/Members/index.jsx:107-125`；改角色 `:69-86`；移除 `:87-99`；批量移除 `:126-138`；自我保护 `:65-67`（不能改/删自己）；创建角色 `projects/containers/Roles/index.jsx:139-147`；编辑信息 `:47-58`；编辑规则 `:59-71`；删除 `:72-86`；模板角色只读 `:41`（`!globals.config.presetRoles.includes(record.name)`）。

### 5.3 表 5-B 新 UI「作用域 × 授权能力」矩阵

| 作用域 | 邀请成员 | 改成员角色 | 移除成员 | 批量移除 | 创建角色 | 编辑角色信息 | 编辑角色规则 | 删除角色 | 模板角色只读 | 已授权用户/权限查看 | 用户组 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 平台 | 有（`UserCreateDialog`） | 有（`UserRoleDialog`） | 有 | **无** | 有（`RoleEditorDialog`） | 有 | **无** | 有 | 有（`PlatformListPage.tsx:248-249`） | 有（`ClusterRoleDetailPage.tsx`） | **无** |
| 企业空间 | **无**（无作用域） | 无 | 无 | 无 | 无 | 有（仅 alias/desc，`WorkspaceEditorDialog.tsx`） | 无 | 无 | — | 无 | 无 |
| 集群 | **无** | **无** | **无** | 无 | 无 | 无 | 无 | 无 | — | 无 | 无 |
| 项目 | 有（`MemberDialog.tsx`） | 有（同一弹窗） | 有 | **无** | 有（`RoleCreateDialog.tsx`） | 有 | 有（`RolePermissionsDialog.tsx`） | 有 | 有（`SettingsListPage.tsx:189-207`） | 有（规则表 `:381-407`） | 无 |
| DevOps | 无（无作用域） | 无 | 无 | 无 | 无 | 无 | 无 | 无 | — | 无 | 无 |

证据：`apps/console-next/src/pages/platform/PlatformListPage.tsx:217-256`、`settings/SettingsListPage.tsx:161-208,285-334`、`cluster/ClusterMembersPage.tsx:17-18,34-85`、`areas/registry.ts:221-238`（平台只有 users/clusterroles/workspaces 三页）。

### 5.4 差距与影响

| # | 差距 | 类型 | 影响 |
| --- | --- | --- | --- |
| 21 | 集群成员管理（邀请/改角色/移除） | **真缺失**（parity `:33` 登记为有意不迁移，理由"写集群角色绑定"） | 新集群加不了人，只能走 kubectl 或老 console |
| 22 | 平台角色的规则编辑 | **真缺失**（parity `:134` 只登记"规则的多条编辑"，未登记"完全没有编辑器"） | 平台角色建得出来但配不了权限，只能编辑 alias |
| 23 | 企业空间的成员/角色/用户组 | **真缺失**（parity `:137` 登记理由：`/workspaces/<name>/members` 在本集群 404） | 企业空间这一整层在新 UI 不存在 |
| 24 | 成员批量移除 | **部分** | 多一个人就要多点一次 |
| 25 | 用户组（Groups） | **真缺失** | 部门/用户组授权无处可做 |
| 26 | 用户登录历史页签 | **真缺失**（parity `:135` 只登记"该用户在项目/企业空间里的角色"，未登记登录历史） | 安全审计看不到登录记录 |

---

## 6. 创建表单（矩阵）

### 6.1 老 console 的创建能力

`console/src/components/Forms/` 下 29 个表单目录：AlertingPolicy、AppDeploy、Base、CD、Cluster、ConfigMap、CronJob、CustomScaling、Dashboard、DevOps、Elasticsearch、Fluentd、GrayRelease、ImageBuilder、Job、KafkaForm、LoggingCollection、Notification、Opensearch、Pipelines、Route、Secret、Service、ServiceAccount、SilentPolicy、StorageClass、Volume、VolumeSnapshot、Workload。

对应的 action 名（`console/src/actions/*.js`）：`workload.create`、`configmap.create`、`secret.create`、`service.create`/`service.simple.create`、`router.create`、`serviceaccount.create`、`volume.create`、`create.snapshot`/`volume.create.snapshot`、`snapshotClasses.create`、`storageclass.create`、`network.policies.add`/`addByYaml`、`network.ippool.add`、`project.create`、`workspace.create`、`user.create`、`role.create`、`member.invite`、`cluster.add`、`node.add`、`gateways.create`、`alerting.policy.create`、`custom.monitoring.create`、`log.collection.*`、`imagebuilder.create`、`devops.create`、`pipeline.create`、`cd.create`、`codeRepo.create`、`openpitrix.*`、`federated.project.create`。

### 6.2 表 6-A 「资源 × 创建能力」矩阵

| 资源 | 老 console | 新 UI | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| ConfigMap | 有（含 YAML 模式） | 有（含 YAML 模式） | 无 | 老 `Forms/ConfigMap/`、`actions/configmap.js`；新 `ConfigMapCreateDialog.tsx:198-201` |
| Secret | 有 | 有（含 YAML 模式） | 无 | 新 `SecretCreateDialog.tsx:238-239` |
| ServiceAccount | 有 | 有（含 YAML 模式） | 无 | 新 `ServiceAccountCreateDialog.tsx:144-145` |
| Deployment/StatefulSet/DaemonSet/Job/CronJob | 有 | 有（通用向导） | 无（但功能缩水，见下） | 新 `WorkloadCreateDialog.tsx` |
| Service | 有（含简易创建） | **无** | **真缺失** | 新 UI 无 Service 创建弹窗；`WorkloadCreateDialog` 只建控制器 |
| Ingress(Route) | 有 | **无** | **真缺失** | 同上；`IngressRulesDialog` 是编辑 |
| PVC | 有 | **无** | **真缺失**（parity `:108`「不在列表创建存储卷」= 有意不迁移） | `StorageListPage.tsx` 无创建 |
| VolumeSnapshot | 有 | **无** | **真缺失**（parity `:108`「不做快照创建」） | — |
| StorageClass | 有 | **无** | **真缺失**（parity `:45` 有意不迁移） | — |
| NetworkPolicy | 有（含 YAML 创建） | 有 | 无 | `NetworkPolicyDialog.tsx` |
| IPPool | 有 | **无** | **真缺失** | 无路由 |
| Project（命名空间） | 有 | **无** | **真缺失**（parity `:43` 有意不迁移） | `cluster/namespaces` 只读 |
| Workspace | 有 | 有 | 无 | `WorkspaceEditorDialog.tsx` + `PlatformListPage.tsx:301` |
| User | 有 | 有 | 无 | `UserCreateDialog.tsx` |
| Role（项目） | 有 | 有 | 无 | `RoleCreateDialog.tsx` |
| Role（平台/集群） | 有 | 有（但无规则） | **部分** | `RoleEditorDialog.tsx` |
| Member | 有（邀请） | 有（项目级）；集群级无 | **部分** | §5 |
| Cluster | 有（`cluster.add`） | 有 | 无 | `AddClusterDialog.tsx` |
| Node | 有（`node.add`） | **无** | **真缺失** | 无对应弹窗 |
| AlertingRule | 有 | 有（规则组） | 无 | `RuleGroupDialog.tsx` |
| CustomMonitoring | 有 | **无** | **真缺失** | 无路由 |
| LogCollection | 有 | **无** | **真缺失**（parity:37） | — |
| Gateway | 有 | **无** | **真缺失**（parity `:122` 有意不迁移） | — |
| ImageBuilder（S2I） | 有 | **无** | **真缺失**（依赖 devops） | — |
| DevOps 工程/流水线/CD/代码仓库 | 有 | **无** | **真缺失**（无 devops 作用域） | — |
| 应用（openpitrix） | 有 | **无** | **真缺失**（模块关闭） | — |
| 联邦项目 | 有 | **无** | **真缺失** | — |
| 第三方登录/通知渠道 | 有 | 仅邮件（`MailChannelPage.tsx`） | **部分** | 正在迁移中 |

### 6.3 差距与影响

| # | 差距 | 类型 | 影响 |
| --- | --- | --- | --- |
| 27 | Service / Ingress 创建 | **真缺失** | 新 UI 能建 Deployment 但建不出对外入口，必须去老 console 或 YAML |
| 28 | PVC / 快照 / StorageClass 创建 | **真缺失**（部分有意不迁移） | 存储只能用已有的 |
| 29 | 项目（命名空间）创建 | **真缺失**（有意不迁移） | 新项目必须由老 console 或管理员建 |
| 30 | 节点添加 | **真缺失** | — |
| 31 | 平台角色创建时的规则配置 | **部分** | 建出来的角色没有权限，等于空壳 |
| 32 | 通知渠道只有邮件 | **部分**（正在迁移中） | 飞书/钉钉/企微/Slack/Webhook 无入口 |

---

## 7. 顶栏与全局壳

### 7.1 老 console（事实）

| 能力 | 老实现 | 证据 |
| --- | --- | --- |
| 产品 logo + 跳转 | logo → `/`（应用商店页跳 `/apps`） | `components/Layout/Header/index.jsx:152-160` |
| 平台管理菜单 | 由 `globals.app.getGlobalNavs()` 生成，受 `enableGlobalNav` 开关 | `components/Layout/Header/index.jsx:124-135,164-173` |
| 应用商店入口 | 受 `enableAppStore` 开关 | `components/Layout/Header/index.jsx:174-185` |
| 其他产品入口 | `visibleProductEntries(portal)`：工作台/Agent 工坊/大模型/东巴/治理平台 | `components/Layout/Header/index.jsx:62-108,186-188` |
| 帮助/文档菜单 | 用户指南 + API 文档，`window.open` | `components/Layout/Header/index.jsx:110-122,193-196` |
| 用户菜单 | 用户设置 / 退出登录 / 关于 | `components/Layout/LoginInfo/index.jsx:78-96` |
| 语言切换 | 在「用户设置 → 基本信息」里的 `spec.lang` 下拉，**不在顶栏** | `components/Modals/UserSetting/BaseInfo/index.jsx:90-96` |
| 用户设置弹窗 | 两个页签：基本信息（用户名/邮箱/语言）+ 密码设置 | `components/Modals/UserSetting/tabs.js` |
| 全局搜索 | **不存在**（全仓无 `GlobalSearch` 组件） | 反向核实：`grep -rln "GlobalSearch\|global-search\|SearchModal"` 只命中 LogSearch |
| 通知中心 | **不存在** | 反向核实：`components/Layout` 与 `core/containers` 无 notification |
| 快捷键 | **不存在** | 反向核实：无 `keydown`/`hotkey` 处理 |
| 404 兜底 | 有 `/404` 路由 + NotFound 容器 | `console/src/pages/console/routes/index.js`（`/404` → `console/containers/NotFound`，见 `00-inventory.md:37`） |
| 工具箱（浮动锤子） | 6 个工具 + 第三方工具，可拖拽、位置持久化 | `components/KubeTools/index.jsx:74-135,172-177,255-283` |

### 7.2 新 UI

| 能力 | 新 UI | 证据 |
| --- | --- | --- |
| 平台切换器（替代 logo） | 有：算力/模型/智能体/生态四个平台 | `shell/AppShell.tsx:123-144,348-374,666` |
| 模块导航 | 有：平台管理（下拉：集群/访问控制/应用商店管理/平台设置）、应用商店、工作台 | `shell/AppShell.tsx:230-263,674-689` |
| 应用商店 | 菜单指向 `/kube-frontend/apps`，**该路由不存在** | `AppShell.tsx:248` vs `src/routes/` 无 `kube-frontend.apps*` |
| 平台管理里的「应用商店管理」 | 指向 `/kube-frontend/apps-manage`，**该路由不存在** | `AppShell.tsx:239` |
| 语言切换 | 有（顶栏独立按钮，zh/en） | `AppShell.tsx:602-614,756-763` |
| 主题切换 | 有（老 console 无） | `AppShell.tsx:775` |
| 用户菜单 | 邮箱 / 用户设置 / 退出登录 | `AppShell.tsx:881-929` |
| 用户设置弹窗 | 有：资料（用户名只读 + 平台角色 + 邮箱/描述）+ 密码 | `shell/UserSettingsDialog.tsx:43,195-212,225-227` |
| 关于（版本信息） | **无** | 老 `LoginInfo/index.jsx:87-89` 的 `about` 菜单项在新 UI 无对应 |
| 帮助/文档入口 | **无** | 老 `Header/index.jsx:110-122`；新 UI 顶栏无此按钮 |
| 全局搜索 / 通知中心 / 快捷键 | **无**（老 console 也无，不计缺口） | §7.1 反向核实 |
| 404 兜底 | **无**（`src/routes/` 下无 `$.tsx`/`404`） | 目录清单 |
| 工具箱 | **无** | 无对应组件 |
| 侧栏折叠 / 移动端抽屉 / 跳到主内容 | 有（老 console 侧栏固定） | `AppShell.tsx:626-634,793-849` |
| 工作台上下文栏 | 有 | `shell/WorkspaceBar.tsx` |

### 7.3 差距与影响

| # | 差距 | 类型 | 影响 |
| --- | --- | --- | --- |
| 33 | 帮助/文档入口 | **真缺失**（未登记） | 用户在新 UI 里找不到任何文档出口 |
| 34 | 关于（版本） | **真缺失**（未登记） | 提工单时说不出前端版本 |
| 35 | 404 兜底页 | **真缺失**（未登记） | 任何写错的 URL 渲染空白或崩到根路由 |
| 36 | 顶栏「应用商店」「应用商店管理」指向不存在的路由 | **真缺失（死链接）** | 点了就 404/白屏；parity 报告 `:15`「部分功能登记为明确不做而非放死按钮」的原则在这里被违反 |
| 37 | 浮动工具箱（6 个运维工具的统一入口） | **真缺失** | 见 §1/§2 |
| 38 | 第三方工具入口（`config.thirdPartyTools`） | **真缺失** | 与工具箱同因 |

---

## 8. 列表通用能力

### 8.1 老 console

| 能力 | 老实现 | 证据 |
| --- | --- | --- |
| 分页档位 | `PAGESIZE_OPTION = [10, 20, 50, 100]`，下拉切换 | `console/src/utils/constants.js:1226`、`components/Tables/Base/Pagination/index.jsx:55-111` |
| 列显隐设置 | `CustomColumns` 下拉，列定义带 `isHideable` | `components/Tables/Base/index.jsx:341-349`、`components/Tables/Base/CustomColumns/index.jsx:41-66` |
| 刷新按钮 | 工具栏常驻刷新 | `components/Tables/Base/index.jsx:335-340` |
| 批量操作 | 选中后标题栏切换为「已选 N 项 + 批量动作」 | `components/Tables/Base/index.jsx:357-363` |
| 搜索 | 工具栏内 `FilterInput`，按 `searchType`（如 name） | `components/Tables/Base/FilterInput/` |
| 排序 | 列头 `sorter: true`，服务端排序 | `projects/containers/Roles/index.jsx:106-135` |
| 空态可操作 | 空态给「刷新数据 / 清除搜索条件」两个出口 | `components/Tables/Base/index.jsx:365-399` |
| 实时刷新 | 列表用 WebSocket watch，MODIFIED/ADDED/DELETED 自动重取 | `workspaces/containers/Groups/index.jsx:84-105` |
| 排行表 | `Tables/Ranking` | `components/Tables/Ranking/` |
| 高级设置折叠 | `ToggleView`（**不是**卡片/列表切换，是「高级设置」展开器） | `components/ToggleView/index.jsx:26-61` |
| 长文本预览 | `TextPreview` 弹窗 | `components/TextPreview/` |

### 8.2 新 UI

| 能力 | 新 UI | 证据 |
| --- | --- | --- |
| 分页 | 有，**固定 10 条**（12 个页面各自 `const PAGE_SIZE = 10`） | `ConfigMapsPage.tsx:34` 等 12 处；`useResourceListState.ts:76-89` |
| 每页档位切换 | **无**（schema 支持 `pageSizeOptions`+`onPageSizeChange`，但没有页面用） | `packages/ai-kit/src/schema/ResourceList.tsx:160,234` vs 全仓无 `pageSizeOptions` 使用 |
| 列显隐 | **无**（`TableColumn` 只有 `hideOnMobile`，是断点不是用户设置） | `packages/ai-kit/src/primitives/Table.tsx:13-20` |
| 列宽拖拽 | **无** | 同上 |
| 刷新按钮 | **无**（靠 React Query 缓存与 retry） | 页面 schema 无 refresh action |
| 批量操作 | 有（`selection: 'multiple'` + `actions`），**目前只有批量删除** | `ConfigMapsPage.tsx:118,126-134`、`SecretsPage.tsx:139`、`WorkloadListPage.tsx:122`、`StorageListPage.tsx:105`、`ServiceAccountsPage.tsx:129` |
| 搜索 | 有，防抖 250ms，只按 name | `useResourceListState.ts:48-56` |
| 排序 | 有，`sortableKeys` 白名单，服务端排序 | `useResourceListState.ts:66-70` |
| 筛选 | 有，**每个页面只有一个「项目」筛选器** | `ConfigMapsPage.tsx:117`、`SecretsPage.tsx:138` 等 |
| 选择态重置 | 有（翻页/搜索/排序都清空选择） | `useResourceListState.ts:58-64` |
| 行内「更多操作」 | 有（`rowActions` 下拉） | `ResourceList.tsx:378` |
| 卡片视图 | **无** | — |
| 实时刷新 | **无**（无 watch，仅 `staleTime`） | 全仓无 WebSocket |
| 空态 | 有（title + description），**没有「刷新/清除筛选」出口** | `ConfigMapsPage.tsx:244` |
| 移动端 | 有（`hideOnMobile` + 抽屉侧栏） | `Table.tsx:13-20`、`AppShell.tsx:642-656` |

### 8.3 差距与影响

| # | 差距 | 类型 | 影响 |
| --- | --- | --- | --- |
| 39 | 每页档位（10/20/50/100） | **真缺失**（迁移指南 §3 明确登记为「有意识的取舍」，但 parity 报告里只在 ConfigMaps 一节提了 `不做虚拟滚动`） | 大列表只能 10 条一页翻，运维场景很痛 |
| 40 | 列显隐设置 | **真缺失**（parity 报告每个资源页都登记「不做列显隐设置与列宽拖拽」） | 窄屏只能靠固定断点 |
| 41 | 刷新按钮 | **真缺失**（未登记） | 数据不自动刷新，用户没有手动出口 |
| 42 | 批量操作只覆盖「删除」 | **部分**（老 console 还有批量停止、批量移除成员、批量删除存储类/PV 等） | 批量操作面窄 |
| 43 | 实时刷新（WebSocket watch） | **真缺失**（未登记） | 列表永远是打开那一刻的快照 |
| 44 | 空态的「刷新/清除筛选」出口 | **部分**（未登记） | 空表时用户只能自己猜为什么空 |

---

## 9. 疑似回归清单（老 console 有、新 UI 漏了、且**没有登记**为有意不迁移）

> 判定：这些项在 parity 报告与 `design/` 里都找不到理由，但源码层面确实缺。

| # | 能力 | 老证据 | 新 UI | 为什么算疑似回归 |
| --- | --- | --- | --- | --- |
| R1 | 容器 exec 终端（含容器切换 + 容器基本信息面板） | `components/Modals/ContianerTerminal/index.jsx:100-151`、入口 `pages/projects/containers/Pods/Containers/Detail.jsx:189` | 无 | parity 报告只在「集群概览」登记了 kubectl/kubeconfig 快捷工具，**容器终端一字未提** |
| R2 | 节点 shell | `components/Modals/KubeCtl/index.jsx:68-71`、`stores/terminal.js:61-65` | 无 | 同上 |
| R3 | 容器日志查看（tail/实时/下载） | `components/Cards/ContainerLog/index.jsx:124-167` | 无 | parity 报告 `:123` 只登记了「日志查询与检索（属集群日志查询页面）」，**没登记"容器日志页签本身没有"** |
| R4 | 日志收集配置的编辑 | `clusters/containers/LogCollections/Detail/index.jsx:80` | 只读 | 已登记（parity:37），**不算回归**，列在此仅为对照 |
| R5 | 集群成员写操作 | `clusters/containers/Members/index.jsx:101-141` | 只读 | 已登记（parity:33），**不算回归** |
| R6 | 平台角色规则编辑 | `projects/containers/Roles/index.jsx:59-71` + `actions/role.js:62` | 只有 alias/desc | parity `:134` 只登记了「规则的多条编辑（当前一次一条）」，暗示存在单条编辑；但 `RoleEditorDialog.tsx` 根本没有规则字段 |
| R7 | 用户登录历史页签 | `access/containers/Accounts/Detail/routes.js`（`LOGIN_HISTORY`） | 无 | parity `:135` 只登记了「该用户在项目/企业空间里的角色」 |
| R8 | 帮助/文档入口 | `components/Layout/Header/index.jsx:110-122` | 无 | 未登记 |
| R9 | 关于（版本信息） | `components/Layout/LoginInfo/index.jsx:87-89` | 无 | 未登记 |
| R10 | 404 兜底页 | `00-inventory.md:37`（`/404` → NotFound） | 无 `$.tsx`/`404` 路由 | 未登记 |
| R11 | 顶栏死链接（应用商店 / 应用商店管理） | 老 console 有 `enableAppStore` 开关控制显隐 | 菜单常驻但路由不存在 | parity `:15` 自己定的原则「登记为明确不做而非放死按钮」，这里被违反 |
| R12 | 列表刷新按钮 | `components/Tables/Base/index.jsx:335-340` | 无 | 未登记 |
| R13 | 实时刷新（WebSocket watch） | `workspaces/containers/Groups/index.jsx:84-105` | 无 | 未登记 |
| R14 | 图表能力整体退化（只有手写 SVG 折线） | `components/Charts/**`（5 种 Area + 3 种 Bar + Pie） | 4 张 SVG 折线 | `ClusterMonitorPage.tsx:16-20` 有注释说明取舍，但**不在 parity 报告也不在 design/** |
| R15 | 集群物理资源 14 类指标 / GPU 资源监控 | `Monitor/Cluster/Monitor/PhysicalResource/index.jsx:32-302`、`Monitor/Cluster/GPUResource/**` | 4 个指标 | parity `:38` 只登记了 etcd/apiserver/scheduler 与「下钻排行」，**物理资源与 GPU 未登记** |
| R16 | 服务拓扑图 | `components/Graph/**` | 无 | 未登记（属 servicemesh 模块，可归「依赖模块」，但报告未写） |
| R17 | Service / Ingress 创建 | `actions/service.js`、`actions/router.js`、`Forms/Service`、`Forms/Route` | 无 | parity 报告各资源页都没提「不能创建 Service/Ingress」 |

---

## 10. 规模总结

| 维度 | 数量 | 说明 |
| --- | --- | --- |
| **页面级缺口** | **9** | 容器终端窗口、kubectl 窗口、节点 shell 窗口、`/logquery`、`/eventsearch`、`/auditingsearch`、`/bill`、kubeconfig 工具、`/404` |
| **功能级缺口** | **53** | 按能力点计（每张缺口表的一行算 1 项）：§1 终端 6 + §2 日志 7 + §3 图表 7 + §4 编辑 9 + §5 授权 6 + §6 创建 6 + §7 顶栏 6 + §8 列表 6 = 53。其中标「有意不迁移」的 6 项（#13/#19/#30/#39 的一部分/#24/#26 的部分）单列，不重复计入"真缺失" |
| **疑似回归（未登记）** | **15** | §9 共 17 行，其中 R4/R5 已登记为有意不迁移（列出仅为对照），余 **15 条**在 parity 报告与 design/ 中都找不到理由 |
| 架构级（需后端配合） | 4 | 容器 exec、kubectl、节点 shell、日志 tail——都卡在 BFF 无 WebSocket upgrade |
| 矩阵规模 | 6 张 | 表 4-A/4-B/4-C（资源 × 编辑，29 类资源 × 5 项能力）、表 5-A/5-B（作用域 × 授权，5 个作用域 × 11 项能力）、表 6-A（资源 × 创建，28 类资源） |

**一句话**：本作用域最大的不是"少几个页面"，而是**四个通道级能力（终端、kubectl、节点 shell、日志 tail）整体不存在**，其次是**编辑能力从"30 类资源可编 YAML / 20+ 种定制编辑设置"退化到"12 类可编 YAML / 6 种编辑设置"**；授权层则呈现"项目级基本齐、集群与平台级写操作全缺、企业空间整层不存在"的断层。
