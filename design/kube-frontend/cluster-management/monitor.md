# 集群监控 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/monitor.md)

## 概述

四个趋势卡片，数据来自 KubeSphere 监控的 range query；百分比由两条序列相除得到。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02

## 设计目标与非目标

目标：形状与数值同时可读；步长随窗口放大；缺数据要说出来。

非目标：下钻、排行、组件专用面板、阈值线。

## 关键约束

- `GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=…&start=…&end=…&step=…&cluster=…`
- range 返回 `matrix`：`results[].data.result[].values = [[ts, "value"], …]`
- 百分比需要成对的用量/总量序列：`cluster_cpu_usage`/`cluster_cpu_total`、`cluster_memory_usage_wo_cache`/`cluster_memory_total`

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
`/kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=<name># 集群监控 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/monitor.md)

## 概述

四个趋势卡片，数据来自 KubeSphere 监控的 range query；百分比由两条序列相除得到。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02

## 设计目标与非目标

目标：形状与数值同时可读；步长随窗口放大；缺数据要说出来。

非目标：下钻、排行、组件专用面板、阈值线。

## 关键约束

- `GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=…&start=…&end=…&step=…&cluster=…`
- range 返回 `matrix`：`results[].data.result[].values = [[ts, "value"], …]`
- 百分比需要成对的用量/总量序列：`cluster_cpu_usage`/`cluster_cpu_total`、`cluster_memory_usage_wo_cache`/`cluster_memory_total`

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

 对每条返回一条序列），因为换名字会让
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

老 console 的集群监控是独立区域（`/clusters/:cluster/monitor-cluster/*`），含总览、物理资源、etcd、apiserver、scheduler 与节点用量排行。本次迁移实现「总览」的四个趋势；其余（下钻与排行）列入后续。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterMonitorPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/monitor/`
- 区域注册：`apps/console-next/src/areas/registry.ts`（cluster-management 增加 monitor）
- 接口：`packages/api-client/src/cluster.ts` 的 `rangeMetricsApi`
- 文案：`packages/locales/src/index.ts`（`cluster.monitor.*`）

## 对外契约

`GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster`，参数 `metrics_filter`（`|` 分隔，每个名字以 `$` 结尾）、`start`、`end`（epoch 秒）、`step`（`60s`/`5m`/`15m`/`2h`）、`cluster`。

## 不变量

1. 百分比 ∈ [0, 100]，且等于用量 ÷ 同一时刻的总量。
2. 没有总量序列时不画百分比（显示无数据）。
3. 单条曲线点数与所选窗口的步长一致，不随窗口线性膨胀。
4. 无数据不画零线。

## 已知坑

- **单位**：CPU 是核、内存是字节；直接当百分比会得到荒谬数值（本项目实测内存显示 937053405184%）。
- **按时间戳配对**：两条序列分别采样，按下标 zip 在缺一个点时会把 A 时刻的用量除以 B 时刻的总量。
- **`resultType` 可能是 `vector`**：若后端忽略 range 参数，会返回单点；当成趋势画会是一条静止的线，必须按 `result`/`values` 是否存在来判断。
- **`end` 不能每次渲染都取 `Date.now()`**：放进 query key 会导致无限重取；本项目在窗口切换时才重新计算区间。
- **`step` 太小会拖慢**：7 天 × 60s 在慢后端上是几十秒的请求。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01.yaml`
可观测点：`cluster-monitor:surface`、`cluster-monitor:{cpu,memory,pods,nodes}`、`:latest`、`:empty`、`:chart`、`cluster-monitor:range:<key>`。

## 后续改进

- 节点用量排行与物理资源下钻（老 console 的独立页）。
- apiserver / scheduler / etcd 专用面板。
- 交互式缩放与 tooltip。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01


## 自动刷新（R-27 的对应实现）

老 console 的监控卡片有一个「播放/暂停」控制：打开后每 **5 秒**用「最近 N 分钟」重取一次（`utils/monitoring.js` 的 `startAutoRefresh`，`interval: 5000`，且 `autoRefresh` 时把参数设为 `last: true`）。新 UI 此前只有手动刷新（R-26），没有这个开关。

实现：

- 开关状态在页面内，`aria-pressed` 与按钮文案同步（开/关）。
- 每次 tick **把时间窗向前滚动**（`end = now`），而不是重复查询冻结的区间——否则「实时」看不到新采样。
- 定时器在关闭、切窗或卸载时清理；注意该组件里 `window` 是一个局部变量（时间窗对象），必须用 `globalThis.setInterval`。
- 与 R-27 的关系：这是老 console 的真实行为（轮询），已按 parity 交付；WebSocket/watch 推送属后续改进，不阻塞 parity。
