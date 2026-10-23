# 健康状态 · 技术方案（L3）

## 概述

显卡列表的状态列。数据链路是：HAMi device plugin 的 health manager 判定 → 写节点注解 `hami.io/node-nvidia-register` 的逐设备 `health` → `ks-apiserver` 读取并合并 → 页面渲染。

2026-10-23 定位到一个会让故障卡永远显示「健康」的缺陷：`gpu-agent` 在写 `hami.io/node-gpu-info` 时把 `Health` 硬编码为 `true`，而接口只读这份注解。于是 device plugin 已经把 3 张卡摘出可分配池（allocatable 8→5），页面仍显示 8 行全绿。

## 关联需求

- `AC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01`
- `AC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02`

## 设计目标与非目标

**目标**：健康状态的唯一来源是 device plugin 的结论；故障卡仍列出并标为亚健康。

**非目标**：不在页面/接口里重新实现 XID 判定；不提供修改入口。

## 关键约束

- 判定属于 HAMi（`pkg/device-plugin/nvidiadevice/nvinternal/rm/health.go`：XID 事件 → `marking device as unhealthy`）。接口只读结论。
- 节点上有两份 GPU 注解，写者不同、用途不同，不能互相替代：

| 注解 | 写者 | 内容 | 健康状态可信吗 |
| --- | --- | --- | --- |
| `hami.io/node-nvidia-register` | device plugin（`plugin/register.go` 的 `RegisterInAnnotation`） | 调度视角的设备清单：`id`/`index`/`count`/`devmem`/`devcore`/`type`/`mode`/`health` | **是**。`health` 来自 `plugin.Devices()` 的实时健康标记 |
| `hami.io/node-gpu-info` | gpu-agent（`collector/nvidia.go`） | 补充信息：driver、CUDA、拓扑、NUMA、每卡用量 | **否**。历史上 `Health: true` 是硬编码常量 |

## 方案决策

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01 — 健康状态从 `*-register` 注解取，不从 `node-gpu-info` 取

接口在展开设备列表时，以 `node-gpu-info` 为骨架（它带 NUMA、用量、vendor、mode），再按 UUID 把 `health` 从 register 注解覆盖上去。

- **为什么**：register 注解是 device plugin 写的，`health` 直接来自它的 health manager；`node-gpu-info` 的 `health` 是 gpu-agent 自己填的常量，与调度器无关。以调度器的结论为准，页面才和「能调度几张」自洽。
- **被否方案**：只修 gpu-agent，让它去读 register 注解。这样要等 gpu-agent 重新发布并跑完一轮采集（默认 5 分钟）才生效，且任何一次 gpu-agent 回滚都会让问题复发。接口侧兜底更稳。
- **被否方案**：用 `capacity - allocatable` 的差额推断故障卡数量。差额只能说明「少了几张」，说不出是哪几张，也无法区分「被摘」和「本来就没插」。
- **被否方案**：页面直接调 `nvidia-smi` 或查 Prometheus 的 ECC 指标。前者浏览器做不到，后者是另一套判定，会和调度器打架。
- **何时重新考虑**：HAMi 把健康状态挪到 CRD 或独立的 node condition 时。

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02 — 按注解名模式匹配，不硬编码 NVIDIA

register 注解的名字随厂商变化：`hami.io/node-nvidia-register`、`hami.io/node-mlu-register`、`hami.io/node-dcu-register`、`hami.io/node-register-xpu`、`hami.io/node-biren-register`、`hami.io/node-va-register`。

接口扫描节点上所有 `hami.io/node-` 前缀、`-register` 后缀（含 `node-register-*` 形态）的注解，逐个解析成 `id → health` 映射后合并。这样新增厂商不需要改代码。

- **为什么**：硬编码 nvidia 会在 MLU / Ascend 节点上静默退回 `node-gpu-info` 的常量，同一个 bug 换个厂商再来一次。
- **被否方案**：按 `node-gpu-info` 的 `gpuVendor` 拼注解名。厂商名与注解名不是一一对应（`ascend` 的注解是 `node-register-<model>`，`kunlun` 是 `node-register-xpu`）。
- **何时重新考虑**：HAMi 统一注解名时。

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-03 — 同时修 gpu-agent，让注解不再撒谎

`collector/nvidia.go` 的 `CollectDevices` 改为读本节点的 register 注解，按 UUID 取 `health`；注解缺失或解析失败时保持 `true`。

- **为什么**：`node-gpu-info` 是给人看、给别的消费者用的注解，里面写一个恒为 `true` 的健康字段会持续误导下一个读它的人。接口侧兜底解决了「页面」，注解本身也要对。
- **被否方案**：从 `node-gpu-info` 里删掉 `health` 字段。会破坏既有消费者（cambricon / ascend 路径与前端历史版本），且改动面更大。
- **何时重新考虑**：`node-gpu-info` 不再被任何消费者读取时。

## 系统现状

