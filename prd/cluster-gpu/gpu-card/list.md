# 子集群显卡与 RDMA 列表（L3）

[子模块需求](./_index.md)

## 概述

成员集群（如 `xc`）的节点运行状态页和集群显卡页，必须列出**该集群**的 GPU 与 RDMA 端口，而不是 host 上的卡和口。接口留在 host ks-apiserver，用 `cluster` query 指向成员集群。

## 用户故事

### US1 - 作为集群运维，在子集群节点运行状态页看到该节点的显卡

**Independent Test**：打开 `/clusters/xc/nodes/node201-xpu/status`，显卡列表请求是 `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus?conditions=nodeName=node201-xpu&cluster=xc`，表格行来自 `xc` 上该节点的 `hami.io/node-gpu-info`，不是 host 节点的卡。

### US2 - 作为集群运维，在子集群显卡页看到该集群的全部卡

**Independent Test**：打开 `/clusters/xc/gpus`，列表与 stats 请求带 `cluster=xc`，路径不含 `/kapis/clusters/xc/`；行的节点名属于 `xc`。

### US3 - 作为集群运维，在子集群节点运行状态页看到该节点的 RDMA 端口而不是 host 的口

**Independent Test**：打开 `/clusters/xc/nodes/node201-xpu/status`，RDMA 请求是 `GET /kapis/rdma.kubesphere.io/v1alpha1/ports?nodeName=node201-xpu&cluster=xc`；列表不含 host 节点（如 `gpu01`）的端口。没有 InfiniBand 指标时表格为空，而不是混入 host 端口。

## 验收场景

- **AC-L3-CLUSTER-GPU-GPU_CARD-LIST-01** — Given 当前页面是 `/clusters/xc/nodes/node201-xpu/status` 且该节点只存在于 `xc`，When 打开运行状态页，Then 显卡列表请求 query 含 `cluster=xc` 与 `conditions=nodeName=node201-xpu`，路径不含 `/kapis/clusters/xc/`，表格展示该节点在 `xc` 上的卡。
- **AC-L3-CLUSTER-GPU-GPU_CARD-LIST-02** — Given 当前页面是 `/clusters/xc/gpus`，When 打开显卡列表，Then `GET /gpus` 与 `GET /gpus/stats` 都带 `cluster=xc`，路径不含 `/kapis/clusters/xc/`，行的节点属于 `xc`。
- **AC-L3-CLUSTER-GPU-GPU_CARD-LIST-03** — Given 当前页面是 `/clusters/xc/nodes/node201-xpu/status`，When 打开运行状态页，Then RDMA 端口请求 query 含 `cluster=xc` 与 `nodeName=node201-xpu`，列表不出现 host 节点的端口。

## 设计目标

- 成员集群的 GPU / RDMA 读接口与 vGPU 模式切换同一条路由：host handler + `cluster` query + Cluster CR kubeconfig。不要用 `/kapis/clusters/<id>/` 代理到成员 ks-apiserver。

## 约束与边界

- `gpu.kubesphere.io`、`rdma.kubesphere.io`、`juicefs.kubesphere.io` 只部署在 host ks-apiserver。成员集群（`connection.type=direct` 且无 `kubeSphereAPIEndpoint`）跑库存 KubeSphere，没有这些 API。
- 监控页（概览 / 物理监控 / 排行）同样走 host GPU API + `cluster` query，不走路径前缀。
- RDMA 库存来自 Prometheus。host Prometheus 没有成员节点的 `node_infiniband_*` 时，成员页显示空列表，这是预期，不是回退到 host 端口。

## UI 交互设计

页面上没有新控件。子集群页与 host 页同一套表格；差别只在请求是否带 `cluster`。

## 文案与校验

- 形态：页面上没有控件，是一项能力
- 文案：沿用显卡列表与 RDMA 端口列表已有 key，不新增。

| key | 中文 | 英文 | 用途 |
| --- | --- | --- | --- |
| `GPU_CARD_LIST` | 显卡列表 | GPU cards | 节点页面板标题 |
| `RDMA_PORT_LIST` | RDMA 端口列表 | RDMA Port List | 节点页面板标题 |

## 边界情况

| 情况 | 对外行为 |
| --- | --- |
| 成员节点没有 `node-gpu-info` | 显卡表格空态 |
| 成员集群 Prometheus 没有 IB 指标 | RDMA 表格空态，不显示 host 端口 |
| 漏传 `cluster` | host informer 找不到成员节点，显卡 404 / 空列表 |
| 走 `/kapis/clusters/xc/gpu...` | 代理到成员 ks-apiserver，404 |

## 功能需求

- **FR-L3-CLUSTER-GPU-GPU_CARD-LIST-01** — 系统 MUST 在子集群显卡列表与节点显卡列表请求上携带 `cluster` query，并由 host ks-apiserver 用该集群 kubeconfig 读成员 Node 注解。
- **FR-L3-CLUSTER-GPU-GPU_CARD-LIST-02** — 系统 MUST 在子集群 RDMA 端口请求上携带 `cluster` query，并只返回该集群节点上的端口。
- **FR-L3-CLUSTER-GPU-GPU_CARD-LIST-03** — 系统 MUST NOT 把 GPU / RDMA / JuiceFS 自定义 API 放到 `/kapis/clusters/<id>/` 路径下。

## 成功标准

- **SC-L3-CLUSTER-GPU-GPU_CARD-LIST-01** — `/clusters/xc/gpus` 与 `/clusters/xc/nodes/node201-xpu/status` 的显卡行与 `kubectl --kubeconfig=xc get node node201-xpu` 的 `hami.io/node-gpu-info` 设备数一致。
- **SC-L3-CLUSTER-GPU-GPU_CARD-LIST-02** — 上述页面的 GPU / RDMA 请求 URL 含 `cluster=xc` 且不含 `/kapis/clusters/xc/`。

## 明确不做

- 不在成员集群部署带 GPU API 的 ks-apiserver。
- 不把 host Prometheus 没有的成员 IB 指标伪造出来。
- 不做跨集群聚合。

## 假设

- 已登录，且 `xc` 在 host 上是 Ready 的 Cluster CR。
- 成员节点上有 gpu-agent 写 `hami.io/node-gpu-info`。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-01`
- `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-02`
- `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-03`
