# TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03 设置 vGPU 模式 · 昆仑芯独占不带切分参数

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `switch`
- **入口**: `{BASE_URL}/clusters/default/nodes`
- **需求**: `prd/cluster-gpu/vgpu-mode/switch.md`

## 产品功能

昆仑芯节点切到独占时，请求体只有 mode=default，params 为空对象。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03** — Given 节点厂商是 `kunlunxin` 且当前为 `hami-core`，When 选 `default` 后确定，Then 请求体是 `{mode: default, params: {}}`，对话框没有切分数输入。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/switch.md`](../../../../design/cluster-gpu/vgpu-mode/switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为集群运维，把昆仑芯节点切到独占


**Independent Test**：厂商为 `kunlunxin` 时可选 `default`，没有切分数输入。提交体是 `mode=default` 且 `params` 为 `{}`。

## 前置与配置

- 已登录
- 存在厂商为 kunlunxin 的节点

## 测试步骤

1. 打开节点的设置 vGPU 模式对话框
2. 选择独占
3. 确认请求体

## 期望结果

- 没有切分数、显存倍率、算力倍率输入
- 请求体为 mode=default 且 params 为 {}

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 模式表增加参数时同步改本用例
