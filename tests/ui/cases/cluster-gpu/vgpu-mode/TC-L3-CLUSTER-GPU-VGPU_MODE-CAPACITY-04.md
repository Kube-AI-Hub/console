# TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-04 vGPU 资源就绪 · 昆仑芯切回独占后共享资源归零

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-04`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `capacity`
- **入口**: `{BASE_URL}/clusters/default/nodes/node201-xpu/status`
- **需求**: `prd/cluster-gpu/vgpu-mode/capacity.md`

## 产品功能

昆仑芯切回独占后，状态页不再把 vxpu 与 vxpu-memory 显示为非零总量。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/capacity.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/capacity.md`](../../../../prd/cluster-gpu/vgpu-mode/capacity.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-04** — Given 该昆仑芯节点已切回独占，When 打开同一状态页，Then `kunlunxin.com/vxpu` 与 `kunlunxin.com/vxpu-memory` 不以非零总量出现。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/capacity.md`](../../../../design/cluster-gpu/vgpu-mode/capacity.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/capacity.md`](../../../../prd/cluster-gpu/vgpu-mode/capacity.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 作为集群运维，把昆仑芯切回独占后确认共享资源归零


**Independent Test**：切回独占后，状态页上 `kunlunxin.com/vxpu` 与 `kunlunxin.com/vxpu-memory` 不再以非零总量出现。

## 前置与配置

- 已登录，且在 default 集群
- node201-xpu 已从 hami-core 切回独占，vxpu=off

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/nodes/node201-xpu/status
2. 读取资源总量

## 期望结果

- kunlunxin.com/vxpu 与 kunlunxin.com/vxpu-memory 不以非零总量出现
- 不出现未翻译的 key

## 失败排查

- 仍显示非零时确认独占插件已重新注册，且 vxpu-device-plugin 已离开节点

## 产品改版后如何更新自动化

- 资源名变化时改本用例
