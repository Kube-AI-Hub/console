# TC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01 容器/POD 维度指标 · 分配量与注解一致

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-monitor` `pod-metrics`
- **入口**: `{BASE_URL}/clusters/default/projects/{ns}/pods/{pod}/monitors`
- **需求**: `prd/cluster-gpu/gpu-monitor/pod-metrics.md`

## 产品功能

GPU Pod 的监控页有显存、使用量、分配量三条曲线，分配量与分配注解条数一致。

### 关联需求

- `prd/cluster-gpu/gpu-monitor/pod-metrics.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-monitor/pod-metrics.md`](../../../../prd/cluster-gpu/gpu-monitor/pod-metrics.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01** — Given 一个 Pod 在 `hami-core` 模式下分到 1 个 vGPU 与 8192Mi 显存，When 打开该 Pod 的监控页，Then GPU 显存用量曲线非零、GPU 分配量为 1，且不出现未翻译的 key。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-monitor/pod-metrics.md`](../../../../design/cluster-gpu/gpu-monitor/pod-metrics.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-monitor/pod-metrics.md`](../../../../prd/cluster-gpu/gpu-monitor/pod-metrics.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，看某个推理实例用了多少显存


**Independent Test**：打开一个 GPU Pod 的监控页，GPU 显存用量非零，且与节点上该 Pod 对应的卡显存增量大致相等。

### US2 - 作为集群运维，按工作负载看 GPU 总量


**Independent Test**：打开一个 Deployment 的监控页，GPU 分配量等于该 Deployment 所有 Pod 的分配量之和。

### US3 - 作为集群运维，知道某个数值是近似的


**Independent Test**：在 `mig` 模式下，Pod 监控有值；页面上（或文档里）说明该值是「按分配显存比例分摊的近似」。

## 前置与配置

- 已登录，且在 default 集群
- 目标 Pod 已申请 GPU 且处于 Running

## 测试步骤

1. 读取 Pod 的 hami.io/vgpu-devices-allocated 注解，数出设备条数
2. 打开该 Pod 的监控页
3. 读取 GPU 分配量曲线的值

## 期望结果

- 出现 GPU 显存用量、使用量、分配量三条曲线
- 分配量曲线的值等于注解里的设备条数
- 显存用量非零
- 不出现未翻译的 key

## 失败排查

- 分配量为 0 时确认 Pod 注解存在（default 模式下由 gpu-agent 补写）
- 曲线为空时确认 pod:gpu_allocated:count 规则已加载

## 产品改版后如何更新自动化

- 注解键变化时改本用例
