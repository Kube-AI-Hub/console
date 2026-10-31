# 厂商与虚拟化方式分派 · 技术方案（L3）

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH`

## 概述

`CollectMetrics` 是唯一的分派点：每个厂商的 collector 实现自己的 `CollectMetrics`，内部按虚拟化方式选择卡级与 POD 级来源，对外只返回 `MetricsResult{CardMetrics, PodMetrics}`。

## 关联需求

- `AC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01`

## 设计目标与非目标

- **目标**：新增厂商/模式只改一个 collector 文件；对外指标名不变。
- **非目标**：不做多厂商混合节点；不透出原始指标名。

## 关键约束

- collector 通过 `xpu-vendor` 标签选择；一个节点只有一个厂商。
- exporter 是 co-located resolver：只找**同节点**的 exporter Pod，不跨节点。
- 近似必须有据可依（分配注解），不能凭空。

## 方案决策

### DEC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01：分派在 collector，不在 exporter

- **备选**：① exporter 里按 vendor 分支；② 每个 collector 的 `CollectMetrics` 自己分派。
- **选定**：②
- **原因**：各厂商的原始指标结构完全不同（DCGM 的 `DCGM_FI_DEV_*`、mlu-exporter 的 `mlu_*`、npu-exporter 的 `npu_chip_info_*`），解析逻辑天然属于厂商。exporter 只负责把 `MetricsResult` 转成 Prometheus families，保持厂商无关。
- **被否方案**：① exporter 会变成一个巨大的 switch，且每加一个厂商都要改它。
- **何时重新考虑**：不重新考虑。

### DEC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-02：近似用分配注解的 `gpumem` 比例

- **备选**：① 均分；② 按 `gpumem`；③ 按 `gpucores`。
- **选定**：②
- **原因**：`gpumem` 是 MiB 的确定值，直接可加；`gpucores` 是百分比，多个 Pod 的百分比之和可能超过 100（超卖），比例会失真。
- **被否方案**：① 失真；③ 超卖时比例无意义。
- **何时重新考虑**：拿到 per-container 实测用量时。

## 系统现状

### 数据流

`xpu-vendor 标签 → 选 collector → collector.CollectMetrics → 按 mode 分派 podMetricsFrom* → MetricsResult → exporter`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `pkg/gpu-agent/collector/collector.go` | `Collector` 接口与选择 | 不解析指标 |
| `pkg/gpu-agent/collector/nvidia_metrics.go` | NVIDIA 三种模式分派 | 不做输出 |
| `pkg/gpu-agent/collector/cambricon_metrics.go` | MLU 四种模式 | 同上 |
| `pkg/gpu-agent/collector/ascend_metrics.go` | NPU | 同上 |
| `pkg/gpu-agent/exporter/prometheus.go` | 统一输出 | 不分厂商 |

## 仓库落点

| 层 | 仓库 | 路径 |
| --- | --- | --- |
| 分派 | `HAMi` | `pkg/gpu-agent/collector/*_metrics.go` |
| 输出 | `HAMi` | `pkg/gpu-agent/exporter/prometheus.go` |
| exporter 发现 | `HAMi` | `pkg/gpu-agent/collector/exporter_endpoint.go` |

## 对外契约

- **CON-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01** — 无论厂商与模式，`CardMetric` 与 `PodMetric` 的字段集合固定（见 `types.go`）；exporter 只读这些字段。
- **CON-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-02** — 取不到某字段时填 0 而不是省略；页面无法区分「0」与「不支持」，所以厂商不支持某项时 exporter 应**不产出该指标族**而不是产出 0。

## 不变量

- **INV-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01** — 任一 `(node, uuid)` 组合只由一个 collector 产出。
- **INV-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-02** — 近似的 Pod 指标与卡指标的加权和相等（在同一卡上，按 `gpumem` 比例分摊时成立）。

## 已知坑

- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01** — co-located resolver 通过 Pod 标签找同节点 exporter。标签写错（如 `app.kubernetes.io/name=dcgm-exporter` 与实际不符）时会解析失败，表现是所有卡指标为空但 agent 本身正常。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-02** — 昇腾的 npu-exporter 用整数 chip 序号做 `id` 标签，HAMi 用 UUID。`ascend_metrics.go` 里做了 remap，漏掉会导致卡级指标对不上 Pod 分配。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-03** — 寒武纪 `dynamic-smlu` 下卡级 `mlu_utilization{vf=""}` 常为 0，`cardUtilFromSMLUSum` 用实例加权和补出来。直接读卡级值会得到「卡空闲」的错误结论。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-04** — 新增厂商时必须同时改：collector、`xpu-vendor` 的 nodeSelector、chart 的子 chart、本表、recording rules（如果新增了标签）。

## 测试与可观测

- 每个 collector 的 `CollectMetrics` 用假 exporter 响应做单测（`pkg/gpu-agent/collector/*_test.go`）。
- 现场：`curl -s hami-gpu-agent:9101/metrics | grep -E 'gpu_card_|gpu_agent_pod_' | head`。
- UI 用例：`TC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01`。

## 后续改进

- 给近似值加 `estimated` 标签。
- 把「厂商 × 模式 → 来源」做成代码里的常量表，避免文档与实现漂移。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01`
