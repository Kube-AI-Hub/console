# TC-L3-CLUSTER-GPU-GPU_CARD-LIST-03 子集群节点运行状态 · RDMA 端口请求带 cluster

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-03`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-card` `list`
- **入口**: `{BASE_URL}/clusters/xc/nodes/node201-xpu/status`
- **需求**: `prd/cluster-gpu/gpu-card/list.md`

## 产品功能

子集群节点运行状态页的 RDMA 端口请求带 cluster=xc，路径不含 /kapis/clusters/xc/。

### 关联需求

- `prd/cluster-gpu/gpu-card/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-card/list.md`](../../../../prd/cluster-gpu/gpu-card/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_CARD-LIST-03** — Given 当前页面是 `/clusters/xc/nodes/node201-xpu/status`，When 打开运行状态页，Then RDMA 端口请求 query 含 `cluster=xc` 与 `nodeName=node201-xpu`，列表不出现 host 节点的端口。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-card/list.md`](../../../../design/cluster-gpu/gpu-card/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-card/list.md`](../../../../prd/cluster-gpu/gpu-card/list.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为集群运维，在子集群节点运行状态页看到该节点的 RDMA 端口而不是 host 的口


**Independent Test**：打开 `/clusters/xc/nodes/node201-xpu/status`，RDMA 请求是 `GET /kapis/rdma.kubesphere.io/v1alpha1/ports?nodeName=node201-xpu&cluster=xc`；列表不含 host 节点（如 `gpu01`）的端口。没有 InfiniBand 指标时表格为空，而不是混入 host 端口。

## 前置与配置

- 已登录
- 成员集群 xc 的节点页 /clusters/xc/nodes/node201-xpu/status 可打开

## 测试步骤

1. 拦截 GET /kapis/rdma.kubesphere.io/v1alpha1/ports，记录 URL，返回空列表
2. 打开 {BASE_URL}/clusters/xc/nodes/node201-xpu/status

## 期望结果

- 拦截到的 URL query 含 cluster=xc 与 nodeName=node201-xpu
- URL 不含 /kapis/clusters/xc/

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 漏传 cluster 时 host Prometheus 的端口会混进子集群页，本用例必须失败
