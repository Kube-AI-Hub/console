# 集群监控 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/monitor.md)

## 概述

一个导航入口、页内五个基础页签：概览 / 物理资源监控 / API Server 监控 / 调度器监控 / 资源用量排行（etcd 接入监控时另有条件 etcd 页签），`?tab=` 可深链，默认概览。页头只有一套时间窗与自动刷新，五个页签共用。概览先给节点在线环图、XPU 厂商构成环图与组件状态 3×2 磁贴，再给「7 行当前用量 + 一张可选指标大图」，最后是两块恢复自旧 console 概览的图表面板：RDMA 状态（health / 端口 / 吞吐 / 错误 4 个指标页签 + 曲线 + 端口异常节点清单）与服务组件监控（APIServer 延迟 / 速率、调度器尝试 / 速率 4 个页签，复用组件查询与身份合并）；物理资源页签把旧 console 的多序列指标合并成 18 张带坐标轴的大图；APIServer / Scheduler 页签承载组件级 range 指标，多序列按 `verb` / `result` / `quantile` 身份分开画；排行页签复用节点用量排行并支持导出 JSON。折线继续用 ai-kit `TrendChart`，构成图用本批新增的 `DonutChart`（recharts）。数据来自 KubeSphere 监控的 range query，概览的用量行由 used/total 两条序列按时间戳相除。集群未就绪时页面不挂载，由集群作用域路由层整页接管为「等待集群加入」，页面内不重复实现等待视图。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-10
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-17
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-18
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-19

## 设计目标与非目标

目标：一个导航入口、五个基础页签 + 条件 etcd 页签，按使用场景拆分并可深链；概览先回答「集群整体是否正常」（节点在线、厂商构成、控制面组件），再回答「资源用在哪」（7 行当前值 + 主图），最后回答「RDMA 织物是否正常」「控制面是否退化」（两块旧 console 的图表面板，多指标页签 + 曲线 + 异常节点清单）；其它页签回答「趋势如何」；构成用环图、趋势用带轴多序列大图，形状与数值同时可读；同一指标的多条身份序列同图比较；步长随窗口放大；缺数据、未上报、无权限与失败各自说清；页签各自降级。

仍然非目标：节点/容器组级下钻、告警阈值线、组件指标的独立路由页、折线缩放与框选、环图的 hover 下钻与扇区筛选、每页签独立时间窗（本批共用页头，登记后续）、RDMA 异常节点点击下钻与端口清单搜索/分页/导出、概览内组件下钻。etcd 的真实健康仍不承诺（只表达是否接入监控）。

## 关键约束

- `GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=…&start=…&end=…&step=…&cluster=…`
- range 返回 `matrix`：`results[].data.result[].values = [[ts, "value"], …]`
- 百分比需要成对的用量/总量序列：`cluster_cpu_usage`/`cluster_cpu_total`、`cluster_memory_usage_wo_cache`/`cluster_memory_total`
- 组件级指标走 `GET /kapis/monitoring.kubesphere.io/v1alpha3/components/{apiserver|scheduler|etcd}?metrics_filter=…&start=…&end=…&step=…&cluster=…`，返回每个 `metric_name` 下的多条 `matrix`，身份在 `data.result[].metric` 的 `verb` / `result` / `quantile` 标签上

- 路由：`/kube-frontend/clusters/$cluster/monitor` 是唯一入口；`validateSearch` 接受 `tab` ∈ `overview|resource|apiserver|scheduler|ranking|etcd`；未知值忽略、默认 `overview`；etcd 页签仅在 `kubesphere-monitoring-system/etcd` ServiceMonitor 探测为 200 时可见，隐藏时 `?tab=etcd` 按 `overview` 渲染；`Route.useSearch()` 读、`Route.useNavigate()` 写，切页签 `navigate({ search: { tab }, replace: true })`（不进浏览器历史）。节点详情复用同页（传入 `node`）时没有页签。
- 图表组件：折线/面积用 ai-kit `TrendChart`（多序列 `series`、`showAxes`/`showGrid`/`interactive`）；构成用新增的 ai-kit `DonutChart`。不在页面内自绘 SVG 环图/饼图/折线。
- recharts 依赖装在独立 pnpm 项目 `console/packages/ai-kit`（`^3.11.0`），**不要加到 kube-frontend workspace**；ai-kit 需先构建（`vite build` + `tsc -p tsconfig.build.json`），再由 `kube-frontend/packages/ui/src/index.ts` 命名导出 `DonutChart` 与类型。
- 每个页签一个主查询：物理资源页签一次 range 查询取 18 张图的指标；APIServer / Scheduler 各自一次 `components/<apiserver|scheduler>` 查询，etcd 页签（可见时）一次 `components/etcd` 查询；排行页签走既有 node 用量排行接口；页头持有时间窗，页签不持有第二套时间窗。
- 只读页面；不改 api-client 既有方法签名。排行导出如需新增参数只加不改，并同步 barrel 导出与契约测试。
- 交互元素用共享 `Button`/`Tabs` + `actionProps`（ai-surface 契约）；图表容器加 `aria-label`（图名）；DonutChart 根 `role="img"`。
- 状态：loading 用 Skeleton（保留已有内容不被整块骨架遮挡的场景按既有约定）；empty 用说明文本；error 用 ResourceErrorPanel（403 无重试）；不得用 0 顶替无数据。
- 排行导出用 Blob + `a.download`，文件名固定 `node.usage.rank.json`，并 `revokeObjectURL`。
- 概览的一次 range 查询还携带 RDMA 4 组指标（`cluster_ib_health`、`cluster_ib_port_up`/`cluster_ib_port_total`、`cluster_ib_tx_bytes`/`cluster_ib_rx_bytes`、`cluster_ib_rx_errors`/`cluster_ib_retrans`），让 RDMA 块与用量块共用同一窗口与时间戳；端口清单是独立清单读取，不并入 range 查询（见 `CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-08`）。
- RDMA 端口清单走路径集群段 `GET /kapis[/clusters/<cluster>]/rdma.kubesphere.io/v1alpha1/ports?limit=-1`（api-client `rdmaPortsApi` 用 `clusterScoped`）；不能用 `?cluster=`（成员集群实测返回 0 条，见 `GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-19`）。
- 概览服务组件监控块复用 `componentMonitorQueries` 的 `useComponentMetrics` / `toComponentCharts`（与 API Server / 调度器页签同一查询与身份合并），概览里不复制第二套请求或按返回顺序配对（见 `CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-09`）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-01 — 内联 SVG，不引入图表库

**为什么**：ai-kit 没有图表库；为了四条折线引入一个库（通常 50KB+ gzip 并带自己的主题体系）比整个监控页 chunk 还大。这里需要的只是「把 N 个点连成线」，即一个 `viewBox` 加一条 `path`。

**被否方案**：引 ECharts/Recharts。它们解决的是坐标轴、缩放、堆叠、tooltip——当前四个指标都不需要。

**何时重新考虑**：需要交互式缩放、多序列叠加或 tooltip 时。

> **2026-11-18 已触发**：页签化与图表形态需要环图/构成图与多序列大图；按 `DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-20` 只在 ai-kit 引入 recharts 与 DonutChart，折线继续用 TrendChart。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-02 — 窗口决定步长

**为什么**：API 返回原始采样点。7 天按 60s 采样是每条序列 10,080 点——传输、解析与绘制都是浪费，画出来还是一团。每个窗口配一个步长，使点数稳定在 60 左右：1h→60s、6h→5m、24h→15m、7d→2h。

**被否方案**：固定 60s 步长。见上。

**何时重新考虑**：需要秒级放大某个时间点时，再加独立的时间范围选择器。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-03 — 百分比必须相除，不能直接画指标

**为什么**：`cluster_cpu_usage` 单位是**核**，`cluster_memory_usage_wo_cache` 单位是**字节**。第一版直接把内存指标当百分比画，页面显示了 `937053405184%`——这个数字荒谬到一眼能看出，但如果集群只有 8 核，CPU 的「34」会被误读成 34% 而不是 34 核。两处都必须读总量再相除。

**被否方案**：信任指标名里的语义。指标名不承诺单位。

**何时重新考虑**：监控 API 提供已归一化的比率指标时（例如 `cluster_cpu_utilisation` 这类）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-05 — 物理资源面板按旧 console 的分组补全，指标名照抄记录规则

旧 console 的「物理资源监控」在一列里画约三十张图：GPU 三项、主机十余项、磁盘吞吐与 IOPS、网络两项、RDMA 十项。
新 UI 第一版只画了其中十三张。补齐时不改指标来源：全部沿用 KubeSphere 的 `cluster_*` 记录规则名（实测
`/kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=<name>$` 对每条返回一条序列），因为换名字会让
「页面有卡片」和「后端真有这条指标」脱钩。被否方案：用 PromQL 自行聚合原始指标——记录规则已经是服务器算好的
总量，客户端再算一遍只会把单位与分母的错误引入页面。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-06 — 加分组标题，而不是继续平铺三十张卡片

一列三十张无标题卡片读不出「哪些数字属于同一件事」。页面按 GPU / 主机资源 / 磁盘 I/O / 网络 / RDMA 五组渲染，
组标题只做分区不折叠；组内仍是两列网格。被否方案：做页签——切换页签会把「同时看 GPU 与主机」的对比场景拆散，
而监控页的首要任务正是横向比较。

> 2026-11-18：物理资源整体成为页面级页签（`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-22`），但组内仍不拆二级页签；本决策的分组结论继续有效。

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-01 — 指标名与单位

| 卡片 | 指标 | 呈现 |
| --- | --- | --- |
| GPU 显存使用率 | `cluster_gpu_memory_utilisation` | API 为 0–1 比值，×100 显示为百分比 |
| GPU 使用率 | `cluster_gpu_utilization` | 同上 |
| 已分配 GPU 卡数 | `cluster_gpu_allocated` | 整数 |
| 磁盘读/写吞吐 | `cluster_disk_read_throughput` / `cluster_disk_write_throughput` | 字节/秒，按 B/KiB/MiB/GiB 缩放 |
| 磁盘读/写 IOPS | `cluster_disk_read_iops` / `cluster_disk_write_iops` | 两位小数（次/秒） |
| RDMA 健康度 | `cluster_ib_health` | 0–1 比值 ×100 |
| RDMA 端口可用率 | `cluster_ib_port_up` ÷ `cluster_ib_port_total` | 百分比（同一时间戳相除） |
| RDMA 发送/接收速率 | `cluster_ib_tx_bytes` / `cluster_ib_rx_bytes` | 字节/秒 |
| RDMA 链路速率 | `cluster_ib_link_speed` | **bit/s**，÷1e9 显示为 Gb/s |
| RDMA 错误/重传/丢弃/链路中断 | `cluster_ib_rx_errors` / `cluster_ib_retrans` / `cluster_ib_discards` / `cluster_ib_link_downed` | 整数计数 |

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-01 — 链路速率是 bit/s，不是字节

`cluster_ib_link_speed` 返回 907500000000（907.5 Gb/s 的 fabric）。当成字节/秒格式化会显示成 825 GiB/s
——差 8 倍且单位错。页面因此单独用 linkRate 格式（÷1e9 + Gb/s），并在卡片上保留一位小数。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-02 — GPU 指标是比值，不是百分比

`cluster_gpu_memory_utilisation` / `cluster_gpu_utilization` 与 inode 一样是 0–1 比值：直接画会在 0–1 区间
显示成一条平线（1% 的卡看起来是满的）。页面用 scale=100 换算，而不是把 0–1 当成 0–100。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-04 — 曲线按卡片自身峰值缩放

**为什么**：固定 0–100 刻度在「集群空闲」时把 5% 画成贴底的一条直线，与「无数据」在视觉上无法区分——而这正是趋势图要回答的问题。按峰值缩放（含 15% 余量）能看出形状；绝对值由卡片上的数字给出。

**被否方案**：固定 0–100，便于跨卡片比较。跨卡片比较的需求远小于「看出这条线有没有在动」。

**何时重新考虑**：多个集群并排比较同一指标时。

