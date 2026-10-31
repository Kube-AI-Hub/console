# TC-FULL-CLUSTER-GPU-VGPU_MODE-01 vGPU 模式 · 切换与资源就绪

- **用例 ID**: `TC-FULL-CLUSTER-GPU-VGPU_MODE-01`
- **级别**: L2  **套件**: `full`
- **模块**: `cluster-gpu` / `vgpu-mode` `page`
- **入口**: `{BASE_URL}/clusters/default/nodes`
- **需求**: `prd/cluster-gpu/vgpu-mode/_index.md`

## 产品功能

从节点列表切一次 vGPU 模式，模式列出现切换中，完成后显示新模式，且节点运行状态页的资源总量按新模式变化。

### 关联需求

- `prd/cluster-gpu/vgpu-mode/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/vgpu-mode/_index.md`](../../../../prd/cluster-gpu/vgpu-mode/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-CLUSTER-GPU-VGPU_MODE-01** — Given 已登录且对 `nodes` 有 edit 权限，When 打开节点列表并对一台 GPU 节点选择「设置vGPU模式」，Then 对话框显示当前模式、可选模式与当前模式的参数，提交后节点列表的模式列显示「切换中」，完成后显示新模式。

### 关联设计

- 技术方案 [`design/cluster-gpu/vgpu-mode/_index.md`](../../../../design/cluster-gpu/vgpu-mode/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/vgpu-mode/_index.md`](../../../../prd/cluster-gpu/vgpu-mode/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，把一台 GPU 节点切成 hami-core 并确认资源就绪


**Independent Test**：在节点列表对 `sagesuite-demo` 选 `hami-core`、切分数 10，等待后在节点运行状态页看到 `nvidia.com/vgpu` 总量 = 70（7 卡 × 10），显卡列表每行 vGPU 为 `0/10`。

### US2 - 作为集群运维，切模式前知道会中断什么


**Independent Test**：模式切换对话框里能看到「切换会重启 device plugin 与调度器」的提示；切到 `mig` 时另有「会销毁现有 MIG 实例」的警告。

### US3 - 作为集群运维，切错了能切回 default


**Independent Test**：把节点切回 `default`，确认 `nvidia.com/gpu` 回到卡数、`nvidia.com/vgpu` 归零、`vgpu` 标签变回 `off`。

## 前置与配置

- 已登录，且在 default 集群
- 目标 GPU 节点上没有正在运行的 GPU 负载（切换会重启 device plugin 与调度器）
- 节点当前模式为 default

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/nodes
2. 找到目标 GPU 节点，确认模式列显示「默认」
3. 点行操作「设置vGPU模式」，确认对话框回填的模式为 default
4. 选 hami-core，切分数填 10，点确定
5. 记录模式列文本，等待 5 分钟
6. 打开该节点的运行状态页，读取资源总量与显卡列表
7. 切回 default，等待 5 分钟，再次读取资源总量

## 期望结果

- 对话框打开时模式下拉为 default，且无参数输入框
- 选 hami-core 后出现切分数/显存倍率/算力倍率三个输入
- 提交后节点列表模式列出现「切换中」文本
- 切换完成后模式列为 hami-core
- 节点运行状态页出现 nvidia.com/vgpu 且总量等于卡数乘 10
- 显卡列表每行 vGPU 列为 0/10
- 切回 default 后 nvidia.com/gpu 回到卡数，nvidia.com/vgpu 不再非零

## 失败排查

- 模式列一直是「切换中」时先看 hami.io/gpu-mode-status 注解的 status 与 message
- 容量不变时确认 hami-device-plugin 的 nodeconfig 里该节点的 operatingmode 与 devicesplitcount
- nvidia.com/vgpu 为 0 时确认 devices.nvidia.resourceCountName 是 nvidia.com/vgpu 且节点 vgpu=on

## 产品改版后如何更新自动化

- 模式文案变化时改 pages/gpu_cards.py 与节点页的选择器
- 资源名变化时改本用例的 expected
