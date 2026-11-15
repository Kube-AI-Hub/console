# TC-L3-CLUSTER-GPU-GPU_CARD-LIST-01 子集群节点运行状态 · 显卡列表请求带 cluster

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-card` `list`
- **入口**: `{BASE_URL}/clusters/xc/nodes/node201-xpu/status`
- **需求**: `prd/cluster-gpu/gpu-card/list.md`

## 产品功能

子集群节点运行状态页的显卡列表请求带 cluster=xc，路径不含 /kapis/clusters/xc/。

### 关联需求

- `prd/cluster-gpu/gpu-card/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-card/list.md`](../../../../prd/cluster-gpu/gpu-card/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_CARD-LIST-01** — Given 当前页面是 `/clusters/xc/nodes/node201-xpu/status` 且该节点只存在于 `xc`，When 打开运行状态页，Then 显卡列表请求 query 含 `cluster=xc` 与 `conditions=nodeName=node201-xpu`，路径不含 `/kapis/clusters/xc/`，表格展示该节点在 `xc` 上的卡。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-card/list.md`](../../../../design/cluster-gpu/gpu-card/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-card/list.md`](../../../../prd/cluster-gpu/gpu-card/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，在子集群节点运行状态页看到该节点的显卡


**Independent Test**：打开 `/clusters/xc/nodes/node201-xpu/status`，显卡列表请求是 `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus?conditions=nodeName=node201-xpu&cluster=xc`，表格行来自 `xc` 上该节点的 `hami.io/node-gpu-info`，不是 host 节点的卡。

## 前置与配置

- 已登录
- 成员集群 xc 的节点页 /clusters/xc/nodes/node201-xpu/status 可打开

## 测试步骤

1. 拦截 GET /kapis/gpu.kubesphere.io/v1alpha1/gpus，记录 URL，返回含一张卡的列表
2. 打开 {BASE_URL}/clusters/xc/nodes/node201-xpu/status

## 期望结果

- 拦截到的 URL query 含 cluster=xc 与 nodeName=node201-xpu
- URL 不含 /kapis/clusters/xc/

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 接口改走 /kapis/clusters/<id>/ 路径时代理会丢掉 host handler，本用例必须失败