## 系统现状

老 console 的集群监控是独立区域（`/clusters/:cluster/monitor-cluster/*`），含总览、物理资源、etcd、apiserver、scheduler 与节点用量排行六个页签。老「总览」由四块组成：节点健康「编号环」、厂商分布（列表 + recharts 饼图）、组件状态卡（6 个服务组件 + 3 个核心组件）、以及「集群资源用量 / RDMA 状态 / 服务组件监控」三个 tab 型面板。新 UI 已经把三个 tab 型面板分别承接为趋势分组与「系统组件」分区；本次补的是老总览的其余三块，并在同一页承载，不新增路由。

老页在集群未就绪时的行为与本次决定不同：旧实现把读失败吞掉，显示 0/0 与「暂无数据」、模块显示「已禁用」（2026-11-18 在无 Ready 条件的成员集群 `test` 上实测，截图 [assets/cluster-monitor-status-20261118/old-test.png](../../../docs/plans/assets/cluster-monitor-status-20261118/old-test.png)）。新页由集群作用域路由层整页接管为「等待集群加入」面板并给出集群概览入口，这是对旧页的**改进**，不是 parity；理由见 `DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-12`。注意：页面内的旧/新等待视图都不在本页实现，路由层接管是既有能力，部署构建可能尚未包含该路由层（本地/新构建才有）。

2026-11-18 用户对比旧页 5 个页签后指出两处未承接：旧页的 5 个页签（概览 / 物理资源监控 / API Server 监控 / 调度器监控 / 资源用量排行）应按场景逐一迁移而不是平铺成一屏；概览的节点健康/厂商分布应以图表呈现，资源用量应是「主图 + 明细」。本批（增量 1）恢复**页内页签 IA**（一个导航入口、五个页签、`?tab=` 深链），在 ai-kit 引入 recharts 并新增 `DonutChart`，概览恢复环图/构成图/3×2 磁贴与主图+明细，物理资源页签把 29 张卡合并为 18 张多序列大图，APIServer / Scheduler / 排行各自成为页签。旧页 etcd 页签是按 `requireETCD` 条件显示的；本部署 etcd ServiceMonitor 探测为 404，因此条件 etcd 页签隐藏；AC-07 的「有序列 / 无序列说明」正分支待接入 etcd 监控的集群复验（见「后续改进」与交付记录）。

2026-11-18 晚（增量 2）：用户对比旧页指出新概览缺两块——旧 console 的「RDMA 状态」4 指标页签与「服务组件监控」块。增量 1 只把 RDMA 退化成 4 个数字 + 跳转按钮，并且整块漏掉了服务组件监控。本批恢复两块：RDMA 状态 = 4 个指标页签（health / 端口 / 吞吐 / 错误）+ 曲线 + 端口异常节点清单（旧页的 4 个子图与异常节点列表）；服务组件监控 = 4 个页签（APIServer 延迟 / 速率、调度器尝试 / 速率），复用 `componentMonitorQueries` 的查询与身份合并。原「查看 RDMA 趋势」按钮删除，概览四分区顺序固定为：状态行 → 集群资源用量 → RDMA 状态 → 服务组件监控。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterMonitorPage.tsx`
- 组件指标配置与取值：`apps/console-next/src/pages/cluster/componentMonitorQueries.ts`
- 数值格式化：`apps/console-next/src/pages/cluster/monitorFormat.ts`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/monitor/`
- 状态分区：`apps/console-next/src/pages/cluster/ClusterStatusSection.tsx`（节点在线状态、厂商分布、组件状态三块；数据源见 `CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-03`）
- 未就绪接管：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/route.tsx`（既有能力：集群列表 `ready === false` 且非 overview 时不挂载页面，渲染 `data-ai-id="cluster:not-ready"` 面板与 `cluster:not-ready-overview` 入口；本页不新增第二个等待视图）
- 状态分区接口：`packages/api-client/src/cluster.ts` 的 `clusterStatusApi`（`componentHealth` / `nodeVendorStats` / `etcdServiceMonitor`），复用 `clusterScoped` 处理成员集群路径；未复用 `nodeListApi.stats`（节点列表的 stats 查询另有 labelSelector 语义，状态分区直接读 `nodes/stats`）
- 区域注册：`apps/console-next/src/areas/registry.ts`（cluster-management 增加 monitor）
- 接口：`packages/api-client/src/cluster.ts` 的 `rangeMetricsApi`（新增 `component` 方法，保留身份标签）
- 共享图表：`console/packages/ai-kit/src/primitives/TrendChart.tsx`（新增多序列能力，单序列 `points` 兼容）+ `src/styles/tokens.css` 的 `--ai-chart-*` 语义色
- 文案：`packages/locales/src/index.ts`（`cluster.monitor.*`）

本批（页签 IA 与图表化）新增/改动的落点：

- 页面与页签框架：`apps/console-next/src/pages/cluster/ClusterMonitorPage.tsx`（页头 + `Tabs` + node 变体）、`monitorTabs.ts`（`MonitorTabKey` / `MONITOR_TABS` / `parseMonitorTab` / `WindowContext`）、`monitorWindow.ts`（`WINDOWS` / `rangeForWindow` / `AUTO_REFRESH_INTERVAL_MS`）
- 概览：`apps/console-next/src/pages/cluster/ClusterOverviewTab.tsx`、`ClusterStatusSection.tsx`（3×2 磁贴与核心组件行；节点环图用既有 `MetricRing`，厂商构成用 `DonutChart`）
- 物理资源：`apps/console-next/src/pages/cluster/ClusterResourceTab.tsx`、`monitorResourceCharts.ts`（18 图与多序列配置）
- 组件页签：`ClusterApiServerTab.tsx`、`ClusterSchedulerTab.tsx`、`componentMonitorQueries.ts`（既有查询与身份合并）
- 排行：`ClusterRankingTab.tsx`、`NodeRankingPanel.tsx`（新增 `aiIdPrefix` 与导出）
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/monitor/index.tsx`（`validateSearch` / `useSearch` / `useNavigate`）
- ai-kit：`console/packages/ai-kit/src/primitives/DonutChart.tsx`、`src/index.ts`、`kube-frontend/packages/ui/src/index.ts`（再导出）、Storybook story 与单测
- 文案：`packages/locales/src/index.ts`（本批 key 由 Lead 统一写入，`cluster.monitor.tab.*` / `overview.*` / `resource.*` / `series.*` / `cluster.nodeUsage.export*`）
- 概览 RDMA 状态块（增量 2）：`apps/console-next/src/pages/cluster/ClusterOverviewRdmaBlock.tsx`（4 指标页签、曲线、端口异常节点清单；`RDMA_BLOCK_METRICS` 供概览 range 查询合并指标，见 `CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-08`）
- 概览服务组件监控块（增量 2）：`apps/console-next/src/pages/cluster/ClusterOverviewComponentsBlock.tsx`（4 页签，复用 `componentMonitorQueries`，见 `CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-09`）
- RDMA 端口清单接口（增量 2）：`packages/api-client/src/node-insights.ts` 的 `rdmaPortsApi`（`clusterScoped` 路径段 + `limit=-1`，返回 `RdmaPortRow[]`）

## 对外契约

`GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster`，参数 `metrics_filter`（`|` 分隔，每个名字以 `$` 结尾）、`start`、`end`（epoch 秒）、`step`（`60s`/`5m`/`15m`/`2h`）、`cluster`。

`GET /kapis/monitoring.kubesphere.io/v1alpha3/components/{component}`（`component` ∈ `apiserver` / `scheduler` / `etcd`），参数同上。返回 `results[].metric_name` 与 `data.result[]`，每条 `data.result[]` 是一个独立序列，身份在 `metric.verb` / `metric.result` / `metric.quantile`；某条指标在本集群没有采集时仍返回该 `metric_name`，但 `data.result` 为空数组（不是 404，也不是 0）。

页签路由与深链（本批新增）：

- `/kube-frontend/clusters/$cluster/monitor?tab=<overview|resource|apiserver|scheduler|ranking>`；无参数或非法值按 `overview` 渲染，URL 不被改写；切页签 `navigate({ search: { tab }, replace: true })`，不进入浏览器历史（`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-19`）。
- 页签标签来自 `cluster.monitor.tab.*`；页签句柄 `cluster-monitor:tab:<key>`，面板 `cluster-monitor:tabpanel:<key>`；node 变体不产生这些句柄。

DonutChart（ai-kit 共享原语，本批新增）：

```ts
export interface DonutSegment { key: string; label: string; value: number; color?: string }
export interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  segments: DonutSegment[]; label: string; emptyText: string;
  formatValue?: (value: number) => string; showLegend?: boolean; size?: number; centerLabel?: React.ReactNode;
}
```

契约：recharts `PieChart/Pie/Cell`（内半径约 62%、外半径约 88%）；颜色默认取 `TREND_SERIES_COLORS` 并解析成 recharts 可用的颜色（`GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12`）；HTML 图例每行 `data-ai-segment={key}`；合计 ≤0 或全部非有限时只渲染 `emptyText`、不渲染 SVG；根 `role="img" aria-label={label}`；只使用 ai-kit token，不新增硬编码色值。

排行导出（本批新增）：

- 触发：`cluster-monitor:ranking:export`（页签）与 `node-usage:export`（独立页），文案 `cluster.nodeUsage.export` / `exportHint` / `exportEmpty`。
- 产物：`node.usage.rank.json`，形状 `{cluster, metric, order, generatedAt, items:[{name, values}]}`；items 为当前 metric/order 的全部行（后端支持全量时），否则已加载页并如实标注范围（`CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`）。
- 端点：不新增后端导出接口，仍只读 node 用量排行数据。

RDMA 端口清单（增量 2）：

- `GET /kapis[/clusters/<cluster>]/rdma.kubesphere.io/v1alpha1/ports?limit=-1`，返回 `{items:[{nodeName,device,port,stateName,healthy}],totalItems}`；集群段在路径中（host 为 `/kapis/...`，成员集群为 `/kapis/clusters/<c>/...`），不接受用 `?cluster=` 代替（成员集群实测 0 条，见 `GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-19`）。
- 该读取与指标查询独立：失败只影响「端口异常节点清单」区域（显示不可用说明），不影响 4 个指标页签的曲线；`staleTime` 30s，不随每次渲染重取。

## 不变量

1. 百分比 ∈ [0, 100]，且等于用量 ÷ 同一时刻的总量。
2. 没有总量序列时不画百分比（显示无数据）。
3. 单条曲线点数与所选窗口的步长一致，不随窗口线性膨胀。
4. 无数据不画零线。
5. 多序列按身份标签（`verb` / `result` / `quantile`）合并：同一身份只有一条线，不同身份不会被合成一条，线数等于有数据的身份数。
6. 组件指标「没有序列」与「序列值为 0」是两件事：前者显示说明，后者显示 0；无权限（403）与无数据、普通错误三者画面互不顶替。
7. 组件查询的缓存键包含作用域（cluster + 组件 + 时间窗 + start/end），不回退到别的集群的数据。
8. 状态分区的三块各自由自己的数据源决定状态：componenthealth 失败不隐藏厂商分布，nodes/stats 失败不隐藏节点与组件状态。
9. 状态分区的零值、缺失、未上报、未安装、无权限与失败是六种不同的事实，不互相顶替；`0/0` 不是「正常」。
10. 厂商占比的分母等于参与展示的厂商行计数之和；`healthy` / `total` 不进入厂商列表与分母。`CPU` 键表示「无 XPU 节点」，作为 CPU 行显示并计入分母；空态只用于各厂商计数合计为 0（无节点/未上报），CPU 行不是空态。
11. 就绪判断只认集群列表的 `ready === false`：命中时页面不挂载、由路由层整页接管；`ready` 缺失（列表读取中或读取失败）时不接管，页面照常挂载。

