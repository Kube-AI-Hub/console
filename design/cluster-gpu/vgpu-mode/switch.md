# 设置 vGPU 模式 · 技术方案（L3）

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-CLUSTER-GPU-VGPU_MODE-SWITCH`

## 概述

对话框收集 `{mode, params}`，`PUT` 到 `device-plugins/gpu/mode`，后端把它写成 Node 注解 `hami.io/gpu-mode-desired`。对话框不等结果，结果通过节点列表的模式列观察。

## 关联需求

- `AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01`
- `AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02`
- `AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03`
- `AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04`
- `AC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05`

## 设计目标与非目标

- **目标**：把「意图」与「落地」彻底分开，页面只负责前者。
- **非目标**：不在前端做落地编排；不在前端推断结果。

## 关键约束

- `params` 的值必须是字符串。后端按 `map[string]string` 存进注解；前端传数字会在 JSON 序列化后变成 number，gpu-agent 解析失败。
- 参数键与 `hami-device-plugin` ConfigMap 的 `nodeconfig` 字段同名（`devicesplitcount` / `devicememoryscaling` / `devicecorescaling`），中间不做改名。
- 打开对话框时用节点当前值回填，不用配置表默认值。

## 方案决策

### DEC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01：模式切换走注解信号，而不是直接改 ConfigMap

- **备选**：① 前端直接 patch `hami-device-plugin` ConfigMap 并删 Pod；② kube-server 提供「改 ConfigMap + 重启」的同步接口；③ 写 `hami.io/gpu-mode-desired` 注解，由 gpu-agent 落地。
- **选定**：③
- **原因**：落地要改两处（Node label + ConfigMap）并重启两个组件，是一个有顺序、可能失败、需要重试的过程。把它放进 kube-server 会让 kube-server 依赖 HAMi 的内部结构（ConfigMap 名、字段名、哪个 Deployment 要重启）；放进前端更糟。gpu-agent 本来就 watch Node 注解，也已经有 `EnableVirtualCardMode`。
- **被否方案**：① 前端改 ConfigMap 会把 kube-system 的写权限暴露给浏览器，且无法表达「先改 label 再改 ConfigMap 再重启」的顺序；② 同步接口会把分钟级的操作塞进一个 HTTP 请求，超时与重试都难处理。
- **何时重新考虑**：HAMi 把模式切换改成 CRD（带 `observedGeneration`）时，页面改为读 CRD status。

### DEC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02：对话框不等待结果

- **备选**：① 提交后轮询 `gpu-mode-status` 直到 completed；② 提交后立即关闭，靠列表的模式列观察。
- **选定**：②
- **原因**：切换要 3–5 分钟，轮询会把对话框变成一个长时间挂起的模态框，用户既不能继续操作也无法取消。模式列已经有「切换中 / 失败」两种状态，是更合适的观察点。
- **被否方案**：① 长轮询。用户离开页面就丢上下文，且 `gpu-mode-status` 的粒度不足以显示进度百分比。
- **何时重新考虑**：`gpu-mode-status` 能给出分阶段进度且切换能压到 30 秒内时。

### DEC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04：子集群模式切换留在 host ks-apiserver，用 `cluster` query

- **备选**：① 前端走 `/kapis/clusters/<cluster>/gpu.kubesphere.io/...`，让 WithMulticluster 代理到成员集群 ks-apiserver；② host GPU 接口增加 `cluster` query，用 Cluster CR 的 kubeconfig 对成员 Node 做 Get/Patch。
- **选定**：②
- **原因**：成员集群（如 `xc`）是 `connection.type=direct` 且 `kubeSphereAPIEndpoint` 为空，① 会把请求代理到成员自己的 ks-apiserver。成员跑的是库存 KubeSphere 3.4.1，没有 `gpu.kubesphere.io` 的 `changeMode`。模式切换只需要 Node Get/Patch，host 用集群 kubeconfig 就能写，gpu-agent 仍在成员集群里消费注解。
- **被否方案**：① 路径里的 `/clusters/<id>/` 触发代理，host GPU handler 根本收不到请求；成员没有 GPU API 时返回 404，看起来像「节点不存在」。
- **何时重新考虑**：成员集群也部署了带 GPU / RDMA / JuiceFS API 的 ks-apiserver 时，可以再改成路径代理。当前 GPU 列表、RDMA 端口、共享存储同样走 host + `cluster` query，不要改回路径代理。

### DEC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03：参数用配置表驱动，不用 if-else

- **备选**：① 在组件里按 mode 写 if-else 渲染参数；② 用 `GPU_VENDOR_MODE_CONFIG` 配置表描述每种模式的参数。
- **选定**：②
- **原因**：寒武纪已有 `dynamic-smlu` / `env-share` 两种模式各带不同参数，NVIDIA 又有三种。配置表让「新增一种模式」只改一个数据文件，也让对话框与后端参数的对应关系可读。
- **被否方案**：① 每加一种模式都要改 JSX 分支，且默认值散落在多处。
- **何时重新考虑**：参数需要跨字段联动校验（如「切分数 × 显存倍率不能超过 X」）时，配置表表达力不够。

## 系统现状

### 数据流

`对话框 → PUT /device-plugins/gpu/mode?nodeName=&cluster= → host handler.changeMode（成员集群用 Cluster kubeconfig） → patch 目标集群 Node 注解 hami.io/gpu-mode-desired → gpu-agent watch → EnableVirtualCardMode → label + ConfigMap + 重启 → 资源就绪`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `console/src/components/Modals/Node/GpuVirtMode/index.jsx` | 表单、回填、提交 | 不落地、不轮询 |
| `console/src/components/Modals/Node/GpuVirtMode/config.js` | 厂商 × 模式 × 参数定义 | 不含校验逻辑 |
| `kube-server/pkg/kapis/gpu/v1alpha1/handler.go` `changeMode` | 写注解信号、返回前后模式 | 不改 label / ConfigMap |
| `HAMi/cmd/gpu-agent/main.go` `watchModeSignal` | 消费注解、去抖、调用 collector | 不做校验（信任上游） |
| `HAMi/pkg/gpu-agent/collector/nvidia.go` `EnableVirtualCardMode` | 改 label、改 ConfigMap、重启 device plugin | 不重启调度器（由 main 做） |

## 仓库落点

| 层 | 仓库 | 路径 |
| --- | --- | --- |
| 对话框 | `console` | `src/components/Modals/Node/GpuVirtMode/{index.jsx,config.js}` |
| 行操作 | `console` | `src/pages/clusters/containers/Nodes/index.jsx` |
| 接口 | `kube-server` | `pkg/kapis/gpu/v1alpha1/handler.go` 的 `changeMode`（`cluster` query → 成员 kubeconfig） |
| 注册 | `kube-server` | `pkg/kapis/gpu/v1alpha1/register.go` |
| 单测 | `kube-server` | `pkg/kapis/gpu/v1alpha1/handler_mode_test.go` |
| 落地 | `HAMi` | `pkg/gpu-agent/collector/nvidia.go` 的 `EnableVirtualCardMode` |
| 消费 | `HAMi` | `cmd/gpu-agent/main.go` 的 `watchModeSignal` |

## 对外契约

- **CON-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01** — 请求体 `{"mode":"hami-core","params":{"devicesplitcount":"10","devicememoryscaling":"1","devicecorescaling":"1"}}`；`params` 省略某键表示不覆盖。
- **CON-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02** — `default` 模式的 `params` 是 `{}`（空对象），不是 `null`。
- **CON-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05** — 子集群请求是 `PUT /kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode?nodeName=<node>&cluster=<cluster>`；失败体同时有 `error` 与 `message`，前端 toast 为 `UPDATE_FAILED` 的译文加 `message`。

## 不变量

- **INV-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01** — 一次提交只影响一台节点。
- **INV-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02** — 对话框打开时的回填值等于节点当前值；节点没有该参数时用配置表默认值。

## 已知坑

- **GOT-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01** — 后端 `changeMode` 把 desired 结构**二次编码**：先 `json.Marshal(map)` 得到字节，再 `json.Marshal(string(bytes))` 存进注解。所以注解值是带引号的 JSON 字符串。前端不感知，但排查时要先 `json.Unmarshal` 一次。
- **GOT-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02** — 参数传 number 会静默失效：`buildParamsFromFormData` 里 `String(v)` 保证了字符串，如果绕过它直接传 number，gpu-agent 的 `map[string]string` 解析会失败并把整个注解丢掉。
- **GOT-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03** — 切换进行中再次提交会被 gpu-agent 的去抖逻辑合并，表现为「第二次提交无效」。页面应禁止在 `in_progress` 时提交。
- **GOT-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05** — 旧对话框把 PUT 打到 host，host informer 没有子集群节点，返回 `{error:"node … not found"}`。`formatError` 以前只读 `data.message`，toast 退化成未翻译的 `UPDATE_FAILED`。接口必须带 `cluster` query，错误体必须有 `message`。
- **GOT-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04** — 不要把 GPU 写接口放进 `/kapis/clusters/<id>/`：WithMulticluster 会改路径并代理走，host 的 `changeMode` 收不到。

## 测试与可观测

- 单测：`kube-server/pkg/kapis/gpu/v1alpha1/handler_mode_test.go` 覆盖 host / 成员集群写与 404 `message`。
- UI 用例：`TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01` 到 `05`。
- 现场核对：提交后在**目标集群**上 `kubectl get node <n> -o jsonpath='{.metadata.annotations.hami\.io/gpu-mode-desired}'`。

## 后续改进

- 提交前检查节点是否有运行中的 GPU Pod，有则二次确认。
- 把 `gpu-mode-status` 的分阶段进度显示在模式列的 tooltip 里。

## 验收用例

- `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01`
- `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02`
- `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03`
- `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04`
- `TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05`
