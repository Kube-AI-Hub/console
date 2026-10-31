# vGPU 资源就绪 · 技术方案（L3）

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY`

## 概述

切换完成后，节点上真正能被调度的资源名与容量会变。页面从两个来源读：Node 的 `status.capacity`（经 kapis 的 `resourceQuota` 透出）与 gpu-agent 写的 `node-gpu-info`（每卡的 `count` / `mode` / 已用量）。

## 关联需求

- `AC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01`
- `AC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02`

## 设计目标与非目标

- **目标**：容量与列表两个视角都能核对；不自己算容量。
- **非目标**：不在页面里推算「卡数 × 切分数」；不展示 MIG profile 明细。

## 关键约束

- 显示哪些资源名由 `kubesphere-config` 的 `gpu.kinds` 决定，不硬编码。
- 单位来自 `gpu.kinds` 的 `memoryUnit` / `vcoresName`，页面只做展示格式化。
- `mig` 模式下 `nvidia.com/gpu` 是 MIG 实例数，不是物理卡数。

## 方案决策

### DEC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01：容量读 allocatable，不读注解

- **备选**：① 从 `node-gpu-info` 的 `cardCount × deviceSplitCount` 算；② 读 Node `status.capacity`。
- **选定**：②
- **原因**：容量是 kubelet 按 device plugin 的 `ListAndWatch` 计的，是「真的能调度多少」。用注解算出来的是「理论上能调度多少」——device plugin 注册失败时两者会分叉，页面若用后者会显示一个假的正确值。
- **被否方案**：① 无法发现注册失败，且 MIG 模式下算不出来（实例数取决于 profile 与卡的可用性）。
- **何时重新考虑**：不重新考虑。这是「调度事实的唯一来源」。

### DEC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02：显卡列表的 vGPU 列读注解，不读容量

- **备选**：① vGPU 列 = 容量 / 卡数；② vGPU 列 = `node-gpu-info.devices[].count`。
- **选定**：②
- **原因**：这一列表达的是「每张卡切了多少份、用了几份」，是逐卡的。容量是一个总数，除不尽或卡型不一时会失真。
- **被否方案**：① 混插节点上算错，且无法表达「这张卡 10 份、那张卡 0 份」。
- **何时重新考虑**：不重新考虑。

### DEC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-03：不过滤 0 值资源，但资源名为空的不显示

- **备选**：① 显示 `gpu.kinds` 里的全部资源（含 0）；② 只显示非零。
- **选定**：②（沿用现有 `isCapacityZero` 判断）
- **原因**：`gpu.kinds` 有 20+ 条（含所有 Ascend 型号），全显示会把页面撑满且大部分是 0。运维关心的是「这个节点有什么」。
- **被否方案**：① 信息完整但不可读。
- **何时重新考虑**：节点资源种类多到需要「显示全部」的开关时。

## 系统现状

### 数据流

`device plugin 注册 → kubelet 更新 status.capacity → kube-server 的 kapis 读 Node → 页面资源总量`
`gpu-agent 采集 → hami.io/node-gpu-info → kapis gpus → 显卡列表 vGPU 列`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `console/src/pages/clusters/containers/Nodes/Detail/RunningStatus/index.jsx` | 资源总量渲染 | 不计算容量 |
| `console/src/pages/clusters/containers/Nodes/Detail/RunningStatus/GpuCardList/index.jsx` | 显卡列表 | 不推算 count |
| `kube-server/pkg/kapis/gpu/v1alpha1/handler.go` `collectDevicesFromAnnotations` | 透出 `node-gpu-info` | 不读 register 注解 |
| `kube-server` 的 resourceQuota kapis | 透出 Node capacity | 不做单位换算 |

## 仓库落点

| 层 | 仓库 | 路径 |
| --- | --- | --- |
| 资源总量 | `console` | `src/pages/clusters/containers/Nodes/Detail/RunningStatus/index.jsx` |
| 显卡列表 | `console` | `src/pages/clusters/containers/Nodes/Detail/RunningStatus/GpuCardList/index.jsx` |
| 资源名清单 | `console` | `src/stores/cluster`（`gpu.kinds` 解析） |
| 注解透出 | `kube-server` | `pkg/kapis/gpu/v1alpha1/handler.go` |
| 注解写入 | `HAMi` | `pkg/gpu-agent/collector/nvidia.go` |

## 对外契约

- **CON-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01** — `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus?conditions=nodeName=<n>` 的 `nodeInfo.virtualCardCount` 等于该节点 `nvidia.com/vgpu` 的 capacity（`hami-core` 下），`default`/`mig` 下为 0。
- **CON-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02** — `devices[].count` 等于该卡的切分数；`mig` 模式下等于该卡可用 profile 的最大实例数。

## 不变量

- **INV-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01** — `virtualCardCount = Σ devices[].count`（`hami-core` 与 `mig` 下）。
- **INV-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02** — 页面显示的资源总量与 `kubectl get node <n> -o jsonpath='{.status.capacity}'` 同名键一致。

## 已知坑

- **GOT-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01** — `devices[].index` 与 `health` 带 `omitempty`，`index: 0` 与 `health: false` 在注解里字段消失。解析时按 0/false 处理。
- **GOT-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02** — `nvidia.com/gpumem` 单位是 Mi，但 `iluvatar` 的 memoryUnit 是 `*256Mi`。页面必须读 `memoryUnit` 而不是假设 Mi。
- **GOT-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-03** — 刚切完时 `capacity` 还是旧值（kubelet 要等 device plugin 重新注册），而 `node-gpu-info` 可能已经是新值。两个来源不同步是预期的，页面不做「一致性修正」。
- **GOT-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-04** — MIG 模式下 `nvidia.com/gpu` 的数值可能小于物理卡数（只有部分卡支持该 profile）。这不是 bug。

## 测试与可观测

- UI 用例：`TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01/02`。
- 现场核对：`kubectl get node <n> -o jsonpath='{.status.capacity}'` 与页面逐项对照。

## 后续改进

- 在资源总量里给 `nvidia.com/vgpu` 加 tooltip 说明「= 卡数 × 切分数」。

## 验收用例

- `TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01`
- `TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02`
