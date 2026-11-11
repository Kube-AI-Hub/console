# 显卡列表（L2）

## 概述

集群算力与节点运行状态共用的显卡视图。列表的每一行是一张物理卡，状态列直接反映「这张卡现在能不能被调度」。集群页按厂商-型号分组给出健康比例；节点页把同一份数据限定到单个节点。

## 用户故事

### US1 - 作为集群运维，在集群显卡列表里按节点核对每张卡的状态

**Independent Test**：打开 `/clusters/default/gpus`，表格出现节点 / 序号 / UUID / 状态 / 型号 / NUMA / 厂商 / 模式 / vGPU / 核心 / 显存列；按节点排序后，每节点的行数与 `kubectl get node <name> -o jsonpath='{.metadata.annotations.hami\.io/node-nvidia-register}'` 里的设备数一致。

### US2 - 作为集群运维，点进某张卡看到它的详细属性

**Independent Test**：点表格里的 UUID 进入 `/clusters/default/nodes/<node>/gpus/<uuid>/status`，侧栏显示状态、节点、UUID、序号、型号、厂商、NUMA、模式、显存总量；状态与列表里那一行一致。

## 验收场景

- **AC-FULL-CLUSTER-GPU-GPU_CARD-01** — Given 已登录且集群有 GPU 节点，When 打开显卡列表，Then 表格列齐全、每行有状态标记、点 UUID 可进入单卡详情且状态一致。

## 设计目标

- 集群页与节点页共用同一个接口与同一套健康语义，避免「同一张卡在两个页面显示不同状态」。
- 列表以**物理卡**为粒度，不以 allocatable 计数为粒度：allocatable 是「能分配几张」，列表是「机箱里有几张、各自什么状态」。

## 约束与边界

- 列表数据来自 `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus`；集群页不带 `conditions`，节点页带 `conditions=nodeName=<node>`。
- 排序与筛选在后端完成（`sortBy`、`page`、`limit`、`labelSelector`、`status`），前端不做二次排序。

## UI 交互设计

- 集群页：概览条 + 表格。状态列可筛选（健康 / 亚健康）。
- 节点页：表格卡片，无筛选。
- 状态标记用 `Status` 组件：健康 → `Running` 绿色；亚健康 → `Warning` 橙色。

## 页面结构

```text
集群 /clusters/:cluster/gpus
  Banner: 显卡
  Overview: 总数 | 健康比例环图 | 各型号计数
  Table: 节点 | 序号 | UUID | 状态 | 型号 | NUMA | 厂商 | 模式 | vGPU | 核心 | 显存

节点 /clusters/:cluster/nodes/:node/status
  ...
  Panel: 显卡列表
  Table: 序号 | UUID | 状态 | 型号 | NUMA | 厂商 | 模式 | vGPU | 核心 | 显存
  Panel: RDMA 端口列表
```

## 异常态

| 状态 | 表现 |
| --- | --- |
| 节点无 GPU | 表格显示「暂无 GPU」 |
| 节点没有 register annotation | 该节点不产生行 |
| 有卡被 device plugin 摘除 | 该卡仍在列表里，状态为「亚健康」 |
| 接口失败 | 表格空态，不显示上一次的陈旧数据 |

## 功能需求

- **FR-FULL-CLUSTER_GPU-GPU_CARD-01** — 系统 MUST 让集群页与节点页共用同一个显卡接口与同一套健康语义。

## 成功标准

- **SC-FULL-CLUSTER_GPU-GPU_CARD-01** — 集群页与节点页对同一张卡显示的状态一致。

## 明确不做

- 不做卡的批量操作（批量摘除、批量重置）。
- 不做跨集群聚合。

## 假设

- 每个 GPU 节点都有 HAMi device plugin 在运行。

## 功能点

- `health.md` — 健康状态

## 验收用例

- `TC-FULL-CLUSTER-GPU-GPU_CARD-01`
