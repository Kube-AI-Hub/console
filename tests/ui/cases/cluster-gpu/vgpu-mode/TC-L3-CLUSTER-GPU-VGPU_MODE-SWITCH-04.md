# TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04 设置 vGPU 模式 · 昆仑芯 hami-core 说明资源名

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `switch`
- **入口**: `{BASE_URL}/clusters/default/nodes`
- **需求**: `prd/cluster-gpu/vgpu-mode/switch.md`

## 产品功能

昆仑芯节点切到 hami-core 时，请求体 params 为空，说明文字包含 kunlunxin.com/vxpu。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04** — Given 节点厂商是 `kunlunxin` 且当前为 `default`，When 选 `hami-core` 后确定，Then 请求体是 `{mode: hami-core, params: {}}`，说明文字写明资源名 `kunlunxin.com/vxpu` 与 `kunlunxin.com/vxpu-memory`。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/switch.md`](../../../../design/cluster-gpu/vgpu-mode/switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 作为集群运维，把昆仑芯节点切到 hami-core


**Independent Test**：选 `hami-core` 后仍没有切分数、显存倍率、算力倍率。提交体是 `mode=hami-core` 且 `params` 为 `{}`。说明文字包含 `kunlunxin.com/vxpu`。

## 前置与配置

- 已登录
- 存在厂商为 kunlunxin 的节点

## 测试步骤

1. 打开节点的设置 vGPU 模式对话框
2. 选择 hami-core
3. 确认说明文字与请求体

## 期望结果

- 说明文字包含 kunlunxin.com/vxpu 与 kunlunxin.com/vxpu-memory
- 请求体为 mode=hami-core 且 params 为 {}

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 资源名变化时同步改本用例与文案
