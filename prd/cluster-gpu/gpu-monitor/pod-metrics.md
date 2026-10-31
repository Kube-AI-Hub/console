# 容器/POD 维度指标（L3）

[子模块需求](./_index.md)

## 概述

Pod 与工作负载监控页的 GPU 图表。回答「这个任务用了多少 GPU」：显存用量、使用量、分配量。数据来自 gpu-agent 的 POD 级指标（`gpu_agent_pod_*`），经 recording rules 滚成 `pod:gpu_*`。

这是三个维度里**最难做准**的一个：有的虚拟化方式能直接读到容器级用量，有的只能按分配比例分摊。

## 用户故事

### US1 - 作为集群运维，看某个推理实例用了多少显存

**Independent Test**：打开一个 GPU Pod 的监控页，GPU 显存用量非零，且与节点上该 Pod 对应的卡显存增量大致相等。

### US2 - 作为集群运维，按工作负载看 GPU 总量

**Independent Test**：打开一个 Deployment 的监控页，GPU 分配量等于该 Deployment 所有 Pod 的分配量之和。

### US3 - 作为集群运维，知道某个数值是近似的

**Independent Test**：在 `mig` 模式下，Pod 监控有值；页面上（或文档里）说明该值是「按分配显存比例分摊的近似」。

## 验收场景

- **AC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01** — Given 一个 Pod 在 `hami-core` 模式下分到 1 个 vGPU 与 8192Mi 显存，When 打开该 Pod 的监控页，Then GPU 显存用量曲线非零、GPU 分配量为 1，且不出现未翻译的 key。

## 设计目标

- **POD 级指标必须存在，哪怕是近似。** 空曲线无法区分「没用 GPU」与「采不到」。近似值 + 文档说明优于留空。
- **分配量与用量分开。** 分配量是调度结果（可精确），用量是运行时观测（可能近似）。两者混在一个字段里会让运维无法判断「这个任务是占着卡还是真在用」。

## 约束与边界

- 指标来自 `gpu_agent_pod_*`，标签 `node/namespace/pod/vendor/model`。
- `pod:gpu_*` 是 recording rule 从 `gpu_agent_pod_*` 滚出来的，供 Pod / 命名空间 / 工作负载 / 集群四级复用。
- 取数来源按厂商与模式分派，见 `vendor-dispatch.md`。页面不做分派。
- 与 Pod 列表的边界：Pod 列表的 GPU 请求来自 k8s resource limits，监控的分配量来自 gpu-agent 的分配注解；两者不一致说明 device plugin 没写注解（`default` 模式下由 gpu-agent 补写）。

## UI 交互设计

| 图表 | 单位 | 数据 |
| --- | --- | --- |
| GPU 显存用量 | GiB | `pod_gpu_memory_usage` |
| GPU 使用量 | % | `pod_gpu_usage` |
| GPU 分配量 | 卡当量 | `pod_gpu_allocated` |

工作负载页把同名 Pod 的序列按 `owner_kind`/`owner_name` 聚合。

## 文案与校验

| 指标 | 语义 | 聚合 |
| --- | --- | --- |
| `pod:gpu_usage:count` | Pod GPU 使用量 | `sum by (namespace, pod, vendor) (gpu_agent_pod_utilisation / 100)` |
| `pod:gpu_memory_usage:bytes` | Pod 显存用量 | `sum by (namespace, pod, vendor) (gpu_agent_pod_memory_used_bytes)` |
| `pod:gpu_allocated:count` | Pod 分配量 | `sum by (namespace, pod, vendor) (gpu_agent_pod_gpu_allocation)` |

## 边界情况

| 情况 | 对外行为 |
| --- | --- |
| Pod 未申请 GPU | 不出现 GPU 图表 |
| 容器级指标取不到 | 用分配到的卡指标按显存比例近似（见 `vendor-dispatch.md`） |
| Pod 已结束 | 序列停止，保留历史 |
| 一个 Pod 多容器共享一张卡 | 分配量按容器累加，可能与 Pod 请求数不一致（已知） |
| Pod 迁移到别的节点 | 按 `node` 标签区分，曲线不连续 |

## 功能需求

- **FR-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01**：系统必须在 Pod 与工作负载监控页展示 GPU 显存、使用量、分配量三条曲线。
- **FR-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-02**：Pod 的 GPU 分配量必须与 `hami.io/vgpu-devices-allocated` 注解的设备条数一致。

## 成功标准

- **SC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01**：同一命名空间内所有 Pod 的分配量之和等于命名空间级指标值。

## 明确不做

- 不做容器级（单容器）图表，只有 Pod 级。
- 不做跨命名空间对比。
- 不做精确的 per-container 用量（受虚拟化方式限制）。

## 假设

- gpu-agent 能读到 Pod 的分配注解（`default` 模式下它自己补写）。
- recording rules 已加载。

## 验收用例

- L3：`TC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01`
