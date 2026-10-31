# TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02 vGPU 资源就绪 · 切回 default 后 vGPU 归零

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `capacity`
- **入口**: `{BASE_URL}/clusters/default/nodes/{node}/status`
- **需求**: `prd/cluster-gpu/vgpu-mode/capacity.md`

## 产品功能

切回 default 后，节点运行状态页的 nvidia.com/gpu 回到卡数，nvidia.com/vgpu 不再非零。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/capacity.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/capacity.md`](../../../../prd/cluster-gpu/vgpu-mode/capacity.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02** — Given 节点已切回 `default`，When 打开节点运行状态页，Then `nvidia.com/gpu` 显示 7，且页面上不出现 `nvidia.com/vgpu` 的非零总量。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/capacity.md`](../../../../design/cluster-gpu/vgpu-mode/capacity.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/capacity.md`](../../../../prd/cluster-gpu/vgpu-mode/capacity.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为集群运维，切回 default 后确认 vGPU 归零


**Independent Test**：切回 `default` 后，节点运行状态页不再显示 `nvidia.com/vgpu`（或显示 0），`nvidia.com/gpu` 回到 7。

## 前置与配置

- 已登录，且在 default 集群
- 目标节点当前为 hami-core 模式

## 测试步骤

1. 把节点切回 default 并等待资源就绪
2. 打开 {BASE_URL}/clusters/default/nodes/{node}/status
3. 读取资源总量里的 GPU 相关条目
4. 读取节点 capacity

## 期望结果

- 页面 nvidia.com/gpu 等于卡数
- 页面不出现非零的 nvidia.com/vgpu
- 页面数值与 capacity 一致
- 显卡列表的模式列显示 default

## 失败排查

- nvidia.com/vgpu 仍非零时确认节点 label vgpu 已变 off 且 hami-device-plugin 的 nodeconfig 已改回 default
- 容量迟迟不变时等 device plugin 重新注册（最长 5 分钟）

## 产品改版后如何更新自动化

- 资源名或模式文案变化时同步改
