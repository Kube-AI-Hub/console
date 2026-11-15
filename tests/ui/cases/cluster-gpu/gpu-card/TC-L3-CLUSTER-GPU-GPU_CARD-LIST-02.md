# TC-L3-CLUSTER-GPU-GPU_CARD-LIST-02 子集群显卡页 · 列表与 stats 请求带 cluster

- **用例 ID**: `TC-L3-CLUSTER-GPU-GPU_CARD-LIST-02`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-gpu` / `gpu-card` `list`
- **入口**: `{BASE_URL}/clusters/xc/gpus`
- **需求**: `prd/cluster-gpu/gpu-card/list.md`

## 产品功能

子集群显卡页的 gpus 与 gpus/stats 请求带 cluster=xc，路径不含 /kapis/clusters/xc/。

### 关联需求

- `prd/cluster-gpu/gpu-card/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-card/list.md`](../../../../prd/cluster-gpu/gpu-card/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-GPU-GPU_CARD-LIST-02** — Given 当前页面是 `/clusters/xc/gpus`，When 打开显卡列表，Then `GET /gpus` 与 `GET /gpus/stats` 都带 `cluster=xc`，路径不含 `/kapis/clusters/xc/`，行的节点属于 `xc`。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-card/list.md`](../../../../design/cluster-gpu/gpu-card/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-card/list.md`](../../../../prd/cluster-gpu/gpu-card/list.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为集群运维，在子集群显卡页看到该集群的全部卡


**Independent Test**：打开 `/clusters/xc/gpus`，列表与 stats 请求带 `cluster=xc`，路径不含 `/kapis/clusters/xc/`；行的节点名属于 `xc`。

## 前置与配置

- 已登录
- 成员集群 xc 的显卡页可打开

## 测试步骤

1. 拦截 GET /kapis/gpu.kubesphere.io/v1alpha1/gpus 与 /gpus/stats，记录 URL
2. 打开 {BASE_URL}/clusters/xc/gpus

## 期望结果

- gpus 与 gpus/stats 的 URL query 都含 cluster=xc
- URL 不含 /kapis/clusters/xc/

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 接口改走 /kapis/clusters/<id>/ 路径时代理会丢掉 host handler，本用例必须失败
