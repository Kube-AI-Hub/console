# TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02 健康状态 · 全部健康时不出现亚健康

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-card` `health`
- **入口**: `{BASE_URL}/clusters/default/nodes/gpu01/status`
- **需求**: `prd/cluster-gpu/gpu-card/health.md`

## 产品功能

节点上全部设备健康时，列表每一行都是健康，不出现亚健康。

### 关联需求

- `prd/cluster-gpu/gpu-card/health.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-card/health.md`](../../../../prd/cluster-gpu/gpu-card/health.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — Given 某节点的 register annotation 里全部设备 `health: true`，When 打开该节点的运行状态页，Then 所有行显示「健康」，不出现任何「亚健康」。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-card/health.md`](../../../../design/cluster-gpu/gpu-card/health.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-card/health.md`](../../../../prd/cluster-gpu/gpu-card/health.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为集群运维，确认健康卡与故障卡在同一张表里可以一眼分辨


**Independent Test**：同一节点上既有健康卡也有故障卡时，状态列按卡分别渲染：健康卡「健康」、故障卡「亚健康」，两者颜色不同；页面不出现未翻译的 key。

## 前置与配置

- 已登录，且在 default 集群
- 目标节点的 register 注解里所有设备 health 均为 true

## 测试步骤

1. 读取节点上 hami.io/node-nvidia-register 注解，确认所有设备 health 为 true
2. 打开 {BASE_URL}/clusters/default/nodes/{node}/status
3. 统计显卡列表里「亚健康」的行数

## 期望结果

- 亚健康行数为 0
- 每行状态文本为「健康」
- 页面不出现未翻译的 key

## 失败排查

- 出现亚健康时先看 register 注解里是否真有 health:false，再看接口返回值
- 全部显示亚健康时确认注解解析是否把缺失的 health 字段当成 false

## 产品改版后如何更新自动化

- 状态文案变化时改 pages/gpu_cards.py
