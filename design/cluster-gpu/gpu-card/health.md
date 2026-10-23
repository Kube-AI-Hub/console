# 健康状态 · 技术方案（L3）

## 概述

显卡列表的状态列。数据链路是：HAMi device plugin 的 health manager 判定 → 写节点注解 `hami.io/node-nvidia-register` 的逐设备 `health` → **gpu-agent 汇总**并写 `hami.io/node-gpu-info` → `ks-apiserver` 只读 `node-gpu-info` → 页面渲染。

2026-10-23 定位到一个会让故障卡永远显示「健康」的缺陷：`gpu-agent` 在写 `hami.io/node-gpu-info` 时把 `Health` 硬编码为 `true`，而接口只读这份注解。于是 device plugin 已经把 3 张卡摘出可分配池（allocatable 8→5），页面仍显示 8 行全绿。

## 关联需求

- `AC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01`
- `AC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02`

## 设计目标与非目标

**目标**：健康状态的唯一判定来源是 device plugin，唯一汇总者是 gpu-agent，页面只读汇总结果；故障卡仍列出并标为亚健康。

**非目标**：不在页面里重新实现 XID 判定；不提供修改入口；不让接口层解析厂商专属注解名。

## 关键约束

- 判定属于 HAMi（`pkg/device-plugin/nvidiadevice/nvinternal/rm/health.go`：XID 事件 → `marking device as unhealthy`）。
- 节点上有两份 GPU 注解，写者与职责必须分清：

| 注解 | 写者 | 内容 | 健康状态可信吗 |
| --- | --- | --- | --- |
| `hami.io/node-nvidia-register` | device plugin（`plugin/register.go` 的 `RegisterInAnnotation`） | 调度视角的设备清单：`id`/`index`/`count`/`devmem`/`devcore`/`type`/`mode`/`health` | **是**。`health` 来自 `plugin.Devices()` 的实时健康标记 |
| `hami.io/node-gpu-info` | gpu-agent（`collector/nvidia.go`） | 补充信息：driver、CUDA、拓扑、NUMA、每卡用量、**已汇总的 health** | **是（2026-10-23 修复后）**。此前 `Health: true` 是硬编码常量 |

- **接口层不解析 register 注解**。厂商注解名各异（`node-nvidia-register` / `node-mlu-register` / `node-register-<model>`），这份知识只应存在于一个地方。

## 方案决策

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01 — gpu-agent 是 register 注解的唯一扫描者

`HAMi/pkg/gpu-agent/collector/register.go` 提供 `IsRegisterAnnotation` / `DeviceHealthFromRegister` / `DeviceHealthFromAnnotations`，扫描节点上所有 register 注解，产出 `uuid → health`。`collector/nvidia.go` 的 `CollectDevices` 用它填 `Health`，结果写进 `hami.io/node-gpu-info`。

kube-server 的 `collectDevicesFromAnnotations` 只解析 `node-gpu-info`，`health` 原样透出。

- **为什么**：同一份事实只放一处。register 注解是 device plugin 的领域，gpu-agent 本来就负责把它的结论与自身采集的 driver/拓扑/用量合并成一份 `node-gpu-info`；让接口层再扫一遍等于把「厂商注解怎么命名」这件事复制到两个仓库，迟早漂移。
- **被否方案（上一版实现）**：接口层扫描 register 注解并覆盖 health。需要 `register_health.go` + 一套并行测试，且每个请求都要解析全部 register 注解；厂商新增时两个仓库都要改。
- **被否方案**：用 `capacity - allocatable` 的差额推断故障卡数量。差额只能说明「少了几张」，说不出是哪几张，也无法区分「被摘」和「本来就没插」。
- **被否方案**：页面直接调 `nvidia-smi` 或查 Prometheus 的 ECC 指标。前者浏览器做不到，后者是另一套判定，会和调度器打架。
- **何时重新考虑**：HAMi 把健康状态挪到 CRD 或独立的 node condition 时。

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02 — 按注解名模式匹配，不硬编码 NVIDIA

register 注解的名字随厂商变化：`hami.io/node-nvidia-register`、`hami.io/node-mlu-register`、`hami.io/node-dcu-register`、`hami.io/node-register-xpu`、`hami.io/node-biren-register`、`hami.io/node-va-register`。

