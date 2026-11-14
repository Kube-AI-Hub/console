# 缺口分析：集群作用域（/clusters/:cluster 下全部页面与功能）

> **历史证据，2026-11-14 基线。** 下文缺口、模块和旧计划行号已过期，不作当前任务或批准不做的依据。
> 现行方法见[迁移指南](../../legacy-ui-migration-guide.md)，待复核项见[能力矩阵](../capability-matrix.md)；
> 概览后续功能与视觉证据见[补齐](../cluster-overview-completion-20261115.md)、[布局复盘](../cluster-overview-layout-review-20261115.md)。

> 事实源：**老 console 源码**（`console/src/pages/clusters/**`、`console/src/pages/projects/containers/Alerting/**`、`console/server/config.yaml`）。
> 新 UI：`console/kube-frontend/apps/console-next/src/routes/kube-frontend.clusters.$cluster/**`、`src/pages/cluster/**`、`src/areas/registry.ts`。
> 已登记的有意不迁移：`console/docs/plans/page-parity-report.md`（cluster-management 一节，L26–L46）、`console/docs/plans/area-migration-plan.md` §5（L164–L189）。
> 纯静态分析，未跑 dev server / 浏览器。**没读到的写「未核实」**。

## 0. 一句话结论

新 UI 集群作用域在侧栏只登记 **13 个页面**（`areas/registry.ts:186-209`），老 console 的集群导航是 **37 个叶子项**（`server/config.yaml:153-316`），路由条目 **54 条**（含详情与页签组，`routes/index.js:96-278` + `routes/detail.js:58-181`）。
**数量差本身就是最大的缺口**：老 console 集群作用域里成体系的三块——集群级应用负载（8 页）、集群级配置（3 页）、集群级网络（2 页）——在新 UI 集群作用域**一页都没有**，而这三块在 `areas/registry.ts` 里连 `status: 'planned'` 的占位都没登记（对比 `registry.ts:41` 明确写了 `status?: 'ready' | 'planned'` 的用途）。

---

## 1. 页面级缺口表

状态口径：`已迁移` / `有替代` / `有意不迁移` / `真缺失`。「页签组」指一个路由下挂多个子页签，按老 console 实际路由条目计。