- 缺陷点：`HAMi/pkg/gpu-agent/collector/nvidia.go` 的 `CollectDevices()`，`Health: true` 是字面量（第 236 行附近）。
- 读取点：`kube-server/pkg/kapis/gpu/v1alpha1/handler.go` 的 `collectDevicesFromAnnotations()`，只解析 `hami.io/node-gpu-info`。
- 缓存：`kube-server/pkg/kapis/gpu/v1alpha1/cache.go` 的 `clusterGPUCache`，node 事件后去抖 2 秒刷新，5 分钟兜底。
- 判定点：`HAMi/pkg/device-plugin/nvidiadevice/nvinternal/rm/health.go` 的 `checkHealth()`，XID 事件不是被忽略的 XID 时 `unhealthy <- d`。
- 现场证据（B200 gpu01，2026-10-23）：device plugin 日志 `XidCriticalError: Xid=71/94 ... marking device as unhealthy` × 27 条，覆盖 idx5/6/7；`allocatable=5`、`capacity=8`；`node-nvidia-register` 里三张卡 `health:false`；`node-gpu-info` 里同一批 UUID `health:true`。

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 接口 | `kube-server` | `pkg/kapis/gpu/v1alpha1/handler.go` | `collectDevicesFromAnnotations` 合并 register 注解的 `health` |
| 接口 | `kube-server` | `pkg/kapis/gpu/v1alpha1/register_health.go`（新增） | 扫描 `*-register` 注解，产出 `uuid → health` |
| 接口单测 | `kube-server` | `pkg/kapis/gpu/v1alpha1/register_health_test.go`（新增） | 覆盖 nvidia / mlu / 缺失 / 非法 / 无 health 字段 |
| 注解写者 | `HAMi` | `pkg/gpu-agent/collector/nvidia.go` | `CollectDevices` 从 register 注解取 `health` |
| 页面 | `console` | `src/pages/clusters/containers/Nodes/Detail/RunningStatus/GpuCardList/index.jsx` | 不改（已按 `record.health` 渲染） |
| 页面 | `console` | `src/pages/clusters/containers/Nodes/Gpus/index.jsx` | 不改（同上） |

## 对外契约

- **CON-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus` 返回的每个 item 的 `health`，当该 UUID 在任一 `hami.io/node-*-register` 注解里存在时，等于该注解里的 `health`；否则退回 `hami.io/node-gpu-info` 的 `health`。
- **CON-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — `hami.io/node-gpu-info` 的 `devices[].health` 等于同 UUID 的 register `health`（gpu-agent 修好之后）。

字段类型不变（`bool`），语义收紧，向后兼容：register 注解缺失的厂商行为与改动前一致。

## 不变量

- **INV-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — 接口返回的设备集合与 `node-gpu-info` 的设备集合相同（只覆盖 `health`，不增删行）。
- **INV-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — 对同一节点，接口返回的 `health:false` 条数等于 register 注解里 `health:false` 的条数。
- **INV-L3-CLUSTER-GPU-GPU_CARD-HEALTH-03** — register 注解里存在但 `node-gpu-info` 里没有的 UUID 不产生新行。

## 已知坑

- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — `DeviceInfo.Health` 带 `json:"health,omitempty"`。`health:false` 在注解里**字段直接消失**，不是 `"health": false`。解析时必须把「字段缺失」当 `false`，否则把 unhealthy 读成健康——正好是本次 bug 的反向版本。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — device plugin 把卡标记 unhealthy 后**不会**从 register 注解里删掉它，只是把 `health` 改成 false。所以「列表少了一行」永远不会发生；症状一定是「行在、状态错」。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-03** — 这个标记不会自愈。只有 device plugin 进程重启才会重新枚举全部设备并写回 `health:true`。页面不提供「重置」按钮正是因为这个动作在 HAMi 侧。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-04** — `node-gpu-info` 的 `index` 字段同样带 `omitempty`，GPU 0 的 `index` 在注解里缺失，解析后为 0。按 UUID 合并时不要用 index 当键。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-05** — `clusterGPUCache` 只在 node 对象变更时刷新。device plugin 改注解会触发 node update，所以健康状态变化能进缓存；但如果有人手工改注解后立刻看页面，最长等 2 秒去抖 + 一次请求。

## 测试与可观测

- 后端单测 `pkg/kapis/gpu/v1alpha1/register_health_test.go`：
  - nvidia register 注解里一张卡 `health:false` → 映射为 `false`；
  - 注解里 `health` 字段缺失 → `false`；
  - 没有 register 注解 → 返回空映射，调用方退回 `node-gpu-info`；
  - 注解 JSON 非法 → 返回空映射且不 panic；
  - 多个厂商注解同时存在 → 合并。
- 后端单测 `handler_test.go`：`collectDevicesFromAnnotations` 在两份注解冲突时以 register 为准，且不增删行。
- UI 用例：`TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01/02`。
- 现场核对：`kubectl get node <n> -o jsonpath='{...node-nvidia-register}'` 与页面状态列逐行比对。

## 后续改进

- 在状态列加 tooltip 说明「亚健康 = device plugin 已摘出可分配池，需重启 device plugin 恢复」。
- 把 XID 明细写进注解，详情页展示。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01`
- `TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02`
