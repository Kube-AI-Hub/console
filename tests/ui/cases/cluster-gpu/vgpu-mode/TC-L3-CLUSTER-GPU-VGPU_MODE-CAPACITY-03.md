# TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-03 vGPU 资源就绪 · 昆仑芯 hami-core 容量

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-03`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `capacity`
- **入口**: `{BASE_URL}/clusters/default/nodes/node201-xpu/status`
- **需求**: `prd/cluster-gpu/vgpu-mode/capacity.md`

## 产品功能

昆仑芯 hami-core 状态页显示 vxpu 与 vxpu-memory，8 行显卡，虚拟卡数 32。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/capacity.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/capacity.md`](../../../../prd/cluster-gpu/vgpu-mode/capacity.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-03** — Given 昆仑芯节点已切成 `hami-core`，8 张卡且每张份额为 4，When 打开 `/clusters/default/nodes/node201-xpu/status`，Then 资源总量出现非零的 `kunlunxin.com/vxpu` 与 `kunlunxin.com/vxpu-memory`，显卡列表 8 行，虚拟卡数为 32。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/capacity.md`](../../../../design/cluster-gpu/vgpu-mode/capacity.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/capacity.md`](../../../../prd/cluster-gpu/vgpu-mode/capacity.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为集群运维，在昆仑芯状态页核对 hami-core 容量


**Independent Test**：`node201-xpu` 切成 `hami-core` 后，状态页资源总量出现 `kunlunxin.com/vxpu` 与 `kunlunxin.com/vxpu-memory`，显卡列表 8 行，虚拟卡数 32。

## 前置与配置

- 已登录，且在 default 集群
- node201-xpu 已切成 hami-core，kunlunxin.com/vxpu 非零

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/nodes/node201-xpu/status
2. 读取资源总量里的 kunlunxin.com/vxpu 与 kunlunxin.com/vxpu-memory
3. 读取虚拟卡数与显卡列表行数

## 期望结果

- 两个共享资源总量非零，且与 kubectl capacity 一致
- 显卡列表 8 行
- 虚拟卡数为 32
- 不出现未翻译的 key

## 失败排查

- 总量为 0 时确认 vxpu=on 且 vxpu-device-plugin 已在该节点注册
- 虚拟卡数不是 32 时看 node-gpu-info 的 virtualCardCount

## 产品改版后如何更新自动化

- 资源名变化时改本用例