| # | 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 1 | 集群概览 | `overview`（`routes/index.js:96-100`） | `overview`（`ClusterOverviewPage.tsx`） | 已迁移 | 见 §2.1 功能级差异 |
| 2 | 节点列表 | `nodes`（`:102-104`） | `nodes`（`ClusterListPage.tsx` kind=nodes） | 已迁移 | 列/操作大面积缩水，见 §2.2 |
| 3 | 节点详情 | `nodes/:node`（`detail.js:61-63`） | `nodes/$name`（`NodeDetailPage.tsx`） | 已迁移 | 5 个页签全无，见 §2.2 |
| 4 | GPU 卡详情 | `nodes/:node/gpus/:gpuUuid`（`detail.js:58-59`） | 无 | 真缺失 | 老侧有 RunningStatus / Monitoring 两个页签（`Nodes/Detail/GpuDetail/index.jsx:190`） |
| 5 | 边缘节点列表 | `edgenodes`（`:106-109`） | 无 | 真缺失 | 依赖 `edgeruntime`（`config.yaml:166-170` `clusterModule: edgeruntime`） |
| 6 | 边缘节点详情 | `edgenodes/:node`（`detail.js:65-67`） | 无 | 真缺失 | 同上；`EdgeNodes/Detail/index.jsx:201` 有运行状态/监控页签 |
| 7 | GPU 卡列表 | `gpus`（`:111-114`） | 无 | 真缺失 | `Nodes/Gpus/index.jsx` 12 列 + 健康率/厂商型号总览面板 |
| 8 | 系统组件列表 | `components`（`:116-119`） | `components`（`ComponentsPage.tsx`） | 已迁移 | 见 §2.3 |
| 9 | 系统组件详情 | `components/:namespace/:name`（`detail.js:85-87`） | 无 | 真缺失 | 老侧有 Pod 列表页签（`ServiceComponents/Detail/routes.js:25-33`） |
| 10 | 项目列表 | `projects`（`:121-124`） | `namespaces`（`ClusterListPage.tsx` kind=namespaces） | 有替代 | 改名但列不等价，见 §2.4 |
| 11 | 项目详情（4 页签） | `projects/:namespace`（`detail.js:114-181`） | 无 | 真缺失 | 概览/容器组/网关/配额（`Projects/Detail/routes.js:28-49`）；`namespaces/` 下无 `$name.tsx` |
| 12 | 自定义资源列表 | `customresources`（`:126-129`） | `custom-resources` | 已迁移 | — |
| 13 | 自定义资源详情 | `customresources/:name`（`detail.js:69-71`） | `custom-resources/$name` | 已迁移 | 新侧用「实例列表」替代老侧 ResourceStatus，**等价且更好**（`CustomResourceDetailPage.tsx:69-112`） |
| 14 | 部署（集群级全命名空间） | `deployments`（`:131-134`） | 无 | 真缺失 | 见 §3.1 |
| 15 | 有状态副本集（集群级） | `statefulsets`（`:136-139`） | 无 | 真缺失 | 同上 |
| 16 | 守护进程集（集群级） | `daemonsets`（`:141-144`） | 无 | 真缺失 | 同上 |
| 17 | 任务（集群级） | `jobs`（`:146-149`） | 无 | 真缺失 | 同上 |
| 18 | 定时任务（集群级） | `cronjobs`（`:151-154`） | 无 | 真缺失 | 同上 |
| 19 | 容器组（集群级） | `pods`（`:156-159`） | 无 | 真缺失 | 同上 |
| 20 | 服务（集群级） | `services`（`:161-164`） | 无 | 真缺失 | 同上 |
| 21 | 应用路由（集群级） | `ingresses`（`:166-169`） | 无 | 真缺失 | 同上 |
| 22 | 保密字典（集群级） | `secrets`（`:171-174`） | 无 | 真缺失 | 见 §3.2 |
| 23 | 配置字典（集群级） | `configmaps`（`:176-179`） | 无 | 真缺失 | 同上 |
| 24 | 服务账户（集群级） | `serviceaccounts`（`:181-184`） | 无 | 真缺失 | 同上 |
| 25 | 存储类型列表 | `storageclasses`（`:186-189`） | `storageclasses` | 已迁移 | 只读，行操作为空数组（`StorageClassesPage.tsx:141`） |
| 26 | 存储类型详情 | `storageclasses/:name`（`detail.js:93-95`） | `storageclasses/$name` | 已迁移 | 老侧详情有「关联 PVC 列表」页签（`StorageClasses/Detail/routes.js:24-31`），新侧无 |
| 27 | 存储卷（**全命名空间 PVC** + PV 页签） | `volumes`（`:190-193`，`Volumes/routes.js:26-43`） | 仅 PV 有替代（`persistentvolumes`） | 真缺失（PVC 半边） | 老 `volumes` 默认页签是 **PVC 全命名空间列表**（`Storage/Volumes/Volume/index.jsx:36-43`），PV 是第二个页签；新 UI 只迁了 PV |
| 28 | 存储卷快照（快照 + 快照内容 2 页签） | `volume-snapshots`（`:195-197`，`VolumeSnapshots/routes.js:26-43`） | 无 | 真缺失 | 快照创建/删除/回滚 |
| 29 | 快照类型列表 | `volume-snapshot-classes`（`:199-201`） | 无 | 真缺失 | `VolumeSnapshotClasses/index.jsx:72-116` |
| 30 | 快照类型详情 | `volume-snapshot-classes/:name`（`detail.js:109-111`） | 无 | 真缺失 | 含 VolumeSnapshot 页签（`VolumeSnapshotClasses/Detail/VolumeSnapshot/index.jsx:144`） |
| 31 | 快照内容详情 | `volume-snapshot-content/:name`（`detail.js:105-107`） | 无 | 真缺失 | `SnapshotContent/Detail/index.jsx:201` |
| 32 | 快照别名路由 | `snapshots/:namespace?`（`:251-254`） | 无 | 真缺失 | 同一组件的旧链接入口，老侧保留兼容 |
| 33 | 持久卷详情 | `pv/:name`（`detail.js:101-103`） | `persistentvolumes/$name` | 有替代 | 新侧只读（`PersistentVolumeDetailPage.tsx:19-24` 写明理由） |
| 34 | 共享存储（JuiceFS，3 页签） | `juicefs-storage`（`:203-205`，`Storage/JuiceFS/index.jsx:56-82`） | 无 | 真缺失 | 总览/卷/性能三页签，含配额编辑（`Volumes/QuotaModal/index.jsx:210`） |
| 35 | 集群状态监控（6 页签） | `monitor-cluster`（`:207-209`，`Monitor/Cluster/routes.js:29-67`） | `monitor`（`ClusterMonitorPage.tsx`） | 有替代 | **不等价**：老 6 页签 → 新 4 条趋势线，见 §2.5 |
| 36 | GPU 资源（3 页签） | `gpu-resource`（`:210-213`，`GpuResourcePage.jsx:31-57`） | 无 | 真缺失 | GPU 总览/物理监控/使用排行 |
| 37 | 应用资源监控（2 页签） | `monitor-resource`（`:214-217`，`Monitor/Resource/routes.js:25-38`） | 无 | 真缺失 | 用量（物理+虚拟+项目趋势）/排行；`node-usage` 只承担了 `monitor-cluster/ranking` |
| 38 | 告警消息（集群级） | `alerts`（`:218-221`） | 无（仅项目级 `alerts`） | 真缺失 | 集群级比项目级多「自定义策略/内置策略」两个页签（`Alerting/Messages/index.jsx:70-92`） |
| 39 | 告警策略（集群级） | `alert-rules`（`:222-225`） | 无（仅项目级 `alertingrules`） | 真缺失 | 同上（`Alerting/Policies/index.jsx:53-72`） |
| 40 | 告警策略详情 | `alert-rules/:name` + `alert-rules/builtin/:name`（`detail.js:77-80`） | 无 | 真缺失 | 规则/消息两页签（`Policies/Detail/routes.js:24-38`） |
| 41 | 自定义监控 | `custom-monitoring`（`:270-273`） | 无 | 有意不迁移 | `area-migration-plan.md` §5.4：仪表板接口各路径 404 |
| 42 | 集群基本信息 | `base-info`（`:227-230`） | `settings`（`ClusterSettingsPage.tsx`） | 有替代 | 改名等价；但老侧顶部的 6 项资源总量没了，见 §2.6 |
| 43 | 集群可见性 | `visibility`（`:231-235`） | `visibility`（`ClusterVisibilityPage.tsx`） | 已迁移 | 企业空间授权列表未迁（已登记） |
| 44 | 集群成员 | `members`（`:236-240`） | `members`（`ClusterMembersPage.tsx`） | 已迁移 | 只读，写操作已登记 |
| 45 | 集群角色列表 | `roles`（`:241-245`） | `/kube-frontend/access/clusterroles`（平台作用域） | 有替代 | 新侧固定读 **host** 集群（`PlatformListPage.tsx:44` `cluster: 'host'`），多集群下不等价 |
| 46 | 集群角色详情 | `roles/:name`（`detail.js:73-75`） | `access/clusterroles/$name` | 有替代 | 老侧有「权限/授权用户」两页签（`Roles/Detail/routes.js:26-39`） |
| 47 | 网络隔离（集群级） | `networkpolicies`（`:256-259`） | 无 | 真缺失 | 依赖 `network` 模块（`config.yaml:207-211`）；集群级列含 PROJECT 列（`Network/Policies/index.jsx:140-150`） |
| 48 | Pod IP 池 | `ippools`（`:260-264`） | 无 | 真缺失 | 依赖 `network.ippool`（`config.yaml:212-216`）；`Network/IPPools/index.jsx:95-142` |
| 49 | Pod IP 池详情 | `ippools/:name`（`detail.js:97-99`） | 无 | 真缺失 | 含 Workspaces 页签（`IPPools/Detail/Workspaces/index.jsx:97`） |
| 50 | 日志收集器 | `log-collections/:component`（`:266-268`） | `log-collections`（`ClusterLogCollectionsPage.tsx`） | 有替代 | **不等价**：老 3 类页签 + 卡片列表 + 增删改 → 新单页只读三段，见 §2.7 |
| 51 | 日志收集器详情 | `log-collections/:component/:name`（`detail.js:81-83`） | 无 | 真缺失 | 资源状态页签（`LogCollections/Detail/routes.js:25-32`） |
| 52 | 网关设置（集群/项目 2 页签） | `gateways/:component`（`:274-278`，`Gateway/index.jsx:53-68`） | 无（仅项目级 `gateways`） | 真缺失 | 集群网关卡片 + 项目网关列表（`Gateway/Components/ProjectGatewayList/index.jsx:220`） |
| 53 | 网关详情（5 页签） | `gateways/:component/:gatewayName`（`detail.js:89-91`） | 无 | 真缺失 | 监控/配置/日志/资源状态/元数据（`Gateway/Detail/routes.js:27-58`） |
| 54 | kubeConfig 独立窗口页 | `kubeConfig`（`routes/index.js:88-91`） | 无 | 有意不迁移 | `area-migration-plan.md` §5.5：读接口 405 |

