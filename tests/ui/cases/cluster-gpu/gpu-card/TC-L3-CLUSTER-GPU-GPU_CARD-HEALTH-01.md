# TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01 健康状态 · 故障卡仍列出并标为亚健康

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-card` `health`
- **入口**: `{BASE_URL}/clusters/default/nodes/gpu01/status`
- **需求**: `prd/cluster-gpu/gpu-card/health.md`

## 产品功能

被 device plugin 摘除的卡仍在显卡列表里，状态为亚健康，其余卡为健康。

### 关联需求

- `prd/cluster-gpu/gpu-card/health.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-card/health.md`](../../../../prd/cluster-gpu/gpu-card/health.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — Given 某节点的 register annotation 里有一张设备 `health: false`，When 打开该节点的运行状态页，Then 该设备仍在显卡列表中，状态显示「亚健康」，其余设备显示「健康」。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-card/health.md`](../../../../design/cluster-gpu/gpu-card/health.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-card/health.md`](../../../../prd/cluster-gpu/gpu-card/health.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，看到一张被 device plugin 摘除的卡仍列在表里并标为亚健康


**Independent Test**：在某节点上让 device plugin 把一张卡标记为 unhealthy（或直接改该节点 register annotation 里对应设备的 `health` 为 `false`），刷新 `/clusters/default/nodes/<node>/status`：该卡仍出现在显卡列表里，状态列显示「亚健康」而不是「健康」；`kubectl get node <node> -o jsonpath='{.status.allocatable.nvidia\.com/gpu}'` 比 capacity 小。

## 前置与配置

- 已登录，且在 default 集群
- 目标节点的 register 注解里至少有一张设备 health 为 false，且同一节点至少有一张 health 为 true

## 测试步骤

1. 读取节点上 hami.io/node-nvidia-register 注解，记下 health 为 false 的 UUID 集合
2. 打开 {BASE_URL}/clusters/default/nodes/{node}/status
3. 读取显卡列表每一行的 UUID 与状态

## 期望结果

- 注解里 health 为 false 的每个 UUID 都出现在表格里
- 这些行的状态文本为「亚健康」
- 注解里 health 为 true 的行状态文本为「健康」
- 表格行数等于注解里的设备数

## 失败排查

- 故障卡显示健康时确认接口返回的 health 字段；若接口返回 false 而页面显示健康，问题在 record.health 的取值
- 表格少行时确认该节点 node-gpu-info 注解里的 devices 是否包含这些 UUID

## 产品改版后如何更新自动化

- 状态文案变化时改 pages/gpu_cards.py 的 HEALTHY / SUB_HEALTHY 常量
