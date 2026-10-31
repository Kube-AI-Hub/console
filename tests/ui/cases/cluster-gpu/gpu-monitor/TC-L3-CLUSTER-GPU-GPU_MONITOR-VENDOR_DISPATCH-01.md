# TC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01 厂商与虚拟化方式分派 · hami-core 下 Pod 指标来自 vGPUmonitor

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-monitor` `vendor-dispatch`
- **入口**: `{BASE_URL}/clusters/default/projects/{ns}/pods/{pod}/monitors`
- **需求**: `prd/cluster-gpu/gpu-monitor/vendor-dispatch.md`

## 产品功能

hami-core 模式下，Pod 的 GPU 指标来自 vGPUmonitor 的容器级数据，而不是按卡分摊。

### 关联需求

- `prd/cluster-gpu/gpu-monitor/vendor-dispatch.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-monitor/vendor-dispatch.md`](../../../../prd/cluster-gpu/gpu-monitor/vendor-dispatch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01** — Given 节点是 `hami-core` 模式，When 查看该节点 Pod 的 GPU 指标，Then 数值来自 vGPUmonitor（`vGPU_device_memory_usage_in_bytes`），且与 `nvidia-smi` 观察到的容器用量一致。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-monitor/vendor-dispatch.md`](../../../../design/cluster-gpu/gpu-monitor/vendor-dispatch.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-monitor/vendor-dispatch.md`](../../../../prd/cluster-gpu/gpu-monitor/vendor-dispatch.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，知道 MIG 模式下 Pod 显存为什么是分摊出来的


**Independent Test**：读本文对照表，能找到 `NVIDIA / mig` 行的「POD 级来源」与「近似策略」两列。

### US2 - 作为研发，新增一种虚拟化方式时知道要改哪几处


**Independent Test**：按对照表新增一行，能定位到 gpu-agent 里对应的 `CollectMetrics` 分支。

## 前置与配置

- 已登录，且在 default 集群
- 节点已切成 hami-core，且有一个申请 vGPU 的 Pod 在跑

## 测试步骤

1. 读取节点模式，确认是 hami-core
2. 打开该 Pod 的监控页，记录显存用量
3. 在同节点上再启动一个 GPU Pod，观察两个 Pod 的显存曲线

## 期望结果

- 两个 Pod 的显存曲线不同（不是同一张卡的相同值）
- 显存用量与容器内 nvidia-smi 观察到的量接近
- 页面不展示厂商原始指标名
- 不出现未翻译的 key

## 失败排查

- 两个 Pod 数值相同说明退化成了卡级分摊
- 全为空时确认 vGPUmonitor 的 9394 端口可抓取

## 产品改版后如何更新自动化

- 分派规则变化时同步改