**合计**：54 条老路由/页 → **已迁移 10 / 有替代 7 / 有意不迁移 2 / 真缺失 35**（其中 `volumes` 的 PVC 半边计入真缺失）。

> 依赖已关闭模块的页面：`edgenodes`(+详情) 依赖 `edgeruntime`；`networkpolicies`/`ippools` 依赖 `network`/`network.ippool`；`alerts`/`alert-rules` 依赖 `alerting`。`area-migration-plan.md` §5.1–§5.3 只把 **openpitrix / devops / servicemesh** 三个模块登记为「不做」，**edgeruntime 与 network 没有被登记为不做**——见 §4。

---

## 2. 功能级缺口（仅针对「已迁移 / 有替代」的页面）

### 2.1 集群概览（已迁移）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| 基本信息：provider / k8s 版本 / KubeSphere 版本 / **可见性（可点击跳 visibility）** | provider / k8s 版本 / KS 版本 / 节点数 / 连接方式 / API 地址 / 描述；状态徽标 | 可见性字段与跳转没有 | 老 `Overview/Dashboard/ClusterInfo/index.jsx:34-59`；新 `ClusterOverviewPage.tsx:158-211` |
| 资源用量 6 项：**GPU 显存 / GPU / CPU / 内存 / Pod / 磁盘**，每项带 used/total + **allocated** | CPU / 内存 / Pod / 节点 / GPU（卡数） | 磁盘整项缺失；GPU 显存缺失；老有「节点」无、新有 | 老 `ResourcesUsage/index.jsx:76-119`；新 `ClusterOverviewPage.tsx:245-301` |
| 系统组件面板：6 个模块图标，可点进 `components?type=` | 无 | 缺失 | 老 `Overview/Dashboard/ServiceComponents/index.jsx:74-95` |
| 工具面板：kubectl（新窗口 `/terminal/kubectl/:cluster`）+ kubeconfig（新窗口 `/clusters/:c/kubeConfig`） | 无 | 缺失（已登记为有意不迁移） | 老 `Overview/Dashboard/Tools/index.jsx:44-73`；parity `L41` |
| Kubernetes 状态：API QPS / 延迟 / 调度次数 / 调度失败 | QPS / 延迟 / 已调度 / 不可调度 | 基本等价 | 老 `KubernetesStatus/index.jsx:94-150`；新 `:360-416` |
| 节点卡片（NodesStatus）+ 节点 Top5 | 无 | 已登记为有意不迁移（节点页承担） | 老 `Overview/Dashboard/ClusterNodes/index.jsx`、`NodesTop5/index.jsx:117`；parity `L41` |
| 集群未就绪时的初始化/引导页（KubeKey 进度 + 日志） | 仅代理集群的 agent manifest 面板 | 新侧做得更聚焦，但 KubeKey 初始化进度/日志缺失 | 老 `Overview/Initializing/index.jsx:221`、`KubeKeyCluster/Logs/index.jsx:182`；新 `ClusterOverviewPage.tsx:98-156` |
| 用量趋势曲线 | 无（只在 `monitor` 页有） | 已登记为有意不迁移 | parity `L41` |

### 2.2 节点（已迁移，缺口最密集）

