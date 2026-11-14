# GPU 资源监控 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/gpu-resource.md)

## 概述

页面读监控 API 的**区间查询**：一次请求取两个命名指标（GPU 利用率、显存利用率）在所选窗口内的 matrix，另一个请求开销为零的读法是把计数指标（已分配 / 总数）一起放进同一个 `metrics_filter`。窗口决定 `start`/`end` 与 `step`，页面把比例 ×100 后画成内联 SVG 柱图；没有点就渲染空态。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01

## 设计目标与非目标

**目标**：一屏看清 GPU 利用率与显存的走势；窗口切换同时改变区间与步长；「无数据」与「空闲 0%」有明确区分。

**非目标**：不做单卡 / 节点级 GPU 指标（`gpu_card_*` 需要 `gpu_uuid`，属于单卡监控与排名页）；不做告警、导出、缩放；不引入图表库。

## 关键约束

- 数据只来自监控 API（宪法 C1）：`/kapis/monitoring.kubesphere.io/v1alpha3/cluster`，复用 api-client 的 `rangeMetricsApi`。
- 只使用服务端命名指标（`kube-server/pkg/models/monitoring/named_metrics.go` 的 `cluster_gpu_*`），页面不拼 PromQL、不改指标口径。
- 窗口同时决定区间与步长：1h→60s、6h→5m、24h→15m。
- 比例到百分比只在展示层 ×100；不重新做除法。
- 图表是内联 SVG，不引入图表库。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01 — 用集群级命名指标，而不是 `gpu_card_*` 或直连 Prometheus

**为什么**：`cluster_gpu_utilization` 与 `cluster_gpu_memory_utilisation` 是 ks-apiserver 已经定义的命名指标，`promql.go` 把它们映射到 `cluster:gpu_*:ratio` recording rule；页面只传指标名，指标口径与权限都在服务端一处。实测 1h/6h/24h 三档分别返回 61/73/97 个点，`utilization` 在 [0, 0.53]、`memory_utilisation` 在 [0.678, 0.887]——都是 **0..1 比例**。

**被否方案**：`gpu_card_utilisation` 逐卡查询。该指标需要 `gpu_uuid`，不带参数时 `results` 为空（实测 0 条）；逐卡取数还要先把 15 张卡的 UUID 拉一遍，属于单卡监控，不是「集群忙不忙」。

**被否方案**：直连 Prometheus 的服务代理（`/api/v1/namespaces/kubesphere-monitoring-system/services/…`）。绕过 monitoring API 的命名口径与权限模型，等于在页面里再定义一次指标。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-02 — 窗口同时驱动区间与采样步长

**为什么**：区间接口返回原始采样。固定 60 秒步长在 24h 是 1,440 个点：传输浪费，SVG 柱宽小于一像素、读不出形状。每档窗口配一个把点数稳定在 60–100 的步长（实测 61/73/97），既保留形状又不放大请求。

**被否方案**：固定步长。要么 24h 不可读，要么 1h 只有十几个点。
**被否方案**：让后端做二次聚合。监控 API 的 `step` 已经就是这个能力，再加一层是重复。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-03 — 无数据是空态，不是错误；0% 不是空态

**为什么**：指标缺失时接口返回 200 + 空 results（未知指标名返回 `results: null`），不是 404/500。把空结果当错误会把读者引向网络排查；渲染一张空图表则会让人读成「0% 利用率」，而 0% 恰好是合法数据（集群空闲）。所以：没有点 → 空态并说明依赖；有点且值为 0 → 画零高度柱并显示 0%。

**被否方案**：空数组也画图（读者无法区分「空闲」与「没有采集」）。
**被否方案**：整块隐藏（页面看起来坏了）。

## 系统现状

- 命名指标：`kube-server/pkg/models/monitoring/named_metrics.go` 的 `cluster_gpu_*`；`kube-server/pkg/simple/client/monitoring/prometheus/promql.go` 映射到 `cluster:gpu_utilization:ratio`、`cluster:gpu_memory_usage:bytes / cluster:gpu_memory_total:bytes` 等 recording rule。
- 区间接口：`GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=…&start=<秒>&end=<秒>&step=<dur>&cluster=<id>`；`metrics_filter` 是正则，api-client 的 `rangeMetricsApi` 已把每个指标加 `$` 锚定并用 `|` 连接。
- 数据链：gpu-agent → Prometheus recording rules → monitoring API → 页面。
- 旧 console：`Monitor/Cluster/GpuResourcePage` 分概览 / 物理卡 / 排名三个子页；本页迁「集群概览 + 趋势」的主干，卡级与排名留给 `cluster-gpu/gpu-monitor` 模块。

