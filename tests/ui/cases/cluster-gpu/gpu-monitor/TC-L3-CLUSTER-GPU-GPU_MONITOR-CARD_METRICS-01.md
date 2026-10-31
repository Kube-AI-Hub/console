# TC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01 卡维度指标 · 按 UUID 隔离

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-monitor` `card-metrics`
- **入口**: `{BASE_URL}/clusters/default/nodes/{node}/gpus/{uuid}/status`
- **需求**: `prd/cluster-gpu/gpu-monitor/card-metrics.md`

## 产品功能

单卡 Monitoring 页签只显示这一张卡的五项指标，与同节点其它卡不同。

### 关联需求

- `prd/cluster-gpu/gpu-monitor/card-metrics.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-monitor/card-metrics.md`](../../../../prd/cluster-gpu/gpu-monitor/card-metrics.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01** — Given 节点上有两张卡、只有一张在跑负载，When 分别打开这两张卡的 Monitoring 页签，Then 两页的曲线数值不同，且各自与对应 UUID 的 `gpu_card_*` 序列一致。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-monitor/card-metrics.md`](../../../../design/cluster-gpu/gpu-monitor/card-metrics.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-monitor/card-metrics.md`](../../../../prd/cluster-gpu/gpu-monitor/card-metrics.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，看某一张卡的利用率和显存是不是被别的任务抢满了


**Independent Test**：从节点显卡列表点进一张正在跑负载的卡，Monitoring 页签利用率接近 100%、显存用量接近总量；同节点另一张空闲卡的曲线是 0。

### US2 - 作为集群运维，从功耗与温度判断这张卡是否过热降频


**Independent Test**：功耗曲线接近 TDP、温度曲线接近上限时，运维据此判断需要迁移负载。

## 前置与配置

- 已登录，且在 default 集群
- 节点上有至少两张卡，其中一张在跑负载

## 测试步骤

1. 从节点运行状态页点一张有负载的卡的 UUID
2. 切到 Monitoring 页签，记录五条曲线的峰值
3. 返回，点另一张空闲卡的 UUID，切到 Monitoring

## 期望结果

- 两次的曲线数值明显不同
- 有负载卡的利用率明显高于空闲卡
- 每页都有使用率、显存用量、分配率、功耗、温度五项
- 不出现未翻译的 key

## 失败排查

- 两页数值相同说明 gpu_uuid 没传到查询
- 缺某项时确认 exporter 是否产出该指标族

## 产品改版后如何更新自动化

- 指标名变化时改 pages 与 expected