**列表**（老 `Nodes/index.jsx` vs 新 `ClusterListPage.tsx`）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| 总览面板：节点总数、master 数、健康率环形图、**各 XPU 厂商节点数** | 无 | 缺失 | 老 `Nodes/index.jsx:892-973` |
| 列：名称(+IP) / 状态(+污点数 tooltip) / 角色 | 名称(+内部 IP) / 状态(+已停止调度) / 角色 | 污点数与 tooltip 缺失 | 老 `:461-513`；新 `ClusterListPage.tsx:99-147` |
| 列：**GPU 使用率**（利用率+used/total+已分配） | 无 | 缺失 | 老 `:514-557` |
| 列：**GPU 显存使用率** | 无 | 缺失 | 老 `:558-597` |
| 列：CPU 使用率（利用率+used/total+**已分配 requests**） | CPU%（容量在 title） | 已分配缺失 | 老 `:598-641`；新 `:148-165` |
| 列：内存使用率（+已分配 requests） | 内存%（容量在 title） | 已分配缺失 | 老 `:642-684`；新 `:166-181` |
| 列：**Pod 用量**（used/total） | 无 | 缺失 | 老 `:685-709` |
| 列：**XPU 类型**（厂商+型号，带筛选） | 无 | 缺失 | 老 `:710-738` |
| 列：**GPU 虚拟化模式**（含切换中/失败态） | 无 | 缺失 | 老 `:739-769` |
| 列：**节点时间同步**（偏移秒数 + NTP 状态，critical/warning 着色） | 无 | 缺失 | 老 `:332-373` |
| 时间同步 critical 横幅 | 无 | 缺失 | 老 `:990-1005` |
| 列筛选：名称 / 状态 / 角色 / 设备厂商 / XPU 型号 | 仅名称搜索 | 缺失 | 老 `:426-457` |
| 行操作：停止/启动调度 | 停止/启动调度 | 等价 | 老 `:99-119`；新 `:78-91` |
| 行操作：**打开终端** | 无 | 缺失（架构级，见 §5） | 老 `:120-127` |
| 行操作：**查看导入日志**（导入未成功时） | 无 | 缺失 | 老 `:128-136` |
| 行操作：**设置 vGPU 模式** | 无 | 缺失 | 老 `:137-153` |
| 行操作：**删除导入失败的节点** | 无 | 缺失 | 老 `:154-166` |
| 批量操作：**编辑污点** | 无 | 缺失 | 老 `:198-209` |
| 顶部操作：**添加节点**（KubeKey 集群） | 无 | 缺失 | 老 `:179-193` |
| Banner 说明（节点类型、污点含义） | 无 | 缺失 | 老 `:86-97` |

**详情**（老 `Nodes/Detail/index.jsx` vs 新 `NodeDetailPage.tsx`）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| 页签「运行状态」 | 无 | 缺失 | 老 `Nodes/Detail/routes.js:26-31` |
| 页签「容器组」（Pod 卡片，可跳 Pod 详情） | 无 | 缺失（parity `L40` 已登记） | 老 `:32`，`Nodes/Detail/Pods/index.jsx` |
| 页签「元数据」（labels/annotations 表） | 标签/污点平铺展示 | 部分等价，annotations 缺失 | 老 `:33-38`；新 `NodeDetailPage.tsx:107-128` |
| 页签「监控」（节点 CPU/内存/磁盘/网络趋势） | 无 | 缺失（parity 登记） | 老 `:39-44`，`Nodes/Detail/Monitoring/index.jsx:382` |
| 页签「事件」 | 无 | 缺失 | 老 `:45` |
| 操作：停止/启动调度 | 无（只在列表页） | 缺失 | 老 `Nodes/Detail/index.jsx:126-132` |
| 操作：打开终端 | 无 | 缺失（架构级） | 老 `:133-142` |
| 操作：编辑标签 | 无 | 缺失 | 老 `:143-154` |
| 操作：编辑污点 | 无 | 缺失（parity 登记） | 老 `:155-165` |
| 操作：设置 vGPU 模式 | 无 | 缺失 | 老 `:166-173` |
| 属性：状态/IP/角色/XPU 类型/OS 版本/OS 类型/内核/容器运行时/kubelet/kube-proxy/架构 | 状态/角色/kubelet/内部 IP/OS 镜像/内核/运行时/创建时间 | **OS 类型、架构、kube-proxy 版本、XPU 类型缺失** | 老 `:237-288`；新 `:65-74` |
| 属性：GPU 虚拟化模式（带「设置」按钮）、GPU 驱动版本、GPU 引擎版本、设备切分数 | 无 | 缺失 | 老 `:289-366` |
| 容量/可分配量 | 有（cpu/memory/pods/ephemeral-storage） | **新侧更好** | 新 `:77-89` |
| 条件（conditions） | 有 | **新侧更好** | 新 `:91-105` |

### 2.3 系统组件（已迁移）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| 按模块分组页签（Kube AI Hub / Kubernetes / Istio / 监控 / 日志 / DevOps），每页签带**异常计数徽标** | 单张平铺表，按健康度排序 | 分组与计数缺失（parity `L35` 已登记「按模块分组显示」） | 老 `ServiceComponents/index.jsx:69-104, 121-144`；新 `ComponentsPage.tsx:60-98` |
| 模块未启用时置灰并显示「已禁用」 | 无（只显示存在的组件） | 缺失 | 老 `ServiceComponents/index.jsx:131-140` |
| 组件详情页：状态/集群/项目/副本数(healthyBackends/totalBackends)/启动时间 | 无 | 缺失 | 老 `ServiceComponents/Detail/index.jsx:59-86` |
| 组件详情页签：Pod 列表 | 无 | 缺失 | 老 `ServiceComponents/Detail/routes.js:25-33` |

