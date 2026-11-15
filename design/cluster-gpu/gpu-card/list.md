# 子集群显卡与 RDMA 列表 · 技术方案（L3）

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-CLUSTER-GPU-GPU_CARD-LIST`

## 概述

GPU / RDMA / JuiceFS 自定义 API 只注册在 host ks-apiserver。成员集群请求带 `?cluster=<name>`，handler 用 Cluster CR kubeconfig 对成员做 Node / PV List，而不是走 WithMulticluster 路径代理。

## 关联需求

- `AC-L3-CLUSTER-GPU-GPU_CARD-LIST-01`
- `AC-L3-CLUSTER-GPU-GPU_CARD-LIST-02`
- `AC-L3-CLUSTER-GPU-GPU_CARD-LIST-03`

## 设计目标与非目标

- **目标**：子集群页读到的卡和口属于该集群；漏传 `cluster` 时不能默默返回 host 数据。
- **非目标**：不在成员集群部署这些 API；不联邦 Prometheus。

## 关键约束

- WithMulticluster 会把 `/kapis/clusters/<id>/<group>/...` 代理到成员 ks-apiserver。`xc` 是 direct 接入、库存 3.4.1，没有 `gpu.kubesphere.io`。
- host `clusterGPUCache` 只 watch host Node。成员必须 live List。
- RDMA 库存来自 Prometheus 全量 series，成员请求必须按成员 Node 名过滤，否则 host 端口会漏出来。

## 方案决策

### DEC-L3-CLUSTER-GPU-GPU_CARD-LIST-01：读接口与模式切换共用 host + `cluster` query

- **备选**：① `/kapis/clusters/<id>/gpu...` 代理到成员；② host handler 增加 `cluster` query，成员走 Cluster kubeconfig。
- **选定**：②，与 `DEC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-04` 同一条路。
- **原因**：成员没有这些 API 组。列表只需要 Node / PV Get/List，host 用 kubeconfig 就能读。
- **被否方案**：① host handler 收不到请求，页面空或 404，看起来像「没有卡」。
- **何时重新考虑**：成员也部署了带这些 API 的 ks-apiserver。

### DEC-L3-CLUSTER-GPU-GPU_CARD-LIST-02：host 继续用 informer 缓存，成员 live List

- **备选**：① 为每个成员起 Node informer；② 每次请求 List。
- **选定**：②。
- **原因**：成员集群少、列表不是热路径；为每个 Cluster 开 informer 要处理 kubeconfig 轮换与停集群。
- **被否方案**：① 复杂度高于收益。
- **何时重新考虑**：成员集群数量或列表 QPS 明显上升。

## 系统现状

### 数据流

`页面 → GET /kapis/gpu.kubesphere.io/v1alpha1/gpus?cluster=xc → host listGPUs → Cluster kubeconfig Nodes.List/Get → hami.io/node-gpu-info → 表格`

`页面 → GET /kapis/rdma.kubesphere.io/v1alpha1/ports?cluster=xc → host collectPorts → Prometheus 全量 series ∩ 成员 Node 名`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `kube-server/pkg/kapis/clusterquery/client.go` | host / 成员 kubernetes client | 不代理 HTTP |
| `gpu/v1alpha1/handler.go` `clusterGPUItems` | host 走 cache，成员 live List | 不解析 register 注解 |
| `rdma/v1alpha1/handler.go` `collectPorts` | 成员结果按 Node 名过滤 | 不假设 Prometheus 已联邦 |
| `console/src/stores/{gpu,rdma,juicefs}.js` | 把 `cluster` 放进 query | 不改成路径前缀 |
| `console/src/utils/clusterKapis.js` | 自定义 API 的基路径与 query 拼装 | 不处理 resources/monitoring |

## 仓库落点

| 层 | 仓库 | 路径 |
| --- | --- | --- |
| 接口 | `kube-server` | `pkg/kapis/{gpu,rdma,juicefs,clusterquery}/` |
| 页面 | `console` | `Nodes/Detail/RunningStatus`、`Nodes/Gpus`、`GPUResource/*` |
| 状态 | `console` | `src/stores/{gpu,rdma,juicefs}.js` |
| 新控制台 | `console` | `kube-frontend/packages/api-client/src/{gpu,node-insights}.ts` |

## 对外契约

- **CON-L3-CLUSTER-GPU-GPU_CARD-LIST-01** — 子集群显卡：`GET /kapis/gpu.kubesphere.io/v1alpha1/gpus?cluster=<cluster>`，节点页另加 `conditions=nodeName=<node>`。
- **CON-L3-CLUSTER-GPU-GPU_CARD-LIST-02** — 子集群 RDMA：`GET /kapis/rdma.kubesphere.io/v1alpha1/ports?nodeName=<node>&cluster=<cluster>`。
- **CON-L3-CLUSTER-GPU-GPU_CARD-LIST-03** — 禁止 `/kapis/clusters/<cluster>/{gpu,rdma,juicefs}.kubesphere.io/`。

## 不变量

- **INV-L3-CLUSTER-GPU-GPU_CARD-LIST-01** — 带 `cluster=xc` 的 GPU 列表不含 host 节点的 UUID。
- **INV-L3-CLUSTER-GPU-GPU_CARD-LIST-02** — 带 `cluster=xc` 的 RDMA 列表不含 host 节点名。

## 已知坑

- **GOT-L3-CLUSTER-GPU-GPU_CARD-LIST-01** — console 的 `getClusterUrl` 只改写含 `klusters/` 的 URL；真正的坑是页面自己拼 `/kapis/clusters/${cluster}/gpu...`。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-LIST-02** — GpuStore / RdmaStore 曾经把 `cluster` 从 query 里排除，只用来给行对象打标，请求实际打到 host。
- **GOT-L3-CLUSTER-GPU-GPU_CARD-LIST-03** — JuiceFS 与 GPU 监控页用了同一套错误路径前缀，必须一起改，否则子集群共享存储仍打到成员 ks-apiserver。

## 测试与可观测

- 单测：`handler_list_test.go`、`TestListPortsMemberDoesNotLeakHostPorts`、`TestListVolumesMemberDoesNotUseHostPVs`。
- UI 用例：`TC-L3-CLUSTER-GPU-GPU_CARD-LIST-01` 到 `03`。

## 后续改进

- 成员 IB 指标需要 Prometheus 联邦或成员 monitoring 入口时再补。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-01`
- `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-02`
- `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-03`
