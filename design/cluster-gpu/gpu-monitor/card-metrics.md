# 卡维度指标 · 技术方案（L3）

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS`

## 概述

单卡详情页按 `gpu_uuid` 过滤卡级指标。数据来自 `gpu_card_*`（exporter 直出），经 `promql.go` 的 `gpu_card_*` 模板查询，模板里用 `max without(instance, pod, container, endpoint, job, service)` 合并多实例碎片。

## 关联需求

- `AC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01`

## 设计目标与非目标

- **目标**：一张卡一页、数值隔离；分配率与利用率分开表达。
- **非目标**：不做多卡叠加；不做 ECC/XID 明细。

## 关键约束

- `gpu_uuid` 由 URL 传入，必须解码。
- 卡级指标必须有 `uuid` 标签，否则无法过滤。
- `gpu_card_*` 是 exporter 直出的名字，`gpu_card_memory_usage` 等是 kapis 侧的别名。

## 方案决策

### DEC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01：kapis 侧用别名，不用 exporter 原名

- **备选**：① 页面直接用 `gpu_card_memory_used_bytes`；② kapis 侧登记别名 `gpu_card_memory_usage` 映射过去。
- **选定**：②
- **原因**：页面只认 kapis 的名字，exporter 改名时只改 `promql.go` 一处。这也是 `named_metrics.go` 存在的意义。
- **被否方案**：① 页面与 exporter 强耦合。
- **何时重新考虑**：不重新考虑。

### DEC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-02：`max without(...)` 而非 `avg`

- **备选**：① `max without(instance, ...)`；② `avg without(instance, ...)`。
- **选定**：①
- **原因**：gpu-agent 重启时新旧两个 Pod 可能同时被抓到，同一 UUID 会出现两条序列。取 `max` 保留「更完整」的那条；`avg` 会在过渡期给出一个两者平均的假值。
- **被否方案**：② 过渡期数值失真。
- **何时重新考虑**：gpu-agent 改成单实例部署时（不再需要去重）。

## 系统现状

### 数据流

`dcgm/mlu/npu/自采 → CardMetric → exporter → gpu_card_* → Prometheus → gpu_card_* (kapis 别名) → 单卡页`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `HAMi/pkg/gpu-agent/exporter/prometheus.go` | `CardMetricsToFamilies` | 不做聚合 |
| `kube-server/.../promql.go` | 别名与去重 | 不做单位换算 |
| `console/.../GpuDetail/tabs/Monitoring.jsx` | 五条曲线 | 不计算 |

## 仓库落点

| 层 | 仓库 | 路径 |
| --- | --- | --- |
| 指标定义 | `HAMi` | `pkg/gpu-agent/exporter/prometheus.go` |
| 查询模板 | `kube-server` | `pkg/simple/client/monitoring/prometheus/promql.go` |
| 指标登记 | `kube-server` | `pkg/models/monitoring/named_metrics.go` |
| 页面 | `console` | `src/pages/clusters/containers/Nodes/Detail/GpuDetail/tabs/Monitoring.jsx` |

## 对外契约

- **CON-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01** — `gpu_card_*` 六条指标都必须带 `uuid` 标签；查询时 `gpu_uuid` 作为 label selector 传入。
- **CON-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-02** — `gpu_card_allocation_rate` 是 0–1 的比例（exporter 侧），kapis 的 `gpu_card_allocation_rate` 在页面上按 % 显示。

## 不变量

- **INV-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01** — 同一 `(node, uuid)` 在去重后只有一条序列。
- **INV-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-02** — 单卡页的曲线条数等于该卡实际可得的指标数（缺项显示空态）。

## 已知坑

- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01** — `gpu_card_allocation_rate` 在 exporter 里是 `VGPUUsed / max(VGPUTotal, 1)`，是 0–1；页面按 % 显示要乘 100。别和 `gpu_card_utilisation`（已是 0–100）混。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-02** — UUID 里可能有 `-`，URL 编码后是 `%2D` 或无变化；`decodeURIComponent` 必须做，否则查不到序列。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-03** — MIG 模式下 UUID 是父卡 UUID，不是 MIG 实例 UUID。单卡页显示的是整卡聚合值。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-04** — 厂商不提供功耗/温度时（部分 MLU 型号），对应序列不存在，页面显示空态而不是 0。

## 测试与可观测

- `curl -s 'prometheus:9090/api/v1/query?query=gpu_card_utilisation{uuid="GPU-..."}'`
- UI 用例：`TC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01`。

## 后续改进

- 在卡级指标里加 `mode` 标签，页面可直接显示该卡当前模式。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01`
