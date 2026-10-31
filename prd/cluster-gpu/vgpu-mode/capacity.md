# vGPU 资源就绪（L3）

[子模块需求](./_index.md)

## 概述

模式切换之后，节点上真正能被调度的资源会变：`default` 下是 `nvidia.com/gpu`，`hami-core` 下是 `nvidia.com/vgpu` + `nvidia.com/gpumem` + `nvidia.com/gpucores`，`mig` 下又是 `nvidia.com/gpu`（但每张卡变成多个 MIG 实例）。运维从节点运行状态页的资源总量与显卡列表核对「切完了、且真的生效了」。

## 用户故事

### US1 - 作为集群运维，切到 hami-core 后核对 vGPU 总量等于卡数乘切分数

**Independent Test**：`sagesuite-demo` 切成 `hami-core`、切分数 10 后，节点运行状态页显示 `nvidia.com/vgpu` 总量 70、`nvidia.com/gpumem` 总量 286720Mi、显卡列表 7 行每行 vGPU `0/10`。

### US2 - 作为集群运维，切回 default 后确认 vGPU 归零

**Independent Test**：切回 `default` 后，节点运行状态页不再显示 `nvidia.com/vgpu`（或显示 0），`nvidia.com/gpu` 回到 7。

## 验收场景

- **AC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01** — Given 节点已切成 `hami-core` 且切分数为 10、卡数为 7，When 打开节点运行状态页，Then 资源总量里 `nvidia.com/vgpu` 显示 70，显卡列表每行的 vGPU 列为 `0/10`。
- **AC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02** — Given 节点已切回 `default`，When 打开节点运行状态页，Then `nvidia.com/gpu` 显示 7，且页面上不出现 `nvidia.com/vgpu` 的非零总量。

## 设计目标

- **容量来自 kubelet 的 allocatable，不来自页面推断。** 页面读的是 Node 的 `status.capacity`（经 kapis 透出），与 `kubectl get node` 一致；不用「卡数 × 切分数」自己算，否则 device plugin 注册失败时页面会显示一个假的正确值。
- **显卡列表的 vGPU 列来自 gpu-agent 的 `node-gpu-info`，不是容量。** 容量说「能切多少份」，列表说「每张卡切了多少份、用了几份」。两者不一致就是有问题，页面要能同时看到。

## 约束与边界

- 三种模式的资源名与容量关系是**契约**，写死在 HAMi 侧；页面只按 `kubesphere-config` 的 `gpu.kinds` 决定显示哪些资源名，不硬编码。
- `nvidia.com/vgpu` 的总量由 device plugin 上报，前提是 `devices.nvidia.resourceCountName = nvidia.com/vgpu` 且节点 `vgpu=on`。两个条件缺一个，容量就是 0，页面不特判。
- `nvidia.com/gpumem` 的单位是 Mi（`memoryUnit: Mi`），`nvidia.com/gpucores` 是百分比（100 = 整卡）。单位来自 `gpu.kinds`，页面不做换算。
- 与 MIG 的边界：`mig` 模式下 `nvidia.com/gpu` 的数值是 **MIG 实例数**，不是物理卡数。页面不区分，但显卡列表的「模式」列会显示 `mig`，运维可据此判断。

## UI 交互设计

| 元素 | 内容 |
| --- | --- |
| 资源总量 | 按 `gpu.kinds` 顺序列出非零资源；每项含 displayName、总量、单位 |
| 显卡列表 · vGPU 列 | `vgpuUsed/vgpuTotal`；`vgpuTotal` 来自 `devices[].count` |
| 显卡列表 · 核心列 | `gpuCoreUsed/gpuCoreTotal` |
| 显卡列表 · 显存列 | `gpuMemoryUsed/gpuMemoryTotal GiB` |
| 显卡列表 · 模式列 | `devices[].mode`（`default` / `hami-core` / `mig`） |

## 文案与校验

| 资源名 | 单位 | 出现条件 |
| --- | --- | --- |
| `nvidia.com/gpu` | 张 | 始终（`default` 与 `mig` 下非零） |
| `nvidia.com/vgpu` | 张 | `hami-core` 下非零 |
| `nvidia.com/gpumem` | Mi | `hami-core` 下非零 |
| `nvidia.com/gpucores` | % | `hami-core` 下非零 |

## 边界情况

| 情况 | 对外行为 |
| --- | --- |
| 刚切完、device plugin 还没注册 | 资源总量显示旧值或 0，模式列已是新模式；页面不掩盖 |
| 切分数为 1 | `nvidia.com/vgpu` 总量等于卡数，vGPU 列 `0/1` |
| 卡数 0（无 GPU） | 不显示任何 GPU 资源 |
| `migProfileAllowlist` 不匹配该型号 | MIG 实例数为 0，`nvidia.com/gpu` 显示 0；显卡列表仍有行但 vGPU 为 `0/0` |
| 资源值超过 2^31 | 按字符串原样显示，不截断 |

## 功能需求

- **FR-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01**：系统必须按 `gpu.kinds` 展示非零 GPU 资源及其单位。
- **FR-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02**：系统必须在显卡列表按 `node-gpu-info` 的 `devices[]` 展示每卡的 vGPU 已分配/总量与模式。

## 成功标准

- **SC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01**：页面显示的资源总量与 `kubectl get node <node> -o jsonpath='{.status.capacity}'` 中同名键一致。

## 明确不做

- 不在页面里计算「卡数 × 切分数」。
- 不提供「重新注册设备」按钮（那是 device plugin 重启的动作）。
- 不展示 MIG 实例的 profile 明细（只有总数）。

## 假设

- `kubesphere-config` 的 `gpu.kinds` 已按 `ks-installer` 的配置写入（`nvidia.com/gpu` 与 `nvidia.com/vgpu` 两条）。
- gpu-agent 的 `node-gpu-info` 里 `devices[].count` 与 `mode` 已按当前模式填好。

## 验收用例

- L3：`TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01`、`TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02`