### 2.4 项目 / 命名空间（有替代）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| 页签「用户项目 / 系统项目」 | 无 | 缺失 | 老 `Projects/index.jsx:96-111` |
| 列：名称(+描述) / 状态 / 企业空间 | 名称(+描述) / 状态 / CPU / 内存 / Pod / 企业空间 / 创建时间 | 列反而更全，但 CPU/内存/Pod 单位与老侧不同（老用 `getSuitableValue` 带单位） | 老 `:184-272`；新 `ClusterListPage.tsx:183-244` |
| 列：GPU 使用率、GPU 显存使用率 | 无 | 缺失 | 老 `:221-242` |
| 列筛选：名称 / 别名 / 企业空间 | 仅名称搜索 | 缺失 | 老 `:125-143` |
| 行操作：编辑信息 / 分配企业空间 / 删除 | 无 | 缺失（创建/编辑/删除已登记） | 老 `:50-94` |
| **项目详情页**：概览 / 容器组 / 网关 / 配额 4 页签 | 无（`namespaces/` 无 `$name.tsx`） | 缺失 | 老 `Projects/Detail/routes.js:28-49` |
| 项目详情操作：编辑信息 / **编辑项目配额** / **编辑默认容器配额(LimitRange)** / 删除 | 无 | 缺失 | 老 `Projects/Detail/index.jsx:82-140` |
| 项目详情属性：状态/集群/企业空间/创建时间/创建者 | 无 | 缺失 | 老 `:142-171` |
| 创建项目 | 无 | 已登记为有意不迁移（parity `L43`） | 老 `:274-278` |

### 2.5 集群监控（有替代，老 `monitor-cluster` 6 页签 → 新 1 页 4 条趋势）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| 页签「总览」：节点状态 + 厂商饼图 + 组件状态（服务组件 + etcd/controller-manager/scheduler 健康） | 无 | 缺失 | 老 `Monitor/Cluster/Overview/index.jsx:501-521` |
| 页签「总览」：集群资源状态 / RDMA 资源状态 / ETCD 状态 / 服务组件状态 | 无 | 缺失 | 老 `:511-518` |
| 页签「物理资源监控」（CPU/内存/GPU/GPU 显存趋势） | 只有 CPU/内存/Pod/节点 4 条趋势 | 部分等价；GPU/GPU 显存/磁盘趋势缺失 | 老 `Monitor/Cluster/Monitor/PhysicalResource/index.jsx:336`；新 `ClusterMonitorPage.tsx:47-58` |
| 页签「etcd 监控」 | 无 | 缺失（parity `L38` 已登记） | 老 `Monitor/Cluster/Monitor/Etcd/index.jsx:225` |
| 页签「API Server 监控」 | 无 | 缺失（parity 登记） | 老 `Monitor/Cluster/Monitor/APIServer/index.jsx:159` |
| 页签「Scheduler 监控」 | 无 | 缺失（parity 登记） | 老 `Monitor/Cluster/Monitor/Scheduler/index.jsx:165` |
| 页签「节点用量排行」 | `node-usage` 页承担 | **有替代**，等价（CPU/内存/磁盘/Pod 排序） | 老 `Monitor/Cluster/Ranking/index.jsx:157`；新 `NodeUsagePage.tsx:60-97` |
| 时间窗选择 | 1h/6h/24h/7d | 老侧是时间范围选择器 + 自动刷新 | 新侧更简单，非缺口 |
| 告警阈值线叠加 | 无 | 已登记为有意不迁移（parity `L38`） | — |

### 2.6 集群设置 / 可见性 / 成员 / 角色（有替代 / 已迁移）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| base-info：集群名/别名/provider/k8s 版本 | 有，且**同一弹窗**与列表共用 | 等价，新侧更一致 | 老 `BaseInfo/index.jsx:278-303`；新 `ClusterSettingsPage.tsx:70-107` |
| base-info 顶部 6 项资源总量（节点/CPU/内存/磁盘/GPU/vGPU） | 无 | 缺失 | 老 `BaseInfo/index.jsx:112-154` |
| base-info 操作：编辑信息 / 更新 kubeconfig / 移除集群 | 仅编辑信息 | 更新 kubeconfig、移除集群已登记为另立功能点（parity `L31`） | 老 `:183-223` |
| visibility：公开/私有 + **企业空间授权列表（3 列）** + 编辑可见性 | 公开/私有 radio（写注解） | 授权列表缺失（parity `L46` 已登记） | 老 `Visibility/index.jsx:103-131, 197-202`；新 `ClusterVisibilityPage.tsx:79-107` |
| members：用户名/状态/角色/最近登录 | 同 4 列 | 等价 | 老 `Members/index.jsx:143-185`；新 `ClusterMembersPage.tsx:40-73` |
| members：邀请 / 改角色 / 移除 / 批量移除 | 无 | 已登记为有意不迁移（parity `L33`） | 老 `:67-141` |
| roles：列表（名称/描述/创建时间）+ 编辑信息/删除（模板角色只读） | 平台 `access/clusterroles` 列表 | 有替代，但固定 `cluster: 'host'` | 老 `Roles/index.jsx:80-113`；新 `PlatformListPage.tsx:44` |
| roles 详情：权限规则 + 授权用户两页签 | `access/clusterroles/$name` 规则表 | 授权用户页签缺失（未核实新侧是否有等价区块） | 老 `Roles/Detail/routes.js:26-39` |

