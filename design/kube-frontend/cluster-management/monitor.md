# 集群监控 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/monitor.md)

## 概述

四个趋势卡片，数据来自 KubeSphere 监控的 range query；百分比由两条序列相除得到。另有「系统组件」分区：APIServer / Scheduler / etcd 的组件级 range 指标，多序列按 `verb` / `result` / `quantile` 身份分开画。趋势之前是「集群状态」分区：节点在线状态、XPU 厂商分布、组件状态（6 个服务组件 + etcd/controller-manager/scheduler）。集群未就绪时页面不挂载，由集群作用域路由层整页接管为「等待集群加入」，页面内不重复实现等待视图。

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

## 设计目标与非目标

目标：先回答「集群整体是否正常」（节点在线、厂商构成、控制面组件），再回答「趋势如何」；形状与数值同时可读；步长随窗口放大；缺数据、未上报、无权限与失败各自说清。

非目标：下钻、排行、阈值线、组件指标的独立路由页与交互式缩放；不做厂商分布饼图，也不承诺 etcd 的真实健康（只表达是否接入监控）。

## 关键约束

- `GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=…&start=…&end=…&step=…&cluster=…`
- range 返回 `matrix`：`results[].data.result[].values = [[ts, "value"], …]`
- 百分比需要成对的用量/总量序列：`cluster_cpu_usage`/`cluster_cpu_total`、`cluster_memory_usage_wo_cache`/`cluster_memory_total`
- 组件级指标走 `GET /kapis/monitoring.kubesphere.io/v1alpha3/components/{apiserver|scheduler|etcd}?metrics_filter=…&start=…&end=…&step=…&cluster=…`，返回每个 `metric_name` 下的多条 `matrix`，身份在 `data.result[].metric` 的 `verb` / `result` / `quantile` 标签上

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-01 — 内联 SVG，不引入图表库

**为什么**：ai-kit 没有图表库；为了四条折线引入一个库（通常 50KB+ gzip 并带自己的主题体系）比整个监控页 chunk 还大。这里需要的只是「把 N 个点连成线」，即一个 `viewBox` 加一条 `path`。

**被否方案**：引 ECharts/Recharts。它们解决的是坐标轴、缩放、堆叠、tooltip——当前四个指标都不需要。

**何时重新考虑**：需要交互式缩放、多序列叠加或 tooltip 时。

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

## 对外契约

`GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster`，参数 `metrics_filter`（`|` 分隔，每个名字以 `$` 结尾）、`start`、`end`（epoch 秒）、`step`（`60s`/`5m`/`15m`/`2h`）、`cluster`。

`GET /kapis/monitoring.kubesphere.io/v1alpha3/components/{component}`（`component` ∈ `apiserver` / `scheduler` / `etcd`），参数同上。返回 `results[].metric_name` 与 `data.result[]`，每条 `data.result[]` 是一个独立序列，身份在 `metric.verb` / `metric.result` / `metric.quantile`；某条指标在本集群没有采集时仍返回该 `metric_name`，但 `data.result` 为空数组（不是 404，也不是 0）。

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

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01.yaml`、`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06.yaml`（组件多序列/单位）、`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07.yaml`（无数据/错误/无权限分支）。
可观测点：`cluster-monitor:surface`、`cluster-monitor:{cpu,memory,pods,nodes}`、`:latest`、`:empty`、`:chart`、`cluster-monitor:range:<key>`；系统组件：`cluster-monitor:components`、`cluster-monitor:group:{apiserver|scheduler|etcd}`（带 `data-ai-state`）、`cluster-monitor:{apiserver|scheduler|etcd}:<card>`、`:<card>:series:<identity>`、`:<card>:series:<identity>:value`。

集群状态分区（`data-ai-id` 清单，以 `ClusterStatusSection.tsx` 为准）：`cluster-monitor:status`（分区根，`data-ai-state` = loading/ready/empty/error）、`cluster-monitor:status:node-online:card`（节点在线卡，`data-ai-state`；含 `cluster-monitor:status:node-online` 数字、`:node-online:ratio` 比例、`:node-online:link` 节点页入口，以及 `:node-online:loading|unreported|empty|permission|error|retry`）、`cluster-monitor:status:vendor:card`（厂商卡；含 `cluster-monitor:status:vendor` 列表、`:vendor:row:<vendor>`（`data-ai-count`）与 `:vendor:row:<vendor>:count|:percent`、`:vendor:loading|empty|permission|error|retry`）、`cluster-monitor:status:components:card`（组件卡；含 `:components:service:<namespace>`（`data-ai-status` = healthy/unhealthy/not-installed/not-reported）、`:components:core:<etcd|controller-manager|scheduler>`（`data-ai-status`）、`:components:core:etcd:retry`，以及组件查询失败时复用分区前缀的 `cluster-monitor:status:permission|:error|:retry`）。未就绪由路由层接管，用既有句柄 `cluster:not-ready`、`cluster:not-ready-overview` 断言（本页不新增等待视图句柄）。用例按这些句柄断言，不按标题文字猜。

## 后续改进

- 节点用量排行与物理资源下钻（老 console 的独立页）。
- etcd 节点级服务状态（在线 / 有 leader / leader 变更次数，旧 `ETCDNodes` 卡）：本部署无 etcd 序列，无法验收，登记为待补。
- 交互式缩放与 tooltip。
- 成员集群就绪后的状态分区正向数据（本轮只能验收 host/agent 就绪集群的正常态与未就绪集群 `test` 的路由层接管）。
- 真实受限账号下 componenthealth / nodes/stats 的 403 分支（本轮用 route mock）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07


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

