# 项目作用域缺口分析（老 `/:workspace/clusters/:cluster/projects/:namespace` → 新 UI）

> 作用域：老 console 项目作用域下全部页面与功能。
> 老源码：`console/src/pages/projects/routes/{index,detail,grayrelease}.js`、`console/src/pages/projects/containers/**`、`console/src/core/containers/Base/Detail/**`。
> 新源码：`console/kube-frontend/apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/`、`src/pages/{app-workloads,configmaps,secrets,serviceaccounts,storage,monitoring,project,settings}/**`、`console/packages/ai-kit/src/schema/ResourceList.tsx`。
> 判定以老 console 源码为准（`legacy-ui-migration-guide.md:29-37`），每个结论给 `路径:行号`。未读到的一律写「未核实」。

## 0. 两侧规模对照

| 项 | 老 console | 新 UI |
| --- | --- | --- |
| 路由条数 | 35（`routes/index.js:57-165` 28 条含 2 条 index 重定向 + `routes/detail.js:40-121` 20 条详情 + `routes/grayrelease.js:25-38` 2 条子页） | 35 叶子路由 = 22 个列表页 + 13 个 `$name` 详情（`00-inventory.md:132`） |
| 详情页形态 | 每类资源一个详情页 + **左侧信息栏 + 顶部页签**（`core/containers/Base/Detail/index.jsx:168-189`） | **无页签**，单页纵向分区（`WorkloadDetailPage.tsx:85-459`、`StorageDetailPage.tsx:53-126`） |
| 模块开关 | `config.yaml:417-520` 声明各页依赖的 `clusterModule` | 无模块概念 |
| 模块实际状态 | openpitrix / devops / servicemesh / edgeruntime 全为 false（`docs/plans/area-migration-plan.md:1038`；`area-migration-plan.md:171`、`:173`） | — |

**关键结论：新 UI 的页面数量并不比老 console 少（35 vs 35），缺的是「详情页的深度」——页签、子页面、行内操作、以及一个独立的容器详情页。**

## 1. 页面级缺口表

