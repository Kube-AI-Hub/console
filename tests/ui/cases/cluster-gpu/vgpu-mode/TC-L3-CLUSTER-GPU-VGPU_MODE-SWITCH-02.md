# TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02 设置 vGPU 模式 · 切回 default 时 params 为空对象

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `switch`
- **入口**: `{BASE_URL}/clusters/default/nodes`
- **需求**: `prd/cluster-gpu/vgpu-mode/switch.md`

## 产品功能

从 hami-core 切回 default 时，请求体只带 mode，params 是空对象，切换完成后 vgpu 标签回到 off。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02** — Given 节点当前是 `hami-core`，When 选 `default` 后确定，Then 请求体里 `mode=default` 且 `params` 为空对象，切换完成后 `vgpu` 标签为 `off`。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/switch.md`](../../../../design/cluster-gpu/vgpu-mode/switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，把节点切成 hami-core 并设置切分数


**Independent Test**：对 `sagesuite-demo` 选 `hami-core`、切分数 10、显存与算力倍率 1，提交后成功提示；节点列表模式列先显示「切换中：hami-core」，再显示 `hami-core`。

### US2 - 作为集群运维，切到 MIG 前看到破坏性提示


**Independent Test**：选 `mig` 后对话框出现「会销毁该节点上现有的 MIG 实例」的警告文字。

## 前置与配置

- 已登录，且在 default 集群
- 目标 GPU 节点当前模式为 hami-core

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/nodes
2. 对目标节点点「设置vGPU模式」，选 default
3. 拦截提交请求体
4. 点确定
5. 等待切换完成，读取节点 label vgpu

## 期望结果

- 选 default 后参数区为空（不残留 hami-core 的三个输入）
- 请求体 mode 为 default
- 请求体 params 是 {}（不是 null，也不含 devicesplitcount）
- 切换完成后节点 label vgpu 为 off

## 失败排查

- params 残留旧键时 gpu-agent 会把它们写进 ConfigMap，切回 default 后仍带着切分数
- vgpu 标签不变时看 gpu-agent 日志里的 patchNodeVGPULabel

## 产品改版后如何更新自动化

- 参数键变化时同步改本用例
