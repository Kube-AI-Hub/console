# 卡维度指标（L3）

[子模块需求](./_index.md)

## 概述

单卡详情页的 Monitoring 页签。回答「这一张卡用得多满」：利用率、显存用量、分配率、功耗、温度。按 `gpu_uuid` 过滤，只反映这一张卡。

## 用户故事

### US1 - 作为集群运维，看某一张卡的利用率和显存是不是被别的任务抢满了

**Independent Test**：从节点显卡列表点进一张正在跑负载的卡，Monitoring 页签利用率接近 100%、显存用量接近总量；同节点另一张空闲卡的曲线是 0。

### US2 - 作为集群运维，从功耗与温度判断这张卡是否过热降频

**Independent Test**：功耗曲线接近 TDP、温度曲线接近上限时，运维据此判断需要迁移负载。

## 验收场景

- **AC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01** — Given 节点上有两张卡、只有一张在跑负载，When 分别打开这两张卡的 Monitoring 页签，Then 两页的曲线数值不同，且各自与对应 UUID 的 `gpu_card_*` 序列一致。

## 设计目标

- **一张卡一页，数值必须按 UUID 隔离。** 单卡页若不过滤 `gpu_uuid`，会把同节点其它卡的值混进来，运维会误判「这张卡满载了」。
- **分配率与利用率分开表达。** 利用率是「现在算得多满」，分配率是「已经承诺出去多少」。一张卡可以分配率 100% 但利用率 0%（任务占着卡没跑），这两个数必须能同时看到。

## 约束与边界

- 指标来自 `gpu_card_*`（卡级），不来自节点聚合。
- `gpu_uuid` 是 URL 里的参数（`encodeURIComponent` 处理过的 UUID），页面必须解码后再传。
- 与显卡列表的边界：列表的「显存 / 核心 / vGPU」是 `node-gpu-info` 的快照，Monitoring 是时间序列；同一时刻两者应一致，不一致说明采集与抓取周期不同步。
- 与节点监控的边界：节点值 = 该节点所有卡值的平均/求和，单卡页只显示一张。

## UI 交互设计

| 图表 | 单位 | 数据 |
| --- | --- | --- |
| GPU 使用率 | % | `gpu_card_utilisation` |
| GPU 显存用量 | GiB | `gpu_card_memory_usage` |
| GPU 分配率 | % | `gpu_card_allocation_rate` |
| GPU 功耗 | W | `gpu_card_power` |
| GPU 温度 | °C | `gpu_card_temperature` |

## 文案与校验

| 指标 | 语义 | 来源 |
| --- | --- | --- |
| `gpu_card_utilisation` | 卡核心利用率 0–100 | `gpu_card_utilisation`（exporter 直出） |
| `gpu_card_memory_usage` | 卡显存已用字节 | `gpu_card_memory_used_bytes` |
| `gpu_card_memory_total` | 卡显存总量字节 | `gpu_card_memory_total_bytes` |
| `gpu_card_allocation_rate` | 已分配/可分配 | `gpu_agent_card_allocation_rate` |
| `gpu_card_power` | 功耗 W | `gpu_card_power_watts` |
| `gpu_card_temperature` | 温度 °C | `gpu_card_temperature_celsius` |

## 边界情况

| 情况 | 对外行为 |
| --- | --- |
| UUID 不存在 | 页面显示空态，不报错 |
| UUID 含特殊字符 | URL 里 `encodeURIComponent`，读取时解码 |
| 卡被摘除（不健康） | 曲线停止更新，保留历史 |
| 厂商不提供功耗/温度 | 该图表显示空态，不显示 0 |
| 同一 UUID 在多个 exporter 上报 | PromQL 用 `max without(instance,...)` 去重，避免多实例碎片 |

## 功能需求

- **FR-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01**：系统必须按 `gpu_uuid` 过滤卡级指标。
- **FR-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-02**：系统必须展示利用率、显存、分配率、功耗、温度五项，缺项显示空态而非 0。

## 成功标准

- **SC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01**：单卡页的数值与 Prometheus 里同 UUID 的序列一致。

## 明确不做

- 不做卡级历史对比（同一张卡跨时间对比）。
- 不做多卡叠加图。
- 不做卡的 ECC / XID 明细（那在健康状态里）。

## 假设

- 卡级 exporter（DCGM / mlu / npu / 自采）在跑且指标名已统一。
- URL 里的 UUID 与 `node-gpu-info` 里的 `devices[].id` 一致。

## 验收用例

- L3：`TC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01`