| 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 项目概览 | `/overview` | `overview` | 已迁移 | 见 §2.1，缺 2 个区块 |
| 应用（自制） | `/applications/composing` | 无 | **真缺失** | CRD 应用（`CRDAppStore`，`Applications/CRDApps.jsx:29-33`），**不依赖 openpitrix**；`50-appendix-mapping.md:166` 亦如此标注 |
| 应用（自制）详情 | `/applications/composing/:name` | 无 | **真缺失** | 老详情含组件/灰度/流量治理/链路追踪 4 个页签（`Applications/CRDAppDetail/routes.js`，58 行；子目录 `Components/GrayRelease/TrafficManangement/Tracing`） |
| 应用（模板） | `/applications/template` | 无 | 有意不迁移 | 依赖 openpitrix，模块关闭（`area-migration-plan.md:171`；`OPApps.jsx:45` 处 `hasKSModule('openpitrix')` 自检） |
| 应用（模板）详情 | `/applications/template/:id` | 无 | 有意不迁移 | 同上（`OPAppDetail/routes.js`，49 行） |
| 部署 | `/deployments(+:name)` | `deployments(+$name)` | 已迁移 | 见 §2.2 |
| 有状态副本集 | `/statefulsets(+:name)` | `statefulsets(+$name)` | 已迁移 | 见 §2.2 |
| 守护进程集 | `/daemonsets(+:name)` | `daemonsets(+$name)` | 已迁移 | 见 §2.2 |
| 容器组 | `/pods` | `pods` | 已迁移 | 见 §2.3 |
| 容器组详情 | `/pods/:podName` | `pods/$name` | 已迁移 | 页签全丢，见 §2.3 |
| **容器详情** | `/pods/:podName/containers/:containerName` | 无 | **真缺失** | 独立页面：4 个页签 + 终端（`Pods/Containers/routes.js:26-51`、`Detail.jsx:61-69`），详见 §2.4 |
| 任务 | `/jobs(+:name)` | `jobs(+$name)` | 已迁移 | 见 §2.2 |
| 定时任务 | `/cronjobs(+:name)` | `cronjobs(+$name)` | 已迁移 | 见 §2.2 |
| 服务 | `/services(+:name)` | `services(+$name)` | 已迁移 | 见 §2.2 |
| 应用路由 | `/ingresses(+:name)` | `ingresses(+$name)` | 已迁移 | 见 §2.2 |
| 镜像构建器 | `/s2ibuilders(+:name)` | 无 | 有意不迁移 | 依赖 devops，模块关闭（`config.yaml:469-474` `clusterModule: devops`；`area-migration-plan.md:1038`） |
| 灰度发布 | `/grayrelease`（cates / jobs） | 无 | 有意不迁移 | 依赖 servicemesh，模块关闭（`config.yaml:462-468`；`area-migration-plan.md:173`） |
| 存储卷 | `/volumes(+:name)` | `persistentvolumeclaims(+$name)` | 有替代 | 改名。见 §2.5，详情页页签全丢 |
| 存储卷快照 | `/volume-snapshots(+:name)` | `volumesnapshots(+$name)` | 有替代 | 改名。见 §2.5 |
| 项目基本信息 | `/base-info` | `baseinfo` | 已迁移 | 见 §2.7 |
| 网络隔离 | `/networkpolicies` | `networkpolicies` | 有替代（**不等价**） | 老页是「隔离开关 + 全部规则聚合视图」，新页是「隔离开关 + NetworkPolicy 对象列表」，见 §2.7 |
| 网络策略详情 | `/networkpolicies/:name` | 无 | **真缺失** | 老详情有出站/入站规则查看器（`Network/Policies/Detail/routes.js:19-36`、`Viewer/index.jsx` 286 行） |
| 配置字典 | `/configmaps(+:name)` | `configmaps(+$name)` | 已迁移 | 已登记差异见 `page-parity-report.md:48-59` |
| 保密字典 | `/secrets(+:name)` | `secrets(+$name)` | 已迁移 | 已登记差异见 `page-parity-report.md:61-72` |
| 服务账户 | `/serviceaccounts`、`/serviceAccounts/:name` | `serviceaccounts(+$name)` | 已迁移 | 已登记差异见 `page-parity-report.md:74-86` |
| 项目角色 | `/roles` | `roles` | 已迁移 | 见 §2.7 |
| 角色详情 | `/roles/:name` | 无（弹窗替代） | 有替代（**不等价**） | 老详情 2 个页签：权限列表 + 已授权用户（`Roles/Detail/routes.js:26-36`）；新只有权限表格弹窗（`SettingsListPage.tsx:368-406`） |
| 项目成员 | `/members` | `members` | 已迁移 | 邀请/改角色/移除**已实现**（`SettingsListPage.tsx:292-324`），优于 `page-parity-report.md:124` 的登记 |
| 日志收集 | `/log-collections` | `log-collections` | 有替代 | 见 §2.7 |
| 网关 | `/gateways` | `gateways` | 有替代（**不等价**） | 见 §2.7 |
| 网关详情 | `/gateways/:gatewayName` | 无 | **真缺失** | 复用集群网关详情组件（`routes/detail.js:19,113-116`） |
| 告警策略 | `/alert-rules(+:name, builtin)` | `alertingrules` | 有替代 | 3.4 集群自动切到 RuleGroup 页（`MonitoringListPage.tsx:41-49`） |
| 告警策略详情 | `/alert-rules/:name` | 无（弹窗替代） | 有替代（**不等价**） | 老详情 2 页签：告警规则 + 告警消息（`Alerting/Policies/Detail/routes.js:26-36`）；新只有字段弹窗 |
| 告警消息 | `/alerts` | `alerts` | 已迁移 | 已登记 `page-parity-report.md:114` |
| 自定义监控 | `/custom-monitoring` | 无 | **真缺失** | 仪表盘列表 + 创建/编辑/删除（`CustomMonitoring/index.jsx:19-80`、`CreateDashborad`、`EditDashborad`），无模块门禁（`config.yaml:493-497`） |
| 404 兜底 | `routes/index.js:162` | 无 | **真缺失** | 新 `routes/` 下无 `$.tsx`/404 路由 |

## 2. 功能级缺口表

### 2.1 项目概览

老页 `Overview/index.jsx:55-81` 的 7 个区块 → 新 `ProjectOverviewPage.tsx`。

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 概览 | 项目基本信息（名称/别名/描述/**企业空间链接**/集群/创建者） | 有名称/别名/创建者/创建时间/描述；**缺企业空间（workspace）跳转链接、缺集群字段** | 轻微缺失 | 老 `Overview/BaseInfo/index.jsx:44-58`（workspace 渲染为 `Link` 到 `/workspaces/:ws/overview`）；新 `ProjectOverviewPage.tsx:58-69` |
| 概览 | 资源配额 used/hard | 有，且加进度条 | 无 | 新 `ProjectOverviewPage.tsx:71-100` |
| 概览 | 默认容器配额 LimitRange | 有 | 无 | 新 `ProjectOverviewPage.tsx:102-123` |
| 概览 | **应用资源用量 + 物理资源用量图表**（11 项对象计数 + CPU/内存/GPU 曲线，可选 12h 区间，30s 自动刷新） | 无 | **真缺失（疑似回归）** | 老 `Overview/ResourceUsage/index.jsx:19-80`（`APP_RESOURCE_METRIC_TYPES` 11 项、`PHYSICAL_RESOURCE_METRIC_TYPES` 4 项）、`Overview/index.jsx:72` |
| 概览 | 用量排行（按工作负载排 CPU/内存/出网/入网） | 无 | 已登记 | `page-parity-report.md:126`「用量排行（需要监控区间查询）」 |
| 概览 | 应用列表（openpitrix） | 无 | 已登记 | `page-parity-report.md:126` |
| 概览 | **提示卡片**（如何邀请成员 / 如何设置网关，跳文档） | 无 | **真缺失（疑似回归）** | 老 `Overview/Help/index.jsx:19-53` |
| 概览 | 快速入口 | 有（5 个胶囊链接） | 无 | 新 `ProjectOverviewPage.tsx:125-141` |