12. 页签：URL 的 `tab` 与选中页签一致；未知值忽略并按概览渲染；默认 `overview`；切页签用 replace 语义，不新增浏览器历史；node 变体没有页签；etcd 页签只在 ServiceMonitor 200 时存在，隐藏时 `?tab=etcd` 按 `overview` 渲染。
13. 一个时间窗、一个自动刷新开关，只出现在页头；任何页签内不得再出现第二套时间窗/刷新控件。
14. 切页签只为新进入的页签发起主查询；未挂载过的页签零请求；同一时间窗内回到已加载页签复用缓存。
15. 图表空态不画零线；DonutChart 合计 ≤0 或全非有限时只显示说明、不渲染 SVG；环图百分比由同次响应计算。
16. 多序列图按身份标签合并：同一身份一条线、不同身份不混线，线数等于有数据的身份数；某身份缺序列时图例不补 0 线。
17. 页签主查询彼此独立：一个页签失败不影响其他页签；403 只说明无权限且不给重试。
18. 导出 JSON 形状固定；items 来自当前 metric/order；无数据不生成文件；导出范围与文件内容一致。
19. ai-kit 主题：DonutChart 只使用 `--ai-*` token；recharts 颜色 token 解析失败时回退内置调色板，不写死十六进制。
20. 既有 `data-ai-id` 不串：`NodeRankingPanel` 默认前缀 `node-usage:`，排行页签传 `cluster-monitor:ranking:`；同一句柄不得在页面里出现两次。
21. 概览四分区顺序固定：状态行 → 集群资源用量 → RDMA 状态 → 服务组件监控；RDMA 块与服务组件块各自 loading/empty/error，一块失败不阻塞其它分区。
22. RDMA 块：4 页签顺序固定（health → ports → throughput → errors）；值来自概览同一次 range 查询；某页签无序列时当前值显示「-」且图为 `:empty`，不画零线；端口清单 404/403/5xx 一律显示不可用，**不得**显示「所有 RDMA 端口均正常」。
23. 服务组件块：4 页签顺序固定（latency → requestRate → attempts → attemptRate）；身份按 `verb` / `result` 合并，线数等于有数据的身份数，不按返回顺序配对；单位分别为 ms / 次/秒 / 整数；无序列显示「本集群未上报该组件指标」，失败带重试（403 无重试）。
24. 概览不存在 `cluster-monitor:overview:view-rdma` 句柄（跳转按钮已删除）；一个动作一个入口：RDMA 明细分组只从物理资源监控页签进入。

## 已知坑

- **单位**：CPU 是核、内存是字节；直接当百分比会得到荒谬数值（本项目实测内存显示 937053405184%）。
- **按时间戳配对**：两条序列分别采样，按下标 zip 在缺一个点时会把 A 时刻的用量除以 B 时刻的总量。
- **`resultType` 可能是 `vector`**：若后端忽略 range 参数，会返回单点；当成趋势画会是一条静止的线，必须按 `result`/`values` 是否存在来判断。
- **`end` 不能每次渲染都取 `Date.now()`**：放进 query key 会导致无限重取；本项目在窗口切换时才重新计算区间。
- **`step` 太小会拖慢**：7 天 × 60s 在慢后端上是几十秒的请求。
- **组件指标值可能是 `NaN`**：本部署 `apiserver_request_by_verb_latencies` 的 `verb="APPLY"` 整条序列都是 `NaN`；`parseFloat` 得到 `NaN`，必须丢弃这些点/整条序列，否则会画出一条归零的假线。
- **调度尝试次数是累积计数、尝试速率是每秒值**：两者不能共用「次/秒」单位；本部署尝试速率恰好为 0（真实 0，有序列），不能因为看起来像 0 就当成无数据。
- **etcd 指标名存在但当前集群没有序列**：`components/etcd` 返回 200 且列出全部 `metric_name` 但 `data.result` 为空；页面必须说「未上报」，不能按 0 渲染。
- **组件指标的 `cluster` 作用域与缓存键**：查询带 `?cluster=`，query key 必须包含它，否则切换成员集群后会显示上一个集群的曲线。
- **未就绪的成员集群所有读返回 500 而不是 403 或空集**：`cluster {c} is not ready` 是 HTTP 500 文本。按错误分支处理会把每块都画成「重试」按钮，而重试不可能成功——所以这类集群根本不该进入本页，由路由层在页面挂载前接管（`GOT-...-11`）。
- **nodes/stats 的 `healthy` / `total` 不是厂商**：它们是汇总字段；旧页把它们从厂商列表剔除是对的，但旧页把 `CPU` 键当厂商展示；新页把无 XPU 的 `CPU` 键作为 CPU 行显示（真实节点数）并计入占比分母，只有各厂商计数合计为 0 时才空态。
- **旧页厂商占比没乘 100**：旧实现 `(count / total).toFixed(2)` 得到 0.01 却直接拼 `%`，页面显示「1.00%」（2026-11-18 在成员集群 `agent` 正常态实测，截图 [assets/cluster-monitor-status-20261118/old-agent.png](../../../docs/plans/assets/cluster-monitor-status-20261118/old-agent.png)）。新页占比按百分比计算（×100）。
- **旧页 Kube AI Hub 恒为 0/0**：旧 store 的 `data` 键是 `kubesphere` 而模板取 `counts.kubeaihub`，两个名字对不上，所以无论真实后端数是多少都显示 0/0。这是旧实现缺陷，不是集群事实；新页按命名空间聚合 healthyBackends/totalBackends。
- **状态分区的刷新随页面开关**：三块查询与趋势共用「自动刷新」开关（开启每 5 秒重取，关闭/卸载停止），不是各自独立的 interval；实现时定时器必须与趋势的 tick 同一生命周期，否则关闭开关后状态分区仍会继续请求。