### 2.7 集群日志收集（有替代）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| 3 个页签：容器日志 / 资源事件 / 审计日志（按 `clusterModule` 隐藏） | 无页签，一次读全部 | 缺失 | 老 `LogCollections/index.jsx:96-118` |
| 收集器卡片列表（图标/地址/启用状态/类型/创建时间），可点进详情 | 三段只读列表（收集器/输入/输出） | 卡片与详情跳转缺失 | 老 `:186-221`；新 `ClusterLogCollectionsPage.tsx:51-111` |
| 添加日志接收器（创建） | 无 | 已登记为有意不迁移（parity `L37`） | 老 `:120-172` |
| 收集器详情页：资源状态（Pod 状态/配置） | 无 | 缺失 | 老 `LogCollections/Detail/routes.js:25-32` |
| 收集器就绪 Pod 数 | 有 | **新侧更好** | 新 `ClusterLogCollectionsPage.tsx:30-37, 63-65` |

### 2.8 存储（已迁移 / 有替代）

| 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- |
| storageclasses 列：名称/别名/PVC 数/是否默认/**允许克隆**/**允许快照**/**允许扩容**/供应者 | 名称(+默认徽标)/供应者/PVC 数/能力徽标(扩容/克隆/快照)/回收策略/创建时间 | 基本等价（老「允许克隆」用注解，新用能力徽标） | 老 `StorageClasses/index.jsx:59-124`；新 `StorageClassesPage.tsx:65-140` |
| storageclasses 行操作：编辑信息 / 编辑 YAML / 删除 / 批量删除（**有 PVC 依赖时拦截**） | `rowActions: []` | 已登记为有意不迁移（parity `L45`），但**依赖拦截逻辑**随之一并消失 | 老 `:42-57, 134-191`；新 `:141` |
| storageclasses 创建 / 设为默认 | 无 | 已登记为有意不迁移（parity `L45`） | 老 `:126-132` |
| storageclasses 详情：关联 PVC 列表页签 | 无 | **缺失且未登记** | 老 `StorageClasses/Detail/routes.js:24-31`；新 `StorageClassDetailPage.tsx:53-89`（只有基本+参数） |
| pv 列：名称/状态/容量/访问模式/回收策略/创建时间 | 名称(+SC)/状态/容量/访问模式/**绑定声明**/回收策略/创建时间 | 等价，新侧多「绑定声明」 | 老 `Storage/PV/index.jsx:138-217`；新 `PersistentVolumesPage.tsx:62-123` |
| pv 行操作：编辑信息 / 编辑 YAML / 删除 / 批量删除（Bound/Released 禁用） | `rowActions: []` | 已登记为有意不迁移（parity `L42`） | 老 `:47-111`；新 `:124` |
| **集群级 PVC 列表**（名称/状态/访问模式/**挂载状态**/PV 链接/创建时间，含全命名空间 + 项目筛选） | 无 | **真缺失**（新 UI 集群作用域没有任何 PVC 页面） | 老 `Storage/Volumes/Volume/index.jsx:152-249` |
| 快照 / 快照类型 / 快照内容 6 个页面 | 无 | **真缺失** | 老 `VolumeSnapshots/routes.js:26-43`、`VolumeSnapshotClasses/index.jsx:72-116` |
| 共享存储 JuiceFS 3 页签（总览/卷/性能，含配额编辑） | 无 | **真缺失** | 老 `Storage/JuiceFS/index.jsx:56-82` |

---

## 3. 集群级应用负载与配置：**整块缺失**（重点核实项）

### 3.1 集群级应用负载（8 页，全缺失）

老 console 在集群作用域提供**跨全部命名空间**的 8 类负载列表，路由在 `console/src/pages/clusters/routes/index.js:131-169`，导航在 `console/server/config.yaml:174-191`（`app-workloads` 分组，下分 `workloads`/`jobs` 两个页签组）。

**与项目级实现的实质差异**（不是同一份代码换个 namespace）：

| 维度 | 老集群级实现 | 老项目级实现 | 证据 |
| --- | --- | --- | --- |
| 命名空间 | **PROJECT 列**，且单元格链接到 `/clusters/:c/projects/:ns` | 无此列 | 集群级 `Workload/Deployments/index.jsx:197-207`；项目级 `console/src/pages/projects/containers/Deployments/index.jsx` 无 PROJECT 列（同文件对照） |
| 命名空间筛选 | `ResourceTable` 挂 `ProjectSelect`，占位文案「全部项目」，可搜索、可翻页、可清空 | 无（namespace 来自路由参数） | `clusters/components/ResourceTable/index.jsx:67-79`、`ResourceTable/ProjectSelect/index.jsx:56-71` |
| 请求参数 | `withList` 把 `clusterStore.project` 注入 `namespace`（空 = 全命名空间） | `namespace` 来自路由 | `components/HOCs/withList.js:116-135` |
| 权限 key | `globals.app.getActions({ module, ...match.params })`——**集群级没有 namespace 参数**，走的是集群角色 | 走项目角色 | `components/HOCs/withList.js:82-89` |
| 页签 | 顶部 3 页签（部署/有状态副本集/守护进程集）与 2 页签（任务/定时任务），切换改 URL | 侧栏分组 | 集群级 `Workload/Deployments/index.jsx:48-67`、`Jobs/index.jsx:47` |
| 创建 | 创建向导**先选项目**（`namespace: query.namespace`） | 项目固定 | 集群级 `Workload/Deployments/index.jsx:220-228` |
| 行操作 | 编辑信息 / 编辑 YAML / 重新部署 / 删除，且 `show: !record.isFedManaged`（联邦托管对象不可改） | 有 `federated` 徽标但操作未按该字段收敛 | 集群级 `Workload/Deployments/index.jsx:69, 88-138` |
| 列 | 名称/状态/**项目**/更新时间（Deployments）；Pods 另有 **NODE 列（可跳节点）**、Pod IP、资源 limits/requests | 名称/状态/就绪/创建时间 | 集群级 `Workload/Pods/index.jsx:104-151`；新 `WorkloadListPage.tsx:159-240` |