`IsRegisterAnnotation` 匹配 `hami.io/node-` 前缀 + `-register` 后缀，以及 `hami.io/node-register-*` 形态。新增厂商不需要改代码。

- **为什么**：硬编码 nvidia 会在 MLU / Ascend 节点上静默退回默认值，同一个 bug 换个厂商再来一次。
- **被否方案**：按 `node-gpu-info` 的 `gpuVendor` 拼注解名。厂商名与注解名不是一一对应（`ascend` 的注解是 `node-register-<model>`，`kunlun` 是 `node-register-xpu`）。
- **何时重新考虑**：HAMi 统一注解名时。

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-03 — 只对「device plugin 拥有 register 注解」的厂商回读

| Collector | register 注解写者 | 处理 |
| --- | --- | --- |
| nvidia | device plugin | 从 register 回读 health |
| ascend | ascend-device-plugin | 整份读 register 注解，天然正确 |
| cambricon | **gpu-agent 自己**（`NeedsDeviceReport()==true`） | **不回读**，保留 cnmon 的 `HealthState` 判定 |
| hygon | 无设备 | `CollectDevices` 返回 nil |

- **为什么**：让 gpu-agent 读回自己写的注解没有信息增量，还会把「写 → 读」耦成一个环。
- **被否方案**：统一让所有厂商都回读。cambricon 会自己覆盖自己的判定结果。
- **何时重新考虑**：cambricon 的 device plugin 接管 register 注解时。

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-04 — 用 node informer 监听 register 变化，而不是缩短采集周期

`runCollectionLoop` 增加一路 `registerTriggerCh`，由 `watchRegisterAnnotations` 触发：node informer + 按 `nodeName` 过滤，`UpdateFunc` 用 `RegisterAnnotationsChanged` 比较新旧注解值，命中则去抖 2 秒后重跑 `collectNodeInfoStatic` + `syncAllocationsAndUsage`。

- **为什么**：`syncInterval` 是 5 分钟。device plugin 标记 unhealthy 后，页面最长要等 5 分钟才变色，而这段时间调度器已经不往里放 Pod 了——运维看到的是「8 张卡全绿但只能调度 5 张」。
- **被否方案**：把 `syncInterval` 缩短到 1 分钟。仍是轮询，且把一次全量 `nvidia-smi` + 拓扑采集的频率提高 5 倍。
- **被否方案**：在接口层按请求实时算。已由 DEC-01 否掉。
- **何时重新考虑**：device plugin 改为通过 CRD/事件总线发布健康状态时。

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-05 — 监听必须过滤 gpu-agent 自己写的注解，否则会自激

gpu-agent 自己也写 node 注解。若 watcher 的判据是「node 对象变了」，就会形成
`写注解 → 触发监听 → 重采集 → 再写注解` 的死循环。两道防线：

1. **结构性防线（强）**：只在 `!c.NeedsDeviceReport()` 时启动 watcher。register 注解由 gpu-agent 自己写的厂商（当前是 cambricon）根本不装 watcher。
2. **取值防线（兜底）**：`RegisterAnnotationsChanged` 只比较 **register 注解** 的值，并跳过 `AgentOwnedAnnotations(vendor)` 里的 key。

| key | 写者 | watcher 是否忽略 | 原因 |
| --- | --- | --- | --- |
| `hami.io/node-gpu-info` | gpu-agent | 是 | 不是 register 注解 |
| `hami.io/gpu-mode-status` | gpu-agent | 是 | 不是 register 注解 |
| `hami.io/node-mlu-register` | gpu-agent（cambricon） | 是 | 在 `AgentOwnedAnnotations` 里显式排除，且该厂商不装 watcher |
| `hami.io/node-nvidia-register` | device plugin | **否** | 这正是要监听的目标 |
| `hami.io/node-register-*` | ascend-device-plugin | **否** | 同上 |

node **label**（如 `vgpu`）与 **pod** 注解都不在监听范围内：watcher 只读 `node.Annotations`，所以 `patchNodeVGPULabel` 与 `patchPodAnnotation` 不会触发。

