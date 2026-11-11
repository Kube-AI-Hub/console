# TC-FULL-CLUSTER-GPU-GPU_CARD-01 显卡列表 · 集群页与节点页一致

- **用例 ID**: `TC-FULL-CLUSTER-GPU-GPU_CARD-01`
- **级别**: L2  **套件**: `full`
- **模块**: `cluster-gpu` / `gpu-card` `page`
- **入口**: `{BASE_URL}/clusters/default/gpus`
- **需求**: `prd/cluster-gpu/gpu-card/_index.md`

## 产品功能

集群页与节点页对同一张卡显示相同状态，点 UUID 可进入单卡详情且状态一致。

### 关联需求

- `prd/cluster-gpu/gpu-card/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-card/_index.md`](../../../../prd/cluster-gpu/gpu-card/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-CLUSTER-GPU-GPU_CARD-01** — Given 已登录且集群有 GPU 节点，When 打开显卡列表，Then 表格列齐全、每行有状态标记、点 UUID 可进入单卡详情且状态一致。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-card/_index.md`](../../../../design/cluster-gpu/gpu-card/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-card/_index.md`](../../../../prd/cluster-gpu/gpu-card/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，在集群显卡列表里按节点核对每张卡的状态


**Independent Test**：打开 `/clusters/default/gpus`，表格出现节点 / 序号 / UUID / 状态 / 型号 / NUMA / 厂商 / 模式 / vGPU / 核心 / 显存列；按节点排序后，每节点的行数与 `kubectl get node <name> -o jsonpath='{.metadata.annotations.hami\.io/node-nvidia-register}'` 里的设备数一致。

### US2 - 作为集群运维，点进某张卡看到它的详细属性


**Independent Test**：点表格里的 UUID 进入 `/clusters/default/nodes/<node>/gpus/<uuid>/status`，侧栏显示状态、节点、UUID、序号、型号、厂商、NUMA、模式、显存总量；状态与列表里那一行一致。

## 前置与配置

- 已登录，且在 default 集群
- 集群至少有一个 GPU 节点

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/gpus
2. 记录某一行 UUID 与状态
3. 打开该行的节点运行状态页，读取显卡列表里同一 UUID 的状态
4. 点该 UUID 进入单卡详情，读取侧栏状态

## 期望结果

- 节点页表格含序号 / UUID / 状态 / 型号 / NUMA / 厂商 / 模式 / vGPU / 核心 / 显存
- 节点页该 UUID 的状态与集群页一致
- 单卡详情侧栏状态与列表一致

## 失败排查

- 两页状态不一致时先确认两次请求是否命中同一份缓存（间隔应小于 5 分钟）
- 单卡详情为空时确认 URL 里的 uuid 是否被 encodeURIComponent 处理

## 产品改版后如何更新自动化

- 状态映射变化时改 pages/gpu_cards.py 的 status 读取