### 2.2 应用负载（8 类共用列表 + 各类详情）

#### 2.2.1 列表通用能力（老 `components/Tables/Base` + `HOCs/withList` vs 新 `ResourceList`）

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 全部负载列表 | 列显隐设置（勾选列，localStorage 持久化 `hide-columns`） | 无 | 已登记 | 老 `components/Tables/Base/index.jsx:85-94`（读 localStorage）、`Base/CustomColumns/index.jsx` 116 行；登记处 `page-parity-report.md:96`「不做列显隐与列宽拖拽」 |
| 全部负载列表 | 分页档位 10/20/50/100 | 固定 10 | 已登记 | 老 `utils/constants.js:1226` `PAGESIZE_OPTION = [10,20,50,100]`；登记处 `legacy-ui-migration-guide.md:84-85` |
| 全部负载列表 | 排序（名称/时间，`sorter: true`） | 有（`sortableKeys: ['name','createTime']`） | 无 | 新 `WorkloadListPage.tsx:123` |
| 全部负载列表 | 批量选择 + 批量停止/删除 | 有 | 无 | 新 `WorkloadListPage.tsx:122,135-158,359-368` |
| 全部负载列表 | 行内「更多操作」下拉 | 有（`rowActions`） | 无 | 新 `WorkloadListPage.tsx:246-285` |
| 全部负载列表 | 页头 Banner（模块说明 + 问号 tips） | 只有 title + description，**tips 无** | 轻微缺失 | 老 `components/Cards/Banner`（各页 `<Banner {...bannerProps} />`，如 `Pods/index.jsx:205`）；新 `WorkloadListPage.tsx:116-117` |
| 全部负载列表 | 卡片/列表视图切换（ToggleView） | — | **不适用** | 老项目作用域未使用 `ToggleView`（`grep ToggleView pages/projects/containers` 无命中） |
| 容器组列表 | **按 Pod 状态筛选**（`PODS_STATUS` 下拉） | 无筛选器（只有项目筛选） | **真缺失** | 老 `Pods/index.jsx:120` `filters: this.getPodsStatus()`；新 `WorkloadListPage.tsx:121` 只有 `projectFilterControl` |
| 容器组列表 | 列：名称 / 状态 / **节点（链到节点详情）** / **Pod IP** / 应用 / 更新时间 | 名称(+应用) / 状态 / 创建时间 | **真缺失 2 列 + 时间语义变化** | 老 `Pods/index.jsx:106-157`（NODE 列 `renderNode` 链 `/clusters/:cluster/nodes/:node`，`:186-195`）；新 `WorkloadListPage.tsx:159-240` |
| 容器组列表 | 状态副文案（失败原因 `StatusReason`） | 无（只有 Badge） | 轻微缺失 | 老 `Pods/index.jsx:82-97`；新 `WorkloadListPage.tsx:184-196` |
| 部署列表 | 列：名称 / 状态 / 应用 / **更新时间** | 名称(+应用) / 状态 / 就绪 / **创建时间** | 时间语义变化 | 老 `Deployments/index.jsx:179-219`；新 `WorkloadListPage.tsx:233-239` |
| 服务列表 | 端口、服务类型等列 | 有 ports 列（`port→targetPort`） | 近似等价 | 新 `WorkloadListPage.tsx:218-232` |

#### 2.2.2 各类详情页（老「左栏 + 页签」→ 新单页分区）