**预期触发而非循环的两条路径**：device plugin 因 XID 标记 unhealthy；gpu-agent 处理模式切换时删 device plugin Pod、插件重启后重新注册。两者都是「值变化 → 重采集一次 → 结束」。`RegisterInAnnotation` 自身带 `deviceCache`，内容不变时不发 patch，所以插件 30 秒一次的 `WatchAndRegister` 不会持续产生事件。

### DEC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-06 — 顺手修 `watchModeSignal` 的陈旧信号重放

`watchModeSignal` 原先只注册 `UpdateFunc`、`lastDesired` 初值为空，导致每次 gpu-agent 重启都会把一个月前的 `hami.io/gpu-mode-desired` 当成新请求重放：

```text
06:48:59  Pod 启动
06:51:23  Detected mode change signal: {"mode":"default",...,"timestamp":"2026-09-26T09:11:11+08:00"}
06:51:23  Deleted scheduler pod kube-system/hami-scheduler-7d8476f5cf-gjsxf for restart
```

修法：`WaitForCacheSync` 之后读一次 node，把 `lastDesired` 初始化为注解里已有的值。这样「首次观察到的状态」不会被当成「发生的事件」。

- **为什么**：`gpu-mode-desired` 是历史记录而非事件队列。重启一次白删一个 scheduler Pod，是实打实的中断。
- **被否方案**：在 `handleModeChange` 里比对 `mode-status` 的时间戳。多一处状态、多一个判断点，且 status 由自己写，容易再次自激。
- **何时重新考虑**：模式切换改为真正的命令式 API（如 CRD + observedGeneration）时。

## 系统现状

- 汇总点：`HAMi/pkg/gpu-agent/collector/nvidia.go` 的 `CollectDevices()`，health 来自 `collector/register.go` 的 `DeviceHealthFromRegister`。
- 触发点：`HAMi/cmd/gpu-agent/main.go` 的 `runCollectionLoop`，`registerTriggerCh` 分支 + `watchRegisterAnnotations`。
- 读取点：`kube-server/pkg/kapis/gpu/v1alpha1/handler.go` 的 `collectDevicesFromAnnotations()`，只解析 `hami.io/node-gpu-info`。
- 缓存：`kube-server/pkg/kapis/gpu/v1alpha1/cache.go` 的 `clusterGPUCache`，node 事件后去抖 2 秒刷新，5 分钟兜底。
- 判定点：`HAMi/pkg/device-plugin/nvidiadevice/nvinternal/rm/health.go` 的 `checkHealth()`，XID 事件不是被忽略的 XID 时 `unhealthy <- d`。
- 现场证据（B200 gpu01，2026-10-23）：device plugin 日志 `XidCriticalError: Xid=71/94 ... marking device as unhealthy` × 27 条，覆盖 idx5/6/7；`allocatable=5`、`capacity=8`；`node-nvidia-register` 里三张卡 `health:false`；`node-gpu-info` 里同一批 UUID 曾为 `health:true`。

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 共享扫描 | `HAMi` | `pkg/gpu-agent/collector/register.go`（新增） | `IsRegisterAnnotation` / `DeviceHealthFromRegister` / `RegisterAnnotationsChanged` / `AgentOwnedAnnotations` |
| 共享扫描单测 | `HAMi` | `pkg/gpu-agent/collector/register_test.go`（新增） | 通配匹配、缺失 health、多注解合并、非法 JSON、nil node、变化判定、忽略列表 |
| 注解写者 | `HAMi` | `pkg/gpu-agent/collector/nvidia.go` | `CollectDevices` 经共享 helper 取 `health` |
| 监听 | `HAMi` | `cmd/gpu-agent/main.go` | `watchRegisterAnnotations` + `registerTriggerCh`；`watchModeSignal` 初始化 `lastDesired` |
| 监听单测 | `HAMi` | `cmd/gpu-agent/register_watch_test.go`（新增） | 自写注解不触发、unhealthy 触发、label 变化不触发、agent-owned 不触发 |
| 接口 | `kube-server` | `pkg/kapis/gpu/v1alpha1/handler.go` | 只解析 `node-gpu-info`，不碰 register |
| 页面 | `console` | `src/pages/clusters/containers/Nodes/Detail/RunningStatus/GpuCardList/index.jsx` | 不改（已按 `record.health` 渲染） |
| 页面 | `console` | `src/pages/clusters/containers/Nodes/Gpus/index.jsx` | 不改（同上） |

