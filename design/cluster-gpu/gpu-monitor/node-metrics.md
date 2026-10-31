# 节点维度指标 · 技术方案（L3）

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS`

## 概述

节点监控页的三条 GPU 曲线不是独立采集的，而是 recording rules 从卡级指标聚合出来的。页面读 `node_gpu_*`，`promql.go` 把查询映射到 `node:gpu_*` 规则。

## 关联需求

- `AC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01`

## 设计目标与非目标

- **目标**：节点值与卡值可互相印证；聚合口径只在一处定义。
- **非目标**：不做按型号拆分的节点曲线（在集群页）。

## 关键约束

- 聚合在 Prometheus 侧（recording rules），不在页面或 kube-server。
- 利用率用算术平均，不按卡容量加权。

## 方案决策

### DEC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01：节点指标用 recording rules，不在查询时聚合

- **备选**：① `promql.go` 里直接写 `sum by (node) (gpu_card_*)`；② Prometheus recording rules 预聚合，查询读 `node:gpu_*`。
- **选定**：②
- **原因**：节点聚合被三处用（节点监控、集群 GPU 资源、排行），写在查询模板里会复制三份；预聚合也让长 range 查询便宜得多。
- **被否方案**：① 每个查询都扫全部卡序列，range 查询代价高。
- **何时重新考虑**：需要按任意标签动态聚合时（规则只能预定义固定维度）。

### DEC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-02：利用率用算术平均

- **备选**：① `sum(util) / count(cards)`；② `sum(util × mem) / sum(mem)` 按容量加权。
- **选定**：①
- **原因**：同型号节点上两者等价，而实际集群里混插是少数。加权会让「7 张 40G 卡 + 1 张 80G 卡」的节点算出一个难以解释的数。
- **被否方案**：② 语义更「正确」，但运维难以从卡列表手算验证。
- **何时重新考虑**：混插成为常态时。

## 系统现状

### 数据流

`gpu_card_utilisation (per card) → node:gpu_usage:count (sum by node) → node_gpu_utilisation (kapis) → 节点监控页`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `cluster-gpu-k8s-rules`（集群内 PrometheusRule） | 卡级 → 节点级聚合 | 不做展示 |
| `kube-server/pkg/simple/client/monitoring/prometheus/promql.go` | `node_gpu_*` → `node:gpu_*` 映射 | 不做聚合 |
| `console/.../Nodes/Detail/Monitoring/index.jsx` | 图表渲染 | 不计算 |

## 仓库落点

| 层 | 仓库 | 路径 |
| --- | --- | --- |
| 规则 | 集群资源 | `kubesphere-monitoring-system/cluster-gpu-k8s-rules` |
| 查询模板 | `kube-server` | `pkg/simple/client/monitoring/prometheus/promql.go` |
| 指标登记 | `kube-server` | `pkg/models/monitoring/named_metrics.go` |
| 页面 | `console` | `src/pages/clusters/containers/Nodes/Detail/Monitoring/index.jsx` |

## 对外契约

- **CON-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01** — `node_gpu_utilisation` 是 0–100 的百分比；`node_gpu_memory_usage` 是字节；`node_gpu_allocated` 是卡当量。

## 不变量

- **INV-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01** — `node:gpu_total:count` 等于该节点 `gpu_card_utilisation` 的序列条数。

## 已知坑

- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01** — `handler.go` 的 `listGPURanking` 把 `node_gpu_utilisation` 乘了 100，而 `gpu_card_utilisation` 已是 0–100。同名字段在两处口径不同。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-02** — recording rules 是按 `(node, vendor)` 分组的。多厂商节点会出现两条序列，页面取第一条会漏。
- **GOT-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-03** — 节点刚加入时 `count by (node)` 可能为 0，`node:gpu_allocation_rate` 的分母用 `> 0` 保护，避免除零。

## 测试与可观测

- `curl -s 'prometheus:9090/api/v1/query?query=node:gpu_total:count{node="sagesuite-demo"}'`
- 与 `kubectl get node sagesuite-demo -o jsonpath='{.status.capacity.nvidia\.com/gpu}'` 对比。
- UI 用例：`TC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01`。

## 后续改进

- 混插节点改用加权平均并加说明。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01`