老详情页统一结构：左侧信息栏（名称/描述/标签/属性 + 「更多操作」）`core/containers/Base/Detail/index.jsx:168-189`，右侧页签 `renderNav` `:143-166`。

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 部署详情 | 6 个页签：资源状态 / 版本记录 / 元数据 / 监控 / 环境变量 / 事件 | 单页：属性 + 自动伸缩 + 关联容器组 + 版本历史 + 容器镜像 | **缺 5 个页签** | 老 `Deployments/Detail/routes.js:30-59`；新 `WorkloadDetailPage.tsx:85-459` |
| 部署详情 | 版本记录（RevisionControl，含「再次部署」指定副本/镜像） | 有版本表 + 回滚；**无 diff、无「再次部署」** | 已登记 | 老 `Deployments/Detail/RevisionControl/index.jsx` 173 行；新 `WorkloadDetailPage.tsx:393-440`；登记处 `page-parity-report.md:98` |
| 部署详情 | 监控图表（CPU/内存/网络曲线） | 无 | **真缺失** | 老 `Deployments/Detail/Monitoring/index.jsx` 258 行；`routes.js:48-50` |
| 部署详情 | 环境变量（容器 env 列表） | 无 | **真缺失** | 老 `core/containers/Base/Detail/EnvVariables/index.jsx` 104 行；`routes.js:54-56` |
| 部署详情 | 事件列表 | 无 | **真缺失** | 老 `core/containers/Base/Detail/Events/index.jsx` 81 行；`routes.js:59` |
| 部署详情 | 元数据（annotations 全量） | 无（只能开「编辑 YAML」看） | **真缺失** | 老 `core/containers/Base/Detail/Metadata/index.jsx` 42 行；`routes.js:42-44` |
| 部署详情 | 资源状态（副本/Pod 列表/HPA） | 部分（关联容器组表） | 近似等价 | 老 `Deployments/Detail/ResourceStatus/index.jsx` 244 行；新 `WorkloadDetailPage.tsx:339-385` |
| 有状态副本集详情 | 同上 6 页签 | 属性 + 关联服务 + 关联容器组 + 容器镜像 | 缺 5 个页签 | 老 `StatefulSets/Detail/routes.js:30-59`；新 `WorkloadDetailPage.tsx:315-332` |
| 守护进程集详情 | 同上 6 页签 | 属性 + 关联容器组 | 缺 5 个页签 | 老 `DaemonSets/Detail/routes.js:30-59` |
| 任务详情 | 5 页签：执行记录 / 资源状态 / 元数据 / 环境变量 / 事件 | 属性 + 执行记录（`jobs-detail:runs`） | 缺 3 页签（元数据/环境变量/事件）；执行记录有 | 老 `Jobs/Detail/routes.js:29-52`、`Jobs/Detail/ExcuteRecords/index.jsx` 190 行；新 `WorkloadDetailPage.tsx:263-307` |
| 定时任务详情 | 3 页签：运行记录 / 元数据 / 事件 | 属性 + 暂停/恢复 | **缺运行记录**（老 `CronJobs/Detail/JobRecords` 168 行） | 老 `CronJobs/Detail/routes.js:27-38`；新 `WorkloadListPage.tsx:283`（只有 suspend） |
| 服务详情 | 3 页签：资源状态 / 元数据 / 事件 + **拓扑图** | 属性 + 端口表 | 缺 3 页签 + 拓扑 | 老 `Services/Detail/routes.js:27-38`、`Services/Topology/**`（12 文件）；新 `WorkloadDetailPage.tsx:229-255` |
| 应用路由详情 | 3 页签：资源状态 / 元数据 / 事件 | 属性 + 规则编辑 | 缺 3 页签 | 老 `Routes/Detail/routes.js:27-38`、`Routes/Detail/ResourceStatus/Rule.jsx` 110 行 |
| 全部详情页 | 左栏标签（labels）展示 | 无 | **真缺失** | 老 `core/containers/Base/Detail/BaseInfo/index.jsx:90-105`（`renderLabels`）；新详情页只有属性 `dl` |
| 全部详情页 | 左栏属性区（12-13 项，含资源 requests/limits 聚合） | 部分（属性 `detail.attributes`） | 部分等价，未逐项核对 | 老 `Pods/Detail/index.jsx:105-182`；新 `WorkloadDetailPage.tsx:180-192` |
| 全部详情页 | 「更多操作」下拉（`BtnGroup` 限 2 个直显，其余进 More） | 全部平铺为按钮 | 交互差异，非功能缺失 | 老 `BaseInfo/BtnGroup/index.jsx:58-107`；新 `WorkloadDetailPage.tsx:124-157` |
| 全部详情页 | 详情页实时刷新（websocket watch，MODIFIED 时原地更新） | 无（仅 react-query 缓存） | **真缺失** | 老 `pages/projects/containers/Base/Detail/index.jsx:62-92`（`initWebsocket` + `reaction`） |
| 全部详情页 | 资源 404 时自动回退到列表 | 有错误面板 + 重试 | 近似等价 | 老 `core/containers/Base/Detail/index.jsx:63-95`；新 `WorkloadDetailPage.tsx:105-107` |

### 2.3 容器组详情（`pods/$name`）