## 对外契约

- **CON-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus` 返回的每个 item 的 `health` 等于 `hami.io/node-gpu-info` 里同 UUID 设备的 `health`；接口不读取任何 `hami.io/node-*-register` 注解。
- **CON-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — `hami.io/node-gpu-info` 的 `devices[].health` 等于同 UUID 的 register `health`（gpu-agent 汇总后）。register 注解里不存在的 UUID 保持采集默认值。

字段类型不变（`bool`），语义收紧，向后兼容。

## 不变量

- **INV-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — 接口返回的设备集合与 `node-gpu-info` 的设备集合相同（不增删行）。
- **INV-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — 对同一节点，`node-gpu-info` 里 `health:false` 的条数等于 register 注解里 `health:false` 的条数（gpu-agent 完成一轮采集后）。
- **INV-L3-CLUSTER-GPU-GPU_CARD-HEALTH-03** — register 注解里存在但采集列表里没有的 UUID 不产生新行。
- **INV-L3-CLUSTER-GPU-GPU_CARD-HEALTH-04** — gpu-agent 的写入不改变 register 注解，因此 watcher 不会被自己的写触发（`AgentOwnedAnnotations` + `NeedsDeviceReport` 双保险）。

## 已知坑

- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — `DeviceInfo.Health` 带 `json:"health,omitempty"`。`health:false` 在注解里**字段直接消失**，不是 `"health": false`。解析时必须把「字段缺失」当 `false`，否则把 unhealthy 读成健康——正好是本次 bug 的反向版本。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — device plugin 把卡标记 unhealthy 后**不会**从 register 注解里删掉它，只是把 `health` 改成 false。所以「列表少了一行」永远不会发生；症状一定是「行在、状态错」。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-03** — 这个标记不会自愈。只有 device plugin 进程重启才会重新枚举全部设备并写回 `health:true`。页面不提供「重置」按钮正是因为这个动作在 HAMi 侧。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-04** — `node-gpu-info` 的 `index` 字段同样带 `omitempty`，GPU 0 的 `index` 在注解里缺失，解析后为 0。按 UUID 合并时不要用 index 当键。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-05** — `clusterGPUCache` 只在 node 对象变更时刷新。gpu-agent 写 `node-gpu-info` 会触发 node update，所以汇总结果能进缓存；但手工改注解后立刻看页面，最长等 2 秒去抖 + 一次请求。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-06** — **新增厂商时若让 gpu-agent 自己写 register 注解，必须把该 key 加进 `AgentOwnedAnnotations`，且不要为它装 watcher**，否则会自激。`NeedsDeviceReport()` 是判断依据。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-HEALTH-07** — gpu-agent 挂掉时 `node-gpu-info` 会冻结在最后一次采集值，接口层不再有 register 兜底。这是「单一汇总者」的代价；靠 DaemonSet 重启后立即全量采集来收敛。

## 测试与可观测

- `pkg/gpu-agent/collector/register_test.go`：
  - 通配匹配（nvidia / mlu / dcu / biren / va / `node-register-910b`），非 register 注解不匹配；
  - `health` 字段缺失 → `false`；显式 `false` → `false`；
  - 多厂商注解合并；
  - 注解 JSON 非法 / 空串 → 跳过且不 panic；
  - nil node → 空映射；
  - `RegisterAnnotationsChanged`：register 值变化 → true，相同 → false，agent 自写注解 → false，ignore 列表 → false，新增/删除 → true。
- `cmd/gpu-agent/register_watch_test.go`：自写注解不触发、unhealthy 触发、label 变化不触发、agent-owned 不触发。
- UI 用例：`TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01/02`。
- 现场核对：
  - 及时性：改 register 注解后计时，`node-gpu-info` 与页面应在数秒内更新；
  - 不自激：5 分钟内 `CollectDevices` 出现次数应为「初始 1 + 变化触发 1 + 周期 1」，而非每秒一次；
  - 陈旧信号：`grep -c "Detected mode change signal"` 在无真实请求时应为 0。

## 后续改进

- 在状态列加 tooltip 说明「亚健康 = device plugin 已摘出可分配池，需重启 device plugin 恢复」。
- 把 XID 明细写进注解，详情页展示。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01`
- `TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02`
