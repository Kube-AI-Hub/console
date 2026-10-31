# TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01 vGPU 资源就绪 · hami-core 下容量等于卡数乘切分数

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `capacity`
- **入口**: `{BASE_URL}/clusters/default/nodes/{node}/status`
- **需求**: `prd/cluster-gpu/vgpu-mode/capacity.md`

## 产品功能

hami-core 模式下节点运行状态页显示 nvidia.com/vgpu 总量等于卡数乘切分数，显卡列表每行 vGPU 为 0/切分数。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/capacity.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/capacity.md`](../../../../prd/cluster-gpu/vgpu-mode/capacity.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01** — Given 节点已切成 `hami-core` 且切分数为 10、卡数为 7，When 打开节点运行状态页，Then 资源总量里 `nvidia.com/vgpu` 显示 70，显卡列表每行的 vGPU 列为 `0/10`。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/capacity.md`](../../../../design/cluster-gpu/vgpu-mode/capacity.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/capacity.md`](../../../../prd/cluster-gpu/vgpu-mode/capacity.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，切到 hami-core 后核对 vGPU 总量等于卡数乘切分数


**Independent Test**：`sagesuite-demo` 切成 `hami-core`、切分数 10 后，节点运行状态页显示 `nvidia.com/vgpu` 总量 70、`nvidia.com/gpumem` 总量 286720Mi、显卡列表 7 行每行 vGPU `0/10`。

## 前置与配置

- 已登录，且在 default 集群
- 目标节点已切成 hami-core，切分数 10，且资源已就绪（nvidia.com/vgpu 非零）

## 测试步骤

1. 读取节点 capacity 里的 nvidia.com/gpu 卡数与 nvidia.com/vgpu 总量
2. 打开 {BASE_URL}/clusters/default/nodes/{node}/status
3. 读取资源总量里的 nvidia.com/vgpu 与 nvidia.com/gpumem
4. 读取显卡列表的 vGPU 列

## 期望结果

- 页面 nvidia.com/vgpu 总量等于卡数乘 10
- 页面数值与 kubectl 读到的 capacity 一致
- 显卡列表行数等于卡数
- 每行 vGPU 列形如 0/10
- 不出现未翻译的 key

## 失败排查

- 总量为 0 时确认节点 vgpu=on 且 devices.nvidia.resourceCountName 是 nvidia.com/vgpu
- 显卡列表行数少于卡数时看 node-gpu-info 的 devices 数组

## 产品改版后如何更新自动化

- 资源名变化时改本用例与 pages/gpu_cards.py
