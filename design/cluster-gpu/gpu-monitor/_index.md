# GPU 监控 · 技术方案（L2）

## 概述

三个维度（节点 / 卡 / Pod）共用一套指标：HAMi 的 gpu-agent 把各厂商、各虚拟化方式的原始数据统一成 `gpu_card_*` 与 `gpu_agent_pod_*`，Prometheus 抓取后用 recording rules 滚成 `node:gpu_*` / `pod:gpu_*` / `namespace:gpu_*`，console 只经 monitoring kapis 读。

## 关联需求

- `AC-FULL-CLUSTER-GPU-GPU_MONITOR-01`

## 设计目标与非目标

**目标**：页面不感知厂商与虚拟化方式；三个维度的口径能互相印证；取不到精确值时显式近似。

**非目标**：不做告警；不做历史导出；不展示厂商原始指标名。

## 关键约束

- **指标名由 HAMi 定义**。console 与 kube-server 不定义、不改写指标名，只在 `named_metrics.go` 登记已存在的名字，在 `promql.go` 写查询模板。
- 页面只经 `monitoring.kubesphere.io/v1alpha3`，不直连 Prometheus。
- 时间序列点数上限 500，超出由后端放稀 step。

## 页面与技术结构

```text
HAMi（生产者）
  pkg/gpu-agent/collector/*.go            各厂商采集 → CardMetric / PodMetric
  pkg/gpu-agent/exporter/prometheus.go    统一成 gpu_card_* / gpu_agent_pod_*
  cmd/gpu-agent/main.go                   /metrics :9101

Prometheus
  ServiceMonitor hami-gpu-agent           抓取
  PrometheusRule cluster-gpu-k8s-rules    pod:gpu_* / node:gpu_* / namespace:gpu_*

kube-server（透出）
  pkg/models/monitoring/named_metrics.go  登记指标名
  pkg/simple/client/monitoring/prometheus/promql.go  PromQL 模板
  pkg/kapis/monitoring/...                monitoring kapis

console（展示）
  src/pages/clusters/containers/Nodes/Detail/Monitoring/index.jsx        节点监控
  src/pages/clusters/containers/Nodes/Detail/GpuDetail/tabs/Monitoring.jsx  单卡监控
  src/pages/projects/containers/Pods/Detail/Monitoring.jsx                Pod 监控
  src/pages/clusters/containers/Monitor/Cluster/GPUResource/              集群 GPU 资源
```

## 状态与数据归属

| 事实 | 唯一来源 | 谁读 |
| --- | --- | --- |
| 卡级利用率/显存/功耗/温度 | `gpu_card_*`（gpu-agent exporter） | Prometheus → kapis → 页面 |
| 卡级分配率 | `gpu_agent_card_allocation_rate` | 同上 |
| Pod 级利用率/显存/分配量 | `gpu_agent_pod_*` | 同上 |
| 节点级聚合 | `node:gpu_*`（recording rules） | 同上 |
| Pod/命名空间/工作负载聚合 | `pod:gpu_*` / `namespace:gpu_*` | 同上 |

## 关键契约与依赖

- **CON-FULL-CLUSTER_GPU-GPU_MONITOR-01** — 卡级指标名固定为 `gpu_card_utilisation` / `gpu_card_memory_used_bytes` / `gpu_card_memory_total_bytes` / `gpu_card_power_watts` / `gpu_card_temperature_celsius` / `gpu_agent_card_allocation_rate`，标签 `node/uuid/vendor/model/device_index`。
- **CON-FULL-CLUSTER_GPU-GPU_MONITOR-02** — Pod 级指标名固定为 `gpu_agent_pod_utilisation` / `gpu_agent_pod_memory_used_bytes` / `gpu_agent_pod_gpu_allocation`，标签 `node/namespace/pod/vendor/model`。
- **CON-FULL-CLUSTER_GPU-GPU_MONITOR-03** — 指标名与标签的定义正文在 `HAMi` 的 `pkg/gpu-agent/exporter/prometheus.go`；改这里必须同步改 `cluster-gpu-k8s-rules`。
- **CON-FULL-CLUSTER_GPU-GPU_MONITOR-04** — kapis 侧的查询模板在 `promql.go`，每条都用 `max without(instance, pod, container, endpoint, job, service)` 合并多实例碎片。

## 不变量

- **INV-FULL-CLUSTER_GPU-GPU_MONITOR-01** — 同一 UUID 在卡级序列里只有一条（`max without` 去重后）。
- **INV-FULL-CLUSTER_GPU-GPU_MONITOR-02** — `node:gpu_total:count` 等于该节点卡级序列条数。
- **INV-FULL-CLUSTER_GPU-GPU_MONITOR-03** — `pod:gpu_allocated:count` 等于该 Pod 的 `vgpu-devices-allocated` 注解设备条数。

## 已知坑

- **GOT-FULL-CLUSTER_GPU-GPU_MONITOR-01** — **改 gpu-agent 的指标名或标签而不改 recording rules，Pod/工作负载监控会静默变空**。`pod:gpu_*` 的表达式直接引用 `gpu_agent_pod_*`，名字变了规则就算不出东西，Prometheus 不报错，页面只是没有曲线。
- **GOT-FULL-CLUSTER_GPU-GPU_MONITOR-02** — `max without(instance, pod, ...)` 是为了合并 gpu-agent 重启前后的多个 Pod 实例。去掉它会让曲线断裂成多段。
- **GOT-FULL-CLUSTER_GPU-GPU_MONITOR-03** — `node_gpu_utilisation` 在 `handler.go` 里被乘了 100（`v * 100`），而 `gpu_card_utilisation` 本身就是 0–100。两处口径不同，改的时候要一起看。
- **GOT-FULL-CLUSTER_GPU-GPU_MONITOR-04** — 单卡监控页必须传 `gpu_uuid`，否则会拿到同节点全部卡的序列并混在一起。
- **GOT-FULL-CLUSTER_GPU-GPU_MONITOR-05** — gpu-agent 的内部 pod-resources gRPC 超时是 10s，ServiceMonitor 的 `scrapeTimeout` 必须大于它（当前 30s），否则 agent 一卡顿所有抓取就失败、图表全空。

## 测试与可观测

- 现场核对：
  - `curl -s hami-gpu-agent:9101/metrics | grep -c gpu_card_`
  - `curl -s 'prometheus:9090/api/v1/query?query=node:gpu_total:count'`
  - 页面三个维度逐一截图。
- UI 用例：`TC-FULL-CLUSTER_GPU-GPU_MONITOR-01` 与四个 L3 用例。

## 明确不做

- 不做告警规则（`alerting` 模块）。
- 不做跨集群聚合。
- 不做指标名的向后兼容别名（`legacyMetrics` 是 HAMi 侧的可选项，不是页面职责）。

## 后续改进

- 把「该维度指标是精确值还是近似值」作为 tooltip 显示在图表上。
- 指标名与 recording rules 的一致性做成 CI 检查。

## 功能点

- `node-metrics.md` — 节点维度指标
- `card-metrics.md` — 卡维度指标
- `pod-metrics.md` — 容器/POD 维度指标
- `vendor-dispatch.md` — 厂商与虚拟化方式分派

## 验收用例

- `TC-FULL-CLUSTER_GPU-GPU_MONITOR-01`
