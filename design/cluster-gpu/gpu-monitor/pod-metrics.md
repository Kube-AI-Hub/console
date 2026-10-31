# 容器/POD 维度指标 · 技术方案（L3）

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS`

## 概述

Pod 与工作负载监控页读 `pod_gpu_*`，它由 recording rule 从 `gpu_agent_pod_*` 滚出来。POD 级指标的**取数来源随虚拟化方式变化**，这是三个维度里唯一需要「近似」的地方。

## 关联需求

- `AC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01`

## 设计目标与非目标

- **目标**：POD 级指标始终有值（精确或近似）；分配量与用量分开。
- **非目标**：不做 per-container 精确计量。

## 关键约束

- `gpu_agent_pod_*` 的标签必须含 `namespace` 与 `pod`，否则无法与 kube-state-metrics 关联。
- `pod:gpu_*` 的规则引用 `gpu_agent_pod_*`，改名必须同步。
- 分配量必须与 `vgpu-devices-allocated` 注解一致。

## 方案决策

### DEC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01：按虚拟化方式分派取数，统一出口

- **备选**：① 只用 vGPUmonitor（`hami-core` 才有）；② 只用卡指标按比例分摊；③ 按模式分派：`default` 用 podresources + 卡指标，`hami-core` 用 vGPUmonitor，`mig` 用注解 + 比例。
- **选定**：③
- **原因**：每种方式能拿到的信息不同。`hami-core` 下 vGPUmonitor 能给出容器级真实用量；`default` 下容器独占整卡，卡值就是容器值；`mig` 下没有容器级接口，只能按分配显存比例分摊。统一用一种会牺牲其中两种的精度。
- **被否方案**：① `default`/`mig` 下无数据；② `hami-core` 下精度白丢。
- **何时重新考虑**：DCGM 提供 per-container 指标（`DCGM_FI_PROF_*` 的 container 维度）且覆盖 MIG 时。

### DEC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-02：近似时按 `gpumem` 比例分摊

- **备选**：① 按 Pod 数均分；② 按请求显存（`gpumem`）比例分摊。
- **选定**：②
- **原因**：显存请求是调度时已知的、写在注解里的确定值；按它分摊比按 Pod 数均分更接近真实。两者都只是近似，但前者在「一个 8G 任务 + 一个 32G 任务共享 40G 卡」时明显更准。
- **被否方案**：① 明显失真。
- **何时重新考虑**：有 per-container 实测数据时不再需要分摊。

## 系统现状

### 数据流

`collector.CollectMetrics → PodMetric{Namespace, Pod, Utilisation, MemoryUsed, GPUAllocation} → exporter → gpu_agent_pod_* → pod:gpu_* (rules) → pod_gpu_* (kapis) → Pod 监控页`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `HAMi/pkg/gpu-agent/collector/nvidia_metrics.go` | 按模式分派三个 `podMetricsFrom*` | 不做聚合 |
| `HAMi/pkg/gpu-agent/exporter/prometheus.go` | `PodMetricsToFamilies` | 不做关联 |
| `cluster-gpu-k8s-rules` | `pod:gpu_*` 聚合 + 关联 owner | 不做展示 |
| `kube-server/.../promql.go` | `pod_gpu_*` 模板 | 不做聚合 |

## 仓库落点

| 层 | 仓库 | 路径 |
| --- | --- | --- |
| 采集 | `HAMi` | `pkg/gpu-agent/collector/nvidia_metrics.go` |
| 输出 | `HAMi` | `pkg/gpu-agent/exporter/prometheus.go` |
| 规则 | 集群资源 | `cluster-gpu-k8s-rules` 的 `pod:gpu_*` |
| 查询 | `kube-server` | `pkg/simple/client/monitoring/prometheus/promql.go` |
| 页面 | `console` | `src/pages/projects/containers/Pods/Detail/Monitoring.jsx` |

## 对外契约

- **CON-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01** — `pod:gpu_allocated:count` 的单位是卡当量，1 = 一张整卡；`hami-core` 下 1 个 vGPU 算 1/`deviceSplitCount` 张卡还是 1 张卡，由 exporter 的 `GPUAllocation` 定义（当前按设备数计，即 1）。
- **CON-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-02** — `pod:gpu_memory_usage:bytes` 在近似模式下是分摊值，不是实测值。

## 不变量

- **INV-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01** — 一个 Pod 的 `pod:gpu_allocated:count` 等于其 `vgpu-devices-allocated` 注解的设备条数。
- **INV-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-02** — 同一命名空间内 Pod 的分配量之和等于 `namespace:gpu_allocated:count`。

## 已知坑

- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01** — `GPUAllocation` 在 vGPUmonitor 路径下用「设备数」而不是「设备数 / 切分数」，所以 1 个 vGPU 显示为 1 张卡。这与调度侧的「1/10 张卡」语义不同，是**已知的语义差异**，改它会破坏现有页面的「分配量」含义。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-02** — MIG 路径下若 `deviceMemTotal[uuid]` 为 0（注解缺 `gpumem`），退化为按 Pod 数均分。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-03** — `default` 模式下 Pod 的分配注解由 gpu-agent 自己补写（上游 device plugin 不写），如果 gpu-agent 挂了，Pod 级指标会缺失。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-04** — 一个 Pod 多容器共享一张卡时，注解里每个容器一条，分配量会累加，可能大于 Pod 的 resource limit 请求数。

## 测试与可观测

- `curl -s 'prometheus:9090/api/v1/query?query=pod:gpu_allocated:count'`
- 与 `kubectl get pod <p> -o jsonpath='{.metadata.annotations.hami\.io/vgpu-devices-allocated}'` 对比。
- UI 用例：`TC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01`。

## 后续改进

- 把「近似」标记成指标的 label（`estimated="true"`），页面据此显示提示。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01`
