# vGPU 模式 · 技术方案（L2）

## 概述

模式切换是**跨三个组件的一次异步配置下发**：console 写一个期望值，kube-server 把它落到 Node 注解，gpu-agent 消费该注解并改 Node label 与 device plugin ConfigMap，device plugin 与调度器重启后生效。页面在整条链路上只做两件事：写意图、读结果。

## 关联需求

- `AC-FULL-CLUSTER-GPU-VGPU_MODE-01`

## 设计目标与非目标

**目标**：模式切换只有一个写入点、一个落地者；中间态（切换中/失败）在页面上可见；三种模式的容量关系可从页面直接核对。

**非目标**：不在页面里实现落地逻辑；不做批量切换；不做回滚。

## 关键约束

- 模式是**节点属性**。同一集群不同节点可以不同，页面不能假设全局一致。
- 切换会重启 device plugin 与调度器 Pod，并可能 reset GPU（MIG）。这是**破坏性操作**，必须由人显式触发。
- 从提交到生效是分钟级（重启 Pod + 重新注册设备 + 调度器重载配置），页面必须有中间态。

## 页面与技术结构

```text
kube-server
  pkg/kapis/gpu/v1alpha1/register.go    PUT /device-plugins/{name}/mode
  pkg/kapis/gpu/v1alpha1/handler.go     changeMode：写 hami.io/gpu-mode-desired
  pkg/kapis/gpu/v1alpha1/handler.go     listGPUs：读 hami.io/node-gpu-info 的 virtualCardMode

console
  src/components/Modals/Node/GpuVirtMode/index.jsx   对话框
  src/components/Modals/Node/GpuVirtMode/config.js   厂商 × 模式 × 参数配置表
  src/pages/clusters/containers/Nodes/index.jsx      行操作 + 模式列
  src/pages/clusters/containers/Nodes/Detail/RunningStatus/index.jsx  资源总量

HAMi（gpu-agent）
  cmd/gpu-agent/main.go                 watchModeSignal：消费 hami.io/gpu-mode-desired
  pkg/gpu-agent/collector/nvidia.go     EnableVirtualCardMode：改 label + ConfigMap + 重启
  cmd/gpu-agent/main.go                 restartSchedulerDeployment
```

## 状态与数据归属

| 事实 | 唯一写者 | 落点 | 读者 |
| --- | --- | --- | --- |
| 期望模式 | kube-server | Node 注解 `hami.io/gpu-mode-desired` | gpu-agent |
| 落地结果 | gpu-agent | Node 注解 `hami.io/gpu-mode-status` | kube-server → 页面 |
| 当前模式（汇总） | gpu-agent | Node 注解 `hami.io/node-gpu-info` 的 `virtualCardMode` | kube-server → 页面 |
| 用哪个 device plugin | gpu-agent | Node label `vgpu=on\|off` | device plugin DaemonSet 的 nodeSelector |
| 插件行为 | gpu-agent | `hami-device-plugin` ConfigMap 的 `nodeconfig[]` | device plugin |

## 关键契约与依赖

- **CON-FULL-CLUSTER-GPU-VGPU_MODE-01** — `PUT /kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode?nodeName=<n>` 请求体 `{mode, params}`；`mode ∈ {default, hami-core, mig}`；`params` 的值是字符串。响应 `{success, prevMode, newMode, message}`。
- **CON-FULL-CLUSTER-GPU-VGPU_MODE-02** — `hami.io/gpu-mode-desired` 的内容是 `{"mode":"...","params":{...},"timestamp":"RFC3339"}` 的 JSON **字符串**（二次编码），gpu-agent 解析时先反序列化成字符串再反序列化。
- **CON-FULL-CLUSTER-GPU-VGPU_MODE-03** — 三种模式的资源名与容量关系：