**新 UI 现状**：`routes/kube-frontend.clusters.$cluster/` 下没有 `deployments` 等任何目录（已逐一枚举全部 `createFileRoute` 路径确认），`areas/registry.ts:186-209` 也没有登记。
**迁移成本提示**（非缺口结论）：`WorkloadListPage.tsx:73-90` 已经带一个 `useProjectFilter` 的项目筛选器与 `namespace: projectFilter` 参数，`useWorkloads` 在 `namespace: ''` 时按全命名空间读（`queries.ts`），所以**页面本体可复用**，缺的是路由 + 侧栏登记 + PROJECT 列 + 集群级权限口径。

### 3.2 集群级配置（3 页，全缺失）

| 维度 | 老集群级实现 | 证据 |
| --- | --- | --- |
| 保密字典 | PROJECT 列 + 项目链接 + 类型 + **键数量** + 创建时间；行操作含「设为默认镜像仓库」 | `clusters/containers/Secrets/index.jsx:85-184` |
| 配置字典 | PROJECT 列 + 项目链接 + **键数量** + 创建时间 | `clusters/containers/ConfigMaps/index.jsx:118-144` |
| 服务账户 | PROJECT 列 + **角色列** + **令牌 Secret 列（可跳该 Secret）** + 创建时间 | `clusters/containers/ServiceAccounts/index.jsx:114-152` |
| 三者共用 | `ResourceTable` + `ProjectSelect` 全命名空间筛选，同 §3.1 | `ResourceTable/index.jsx:67-79` |

新 UI 集群作用域无对应页面；项目作用域的 `configmaps`/`secrets`/`serviceaccounts` 已迁移（`page-parity-report.md:48-86`），但**没有集群级入口**。

### 3.3 集群级网络（2 页 + 1 详情，全缺失）

| 页面 | 老实现要点 | 证据 |
| --- | --- | --- |
| 网络隔离 | PROJECT 列 + 项目链接；创建走「按 YAML 添加」；编辑信息/编辑 YAML/删除 | `clusters/containers/Network/Policies/index.jsx:62-161` |
| Pod IP 池 | 名称/网段 CIDR/**已用 IP（含总量）**/所属企业空间；编辑信息/查看 YAML/分配企业空间/删除；创建 | `clusters/containers/Network/IPPools/index.jsx:46-150` |
| Pod IP 池详情 | 属性 + Workspaces 页签 | `Network/IPPools/Detail/index.jsx:182`、`Detail/Workspaces/index.jsx:97` |

依赖模块：`config.yaml:203-216` 中 `networkpolicies` 需 `clusterModule: network`、`ippools` 需 `network.ippool`。**这两个模块没有被登记为「不做」**（`area-migration-plan.md` §5.1–§5.3 只列 openpitrix/devops/servicemesh）。

---

## 4. 疑似回归（老 console 有、新 UI 漏了、且**未**登记为有意不迁移）

> 判定方法：`page-parity-report.md` cluster-management 一节（L26–L46）里找不到对应条目的，才列在这里。

