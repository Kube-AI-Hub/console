# TC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01 节点维度指标 · 总量等于卡数

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-monitor` `node-metrics`
- **入口**: `{BASE_URL}/clusters/default/nodes/{node}/monitors`
- **需求**: `prd/cluster-gpu/gpu-monitor/node-metrics.md`

## 产品功能

节点监控页的 GPU 总量等于该节点卡数，利用率是各卡的算术平均。

### 关联需求

- `prd/cluster-gpu/gpu-monitor/node-metrics.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-monitor/node-metrics.md`](../../../../prd/cluster-gpu/gpu-monitor/node-metrics.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01** — Given 节点有 7 张卡且其中一张在跑满载负载，When 打开节点监控页，Then GPU 利用率曲线约为 14%（1/7），显存用量约为该卡已用的量，且「GPU 总量」显示 7。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-monitor/node-metrics.md`](../../../../design/cluster-gpu/gpu-monitor/node-metrics.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-monitor/node-metrics.md`](../../../../prd/cluster-gpu/gpu-monitor/node-metrics.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，看这台机器 7 张卡整体跑得多满


**Independent Test**：打开 `/clusters/default/nodes/sagesuite-demo/monitors`，GPU 利用率曲线在跑负载时上升到接近 100%，显存用量曲线同步上升。

## 前置与配置

- 已登录，且在 default 集群
- 节点有 GPU 且指标已被抓取

## 测试步骤

1. 读取该节点的卡数（capacity 的 nvidia.com/gpu）
2. 打开 {BASE_URL}/clusters/default/nodes/{node}/monitors
3. 读取 GPU 图表的图例与数值范围

## 期望结果

- GPU 总量显示值等于卡数
- 利用率曲线取值在 0 到 100 之间
- 显存曲线单位为 GiB
- 不出现未翻译的 key

## 失败排查

- 总量与卡数不符时查 node:gpu_total:count 规则
- 曲线恒为 0 时确认 gpu_card_utilisation 有序列

## 产品改版后如何更新自动化

- 聚合口径变化时同步改本用例