- **recharts 颜色 token**：`TREND_SERIES_COLORS` 是 `rgb(var(--ai-chart-N))` 字符串；DonutChart 需从 computed style 解析出可解析颜色，失败回退内置调色板（`GOT-...-12`）。
- **隐藏页签里的图表尺寸为 0**：recharts `ResponsiveContainer` 在 `display:none` 容器里测量为 0；页签必须懒挂载（离开即卸载），不能全部挂载后隐藏（`GOT-...-14`）。
- **深链与 replace**：`?tab=` 非法值不要改写 URL；切页签用 `replace: true`，后退/前进不切换页签是**本批的明确行为**（`DEC-...-19`、`GOT-...-15`）。
- **导出全量不能想当然**：`pageSize=-1` 是否生效需实测，返回行数要核对 total；否则会把「一页」当「全量」导出（`GOT-...-16`）。
- **比率超配**：`cluster_*_utilisation` 超配时 >1，×100 后允许 >100%，不要截断或固定轴上限（`GOT-...-13`）。
- **etcd 页签可见性**：只有 ServiceMonitor 探测 200 才显示；404 与探测失败（403/5xx）都隐藏，页签条不区分「未接入」与「探测失败」（旧 `requireETCD` parity，`GOT-...-17`）。
- **RDMA 端口清单的集群段**：`?cluster=` 对成员集群无效（实测 agent 返回 0 条，路径形态 16 条）；错用会把成员集群的端口误判成「读不到 = 全正常」（`GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-19`）。
- **端口清单失败 ≠ 全正常**：404/403/5xx/网络失败都显示「RDMA 端口清单不可用」；只有清单成功且没有 `healthy=false` 的端口才显示「所有 RDMA 端口均正常。」。
- **RDMA 块的值来自概览查询**：4 个页签不各自再发 range 查询（实现用概览的 `seriesByName`）；端口清单是唯一独立读取。
- **服务组件块用同一身份合并**：复用 `componentMonitorQueries` 的 `toComponentCharts`，不要按返回顺序取第 i 条；`NaN`-only 身份不画线，无序列显示未上报说明。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01.yaml`、`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06.yaml`（组件多序列/单位）、`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07.yaml`（无数据/错误/无权限分支）。
可观测点：`cluster-monitor:surface`、`cluster-monitor:{cpu,memory,pods,nodes}`、`:latest`、`:empty`、`:chart`、`cluster-monitor:range:<key>`；系统组件：`cluster-monitor:components`、`cluster-monitor:group:{apiserver|scheduler|etcd}`（带 `data-ai-state`）、`cluster-monitor:{apiserver|scheduler|etcd}:<card>`、`:<card>:series:<identity>`、`:<card>:series:<identity>:value`。

集群状态分区（`data-ai-id` 清单，以 `ClusterStatusSection.tsx` 为准）：`cluster-monitor:status`（分区根，`data-ai-state` = loading/ready/empty/error）、`cluster-monitor:status:node-online:card`（节点在线卡，`data-ai-state`；含 `cluster-monitor:status:node-online` 数字、`:node-online:ratio` 比例、`:node-online:link` 节点页入口，以及 `:node-online:loading|unreported|empty|permission|error|retry`）、`cluster-monitor:status:vendor:card`（厂商卡；含 `cluster-monitor:status:vendor` 列表、`:vendor:row:<vendor>`（`data-ai-count`）与 `:vendor:row:<vendor>:count|:percent`、`:vendor:loading|empty|permission|error|retry`）、`cluster-monitor:status:components:card`（组件卡；含 `:components:service:<namespace>`（`data-ai-status` = healthy/unhealthy/not-installed/not-reported）、`:components:core:<etcd|controller-manager|scheduler>`（`data-ai-status`）、`:components:core:etcd:retry`，以及组件查询失败时复用分区前缀的 `cluster-monitor:status:permission|:error|:retry`）。未就绪由路由层接管，用既有句柄 `cluster:not-ready`、`cluster:not-ready-overview` 断言（本页不新增等待视图句柄）。用例按这些句柄断言，不按标题文字猜。

页签 IA 与图表化（本批）的观测点：`cluster-monitor:tab:<key>`、`cluster-monitor:tabpanel:<key>`（含条件 `cluster-monitor:tab:etcd` / `cluster-monitor:tabpanel:etcd`，仅在 etcd 接入监控时存在）、`cluster-monitor:range:<key>`、`cluster-monitor:auto-refresh`、`cluster-monitor:retry`、`cluster-monitor:surface`；概览 `cluster-monitor:overview`、`:overview:node-ring`/`:node-ring:value`、`:overview:vendor-donut`/`:overview:vendor:<vendor>`、`cluster-monitor:status:components`（`:components:service:<ns>`、`:components:core:<key>`）、`:overview:usage`/`:usage:<key>`/`:usage:<key>:value`、`:overview:usage-chart`/`:usage-chart:legend`；概览 RDMA 块 `:overview:rdma`（`:rdma:tabs`、`:rdma:tab:<health|ports|throughput|errors>`（含 `:value`）、`:rdma:chart`（`data-ai-state` + `:now` / `:empty`）、`:rdma:chart:legend`、`:rdma:legend:<metric>`、`:rdma:no-abnormal`、`:rdma:abnormal`（`+ :rdma:abnormal:<node>`）、`:rdma:inventory-unavailable`）；概览服务组件块 `:overview:components`（`:components:tabs`、`:components:tab:<latency|requestRate|attempts|attemptRate>`（含 `:value`）、`:components:chart`（`data-ai-state` + `:now` / `:empty`）、`:components:chart:legend`、`:components:legend:<line>`、`:components:retry`）；物理资源 `cluster-monitor:resource`、`:resource:group:<gpu|host|disk|network|rdma>`、`:resource:chart:<key>`、`:chart:<key>:legend`、`:chart:<key>:empty`；APIServer `cluster-monitor:apiserver:chart:latency|rate`；Scheduler `cluster-monitor:scheduler:chart:attempts|rate|latency`；排行 `cluster-monitor:ranking`、`cluster-monitor:ranking:export`（独立页 `node-usage:export`）；DonutChart 图例行 `data-ai-segment`。

## 后续改进

- 节点用量排行与物理资源下钻（老 console 的独立页）。
- etcd 节点级服务状态（在线 / 有 leader / leader 变更次数，旧 `ETCDNodes` 卡）：本部署无 etcd 序列，无法验收，登记为待补。
- 交互式缩放与 tooltip。
- 成员集群就绪后的状态分区正向数据（本轮只能验收 host/agent 就绪集群的正常态与未就绪集群 `test` 的路由层接管）。
- 真实受限账号下 componenthealth / nodes/stats 的 403 分支（本轮用 route mock）。
- **每页签独立时间窗/播放控制**：本批五个页签共用页头一套时间窗与自动刷新（`DEC-...-23`）；旧 console 的组件面板各自 50×2m 并有播放控制。若产品确认需要按页签独立窗口，另立批次实现，不把「共用」当成永久形态。
- **RDMA 异常节点下钻**：本批端口异常节点只列节点名与 down/total，不提供点击进入节点详情或物理资源页签；端口清单的搜索 / 分页 / 导出也登记后续（不是永久结论）。
- **概览服务组件块下钻**：本批 4 个页签只给曲线，不做点击进入 API Server / 调度器页签或组件页（登记后续）。
- **RDMA 端口清单空响应语义**：清单成功但 items 为空时按「无异常端口」显示「所有 RDMA 端口均正常。」；若后端以空清单表示「本集群没有 RDMA 设备」，需与后端确认是否要单独空态（登记待确认）。
- **etcd 条件页签正分支复验**：条件 etcd 页签已按 `requireETCD` 承接（ServiceMonitor 200 显示、404/失败隐藏，`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-27`）；本部署探测为 404，页签隐藏，`AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07` 的「有序列 / 无序列说明」正分支只能在接入 etcd 监控的集群上复验（环境限制，已记入交付记录）。
- **排行导出扩展**：全量分页拉取的后端核对、CSV/Excel、服务端异步导出（本批只做 JSON）。
- **环图/构成图交互**：hover 读数、扇区点击筛选、跨集群构成对比；折线缩放/框选。
- **旧页逐页签对照验收**：五个基础页签（+条件 etcd 页签）× 旧页截图 × 三档视口 × 浅色/英文，待验证方补齐。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11（页签 IA 与深链，覆盖 AC-11）
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12（概览环图/构成图/主图+明细 + RDMA 状态与服务组件监控两块，覆盖 AC-12 / AC-17 / AC-18）
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13（物理资源多序列分组，覆盖 AC-13）
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14（API Server 页签，覆盖 AC-14）
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15（调度器页签，覆盖 AC-15）
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16（排行页签与导出，覆盖 AC-16）


## 自动刷新（R-27 的对应实现）

老 console 的监控卡片有一个「播放/暂停」控制：打开后每 **5 秒**用「最近 N 分钟」重取一次（`utils/monitoring.js` 的 `startAutoRefresh`，`interval: 5000`，且 `autoRefresh` 时把参数设为 `last: true`）。新 UI 此前只有手动刷新（R-26），没有这个开关。

实现：

- 开关状态在页面内，`aria-pressed` 与按钮文案同步（开/关）。
- 每次 tick **把时间窗向前滚动**（`end = now`），而不是重复查询冻结的区间——否则「实时」看不到新采样。
- 定时器在关闭、切窗或卸载时清理；注意该组件里 `window` 是一个局部变量（时间窗对象），必须用 `globalThis.setInterval`。
- 与 R-27 的关系：这是老 console 的真实行为（轮询），已按 parity 交付；WebSocket/watch 推送属后续改进，不阻塞 parity。

## 系统组件面板追加（APIServer / Scheduler / etcd，2026-11-15）

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-07 — 复用共享 TrendChart 的多序列能力，而不是每序列一张卡

**为什么**：组件指标的身份（`verb` / `result` / `quantile`）本身就是「同一条曲线的不同分类」：6 个 verb 的请求延迟
放在一张图上才能比较「哪个操作变慢」，拆成 6 张卡后比较任务丢失，页面还会变成一面卡片墙。ai-kit 的 `TrendChart`
因此增加 `series` 输入（每条带 `key` / `label` / `points`），原有单序列 `points` 保持兼容，三处既有消费者
（集群监控物理资源卡、节点趋势、GPU 监控）不改调用。

**被否方案**：
- 每序列一张卡：APIServer 延迟 6 张、Scheduler 尝试 3 张、etcd 十余张，卡片数与身份数线性增长，且丢失同图比较。
- 页面内自绘多条折线：图表能力二次实现，与「一套共享组件」的约定冲突，主题 token 与空态也会分叉。

**何时重新考虑**：需要坐标轴刻度、缩放、tooltip 时，按 `DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-01` 的条件重新评估图表库。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-08 — etcd 无数据用区域级说明，不按旧 requireETCD 隐藏

**为什么**：旧 console 用 etcd servicemonitor 探测（`requireETCD`）决定是否显示 etcd 页签；新页是单页分区，
整组隐藏会让读者无法区分「这个集群没配 etcd 监控」与「页面 bug 或功能缺失」。`components/etcd` 返回 200 且
列出全部指标名、但 `data.result` 为空，是「未上报」的最强证据，页面据此如实说明；其余两个组件子组照常显示。

**被否方案**：
- 隐藏整组（沿旧 `requireETCD`）：同一部署里 apiserver/scheduler 有数据、etcd 没有，隐藏后读者不知道少了什么。
- 渲染十余张 0 值卡：把「没有采集」伪装成「一切为 0」，正是本次要避免的语义错误。

**何时重新考虑**：平台改为按安装状态决定组件监控入口时，可把说明换成入口级提示（但仍不能显示 0）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-09 — 多序列按标签身份合并，不按返回顺序

**为什么**：旧实现按固定 legend 顺序（CREATE / DELETE / DELETECOLLECTION / GET / …）取第 i 条序列；本部署实际返回的
身份是 APPLY / DELETE / GET / PATCH / POST / PUT，按位置配对会把 APPLY 标成 REST_CREATE，把 GET 标成 REST_POST。
新实现按 `metric.verb` / `metric.result` / `metric.quantile` 精确匹配：返回顺序变化不影响图例；固定展示顺序
（verb 按字母序、result 按 scheduled → error → unschedulable、quantile 按 0.99 → 0.9 → 0.5 → 平均）只作为呈现规则。

**被否方案**：按位置配对（legacy）；把每条序列都当成同一指标名的不同采样（身份丢失）。
**何时重新考虑**：无需；身份合并是数据契约的一部分。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-10 — 组件面板复用页面时间窗与自动刷新

**为什么**：一页一个时间窗（1h / 6h / 24h / 7d）和一个自动刷新开关（`AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04`）。
组件查询的 query key 含 `cluster` + 组件 + 时间窗 + `start`/`end`，窗口切换与每 5 秒的 tick 同时作用于物理资源与组件，
读者不会看到「上面 1 小时、下面 100 分钟」的两套时间。旧 console 每个组件面板固定 50×2m 并自带播放控制。

**被否方案**：组件区域独立时间窗（同页两套窗口，容易对不上）；沿用固定 2m 步长（与页面窗口语义冲突）。

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-02 — 组件指标的身份、单位与呈现

| 卡片 | 指标 | 身份标签 | 呈现与单位 |
| --- | --- | --- | --- |
| APIServer 请求速率（总） | `apiserver_request_rate` | 无 | 次/秒，两位小数 |
| APIServer 请求速率（按 verb） | `apiserver_request_by_verb_rate` | `verb` | 次/秒；一个 verb 一条线 |
| APIServer 请求延迟 | `apiserver_request_latencies`（总平均）+ `apiserver_request_by_verb_latencies`（按 verb） | `verb` | API 返回**秒**，×1000 显示 ms（两位小数） |
| Scheduler 调度尝试 | `scheduler_schedule_attempts` | `result` | 累积计数，整数 |
| Scheduler 调度尝试速率 | `scheduler_schedule_attempt_rate` | `result` | 次/秒 |
| Scheduler 调度延迟 | `scheduler_e2e_scheduling_latency`（平均）+ `scheduler_e2e_scheduling_latency_quantile` | `quantile` | 秒 → ms |
| etcd DB 大小 | `etcd_mvcc_db_size` | 无 | 字节，按 1024 显示 B/KiB/MiB/GiB |
| etcd WAL fsync 延迟 | `etcd_disk_wal_fsync_duration`（平均）+ `..._quantile` | `quantile` | 秒 → ms |
| etcd backend commit 延迟 | `etcd_disk_backend_commit_duration`（平均）+ `..._quantile` | `quantile` | 秒 → ms |
| etcd 提案速率 | `etcd_server_proposals_committed_rate` / `_applied_rate` / `_failed_rate` | 无 | 次/秒，三条线 |
| etcd 待处理提案 | `etcd_server_proposals_pending_count` | 无 | 个数（与速率分开成卡，见 `GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-04`） |
| etcd 客户端流量 | `etcd_network_client_grpc_received_bytes` / `..._sent_bytes` | 无 | 字节/秒 |
| etcd gRPC 消息速率 | `etcd_grpc_server_msg_received_rate` / `..._sent_rate` | 无 | 次/秒 |

统一规则：非有限值（`NaN` / `+Inf` / `-Inf`）不进入曲线；某条序列没有任何有限点时在图例中置灰显示「—」；
一张卡的所有序列都没有有限点时整卡显示「该时间范围内没有数据」；有序列且值为 0 时显示 0。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-03 — 组件指标值可能是 NaN

本部署 `apiserver_request_by_verb_latencies` 的 `verb="APPLY"` 整条序列都是字符串 `"NaN"`。`parseFloat("NaN")`
得到 `NaN`，若直接交给 SVG 会生成空 `d`（整条线消失）或被当成 0 画出假线。解析后必须 `Number.isFinite` 过滤，
整条序列无有限点时按「无数据」处理。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-04 — 调度尝试次数是累积计数，不是速率

`scheduler_schedule_attempts` 实测是累积值（scheduled 4805 → 4841），而 `scheduler_schedule_attempt_rate` 是每秒值。
两者不能共用「次/秒」单位；旧 console 把 `etcd_server_proposals_pending_count`（个数）塞进 RAFT_PROPOSAL 速率图里，
本次拆成独立卡片。卡面单位取 `CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-02`。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-05 — etcd 有指标名但没有序列

`components/etcd` 返回 200，`results[]` 列出全部 `metric_name`，但每条 `data.result` 都是空数组。这是「本集群未上报
该组件指标」，不是 0，也不是接口失败；页面在该子组显示说明与可能原因，不渲染 0 值卡片（`AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`）。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-06 — 无数据、错误与无权限必须分开

组件子组四种画面：加载中（骨架）、有数据（卡片）、无数据（说明，无重试）、失败（错误说明 + 重试；403 只说明不给重试）。
把失败显示成无数据会让人误以为集群没装监控；把无数据当失败会让人反复重试一个不会变的查询。

## 集群状态分区与未就绪接管（2026-11-18）

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-11 — 状态分区并入监控页，不新增路由或页签

**为什么**：老 console 的监控是六个页签（overview / resource / etcd / api-server / scheduler / ranking），每个页签一个路由。新 UI 已经收敛成两个入口：`monitor`（趋势与组件指标）与 `node-usage`（节点用量排行），物理资源与系统组件已在既有分区承接。再为「集群状态」加路由或页签，会出现两个都叫「监控概览」的入口，而「集群是否正常」本来就是打开监控页的第一个问题，不是另一个页面。一个动作一个入口：状态作为监控页最上面的分区，往下才是趋势。

**被否方案**：
- 照搬旧六页签（新增 `overview` 或 `status` 路由）：导航多一个与 monitor 语义重叠的入口；同一批接口被两个页面读取；面包屑与侧栏高亮都要分叉。
- 把状态塞进集群概览页：概览已承载身份、模块、用量与未就绪整页等待（`DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-19`），再塞一块控制面组件会让概览变成第二个监控页，且「点监控看状态」的路径变长。

**何时重新考虑**：状态数据长成独立运维视图（多集群状态对比、告警联动、历史健康分）时，再给它独立入口。

> 2026-11-18 用户反馈：旧页 5 个页签各自对应一类使用场景，平铺成一屏被判为「只迁移了概览、丢失其他页签内容」。本决策只对「集群状态」分区成立，**不覆盖**旧页签 IA 的最终归宿；后续批次按页签逐一评估「保留页内 Tab / 独立子路由 / 分区」，以交付记录的待补项为准。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-12 — 未就绪不在页面内重复实现等待视图，复用路由层既有接管

**为什么**：集群作用域路由层（`routes/kube-frontend.clusters.$cluster/route.tsx`）已经统一处理「未就绪集群的页面访问」：集群列表 `ready === false` 且访问的不是概览时，不挂载页面，整页渲染「等待集群加入」面板（`cluster:not-ready`）与「前往集群概览」入口（`cluster:not-ready-overview`）。这覆盖书签、粘贴 URL 与浏览器后退，而不只是从侧栏点进来的路径。监控页再实现一套等待视图，会让同一状态出现两种画面（路由层面板 vs 页面内等待面板），文案、入口与就绪刷新行为各自演进；而且监控页上没有可执行的下一步动作（接入 agent 的引导在概览），页面内等待只能在原地重复「等待」。一个动作一个入口：未就绪由路由层拦截，页面只负责自己就绪后的内容。

**为什么不是逐块错误 + 重试**：未就绪时该集群所有 `/kapis/clusters/{c}/*` 读都返回 500，原因只有一个，重试不可能成功；逐块错误面板会得到一屏无效按钮，并把唯一该做的事埋掉。

**旧页行为（不是 parity）**：实测无 Ready 条件的成员集群 `test`（旧页 `/clusters/test/monitor-cluster/overview`，截图 [assets/cluster-monitor-status-20261118/old-test.png](../../../docs/plans/assets/cluster-monitor-status-20261118/old-test.png)），旧实现把失败吞成 `0/0` 与「暂无数据」、模块显示「已禁用」，页面看起来像「集群健康但没有数据」。这是本次要修的事实错误，因此路由层整页接管是**改进**，不能写成「与旧页一致」。

**被否方案**：
- 监控页内新建第二套等待视图（含从概览提取 `WaitingForCluster`）：同一状态两种画面，两个入口两种文案；概览的等待视图带代理接入引导，监控页没有可执行动作，复制过来只剩重复。
- 每块各自错误 + 重试（旧页的逐块回退是 0/0，不是错误）：一屏无效按钮，且读者无法知道重试为什么永远不会成功。
- 保留旧页吞错显示 0/0：把「读不到」说成「是 0」，正是本页其它分区一直在避免的语义错误。
- 只在顶部放 banner、其余面板照常显示：banner 会被一屏「不可用」面板淹没。

**何时重新考虑**：路由层的接管无法表达某个页面特有的下一步动作，或未就绪集群开始提供部分可读数据（例如已注册但未就绪的节点清单）时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-13 — 厂商分布用列表 + 比例条，不用饼图

**为什么**：旧页厂商分布用 recharts 饼图（`Pie`/`Cell`/`Sector` + 自定义 activeShape）。本项目在 `DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-01` 已决定不引入图表库，而这里要回答的只是「各厂商节点数多少、占比大小」，列表可同时给出图标、精确节点数与占比，比例条已经能表达大小关系。饼图在厂商数变多时不可读，还需要第二套主题色。

**被否方案**：移植 recharts 饼图（新增图表库依赖、主题分叉、键盘不可达）；只给数字列表（丢失占比的直观关系）。

**何时重新考虑**：需要跨集群构成对比或交互式下钻时，按 `DEC-...-01` 的条件评估图表库。

> 2026-11-18 用户反馈：节点健康与厂商分布应以图表（环图/饼图）呈现；数值 + 比例条被判定为观感与信息密度退化。**本批已重做**：ai-kit 引入 recharts 并新增 DonutChart（`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-20`），状态行恢复环图/构成图/3×2 磁贴（`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-26`）；本决策保留为历史与「列表可读性」论据，不再是现状。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-14 — 服务组件按命名空间聚合 healthyBackends / totalBackends

**为什么**：`componenthealth` 的 `kubesphereStatus` 是「每个后端一段」的记录（`namespace` / `label` / `totalBackends` / `healthyBackends`）。页面要回答「这个模块整体是否健康」，所以先把同一命名空间的 `healthyBackends` 与 `totalBackends` 分别求和再相除，得到 `x/y`。旧页的 `counts` 里**没有 `kubeaihub` 键**（store 写入的 `data` 键是 `kubesphere`，模板取 `counts.kubeaihub`），所以 Kube AI Hub 无论真实后端数是多少都渲染 `0/0`——这是旧实现缺陷，不是集群事实；新页按命名空间聚合修正。`configz` 未启用的模块显示「未安装」而不是 `0/0`：**没装**与**装了但没有后端**是两件事。

**被否方案**：按 `label` 逐条列出（一个模块多行，页面变后端清单，读者仍不知道整体是否健康）；沿用旧页 `componentCounts`（统计组件记录条数而不是副本数，与卡面 `x/y` 的口径不一致）；把 `0/0` 当正常（旧页行为）。

**何时重新考虑**：后端记录带明确的 per-instance 健康字段时，可在模块行下展开明细。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-15 — etcd 状态沿用旧语义 = ServiceMonitor 是否接入，不是 etcd 健康

**为什么**：旧页 `checkEtcd` 探测 `kubesphere-monitoring-system/etcd` 的 ServiceMonitor，404 时隐藏 etcd 页签。新页不隐藏 etcd 子组（组件趋势已有「本集群未上报」分支，`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-08`），但核心组件里的 etcd 项仍只表达「**已接入监控 / 未接入**」。本部署 `components/etcd` 200 但 13 个指标全 0 序列，没有可读的真实健康数据；承诺 etcd 健康只会把「没采集」说成「健康」。ServiceMonitor 存在 ≠ etcd 健康，页面不把「接入」翻译成「正常」。

**被否方案**：用 components/etcd 序列推断健康（本部署无序列）；ServiceMonitor 存在就显示「正常」（把接入当健康）；整项不显示（读者不知道这个集群有没有接入 etcd 监控）。

**何时重新考虑**：有 etcd 真实健康数据源（如 etcd 自身的 health 端点、成员级指标）时，另立一项，不和「是否接入」共用徽标。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-16 — 状态分区与趋势共用一个自动刷新开关（旧页 2 秒无条件轮询）

**为什么**：旧页组件健康用 `setTimeout(2000)` 递归轮询 componenthealth，页面打开就一直在读，关不掉，且递归定时器与卸载时序不可靠。新页已经有一个显式的「自动刷新」开关（每 5 秒把时间窗向前滚动，`AC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-04`）；状态分区是同一屏的当前值，再单独给一套轮询会出现「上面在动、下面不动」或「关不掉」的两套时间语义。统一成一个开关：开启时趋势与 componenthealth / nodes/stats / etcd ServiceMonitor 三个查询一起重取，关闭或卸载即停止。

**被否方案**：沿旧页 2 秒无条件轮询（更频繁、无法停止、与页面开关冲突）；状态分区只在挂载时读一次（读者为看节点是否恢复会反复手动刷新页面）；给状态分区单独一个开关（同一页两个刷新控件，读者不知道哪个控制什么）。

**何时重新考虑**：状态数据有服务端推送（watch/SSE）时，可把轮询降为推送 + 手动刷新。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-17 — 节点块直接链接，不预检权限

**为什么**：旧页 `handleNodeClick` 先 `globals.app.hasPermission({module:'nodes',action:'view'})` 再 `routing.push`；新 console 的约定是页面不预检路由权限——目标页在无权限时呈现无权限画面，预检会让入口在加载期/权限未知时闪烁或永久消失。节点块是一个链接（`Link` 到 `/kube-frontend/clusters/$cluster/nodes`），可中键、可复制 URL，权限由节点页回答。

**被否方案**：保留旧页的前置权限检查（多一次权限读取、权限未知时入口状态闪烁、与全站其他入口口径不一致）；无权限时把整块渲染成不可点击（读者不知道「没权限」还是「功能不存在」）。

**何时重新考虑**：节点页本身无法区分「无权限」与「不存在」时，应先在目标页补状态，而不是在入口预检。

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-03 — 集群状态分区的数据来源、返回类型与单位

| 块 | 请求（成员集群前缀 `/kapis/clusters/{c}` 或 `/apis/clusters/{c}`） | **返回类型** | 字段/口径 | 显示 |
| --- | --- | --- | --- | --- |
| 节点在线状态 | `GET /kapis[/clusters/{c}]/resources.kubesphere.io/v1alpha2/componenthealth` | **JSON** | `nodeStatus.totalNodes` / `nodeStatus.healthyNodes`，两个字段都可能缺失 | `healthyNodes/totalNodes`（形如 1/1）；在线比例 = 健康 ÷ 总数；`totalNodes` 缺失 → 未上报；为 0 → 空态说明 |
| 厂商分布 | `GET /kapis[/clusters/{c}]/resources.kubesphere.io/v1alpha3/nodes/stats` | **JSON** | 键 = 厂商名 → 节点数；`healthy` / `total` 是汇总字段，不是厂商；`CPU` 键表示无 XPU 的节点数，按 CPU 行显示（文案取 `node.vendor.*`） | 每厂商节点数；占比 = 该厂商节点数 ÷ 各厂商节点数之和 × 100；按数量降序；计数 ≤ 0 的键不成行；各厂商计数合计为 0（无节点/未上报）→ 空态说明；**CPU 行不是空态** |
| 服务组件 | 同 componenthealth | **JSON** | `kubesphereStatus[]` 按 `namespace` 聚合：Σ`healthyBackends` ÷ Σ`totalBackends` | 6 项（kubesphere-system / kube-system / istio-system / kubesphere-monitoring-system / kubesphere-logging-system / kubesphere-devops-system）；`x/y` + 百分比 |
| 核心组件 | componenthealth + ServiceMonitor | **JSON** | controller-manager / scheduler：`label.component` = `kube-controller-manager` / `kube-scheduler` 的 `healthyBackends`；etcd：`GET /apis[/clusters/{c}]/monitoring.coreos.com/v1/namespaces/kubesphere-monitoring-system/servicemonitors/etcd` 200/404 | controller-manager/scheduler：正常（匹配到且 healthyBackends > 0）/ 异常（匹配到但为 0）/ 未上报（匹配不到）；etcd：已接入监控 / 未接入 / 无权限（403）/ 失败（5xx，带重试）；探测失败不判为「未接入」 |
| 模块开关 | 集群对象 `GET /kapis[/clusters/{c}]/resources.kubesphere.io/v1alpha1/clusters/{c}`（或列表同款） | **JSON** | `status.configz.{servicemesh,monitoring,logging,devops}` | 未启用 → 「未安装」 |
| 就绪判断 | 集群列表（路由层） | **JSON** | 集群项 `ready === false`（Ready 条件为假或缺失时为 false） | 命中 → 页面不挂载，路由层整页接管 `cluster:not-ready`；`ready` 缺失 → 页面挂载 |

统一规则：以上端点全部返回 JSON，不传 `responseType: 'text'`；成员集群的集群段紧跟 `/kapis` 或 `/apis`；状态分区三块各自独立降级，不做跨块回退，也不用 host 的数据代替成员集群；页面「自动刷新」开关对趋势与状态分区三查询同时生效（5 秒一次），关闭或卸载即停止。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-07 — 成员集群未就绪时读返回 500，不是 403，也不是空数据

实测（2026-11-18，`test` 集群无 Ready 条件）：`/kapis/clusters/test/resources.kubesphere.io/v1alpha2/componenthealth` 与 `.../v1alpha3/nodes/stats` 均返回 **HTTP 500**，body 文本 `Internal Server Error: "/kapis/...": cluster test is not ready`。按 403 处理会显示「无权限」（错误归因）；按空数据 200 处理会显示 0/0 或空态（把未知说成 0）。两者的正确处理都是先判集群 Ready 条件，未就绪整页等待。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-08 — nodes/stats 的 healthy/total 不是厂商键

`nodes/stats` 返回 `{"cambricon":1,"healthy":1,"total":1}`：`healthy` / `total` 是汇总字段，必须从厂商列表与占比分母中剔除，否则会出现名为「healthy」的厂商。`CPU` 键表示没有 XPU 的节点（旧页把它显示为「无 XPU 节点」行），新页把它归一化后作为 CPU 行展示并计入占比分母（`vendorKey('CPU')` → `CPU`，标签 `node.vendor.cpu`）。这是**真实信息**（集群有节点、只是没有加速卡），隐藏成空态会把「有节点没卡」误报成「没有数据」；空态只在各厂商计数合计为 0 时出现。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-09 — 旧页厂商占比没乘 100

旧实现 `(count / total).toFixed(2)` 得到 `1.00` 却直接拼 `%`，页面显示「英伟达 3 节点 (1.00%)」（实为 100%；2026-11-18 成员集群 `agent` 正常态实测，截图 [assets/cluster-monitor-status-20261118/old-agent.png](../../../docs/plans/assets/cluster-monitor-status-20261118/old-agent.png)）。新页占比按百分比计算（×100）并保留合理精度。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-10 — 旧页 Kube AI Hub 恒为 0/0

旧 store 的组件数据键是 `kubesphere`（以及 `openpitrix` / `kubeSystem` 等），而模板取 `counts.kubeaihub`，两个名字对不上；`counts` 里没有 `kubeaihub`，`get(..., 0)` 兜底后永远渲染 `0/0`（2026-11-18 成员集群 `agent` 正常态实测，截图 [assets/cluster-monitor-status-20261118/old-agent.png](../../../docs/plans/assets/cluster-monitor-status-20261118/old-agent.png)，与旧 store 源码 `stores/monitoring/component.js` 共同证实）。新页按命名空间聚合 `healthyBackends` / `totalBackends`，修掉这个恒零缺陷。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-11 — 「未就绪」判断在路由层/概览页，监控页此前没有该分支

旧 console 的监控页（`clusters/containers/Monitor/Cluster/index.jsx`）只做 Banner + 页签路由，没有 Ready 判断；整页等待只存在于集群概览的 `Initializing` 视图。新 console 的集群作用域路由层已经有统一接管（`cluster:not-ready`），因此本页的未就绪契约是「页面不挂载」，不是「页面内渲染等待视图」——不能从旧监控页「已支持未就绪」反推，也不要再在页面里加第二套。路由层接管依赖集群列表的 `ready === false`；`ready` 缺失（列表读取中或读取失败）时不接管。部署构建可能尚未包含该路由层（本地/新构建才有），验收时先确认构建版本。

## 页签 IA 与图表化（2026-11-18）

> 背景：2026-11-18 用户对比旧 console 的 5 个页签后指出两处未承接——（a）旧页「概览 / 物理资源监控 / API Server 监控 / 调度器监控 / 资源用量排行」应按场景逐一迁移，不得平铺成一屏；（b）概览的节点健康/厂商分布图表缺失，资源用量应是「主图 + 明细」。本批（增量 1）恢复页内页签 IA（一个导航入口、五个页签、`?tab=` 深链），在 ai-kit 引入 recharts 并新增 `DonutChart`，概览恢复环图/构成图/3×2 磁贴与主图+明细，物理资源页签把 29 张卡合并为 18 张多序列大图，APIServer / Scheduler / 排行各自成为页签。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-18 — 页签 IA 用页内 Tabs + 路由 search 参数，而非独立子路由或本地状态

**为什么**：旧 console 的监控每个页签是一个子路由（`/clusters/:cluster/monitor-cluster/<tab>`），侧栏里「集群状态」是一个入口、进去后有 5 个基础页签（etcd 接入监控时另有条件 etcd 页签）。新 console 的集群监控入口已经是 `/monitor`，产品要求「一个导航入口、基础 5 页签 + 条件 etcd 页签」。页内 Tabs + `?tab=<key>` 同时满足四件事：侧栏只有一个入口；URL 可保存/分享/直接粘贴；刷新后停在原页签；不新增路由目录，权限与集群就绪判断仍在同一路由上，面包屑与侧栏高亮不用分叉。数据归属上，页签各自挂载自己的主查询，页头持有时间窗，切页签不会把未挂载页签的数据也拉一遍。

**被否方案**：
- 旧形态的每个页签独立子路由：导航多出 5 个与「监控」语义重叠的入口，需要重复权限/就绪判断，且与「一个动作一个入口」的导航决定冲突。
- 页签状态放本地 `useState`（不写 URL）：刷新、分享、书签都会回到概览，页签 IA 等于没有深链。
- 维持平铺单页：2026-11-18 被用户判定为「只迁移了概览、丢失其他页签内容」。

**何时重新考虑**：某个页签需要独立的权限、就绪判断或独立时间窗时，再拆成子路由；或页面需要同时并排看两个页签时，改为分区布局。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-19 — 切页签用 `replace: true`，不把返回键变成页签步行器

**为什么**：页签切换在语义上是「在同一页里换内容」，不是「进入新页面」。若每次切页签都 push 一条历史，读一遍五个页签就要按五次返回才能离开监控页，浏览器的返回键会被页签占用；而深链（直接打开 `?tab=...`）与刷新定位仍由 search 参数保证。因此切换路径统一 `navigate({ search: { tab }, replace: true })`，只有从其它页面进入监控页时才产生一条历史。

**被否方案**：push 每次切换（返回键变成页签步行器，与「页签是页内状态」的语义冲突）；不写 URL（失去深链，AC-11 的 URL 同步与非法值忽略都无从验证）。

**何时重新考虑**：用户明确要求「返回键回到上一个页签」时；届时用 push 并在文档里把该行为列为验收项。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-20 — ai-kit 引入 recharts 并新增 DonutChart；折线继续用 TrendChart

**为什么**：本批需要环图/构成图，旧页是 recharts 饼图。自绘 SVG 环图要自己处理扇区路径、比例、图例、无障碍与主题，而 ai-kit 的 `TrendChart` 已经承担折线（多序列/坐标轴/读数）。只在 ai-kit 引入一次 recharts（独立 pnpm 项目，`^3.11.0`，不进入 kube-frontend workspace），新增 `DonutChart` 供概览与后续构成场景复用；折线保持 `TrendChart` 不动，避免二次实现与既有 3 处消费者回归。

**被否方案**：
- 继续不引入图表库，用数字 + 比例条（2026-11-18 被用户判为观感与信息密度退化；`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-13` 因此被 `DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-26` 取代）。
- 页面内自绘 SVG 环图/饼图（与「一套共享组件」冲突，主题 token、空态与可访问性会分叉）。
- 把 TrendChart 也迁到 recharts（改动面大、既有消费者与单测要一起改，收益低）。

**何时重新考虑**：图表类型继续增长（柱状/堆叠/热力）或需要统一交互（缩放/刷选）时，可把折线也迁到 recharts 并评估 bundle 体积。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-21 — 概览「主图 + 明细」，而不是 7 个页签或 7 张同权卡片

**为什么**：旧概览的「集群资源用量」是 7 个 StatusTabs，每次只看一张图；7 张等宽卡片平铺则趋势图太小、首屏被图表占满。「左侧 7 行当前值（used/total）+ 右侧一张可选指标大图」同时回答「多少」与「形状」：左列是精确当前值与指标选择器，右列是当前选中指标的趋势，且主图面积明显大于明细行。

**被否方案**：保留 7 个页签（与页面级页签叠加成两级页签，读者要在两级之间切换）；7 张同权卡片平铺（趋势图小、没有主次）；只保留一张固定总图（看不出 CPU/内存/磁盘分别在哪）。

**何时重新考虑**：需要同时对比多条用量曲线时，改为多序列（同单位）或增加「对比」模式。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-22 — 物理资源页签按场景分组、多序列合并为 18 张大图

**为什么**：旧「物理资源监控」一列约三十张图，其中读/写吞吐、读/写 IOPS、网络收发、Pod 三态、负载 1/5/15、RDMA 端口/吞吐/错误本来就是「同一指标的不同身份」。拆成 29 张同权卡会丢失同图比较，还要求读者自己对齐时间轴。本批把身份合并成一张多序列图（TrendChart 的 `series`），保持 18 张，按 GPU/主机/磁盘/网络/RDMA 分组；组标题只做分区不折叠（延续 `DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-06` 的结论，但物理资源整体成为页面级页签）。

**被否方案**：29 张卡片平铺（现状，页面长且横向比较丢失）；每指标一张二级页签（又一层页签）；保留旧 Overview 的 7 个 StatusTabs。

**何时重新考虑**：某组指标继续增长（>30 张图）时，可把组做成页内折叠或二级导航。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-23 — 基础五个页签与条件 etcd 页签共用页头一套时间窗与自动刷新；页签懒挂载、各自查询

**为什么**：一个动作一个入口：时间窗与刷新是页面级动作，页签是内容（基础五个页签与条件 etcd 页签共用这一套）。若每个页签各有一套时间窗，同一页会出现两套时间语义，切页签还会重置读者刚设的窗口。页签各自持有主查询（而非页面一次拉全部）才能在切换时不请求未挂载页签的数据，并让每个页签的主查询独立降级（一页签失败不拖垮另一页签）。

**被否方案**：
- 每页签独立时间窗/播放控制（旧 console 组件面板各自 50×2m；本轮不做，登记后续，不是永久结论）。
- 页面一次性拉全部页签指标（切页签快，但首屏慢、未看页签也请求、单块失败影响整页）。
- 所有页签保持挂载只隐藏（recharts 在 `display:none` 容器里宽度为 0；未挂载页签仍会取数，与 AC-11 冲突）。

**何时重新考虑**：监控 API 支持服务端聚合，或页面需要「同屏对比两个页签」时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-24 — 排行页签复用 NodeRankingPanel + `aiIdPrefix`，导出 JSON

**为什么**：节点用量排行的表格逻辑（服务端分页/排序/搜索/指标切换）已经在独立页 `node-usage` 使用。页签内复制一份会分叉空态/错误/分页行为。给 `NodeRankingPanel` 加 `aiIdPrefix`，同一组件在两个入口产出不同 `data-ai-id`，不重复写表格。导出由页面从「当前 metric/order 的行」生成 JSON，不引入后端导出接口。

**被否方案**：页签内复制排行实现（两份状态机）；新增后端导出接口（本批只读、契约不改后端）；导出 CSV/Excel（本批只要 JSON，格式扩展另立）。

**何时重新考虑**：后端提供导出接口，或排行数据量超过浏览器可承载时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-25 — 排行导出范围：优先全量，退化为已加载页并如实标注

**为什么**：导出是「把当前看到的排行带走」，因此应包含当前 metric/order 的全部行，而不只是当前页。`nodeRankingApi` 支持 `pageSize=-1` 或可逐页拉取时导全量；不支持时导出已加载页，并在文件中记录范围与原因，避免读者以为拿到了全量。无数据时禁用按钮而不是生成空文件。

**被否方案**：只导出当前页（用户常以为拿到全部）；导出空文件或无提示；把导出做成服务端任务（超出本批）。

**何时重新考虑**：后端支持全量/异步导出时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-26 — 状态行恢复环图 + 构成图 + 3×2 磁贴，取代 DEC-13 的列表+比例条

**为什么**：2026-11-18 用户对比旧页指出：节点健康与厂商分布必须是图表（编号环/饼图），数值 + 比例条被判定为观感与信息密度退化；组件状态在旧页是 3×2 磁贴。本批用 ai-kit 的 `MetricRing`（单值占比）与新增 `DonutChart`（构成）恢复图形形态，组件状态改为 3×2 磁贴 + 核心组件一行。数据语义不变（`AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08` 的 healthy/total、厂商占比口径、CPU 行、未安装/未上报等）。

**被否方案**：继续列表 + 比例条（`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-13` 原方案，被用户反馈否决）；页面内自绘环图；直接移植旧 recharts 饼图组件（旧组件带旧主题与自定义 `activeShape`，无法复用）。

**何时重新考虑**：环图/构成图需要做交互（hover 读数、点击筛选、跨集群对比）时，扩展 DonutChart 能力。

> `DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-13` 的「不引入图表库」前提已被 `DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-20` 取代；`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-13` 保留为历史与「列表可读性」论据，但不再是现状。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-27 — etcd 恢复为条件页签，与旧 `requireETCD` 一致

**为什么**：旧 console 的 etcd 页签只在 `kubesphere-monitoring-system/etcd` ServiceMonitor 存在（探测 200）时出现，否则隐藏；AC-07 需要 etcd 组件图与「未上报」说明的落点。本批保留页内页签形态，但把 etcd 作为第 6 个**条件页签**（不是页面级独立路由）：可见性由同一探测决定，隐藏时 `?tab=etcd` 回退概览。这样既保持旧页「没接入就不显示」的语义，又不把 etcd 说明塞进 APIServer / 调度器页签。

**被否方案**：
- 塞进 API Server 页签当子组：页签语义变成「控制面 + etcd」，与页签名不符。
- 始终显示 etcd 页签、无数据时给说明：会改变页签数量与旧页 requireETCD 的可感知行为（产品要求恢复旧行为）。
- 不做 etcd：AC-07 没有落点，追溯断裂。

**何时重新考虑**：平台改为按安装状态决定监控入口，或 etcd 有真实健康数据源（leader/延迟/成员级）时，另立真实健康项。

> 探测失败（403/5xx）与 404 一样按隐藏处理，不把未知当已接入；页签条不提供「探测失败」单独画面（旧页 parity），限制见交付记录未验收项。

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-04 — 概览 7 行用量与主图指标

| 行 key | 当前值 used / total | 大图指标（单位） |
| --- | --- | --- |
| gpuMemory | `cluster_gpu_memory_usage` / `cluster_gpu_memory_total`（bytes） | `cluster_gpu_memory_utilisation`（0–1 ×100，%） |
| gpu | `cluster_gpu_usage` / `cluster_gpu_total`（卡） | `cluster_gpu_utilization`（0–1 ×100，%） |
| gpuAllocated | `cluster_gpu_allocated` / `cluster_gpu_total`（卡） | `cluster_gpu_allocated`（整数，卡） |
| cpu | `cluster_cpu_usage` / `cluster_cpu_total`（核） | `cluster_cpu_utilisation`（0–1 ×100，%） |
| memory | `cluster_memory_usage_wo_cache` / `cluster_memory_total`（bytes） | `cluster_memory_utilisation`（0–1 ×100，%） |
| disk | `cluster_disk_size_usage` / `cluster_disk_size_capacity`（bytes） | `cluster_disk_size_utilisation`（0–1 ×100，%） |
| pods | `cluster_pod_running_count` / `cluster_pod_quota`（个） | `cluster_pod_running_count`（整数，个） |

概览同一次 range 查询还携带 RDMA 状态块的指标：`cluster_ib_health`、`cluster_ib_port_up` / `cluster_ib_port_total`、`cluster_ib_tx_bytes` / `cluster_ib_rx_bytes`、`cluster_ib_rx_errors` / `cluster_ib_retrans`（块内页签与端口清单见 `CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-08`）。7 行用量任一行缺 used/total 时显示「-」且主图空态，不填 0；比率 >1 时可显示 >100%（超配）不做截断，轴上限取数据峰值；一次 range 查询取回上述全部指标，比率按时间戳配对相除，不按下标 zip。

**行标签与图表标题是两个事实。** 行标签是资源名（GPU 显存 / GPU 卡 / 已分配 GPU 卡数 / CPU / 内存 / 磁盘 / 容器组），图表标题才是比率名（…使用率）；两者用不同 locale key。把「使用率」贴到 used/total 值上会读成「显存使用率 118 GiB / 276 GiB」——A100 复验时实际发生过。大盘按 total 选单位、两侧同刻度；TiB 级保留两位小数（0.24 TiB / 5.89 TiB），其余一位。

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-05 — 物理资源页签 18 张图与序列

| 组 | 图 key | 序列（身份） | 指标 | 呈现 |
| --- | --- | --- | --- | --- |
| gpu | gpuMemory | 单序列 | `cluster_gpu_memory_utilisation` | 0–1 ×100，% |
| gpu | gpuUtilization | 单序列 | `cluster_gpu_utilization` | 0–1 ×100，% |
| gpu | gpuAllocated | 单序列 | `cluster_gpu_allocated` | 卡，整数 |
| host | cpu | 单序列 | `cluster_cpu_utilisation` | 0–1 ×100，% |
| host | memory | 单序列 | `cluster_memory_utilisation` | 0–1 ×100，% |
| host | load | load1/load5/load15 | `cluster_load1` / `cluster_load5` / `cluster_load15` | 两位小数 |
| host | diskUsage | 单序列 | `cluster_disk_size_usage` | B/KiB/MiB/GiB |
| host | inode | 单序列 | `cluster_disk_inode_utilisation` | 0–1 ×100，% |
| host | pods | running/completed/abnormal | `cluster_pod_running_count` / `cluster_pod_succeeded_count` / `cluster_pod_abnormal_count` | 个，整数 |
| disk | throughput | read/write | `cluster_disk_read_throughput` / `cluster_disk_write_throughput` | B/s |
| disk | iops | read/write | `cluster_disk_read_iops` / `cluster_disk_write_iops` | 两位小数 |
| network | traffic | tx/rx | `cluster_net_bytes_transmitted` / `cluster_net_bytes_received` | B/s |
| rdma | health | 单序列 | `cluster_ib_health` | 0–1 ×100，% |
| rdma | ports | portUp/portTotal | `cluster_ib_port_up` / `cluster_ib_port_total` | 个，整数 |
| rdma | throughput | tx/rx | `cluster_ib_tx_bytes` / `cluster_ib_rx_bytes` | B/s |
| rdma | linkSpeed | 单序列 | `cluster_ib_link_speed` | bit/s → Gb/s，一位小数 |
| rdma | errors | rxErrors/retrans/discards | `cluster_ib_rx_errors` / `cluster_ib_retrans` / `cluster_ib_discards` | 个，整数 |
| rdma | linkDowned | 单序列 | `cluster_ib_link_downed` | 个，整数 |

查询：本页签一次 range 查询取上述全部指标；某条在本部署不存在（返回 0 序列）时该图显示空态说明，并在交付记录里列出缺失指标，不改契约（`AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13`）。

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-06 — 页签 IA、深链与观测点

- 路由：`/kube-frontend/clusters/$cluster/monitor`；search `tab` ∈ overview|resource|apiserver|scheduler|ranking|etcd；未知值忽略；无参数 = overview；etcd 仅在 ServiceMonitor 200 时可见，隐藏时 `?tab=etcd` 按 overview 渲染；切页签 `navigate({ search: { tab }, replace: true })`。
- 页签标签：`cluster.monitor.tab.*`；页签 `data-ai-id="cluster-monitor:tab:<key>"`；内容容器 `cluster-monitor:tabpanel:<key>`。
- 条件 etcd 页签：`cluster-monitor:tab:etcd` / `cluster-monitor:tabpanel:etcd`；仅在 `kubesphere-monitoring-system/etcd` ServiceMonitor 探测为 200 时存在，404/探测失败时页签与面板都不渲染。
- 页头：`cluster-monitor:surface`（`data-ai-state` = 当前页签主查询）、`cluster-monitor:range:<key>`、`cluster-monitor:auto-refresh`、`cluster-monitor:retry`。
- 概览：`cluster-monitor:overview`、`:overview:node-ring` + `:node-ring:value`、`:overview:vendor-donut` + `:overview:vendor:<vendor>`、`cluster-monitor:status:components` + `:components:service:<ns>` / `:components:core:<key>`、`:overview:usage` + `:usage:<key>` + `:usage:<key>:value`、`:overview:usage-chart` + `:usage-chart:legend`、`:overview:rdma`、`:overview:view-rdma`。
- 物理资源：`cluster-monitor:resource`、`:resource:group:<gpu|host|disk|network|rdma>`、`:resource:chart:<key>`、`:chart:<key>:legend`、`:chart:<key>:empty`。
- API Server：`cluster-monitor:apiserver:chart:latency`、`:chart:rate`；调度器：`cluster-monitor:scheduler:chart:attempts`、`:chart:rate`、`:chart:latency`。
- 排行：`cluster-monitor:ranking`；导出 `cluster-monitor:ranking:export`（独立页为 `node-usage:export`）。
- DonutChart：根 `role="img" aria-label`，图例行 `data-ai-segment="<key>"`；无数据只渲染 `emptyText`，不渲染 SVG。
- 节点详情变体无页签，不产生上述页签句柄。

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-07 — 排行导出 JSON

导出文件名 `node.usage.rank.json`，内容 `{cluster, metric, order, generatedAt, items:[{name, values}]}`；items 来自当前 metric/order 的全部行（后端支持全量时；否则已加载页并在文件与交付记录中标注范围）；无数据时按钮禁用（`cluster.nodeUsage.exportEmpty`），不生成文件；下载用 Blob + `a.download` 并 revoke object URL；两处入口（排行页签 / node-usage 页）形状一致，句柄前缀分别为 `cluster-monitor:ranking:` 与 `node-usage:`。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-12 — recharts 颜色：`rgb(var(--ai-chart-N))` 需要解析

`TREND_SERIES_COLORS` 是 `rgb(var(--ai-chart-N))` 字符串（CSS 变量语义色）。TrendChart 直接在 SVG 属性里使用没问题，但 recharts 的 `fill`/`stroke` 与图例色块、颜色计算路径不一定能解析 `var()`。`DonutChart` 必须从 `getComputedStyle(document.documentElement)` 读 `--ai-chart-N` 再拼成 `rgb(...)`（失败时回退内置调色板），且不得在 ai-kit 新增硬编码十六进制；主题切换后需重新解析（订阅主题或按主题 key 重算）。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-13 — 比率指标 ×100，且超配可 >100%

`cluster_*_utilisation`、`cluster_gpu_*_utilisation`、`cluster_ib_health` 是 0–1 比值，必须 ×100 显示百分比；但这些比率在超配/错误聚合时可能 >1，页面不能把值截到 100%，轴上限也不能固定 100（取数据峰值）。用量行 used/total 同理；「显示 100%」与「显示 -」是两件事，缺序列不能填 0 或 100。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-14 — 隐藏容器里的图表宽度为 0：页签必须懒挂载

recharts 的 `ResponsiveContainer` 在 `display:none` 容器里测量到宽度 0；若所有页签都挂载只隐藏，切到某个页签时图表可能保持 0 高/0 宽。页签内容必须**只在选中时挂载**（离开即卸载），这同时也是 AC-11「切页签不请求未挂载页签」的实现基础。不要用 CSS 隐藏来省掉挂载成本。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-15 — 深链与 replace：URL 是页签的唯一真相

`Route.useSearch()` 的 `tab` 是任意字符串，必须经 `parseMonitorTab` 收窄；无参数/非法值不写回 `?tab=overview`，保持 `/monitor` 的规范 URL，避免每次进入都污染历史与分享链接；切页签用 `navigate({ search: { tab }, replace: true })`，不要手工拼 `location.search` 或 `window.history`（会绕过路由与严格模式）。测试可用 `page.goto(?tab=...)` 验证深链，再用一次点击验证 URL 同步。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-16 — 排行导出：全量、文件名与 Blob 生命周期

`nodeRankingApi` 是否接受 `pageSize=-1` 必须实测；若后端忽略该参数仍只返回一页，页面会误以为拿到全量——实现要核对返回行数与 total（或逐页拉取到 total 满），并把实际范围写进交付记录。下载用 `Blob` + `a.download`，文件名固定 `node.usage.rank.json`；`URL.revokeObjectURL` 必须在 click 后调用，避免长会话泄漏；无数据时不要生成空文件（按钮禁用 + `exportEmpty` 提示）。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-17 — etcd 页签可见性：探测失败一律隐藏，不能把未知当已接入

条件 etcd 页签的可见性由 `GET /apis[/clusters/{c}]/monitoring.coreos.com/v1/namespaces/kubesphere-monitoring-system/servicemonitors/etcd` 决定：200 显示、404（未接入）隐藏；探测失败（403/5xx/网络）也隐藏——旧 `requireETCD` 的行为是「拿不到就当没有」，不能把失败当已接入。代价是页签条无法区分「没接入」与「探测失败」，这是本批接受的 parity 限制；接入 etcd 监控的集群上再复验正分支。探测查询的缓存键必须含 cluster，且只影响页签可见性，不阻塞其它页签。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-18 — 库装在 ai-kit 自己的 pnpm 项目里，会带第二份 React

recharts 属于 `console/packages/ai-kit`（独立 pnpm install，React 18），app 的 React 是 19。直接 import 会在构建/测试里混入 React 18：构建仍成功，运行/单测报「A React Element from an older version of React was rendered」。三件事缺一不可：
1) `apps/console-next/vite.config.ts` 与 `vitest.config.ts` 都加 `resolve.dedupe: ['react','react-dom']` **并显式 alias** react/react-dom 到 app 的 node_modules（vitest 对 linked 包的依赖解析不会只靠 dedupe）；
2) 图表能力放**子路径**（`@kube-ai-hub/ai-kit/charts`、`@kube-ai-hub/ui/charts`），不进主 barrel，否则每个 import ui barrel 的页面/测试都会被动加载 recharts；
3) app 单测用 `test/stubs/recharts.tsx` 替身（jsdom 不验绘图，真实 DonutChart 由 ai-kit 自己的 React 18 测试覆盖），并给 charts 子路径配 alias。
同时把 recharts 及其运行依赖拆到独立 `vendor-charts` chunk（`manualChunks` 规则要匹配到 `ai-kit/src/charts.ts` **和** `primitives/DonutChart`，否则 DonutChart 仍被吞进 ai-kit chunk 并随首屏 preload）。实测拆分后 index.html 不再 preload charts chunk，monitor 路由才加载（97.5 KB gzip）。

## 概览两块恢复：RDMA 状态与服务组件监控（2026-11-18 晚）

> 背景：用户对比旧 console 概览后指出新页缺两块——「RDMA 状态」的 4 指标页签与「服务组件监控」。增量 1 把 RDMA 退化成 4 个数字 + 跳转按钮，服务组件监控整块缺失；本批恢复为旧页的两块图表面板，并把概览分区顺序固定为四段。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-28 — 概览恢复 RDMA 状态为 4 指标页签 + 曲线 + 异常节点清单，删除「查看 RDMA 趋势」按钮

**为什么**：旧 overview 的 RDMA 块是 4 个指标页签（health / ports / throughput / errors），每页签一张曲线，并在图上列出端口异常的节点；增量 1 只剩 4 个数字 + 一个跳转按钮，用户对比旧页判为「缺失」。RDMA 是织物故障在概览里唯一的可视化入口：数字摘要看不出「什么时候开始抖」「哪个节点端口掉了」。恢复为「左列 4 页签（名称 + 当前值）选择指标，右侧大图 + 图例 + 当前值」，端口清单（独立读取）在图上给出异常节点。删除跳转按钮：4 个指标已在概览可见，再放「查看 RDMA 趋势」是重复入口；RDMA 明细分组仍在物理资源监控页签（一个动作一个入口）。

**被否方案**：
- 保持数字摘要 + 跳转按钮（用户反馈的退化形态，且按钮与块内 4 个指标重复）。
- 4 张图平铺（旧页是页签式；平铺会让概览过长，与用量主图抢层级）。
- 把物理资源 RDMA 组的图表整块嵌进概览（与物理资源页签重复，且把「明细」塞进「概览」）。

**何时重新考虑**：产品需要在概览内交互式缩放或并排对比多个 RDMA 指标时（扩展页签为多图同屏）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-29 — RDMA 端口清单必须用路径集群段，`?cluster=` 不可信

**为什么**：实测 mlu370 2026-11-18：`GET /kapis/rdma.kubesphere.io/v1alpha1/ports?cluster=agent` 返回 **200 但 items 为空（0 条）**（参数被忽略，读的是 host），而 `GET /kapis/clusters/agent/rdma.kubesphere.io/v1alpha1/ports` 返回成员集群的 **16 条**端口。若按 query 形态实现，成员集群的端口清单会退化成 host 的一条，页面可能显示「所有 RDMA 端口均正常。」——把「读错集群/没读到」说成「健康」，比 404 更危险。api-client 用 `clusterScoped` 统一路径（宪法 C6：集群段紧跟 `/kapis` 或 `/apis`），端口清单不例外。

**被否方案**：`?cluster=` 参数（实测对成员集群无效）；前端按 cluster 名手拼 host/成员两套路径（与 `clusterScoped` 重复且易漏）。

**何时重新考虑**：后端把 cluster 作为查询参数正确实现并通过成员集群实测后（届时仍建议保留路径形态作为默认）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-30 — 概览服务组件监控复用 `componentMonitorQueries`，不复制查询

**为什么**：旧 overview 的第 4 块是控制面预览：APIServer 请求延迟（按 verb）与速率、调度器尝试次数与速率。增量 1 整块缺失。本批在概览恢复该块，并复用 API Server / 调度器页签的同一查询（`useComponentMetrics`）与身份合并（`toComponentCharts`）：同一响应、同一时间窗、同一 verb/result 合并规则，概览与页签不会出现「同一时刻两个数」或「一个页签有 APPLY 线、概览没有」；也不新增两套缓存与重试逻辑。

**被否方案**：概览内另写 4 个查询（两套缓存与身份合并，概览与页签容易对不上）；把整个 API Server / 调度器页签嵌进概览（重复页面，且概览不需要完整明细）。

**何时重新考虑**：概览需要展示与页签不同的时间窗或不同指标集合时。

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-08 — 概览 RDMA 状态块：页签、指标、单位与句柄

| 项 | 内容 |
| --- | --- |
| 根与页签 | `cluster-monitor:overview:rdma`（section）；`:rdma:tabs`；`:rdma:tab:<health|ports|throughput|errors>`（顺序固定 health → ports → throughput → errors），当前值 `:rdma:tab:<key>:value` |
| 指标与单位 | health = `cluster_ib_health` ×100（%，最多一位小数）；ports = `cluster_ib_port_up` / `cluster_ib_port_total`（整数，以 / 分隔）；throughput = `cluster_ib_tx_bytes` / `cluster_ib_rx_bytes`（B/KiB/MiB/GiB 每秒）；errors = `cluster_ib_rx_errors` / `cluster_ib_retrans`（整数） |
| 图 | `:rdma:chart`（`data-ai-state` = ready/empty；`:chart:now`、`:chart:empty`）、`:rdma:chart:legend`、`:rdma:legend:<metric>`；TrendChart 带坐标轴/网格/交互读数；health 1 条、ports/throughput/errors 各 2 条；无序列只显示 `:empty`，不画零线 |
| 端口清单 | `GET /kapis[/clusters/<c>]/rdma.kubesphere.io/v1alpha1/ports?limit=-1`；成功且有 `healthy=false` → `:rdma:abnormal`（节点行 `:rdma:abnormal:<node>`，文案「down/total 个端口不可用」，按异常端口数降序）；全正常 → `:rdma:no-abnormal`「所有 RDMA 端口均正常。」；读取失败（404/403/5xx/网络）→ `:rdma:inventory-unavailable`「RDMA 端口清单不可用」 |
| 数据来源 | 4 组指标并入概览同一次 range 查询（`RDMA_BLOCK_METRICS`），与用量块共用窗口；端口清单独立读取（staleTime 30s） |
| 入口 | 概览不再渲染 `cluster-monitor:overview:view-rdma`（按钮删除）；RDMA 明细分组在物理资源监控页签 |

### CON-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-09 — 概览服务组件监控块：页签、指标、身份与单位

| 项 | 内容 |
| --- | --- |
| 根与页签 | `cluster-monitor:overview:components`（section）；`:components:tabs`；`:components:tab:<latency|requestRate|attempts|attemptRate>`（顺序固定），当前值 `:components:tab:<key>:value` |
| 数据与身份 | latency = `apiserver_request_by_verb_latencies`（`verb`）+ `apiserver_request_latencies`（总平均）；requestRate = `apiserver_request_rate`；attempts = `scheduler_schedule_attempts`（`result`，累积整数）；attemptRate = `scheduler_schedule_attempt_rate`（`result`，次/秒） |
| 单位 | latency：API 秒 ×1000 → ms（两位小数）；requestRate / attemptRate：次/秒（两位小数）；attempts：整数 |
| 图与状态 | `:components:chart`（`data-ai-state` = loading/ready/empty/error；`:chart:now`、`:chart:empty`）、`:components:chart:legend`、`:components:legend:<line>`；loading 骨架；empty 显示 `cluster.monitor.components.notReported` 说明；error 用 ResourceErrorPanel + `:components:retry`（403 无重试） |
| 复用 | `componentMonitorQueries` 的 `useComponentMetrics` / `toComponentCharts`，与 API Server / 调度器页签同一查询与身份合并（`DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-30`） |

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-31 — 图卡首屏用静态 spec 渲染真实卡片骨架

**为什么**：加载态原先画的是两块固定 256px 的灰底 `Skeleton`，而就绪态是若干张 160px 图表的卡片网格，两者高度不同，数据到达时整页跳动；`ChartPanel` 还曾把骨架叠在图表上方（220px 面板首屏量出 468px，下面露出空坐标轴）。

现在的做法是：加载态渲染**真实的** `ClusterChartCard`，只把 `loading` 置为 true。卡片自己画标题条（20px）、`ChartSkeleton`（轴刻度 + 脉冲带 + 图例占位，与绘图区同高）与图例行（16px），三段与就绪态一一对应，因此卡片高度在数据到达前后不变（实测 282 → 282）。`ChartSkeleton` 的 `legend` 开关就是为这种「骨架要顶替整张图、含图例」的场景加的。

**关键细节**：加载态的卡片清单必须来自**静态 spec**（`RESOURCE_CHARTS` / `toComponentCharts(component, [], t)`），不能来自响应构建的 `charts`——首屏它为空，骨架会一张都画不出来，页面从空白直接跳到满屏，比原来的灰底更差。

**被否方案**：在页面里为加载态手写一组占位卡片。四张卡片的标题、内边距、图例行都得重写一遍，任何一处与真实卡片不一致都会重新引入跳动。

**何时重新考虑**：若某页的图表数量在加载前无法确定（例如由响应决定分组），骨架就退回「与就绪态同高的一整块」，并在 AC 里写明高度关系。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-20 — 骨架里的空态段落会让卡片在数据到达时变矮

`ClusterChartCard` 的 `hasData === false` 分支渲染「无数据」段落（`py-6`，实测 68px）。加载态传 `hasData={false}` 时这段也会渲染，于是骨架卡片比就绪态高 68px，数据到达后卡片变矮、页面往上跳。空态说明属于「已经有答案」的状态，加载态必须显式跳过它（`loading ? null : …`）。

同理，标题占位的高度要按真实标题的行高取（`text-sm` + `font-medium` = 20px），写 `h-3.5`（14px）会差 6px；图例占位要显式给 `h-4`，否则内容为空时行高塌成 0。

### GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-19 — `?cluster=` 对 RDMA 端口清单无效：实测 0 条 vs 路径形态 16 条

实测（mlu370，2026-11-18）：`GET /kapis/rdma.kubesphere.io/v1alpha1/ports?cluster=agent` → 200 但 `items=[]`（0 条）；`GET /kapis/clusters/agent/rdma.kubesphere.io/v1alpha1/ports` → 成员集群 16 条端口。前者不会报错，只会让页面「没有异常端口」，即把「读错集群/没读到」显示成「所有 RDMA 端口均正常」——静默错误比 404 更危险。所有集群级读都必须用 `clusterScoped` 路径（`/kapis/clusters/<c>/...` 或 `/apis/clusters/<c>/...`），端口清单不例外；query 形态只在 host 上恰好可用（host 只有 1 条端口），不能据此认为成员集群也可用。验收时可用「成员集群端口数 16 ≠ host 1」区分两种形态。



