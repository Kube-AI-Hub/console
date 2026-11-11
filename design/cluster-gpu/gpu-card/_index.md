# 显卡列表 · 技术方案（L2）

## 概述

集群显卡页与节点运行状态页读同一个接口，渲染同一份设备列表。差别只在筛选范围：集群页不带 `conditions`，节点页带 `conditions=nodeName=<node>`。

## 关联需求

- `AC-FULL-CLUSTER-GPU-GPU_CARD-01`

## 设计目标与非目标

**目标**：两个页面一套数据、一套健康语义；列表以物理卡为粒度。

**非目标**：不做批量操作、不做跨集群聚合。

## 关键约束

- 数据只从 `GET /kapis/gpu.kubesphere.io/v1alpha1/gpus` 取，页面不直连 kube-apiserver（宪法 C1）。
- 排序、分页、筛选在后端；前端不重排。
- 健康语义见 `health.md` 的「对外契约」一节。

## 页面与技术结构

```text
kube-server
  pkg/kapis/gpu/v1alpha1/cache.go   clusterGPUCache：node informer → 展开设备
  pkg/kapis/gpu/v1alpha1/handler.go listGPUs / listGPUModelStats
  pkg/kapis/gpu/v1alpha1/types.go   GPUDevice{health,...}

console
  src/pages/clusters/containers/Nodes/Gpus/index.jsx                  集群页
  src/pages/clusters/containers/Nodes/Detail/RunningStatus/GpuCardList/index.jsx  节点页
  src/pages/clusters/containers/Nodes/Detail/GpuDetail/index.jsx      单卡详情
  src/stores/gpu.js                                                   fetchList
```

## 状态与数据归属

- 缓存：`clusterGPUCache` 在 node informer 事件后去抖 2 秒刷新，另有 5 分钟兜底 ticker。
- 页面：`fetchGpuData` 每次挂载时请求一次，不做客户端缓存。

## 关键契约与依赖

- **CON-FULL-CLUSTER-GPU-GPU_CARD-01** — 集群页与节点页返回的同一个 UUID 的 `health` 必须相同（同一个缓存条目）。
- 健康字段的语义与来源见 `health.md` 的「对外契约」一节。

## 不变量

- **INV-FULL-CLUSTER-GPU-GPU_CARD-01** — 节点页的行数等于该节点 register annotation 的设备数。

## 已知坑

- **GOT-FULL-CLUSTER-GPU-GPU_CARD-01** — 节点页的 `GpuCardList` 与集群页的 `Gpus` 各自写了一份 `record.health ? 'Running' : 'Warning'` 映射。改语义要两处一起改，否则两个页面会不一致。

## 测试与可观测

- L2 用例断言两页状态一致；L3 用例断言故障卡可见，见 `health.md` 的「验收用例」。

## 明确不做

- 不做批量操作。

## 后续改进

- 把状态映射抽成一个共享函数，消除两处重复。

## 功能点

- `health.md` — 健康状态

## 验收用例

- `TC-FULL-CLUSTER-GPU-GPU_CARD-01`
