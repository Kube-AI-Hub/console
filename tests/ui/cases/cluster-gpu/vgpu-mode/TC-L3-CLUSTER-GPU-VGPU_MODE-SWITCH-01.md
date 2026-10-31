# TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01 设置 vGPU 模式 · hami-core 提交与回填

- **用例 ID**: `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `vgpu-mode` `switch`
- **入口**: `{BASE_URL}/clusters/default/nodes`
- **需求**: `prd/cluster-gpu/vgpu-mode/switch.md`

## 产品功能

对话框按当前模式回填，选 hami-core 并填切分数 10 后提交的请求体符合接口契约。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01** — Given 节点当前是 `default`，When 在对话框选 `hami-core` 并把切分数填成 10 后确定，Then 请求体里 `mode=hami-core`、`params.devicesplitcount=10`，成功后列表模式列先变「切换中」再变 `hami-core`。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/switch.md`](../../../../design/cluster-gpu/vgpu-mode/switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/switch.md`](../../../../prd/cluster-gpu/vgpu-mode/switch.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，把节点切成 hami-core 并设置切分数


**Independent Test**：对 `sagesuite-demo` 选 `hami-core`、切分数 10、显存与算力倍率 1，提交后成功提示；节点列表模式列先显示「切换中：hami-core」，再显示 `hami-core`。

## 前置与配置

- 已登录，且在 default 集群
- 目标 GPU 节点当前模式为 default

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/nodes
2. 对目标 GPU 节点点「设置vGPU模式」
3. 读取模式下拉的当前值与参数区
4. 选 hami-core，切分数填 10
5. 拦截 PUT /kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode 的请求体
6. 点确定

## 期望结果

- 打开时模式下拉为 default，参数区为空
- 选 hami-core 后出现切分数（默认 10）、显存倍率、算力倍率
- 请求体 mode 为 hami-core
- 请求体 params.devicesplitcount 为字符串 "10"
- 提交后出现成功提示

## 失败排查

- 参数是数字而不是字符串时 gpu-agent 会解析失败，注解被丢弃
- 回填值恒为 10 说明没有读 nodeInfo.gpuModeParams

## 产品改版后如何更新自动化

- 接口路径或参数键变化时改 pages/gpu_cards.py 的请求拦截