老 `Pods/Detail/routes.js:28-59` 有 6 个页签；新 `pods/$name.tsx` 复用 `WorkloadDetailPage`。

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 容器组详情 | 资源状态（**容器卡片，每个容器可点进容器详情** + 卷卡片） | 容器只列镜像字符串，**不可点** | **真缺失（含入口）** | 老 `Pods/Detail/ResourceStatus.jsx:45-74`（`ContainersCard` 传 `prefix/podName`）、`components/Cards/Containers`；新 `WorkloadDetailPage.tsx:442-457` |
| 容器组详情 | 调度信息页签（节点亲和/污点/容忍/资源请求，含图表） | 无 | **真缺失** | 老 `Pods/Detail/routes.js:35-39`、`Pods/Detail/ScheduleInfo/index.jsx` 362 行 + `Chart.jsx` |
| 容器组详情 | 元数据页签 | 无 | **真缺失** | `routes.js:40-45` |
| 容器组详情 | 监控页签（Pod CPU/内存/网络曲线） | 无 | **真缺失** | `routes.js:46-51`、`Pods/Detail/Monitoring.jsx` 135 行 |
| 容器组详情 | 环境变量页签 | 无 | **真缺失** | `routes.js:52-57` |
| 容器组详情 | 事件页签 | 无 | **真缺失** | `routes.js:58` |
| 容器组详情 | 操作：编辑 YAML / 删除 | 有（+ 编辑信息） | 无 | 老 `Pods/Detail/index.jsx:79-103`；新 `WorkloadDetailPage.tsx:126-157` |
| 容器组详情 | 属性 13 项：集群/项目/应用/状态/Pod IP/节点/节点 IP/重启/QoS/创建时间/创建者/**requests/limits** | 属性 11 项：集群/项目/应用/创建时间/创建者 + podStatus/node/podIP/hostIP/qosClass/restarts | **缺 requests / limits（资源请求与限额）** | 老 `Pods/Detail/index.jsx:128-181`（`:161-168` 为 requests/limits）；新 `api-client/src/workloads.ts:245-261` + `WorkloadDetailPage.tsx:163-192` |

### 2.4 独立容器详情页（`pods/:podName/containers/:containerName`）—— **整页缺失**

老页是一个完整的一级页面：独立路由（`routes/detail.js:62-64`）、独立 store（`stores/container`）、左栏 12 项属性 + 终端按钮、4 个页签。

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 容器详情 | **页面本身**（路由 + 左栏 + 页签容器） | 无 | **真缺失** | 老 `Pods/Containers/Detail.jsx:35-231`；新 `routes/.../pods/` 下只有 `index.tsx`/`$name.tsx`/`route.tsx` |
| 容器详情 | 属性 12 项：集群/项目/应用/状态/镜像/镜像 ID/端口/命令/requests/limits/拉取策略/重启次数 | 无 | **真缺失** | 老 `Detail.jsx:108-179` |
| 容器详情 | **容器终端**（新窗口打开 `/terminal/cluster/.../containers/...`） | 无 | **真缺失（架构级）** | 老 `Detail.jsx:61-69,181-200`（`window.open`）；新 api-client 无 exec/stream 端点、BFF 无 WS upgrade（Lead 已核） |
| 容器详情 | 资源状态页签：**探针卡片**（liveness/readiness） | 无 | **真缺失** | 老 `Pods/Containers/ResourceStatus.jsx:49-57`、`projects/components/Cards/Probe` |
| 容器详情 | 资源状态页签：**生命周期卡片**（postStart/preStop） | 无 | **真缺失** | `ResourceStatus.jsx:59-67`、`projects/components/Cards/Lifecycle` |
| 容器详情 | 资源状态页签：**卷挂载卡片** | 无 | **真缺失** | `ResourceStatus.jsx:34-47` |
| 容器详情 | 监控页签：4 条曲线（GPU/GPU 内存/CPU/内存） | 无 | **真缺失** | `Pods/Containers/Monitoring.jsx:26-85`（`container_gpu_usage` 等 4 个 metric） |
| 容器详情 | 环境变量页签 | 无 | **真缺失** | `Pods/Containers/routes.js:39-44` |
| 容器详情 | 容器日志页签（实时日志流，含「该容器不支持日志」兜底） | 无 | **真缺失（架构级）** | `Pods/Containers/routes.js:45-50`、`Logs.jsx:33-43`、`components/Cards/ContainerLog` |
| 容器详情 | 面包屑「返回容器组」 | 无 | 真缺失 | `Detail.jsx:216-221` |

> 注：任务描述提到的「文件浏览」页签在老源码中**未核实到**——`Pods/Containers/routes.js:26-51` 只有 resource-status / monitors / env / logs 四个页签，终端是左栏按钮而非页签。文件浏览可能在终端窗口内（`src/pages/terminal`），**未核实**。

### 2.5 存储（volumes → persistentvolumeclaims）

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 存储卷详情 | 4 页签：资源状态（含**用量卡片**）/ 元数据 / 事件 / **快照** | 单页属性区（11 项） | **缺 4 个页签** | 老 `Volumes/Detail/routes.js:28-51`、`Volumes/Detail/ResourceStatus/UsageCard/index.jsx` 176 行、`Volumes/Detail/Snapshots/index.jsx` 135 行；新 `StorageDetailPage.tsx:97-124` |
| 存储卷详情 | 快照列表 + 创建快照 | 无 | 已登记（列表侧） | `page-parity-report.md:108`「不做快照创建」；但**详情页的快照页签本身未登记** |
| 存储卷详情 | 行操作 6 项：编辑信息 / 编辑 YAML / **克隆** / **创建快照** / 扩容 / 删除 | 只有编辑 YAML + 删除 | **缺 4 项** | 老 `Volumes/Detail/index.jsx:131-202`（`edit`/`editYaml`/`clone`/`snapshot`/`expand`/`delete`）；新 `StorageDetailPage.tsx:87-94` |
| 存储卷详情 | 扩容（`allowVolumeExpansion` 门控） | 有，但**只在列表行操作**，详情页无入口 | 位置差异 | 新 `StorageListPage.tsx:218-220,310-320`（`expandableClasses` 门控）；`StorageDetailPage.tsx` 全文无 expand |
| 存储卷快照详情 | 2 页签：数据来源 / 事件 | 单页属性区 | 缺 2 个页签 | 老 `VolumeSnapshots/Detail/routes.js:26-37`、`Source/index.jsx` 149 行；新 `StorageDetailPage.tsx:112-117` |
| 存储列表 | 创建存储卷 | 无 | 已登记 | `page-parity-report.md:108`「不在列表创建存储卷」 |

### 2.6 监控告警

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 告警策略列表 | 列：名称 / 策略状态 / 规则状态 / 耗时 / 最近检测时间 | 列：名称 / 状态 / 规则数 / 最近评估 | 近似等价 | 老 `Alerting/Policies/index.jsx:316-370`；新 `MonitoringListPage.tsx:130-166` |
| 告警策略列表 | **创建策略**（`alerting.policy.create`） | 无 | **真缺失** | 老 `Alerting/Policies/index.jsx:389-393`、`:402-409` |
| 告警策略列表 | 行操作：编辑信息 / 编辑 YAML / **编辑告警规则** / 停用 / 删除 | 只有 detail / enable / disable / delete | **缺编辑信息、编辑 YAML、编辑规则** | 老 `Alerting/Policies/index.jsx:112-191`；新 `MonitoringListPage.tsx:170-184` |
| 告警策略列表 | 内置(builtin)与自定义分组（`?type=builtin`） | 无 | 已登记 | 老 `Alerting/Policies/index.jsx:45`；登记处 `page-parity-report.md:115` |
| 告警策略详情 | 2 页签：告警规则（RuleList 340 行 Item）/ 告警消息 | 字段弹窗 | 不等价 | 老 `Alerting/Policies/Detail/routes.js:26-36`；新 `MonitoringListPage.tsx:236-244` |
| 告警消息列表 | 静默 / 通知 / 批量删除 | 无 | 已登记 | `page-parity-report.md:114` |
| 自定义监控 | 仪表盘列表 + 新建/编辑/删除仪表盘 | 无 | **真缺失** | 老 `CustomMonitoring/index.jsx:19-137`、`CreateDashborad/index.jsx` 107 行、`EditDashborad/index.jsx` 77 行 |

### 2.7 项目设置

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 基本信息 | 项目属性 + **角色数 / 成员数 / 服务数**统计 | 属性 6 项，**无统计** | 真缺失（轻） | 老 `BaseInfo/index.jsx:196-215`（`roleCount/memberCount/serviceCount`）、`ProjectInfo/index.jsx` 138 行；新 `ProjectInfoPage.tsx:56-63` |
| 基本信息 | **编辑项目信息** | 无 | 已登记 | `page-parity-report.md:121` |
| 基本信息 | **编辑项目配额** | 有（`QuotaEditDialog`） | 已实现，优于登记 | 新 `ProjectInfoPage.tsx:69-71,103-108` |
| 基本信息 | **默认容器配额（LimitRange）区块 + 编辑** | 区块无（概览页有只读） | 已登记 | `page-parity-report.md:121`「默认容器配额（LimitRange）区块」 |
| 基本信息 | **删除项目** | 无 | 已登记 | `page-parity-report.md:121` |
| 基本信息 | 页面 tips（配额用法 / 默认容器配额说明） | 无 | 轻微缺失 | 老 `BaseInfo/index.jsx:68-78` |
| 网络隔离 | 隔离开关（annotation 写入） | 有（`Switch`） | 无 | 老 `Network/Policies/index.jsx:70-92`；新 `NetworkIsolationPage.tsx:151-167` |
| 网络隔离 | **规则聚合视图**：内部白名单 / 外部白名单，分 egress/ingress 渲染成「项目→项目」「IP 段+端口」 | 只有 NetworkPolicy 对象表（名称/podSelector/类型/规则数） | **不等价（真缺失）** | 老 `Network/Policies/RuleInfo/index.jsx:145-365`；新 `NetworkIsolationPage.tsx:81-119` |
| 网络隔离 | **新增白名单条目 / 新增 IP 段条目 / 删除条目** | 只有「创建 NetworkPolicy / 删除策略」 | **不等价** | 老 `RuleInfo/index.jsx:108-131,297-328`；新 `NetworkIsolationPage.tsx:52-61,190-198` |
| 网络隔离 | 策略编辑（YAML/信息） | 无 | 已登记（仅编辑部分） | `page-parity-report.md:125` |
| 网络隔离 | 多规则策略 / ipBlock | 无 | 已登记 | `page-parity-report.md:125` |
| 项目角色 | 列表：名称/别名/描述/规则数/创建时间 | 有 | 无 | 老 `Roles/index.jsx:124-132`；新 `SettingsListPage.tsx:86-119` |
| 项目角色 | 创建角色（复制模板） | 有（`RoleCreateDialog`） | 已实现，优于登记 | 新 `SettingsListPage.tsx:161-163,285-290`；登记处 `page-parity-report.md:128` |
| 项目角色 | 编辑信息 / 编辑权限 / 删除 | 有 | 无 | 新 `SettingsListPage.tsx:189-206` |
| 角色详情 | **权限列表页签** | 弹窗表格（apiGroups/resources/verbs） | 近似等价 | 老 `Roles/Detail/routes.js:26-30`；新 `SettingsListPage.tsx:368-406` |
| 角色详情 | **已授权用户页签** | 无 | **真缺失（疑似回归）** | 老 `Roles/Detail/routes.js:32-36`、`Roles/Detail/index.jsx` 182 行 |
| 项目成员 | 列表：名称/状态/角色/最近活跃 | 有 | 无 | 老 `Members/index.jsx` 212 行；新 `SettingsListPage.tsx:120-156` |
| 项目成员 | 邀请成员 / 修改角色 / 移出项目 | **已实现** | 优于登记 | 新 `SettingsListPage.tsx:173-180,292-324`、`MemberDialog.tsx` 143 行；登记处 `page-parity-report.md:124` |
| 日志收集 | 卷上日志采集开关（`logging.kubesphere.io/logsidecar-injection` 标签），受 `hasClusterModule(logging)` 与 `disabledLoggingSidecarNamespace` 门控 | 有开关 + 存储后端只读 | 近似等价 | 老 `LogCollection/index.jsx:41-89`、`LogCollection/LogCollection/index.jsx:37-110`；新 `LogCollectionPage.tsx:56-131` |
| 日志收集 | 关闭时的确认弹窗 | 有 | 无 | 老 `LogCollection/LogCollection/index.jsx:128-135`；新 `LogCollectionPage.tsx:106-131` |
| 网关 | **集群网关卡片**（标题 + 引导 tooltip + 独立卡片，列表第 0 项） | 无 | **真缺失** | 老 `Gateway/index.jsx:80-87,106-129`（`isCluster = index === 0`） |
| 网关 | 项目网关卡片 + **「查看详情」按钮跳 `/gateways/:gatewayName`** | 无（只有 name/type/address/message 只读 + 创建/删除） | **真缺失** | 老 `Gateway/index.jsx:93-104`（`renderOperations` → `routing.push(url)`）、`:136-142`；新 `GatewayPage.tsx:60-94` |
| 网关 | 修改网关类型/端口/副本数 | 无 | 已登记 | `page-parity-report.md:122` |
| 网关 | 网关日志与监控 | 无 | 已登记 | `page-parity-report.md:122` |

## 3. 疑似回归（老 console 有、新 UI 漏了、且**未见**「有意不迁移」登记，需复核）

| # | 缺口 | 老证据 | 新侧 | 为何算疑似回归 |
| --- | --- | --- | --- | --- |
| R1 | **项目概览的应用/物理资源用量图表** | `Overview/ResourceUsage/index.jsx:19-80`、`Overview/index.jsx:72` | 无（`ProjectOverviewPage.tsx` 全文无图表） | `page-parity-report.md:126` 只登记了「用量排行」和「应用列表」，未提 ResourceUsage 卡片 |
| R2 | **项目概览的提示卡片（Help）** | `Overview/Help/index.jsx:19-53` | 无 | 报告未登记 |
| R3 | **角色详情的「已授权用户」页签** | `Roles/Detail/routes.js:32-36` | 无（弹窗只有规则表） | `page-parity-report.md:127` 只登记「规则的编辑」，未登记已授权用户 |
| R4 | **网络隔离的规则聚合视图与白名单增删** | `Network/Policies/RuleInfo/index.jsx:145-365` | 只有 NP 对象表 | `page-parity-report.md:125` 登记的是「策略的编辑」，把「规则视图」读成「编辑」是范围误判 |
| R5 | **存储卷详情的快照页签** | `Volumes/Detail/routes.js:46-49`、`Snapshots/index.jsx` 135 行 | 无 | `page-parity-report.md:108` 登记的是「列表不做快照创建」，未登记详情页快照页签 |
| R6 | **项目基本信息的角色/成员/服务统计** | `BaseInfo/index.jsx:196-215` | 无 | 报告未登记 |
| R7 | **网关的集群网关卡片 + 项目网关「查看详情」按钮** | `Gateway/index.jsx:80-129`（`renderGatewayCard`，第 0 项为集群网关）、`:93-104`（查看详情） | 无（`GatewayPage.tsx` 只有项目网关只读信息） | `page-parity-report.md:122` 登记的是「修改网关类型/端口/副本数」与「日志监控」，未登记集群网关卡片与详情入口 |
| R8 | **容器组列表的节点列 / Pod IP 列 / 状态筛选** | `Pods/index.jsx:106-157,120` | 无 | 报告 `page-parity-report.md:96` 只登记「列显隐与列宽拖拽」，未登记具体列的缺失 |
| R9 | **告警策略的创建、编辑信息、编辑 YAML、编辑规则** | `Alerting/Policies/index.jsx:112-191,389-409` | 只有 detail/enable/disable/delete | `page-parity-report.md:115` 登记「内置与集群级规则组的编辑」，未登记自定义策略的创建与编辑 |
| R10 | **列表页头 tips（Banner 问号说明）** | 各列表页 `<Banner {...bannerProps} />` | 只有 title+description | 报告未登记 |
| R11 | **详情页 websocket 实时刷新** | `pages/projects/containers/Base/Detail/index.jsx:62-92` | 无 | 报告未登记（可能被视为基础设施而非功能，需 Lead 判定） |
| R12 | **404 兜底路由** | `routes/index.js:162` | 无 | 报告未登记 |

## 4. 规模总结

**本作用域缺口规模：页面级 15 个（真缺失 7 + 不等价替代 5 + 依赖关闭模块 4 中不等价的 3），功能级 66 项（其中实质性缺口 52 项、轻微/近似差异 14 项），疑似回归 12 条。**

拆分口径（按 §1 / §2 表格逐行统计，可复核）：

| 维度 | 数字 | 明细 |
| --- | --- | --- |
| 老路由条目 | 36 | §1 表行数（含 2 条 index 重定向、1 条 404 兜底） |
| 已迁移 | 17 | overview、8 类负载列表、8 类负载详情、configmaps、secrets、serviceaccounts、baseinfo、roles、members、log-collections、gateways、alerts |
| **真缺失（无任何替代）** | **7** | 容器详情页、applications/composing、applications/composing/:name、networkpolicies/:name、gateways/:gatewayName、custom-monitoring、404 兜底 |
| 有替代（8，其中**不等价 5**） | 8 | 等价：volumes、volume-snapshots、alert-rules→alertingrules、alerts。不等价：roles/:name（弹窗缺已授权用户）、alert-rules/:name（弹窗缺规则/消息页签）、networkpolicies 列表（对象表 ≠ 规则聚合视图）、log-collections（仅开关）、gateways（缺集群网关卡片与详情入口） |
| 有意不迁移（依赖已关闭模块） | 4 | applications/template、applications/template/:id（openpitrix）、s2ibuilders（devops）、grayrelease（servicemesh） |
| 功能级对照行 | 94 | §2 全部表格行数 |
| 有差距的行 | 82 | — |
| 其中已登记为「有意不迁移」 | 16 | 引用 `page-parity-report.md` 与 `legacy-ui-migration-guide.md` 的出处 |
| **真缺口** | **66** | 其中实质性 52（页签整块缺失、入口缺失、操作缺失）+ 轻微/近似差异 14（时间语义、按钮平铺、tips 缺失等） |
| 疑似回归 | 12 | 见 §3，全部是「老有、新无、且未见登记」的项 |

按页面汇总的真缺口分布：概览 5 · 负载列表通用+各类详情 28 · 容器组详情 7 · **容器详情页 10** · 存储 6 · 监控告警 7 · 项目设置 19。

> 最要紧的三条：**① 独立容器详情页整页缺失（含终端/日志/监控/探针/生命周期）**；**② 全部工作负载详情页的页签体系（监控/环境变量/事件/元数据/调度信息）未迁移**；**③ 应用（composing）与自定义监控两个页面级功能完全缺失**。
