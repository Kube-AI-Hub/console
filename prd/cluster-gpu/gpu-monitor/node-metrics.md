# 节点维度指标（L3）

[子模块需求](./_index.md)

## 概述

节点监控页的 GPU 图表。回答「这台机器的 GPU 整体用得多满」：利用率、显存用量、分配量。三个数都从 gpu-agent 的卡级指标按 `node` 聚合而来，不单独采集。

## 用户故事

### US1 - 作为集群运维，看这台机器 7 张卡整体跑得多满

**Independent Test**：打开 `/clusters/default/nodes/sagesuite-demo/monitors`，GPU 利用率曲线在跑负载时上升到接近 100%，显存用量曲线同步上升。

## 验收场景

- **AC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01** — Given 节点有 7 张卡且其中一张在跑满载负载，When 打开节点监控页，Then GPU 利用率曲线约为 14%（1/7），显存用量约为该卡已用的量，且「GPU 总量」显示 7。

## 设计目标

- **节点值由卡级指标聚合，不另采一套。** 另采一套会与卡级数值不一致，运维无法解释「节点 80% 但每张卡都是 50%」。
- **聚合口径写在 recording rules 里，不写在页面里。** 页面拿到的就是聚合好的序列，换聚合方式不需要改前端。

## 约束与边界

- 节点指标来自 `cluster-gpu-k8s-rules` 的 `node:gpu_*` 规则，规则基于 `gpu_card_*` / `gpu_agent_card_allocation_rate`。
- 利用率是**算术平均**（`sum(...)/count(...)`），不是按卡容量加权——同型号节点上等价，混插节点上会有偏差，已知且接受。
- 与卡级监控的边界：节点页不显示单卡明细，那在显卡列表与单卡详情。

## UI 交互设计

| 图表 | 单位 | 数据 |
| --- | --- | --- |
| GPU 利用率 | % | `node_gpu_utilisation` |
| GPU 显存用量 | GiB | `node_gpu_memory_usage` |
| GPU 分配量 | 卡当量 | `node_gpu_allocated` |

## 文案与校验

| 指标 | 语义 | 聚合 |
| --- | --- | --- |
| `node:gpu_usage:count` | 节点 GPU 使用量（卡当量） | `sum by (node, vendor) (gpu_card_utilisation / 100)` |
| `node:gpu_total:count` | 节点 GPU 总数 | `count by (node, vendor) (gpu_card_utilisation)` |
| `node:gpu_memory_usage:bytes` | 节点显存已用 | `sum by (node, vendor) (gpu_card_memory_used_bytes)` |
| `node:gpu_memory_total:bytes` | 节点显存总量 | `sum by (node, vendor) (gpu_card_memory_total_bytes)` |
| `node:gpu_allocated:count` | 节点已分配（卡当量） | `sum by (node, vendor) (gpu_agent_card_allocation_rate)` |

## 边界情况

| 情况 | 对外行为 |
| --- | --- |
| 节点无 GPU | 不显示 GPU 图表 |
| 只有部分卡上报 | 总量等于上报的卡数（不是物理卡数），页面不修正 |
| exporter 挂掉 | 曲线断开，不补 0 |
| 节点刚加入 | 首个抓取周期前无数据，显示空态 |

## 功能需求

- **FR-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01**：系统必须在节点监控页展示 GPU 利用率、显存用量、分配量三条曲线。
- **FR-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-02**：节点 GPU 总量必须等于该节点上报的卡级序列条数。

## 成功标准

- **SC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01**：节点 GPU 总量与显卡列表行数一致。

## 明确不做

- 不做按型号拆分的节点曲线（集群页有）。
- 不做节点间对比。

## 假设

- `cluster-gpu-k8s-rules` 已部署且被 Prometheus 加载。

## 验收用例

- L3：`TC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01`
