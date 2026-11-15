# 集群监控 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/monitor.md)

## 概述

四个趋势卡片，数据来自 KubeSphere 监控的 range query；百分比由两条序列相除得到。另有「系统组件」分区：APIServer / Scheduler / etcd 的组件级 range 指标，多序列按 `verb` / `result` / `quantile` 身份分开画。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07

## 设计目标与非目标

目标：形状与数值同时可读；步长随窗口放大；缺数据要说出来。

非目标：下钻、排行、阈值线、组件指标的独立路由页与交互式缩放。

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

老 console 的集群监控是独立区域（`/clusters/:cluster/monitor-cluster/*`），含总览、物理资源、etcd、apiserver、scheduler 与节点用量排行。新 UI 已实现「总览」四个趋势与物理资源五组卡片；本次在同一页补「系统组件」分区（APIServer / Scheduler / etcd），节点用量排行与下钻仍在后续。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterMonitorPage.tsx`
- 组件指标配置与取值：`apps/console-next/src/pages/cluster/componentMonitorQueries.ts`
- 数值格式化：`apps/console-next/src/pages/cluster/monitorFormat.ts`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/monitor/`
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

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01.yaml`、`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06.yaml`（组件多序列/单位）、`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07.yaml`（无数据/错误/无权限分支）。
可观测点：`cluster-monitor:surface`、`cluster-monitor:{cpu,memory,pods,nodes}`、`:latest`、`:empty`、`:chart`、`cluster-monitor:range:<key>`；系统组件：`cluster-monitor:components`、`cluster-monitor:group:{apiserver|scheduler|etcd}`（带 `data-ai-state`）、`cluster-monitor:{apiserver|scheduler|etcd}:<card>`、`:<card>:series:<identity>`、`:<card>:series:<identity>:value`。

## 后续改进

- 节点用量排行与物理资源下钻（老 console 的独立页）。
- etcd 节点级服务状态（在线 / 有 leader / leader 变更次数，旧 `ETCDNodes` 卡）：本部署无 etcd 序列，无法验收，登记为待补。
- 交互式缩放与 tooltip。

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