| # | 项 | 老证据 | 新证据 | 为什么算疑似回归 |
| --- | --- | --- | --- | --- |
| R1 | **集群级应用负载 8 页** | `routes/index.js:131-169`、`config.yaml:174-191` | 无路由、无侧栏登记 | parity 报告全篇没有一条提到集群级负载 |
| R2 | **集群级配置 3 页** | `routes/index.js:171-184`、`config.yaml:192-202` | 无 | 同上 |
| R3 | **集群级网络 2 页 + 详情** | `routes/index.js:256-264`、`config.yaml:203-216` | 无 | parity 只登记了「项目设置」下的网络隔离 |
| R4 | **集群级告警消息 / 告警策略 / 策略详情** | `routes/index.js:218-225`、`detail.js:77-80` | 仅项目级 | parity monitoring 一节（L110–L115）只覆盖项目作用域 |
| R5 | **节点列表的 GPU/GPU 显存/Pod/XPU/GPU 虚拟化模式/时间同步列 + 节点总览面板 + 列筛选** | `Nodes/index.jsx:332-373, 426-457, 514-769, 892-973` | `ClusterListPage.tsx:97-182` 只有 5 列 | parity 的「节点列表」条目（L40）只登记了「节点排空、污点编辑、Pod 列表」，**没提这些列** |
| R6 | **节点详情的运行状态/元数据/事件页签与 4 个操作**（终端、编辑标签、编辑污点、vGPU） | `Nodes/Detail/routes.js:26-45`、`Nodes/Detail/index.jsx:122-175` | `NodeDetailPage.tsx:20-22` 注释只写了 pods/monitoring/events 三项未迁，代码里连 events 也没有 | parity「节点列表」只登记 Pod 列表；**运行状态页签与编辑标签/污点操作没有登记** |
| R7 | **系统组件详情页**（副本数 + Pod 列表） | `ServiceComponents/Detail/routes.js:25-33` | 无 | parity「系统组件」（L35）只登记「组件重启/日志查看」「按模块分组」 |
| R8 | **项目详情页 4 页签 + 配额/LimitRange 编辑** | `Projects/Detail/routes.js:28-49`、`Projects/Detail/index.jsx:100-124` | `namespaces/` 无 `$name.tsx` | parity「项目列表」（L43）只登记「项目创建、编辑、删除」 |
| R9 | **存储类型详情的关联 PVC 列表** | `StorageClasses/Detail/routes.js:24-31` | `StorageClassDetailPage.tsx:53-89` 无 | parity「存储类型」（L45）只登记创建/编辑/设为默认 |
| R10 | **集群级全命名空间 PVC 列表** | `Storage/Volumes/Volume/index.jsx:152-249` | 无（集群作用域只有 PV） | parity「持久卷」（L42）只讲 PV；**集群级 PVC 从未被提到** |
| R11 | **快照三件套 6 页 + JuiceFS 共享存储 3 页签** | `VolumeSnapshots/routes.js`、`VolumeSnapshotClasses/index.jsx`、`Storage/JuiceFS/index.jsx:56-82` | 无 | parity 完全没有存储快照与共享存储条目 |
| R12 | **集群日志收集的 3 类页签 + 收集器详情页** | `LogCollections/index.jsx:96-118`、`LogCollections/Detail/routes.js:25-32` | `ClusterLogCollectionsPage.tsx:51-111` 单页三段 | parity「集群日志收集」（L37）只登记「修改收集器/输入/输出」与「日志全文检索」 |
| R13 | **集群网关设置 + 网关详情 5 页签** | `Gateway/index.jsx:53-68`、`Gateway/Detail/routes.js:27-58` | 无 | parity 只在项目设置里登记了网关 |
| R14 | **GPU 卡列表 / GPU 卡详情 / GPU 资源监控 3 页签** | `routes/index.js:111-114, 210-213`、`detail.js:58-59` | 无 | parity 全篇没有 GPU 页面条目（只有概览里的 GPU 卡数） |
| R15 | **集群角色（`roles`/`roles/:name`）在集群作用域没有入口** | `routes/index.js:241-245`、`detail.js:73-75` | 只在平台 `access/clusterroles`，且固定读 host | parity cluster-management 没有「集群角色」页；「集群成员」条目（L33）写的是「集群角色本身的规则（见平台角色详情）」，等于把 per-cluster 的角色列表算作了平台角色 |
| R16 | **兜底 404 路由** | `console/src/pages/console/routes/index.js:28, 41`（`/404` + `from: '*' → /404`） | `src/routes/` 下无 `404`/`$.tsx`（已枚举目录确认） | 未登记；错 URL 在集群作用域内没有落点 |
| R17 | **节点详情「容器组」的文档与实现不一致** | 老有 Pod 页签 | 代码无（parity L40 已登记为有意不迁移） | `area-migration-plan.md` §4.2（L134）写「详情含属性/标签/**容器组**」，与代码和 parity 都矛盾 —— 属文档漂移，需复核 |

---

## 5. 架构级缺失（不是「页面没做」，是能力层没有）

| 能力 | 老 console 证据 | 新 UI | 影响 |
| --- | --- | --- | --- |
| 容器终端 / kubectl / 节点 shell | `console/src/components/Terminal/index.jsx:36` 用 `getWebSocketProtocol()` 拼 `ws(s)://` 连接；入口见 `Nodes/index.jsx:120-127`（节点）、`Nodes/Detail/index.jsx:133-142`、`Overview/Dashboard/Tools/index.jsx:44-73` | `packages/api-client/src` 无 exec/logs/stream 端点，`server/src/proxy.ts` 无 WebSocket upgrade（**Lead 已核实**） | 节点/容器/网关日志页签、终端、kubectl 一律无法实现；这是 §2.2、§2.5、§2.7 多个缺口的共同根因 |
| 容器日志实时 tail | 老 `projects/containers/Pods/Containers/Detail`、`Gateway/Detail/GatewayLog/index.jsx:499` | 无 | 同上 |
| Pod 详情页签（日志/终端/环境变量/事件/容器） | 老 `projects/containers/Pods/Detail` | 所有负载详情共用 `pages/app-workloads/WorkloadDetailPage.tsx` 一个通用组件，无页签（**Lead 已核实**） | 集群级 Pod 页即使补上，详情也是「通用负载详情」，不等于老的 Pod 详情 |
| 通用交互组件：`EditMode`/`EditForms`（内联编辑）、`DiffYaml`（变更 diff）、`MoreActions`（行内更多操作）、`ToggleView`（卡片/列表切换）、`TextPreview`、`Tree`、`Charts`/`Graph` | `00-inventory.md:140-150` | 无 | 直接决定了「详情页内联编辑」「YAML diff」「图表趋势」这几类功能在集群作用域没有承载 |

---

## 6. 规模总结

**集群作用域：老 console 54 条路由/页（37 个导航叶子项）→ 新 UI 13 个页面。**

- **页面级**：**真缺失 35**、有替代 7、已迁移 10、有意不迁移 2（`volumes` 的 PVC 半边计入真缺失）。
  其中成体系的三块——集群级应用负载 8 页、集群级配置 3 页、集群级网络 2 页+1 详情——是 **13 个真缺失**，占真缺失的 37%。
- **功能级**：已迁移/有替代的 17 个页面上共 **74 项**功能缺口（§2 各表逐行计数：概览 7、节点列表 19、节点详情 12、系统组件 4、项目 8、集群监控 7、设置组 6、日志收集 4、存储 7）。
- **疑似回归**：**17 项**（§4 R1–R17），其中 R1–R4（集群级负载/配置/网络/告警整块）与 R14（GPU 三页）是**整块未登记**，不是单点遗漏。
- **架构级**：**4 项**（终端/kubectl、日志 tail、Pod 详情页签、通用交互组件），决定了其中至少 10 个功能缺口无法以「补页面」的方式解决。