| 模式 | 计数资源 | 容量 |
| --- | --- | --- |
| `default` | `nvidia.com/gpu` | 卡数 |
| `hami-core` | `nvidia.com/vgpu` | 卡数 × `deviceSplitCount` |
| `mig` | `nvidia.com/gpu` | MIG 实例数 |

## 不变量

- **INV-FULL-CLUSTER-GPU-VGPU_MODE-01** — 同一时刻，节点上只有一个 device plugin 在注册计数资源：`vgpu=off` 时是上游 `nvidia-device-plugin`，`vgpu=on` 时是 HAMi 的 `hami-device-plugin`。
- **INV-FULL-CLUSTER-GPU-VGPU_MODE-02** — `nvidia.com/vgpu` 非零当且仅当节点 `vgpu=on` 且 `devices.nvidia.resourceCountName=nvidia.com/vgpu`。
- **INV-FULL-CLUSTER-GPU-VGPU_MODE-03** — `hami.io/node-gpu-info` 的 `virtualCardMode` 与 `hami-device-plugin` ConfigMap 里该节点的 `operatingmode` 一致（gpu-agent 一轮采集后）。

## 已知坑

- **GOT-FULL-CLUSTER-GPU-VGPU_MODE-01** — `nodeconfig` 按 `name` 精确匹配节点名。ConfigMap 里有一条模板项 `name: "your-node-name"`，它不匹配任何节点，但如果误把真实节点名改成它，该节点会退回默认模式且没有任何报错。
- **GOT-FULL-CLUSTER-GPU-VGPU_MODE-02** — MIG 模式切换会 `SetMigMode`，这是**破坏性**的：现有 MIG 实例被销毁，正在跑的容器失败。页面必须在选 `mig` 时给出警告。
- **GOT-FULL-CLUSTER-GPU-VGPU_MODE-03** — 切换后 3–5 分钟资源才就绪。这段时间页面显示旧容量而模式列已是新模式，是正常的；不要为此加「等待中」的假状态。
- **GOT-FULL-CLUSTER-GPU-VGPU_MODE-04** — `nvidia.com/gpu` 必须列在调度器的 `managedResources` 里。不列的话 kube-scheduler 用 `DefaultBinder` 绑定，HAMi extender 的 Bind 不执行，`hami.io/vgpu-node` 不写，device plugin 随后每次 Allocate 都失败（`no binding pod found on node`）。MIG 模式正是用 `nvidia.com/gpu`，所以这条在 MIG 下必现。
- **GOT-FULL-CLUSTER-GPU-VGPU_MODE-05** — extender 端口不能是 443。节点上跑 nginx（本地 Harbor / ingress）时，pod 内访问 `127.0.0.1:443` 会到宿主 nginx，TLS 握手失败，表现与 GOT-04 相同。

## 测试与可观测

- 端到端核对（在 A100 上执行，命令见 `环境/a100环境.md`）：
  - `kubectl get node <n> -o jsonpath='{.metadata.labels.vgpu}'`
  - `kubectl -n kube-system get cm hami-device-plugin -o jsonpath='{.data.config\.json}'`
  - `kubectl get node <n> -o jsonpath='{.status.capacity}'`
  - `kubectl -n kube-system get deploy hami-scheduler -o jsonpath='{.spec.template.spec.containers[*].args}'`
- UI 用例：`TC-FULL-CLUSTER-GPU-VGPU_MODE-01`。

## 明确不做

- 不在页面里重启 Pod。
- 不做 dry-run。
- 不做多节点批量切换。

## 后续改进

- 把 `gpu-mode-status` 的进度（改 label / 改 ConfigMap / 重启中 / 完成）分阶段暴露到页面。
- 切换前自动检查该节点是否有运行中的 GPU 负载，有则要求二次确认。

## 功能点

- `switch.md` — 设置 vGPU 模式
- `capacity.md` — vGPU 资源就绪

## 验收用例

- `TC-FULL-CLUSTER-GPU-VGPU_MODE-01`