## 仓库落点

| 层 | 路径 |
| --- | --- |
| 页面 | `apps/console-next/src/pages/cluster/GpuResourcePage.tsx` |
| 路由 | `apps/console-next/src/routes/kube-frontend.clusters.$cluster/gpu-resource/{route,index}.tsx` |
| 取数 | 复用 `packages/api-client/src/cluster.ts` 的 `rangeMetricsApi`（无新增 api-client 代码） |
| 用例 | `tests/ui/{specs,tests}/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01.*` |

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 区间指标 | `/kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=cluster_gpu_utilization$|cluster_gpu_memory_utilisation$|cluster_gpu_allocated$|cluster_gpu_total$&start=<秒>&end=<秒>&step=<60s|5m|15m>&cluster=<id>` |

返回形态：`results[].data.result[]` 为 matrix，`values: [[epoch秒, "比例"], …]`。命名指标：

| 指标 | 含义 | 单位 |
| --- | --- | --- |
| `cluster_gpu_utilization` | 集群 GPU 计算利用率 | ratio（0..1） |
| `cluster_gpu_memory_utilisation` | 集群显存利用率 | ratio（0..1） |
| `cluster_gpu_allocated` | 已分配 GPU 数 | count |
| `cluster_gpu_total` | GPU 总数 | count |

## 不变量

1. 图表只画两个命名指标；页面不拼 PromQL、不做第二套聚合。
2. 比例 ×100 只发生在展示层。
3. 窗口切换必须同时改变请求的 `start`/`end`/`step`，并把当前窗口写进 `data-ai-window`。
4. 窗口内没有采样点 → 空态；有采样点但值为 0 → 0%，不是空态。
5. 不引入图表库；图表是可数柱子的内联 SVG。

## 已知坑

- **`gpu_card_*` 需要 `gpu_uuid`**：不带参数时 `results` 为空（实测 `gpu_card_utilisation` 0 条），不能拿它做集群趋势。
- **`metrics_filter` 是正则**：每个指标要 `$` 锚定、多指标用 `|` 连接；`rangeMetricsApi` 已封装，别自己拼。
- **未知指标名返回 200 + `results: null`**，不是错误：api-client 会得到空数组，页面按空态处理。
- **指标是比例不是百分比**：实测 `cluster_gpu_utilization` 最大 0.53，直接打印会显示 0.53%；必须 ×100。
- **步长要与窗口一起变**：60s × 24h = 1440 点，柱宽不足一像素。
- **窗口要在选定瞬间折算成绝对区间**：把 `Date.now()` 放进 query key 会让每次渲染都变、无限重取。
- **没有 gpu-agent / 监控规则时是空态**：接口 200 + 空结果，不是 500；空态文案要说明依赖，否则读者会以为页面坏了。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01.yaml`。
- 可观测点：`cluster-gpu-resource:surface`（页面状态）、`cluster-gpu-resource:range`（三档按钮，`aria-pressed`）、`cluster-gpu-resource:chart`（`data-ai-window`、`data-ai-points`）、`[data-ai-bar]`（每根柱子）、`cluster-gpu-resource:empty`、`cluster-gpu-resource:summary`（`data-ai-allocated`/`data-ai-total`）、`:utilization`/`:memory` 卡片及其 `:current`/`:empty`。
- 用例侧对账：测试自己请求同一个区间接口，按「是否有采样点」决定断言图表还是空态，避免把环境差异写成产品缺陷。

## 后续改进

- 卡级 GPU 监控（`gpu_card_*` + `gpu_uuid`）与使用排名：属于 `cluster-gpu/gpu-monitor` 模块。
- 增加 7d 窗口（步长 2h），沿用同一套窗口→步长映射。
- 图表交互（hover 读数、缩放）需要图表库，届时重新评估「库 vs 页面体积」的取舍。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01
