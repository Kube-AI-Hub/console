# 项目列表（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/projects.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-02

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01

## 概述

集群内全部项目的列表。

## 设计目标与非目标

展示归属关系。非目标：项目写操作。

## 关键约束

- 集群级 `namespaces` 集合；企业空间来自标签。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01 — 企业空间列单独成列而不是拼进名称

**为什么**：项目名在不同企业空间下可以重复，把企业空间拼进名称会让「按名称搜索」失效（搜索是服务端按 namespace 名匹配的）。

**被否方案**：名称显示为 `workspace/project`。看上去更紧凑，但搜索与排序都会对不上。

**何时重新考虑**：服务端支持按标签过滤时，可做企业空间筛选器。

## 系统现状

老 console 的项目列表含名称、状态、企业空间、GPU 使用等；本模块先做与归属相关的前四列。

## 仓库落点

- `pages/cluster/ClusterListPage.tsx`（namespaces 分支）
- `packages/api-client/src/storage.ts` 的 `toNamespaceSummary`

## 对外契约

只读。

## 不变量

企业空间列等于 `kubesphere.io/workspace` 标签。

## 已知坑

- 31 个命名空间时首屏较慢，必须有加载态。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`。

## 后续改进

企业空间筛选、GPU 用量列。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01`

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-PROJECTS-02 — 用量取自 **每个 Pod 的 `containers[].usage`**

**为什么**：Pod 指标与节点指标的**形状不同**——节点是 `{ metadata, usage }`，Pod 是 `{ metadata, containers: [{ usage }] }`。第一版按节点形状读取，结果每个项目的容器组数正确、但 CPU 与内存都是 0。这个组合（计数对、用量零）恰恰是这个错误的特征。

**被否方案**：逐命名空间请求 `/namespaces/<ns>/pods`。N 个项目 N 次请求，而全量一次调用已经包含全部数据（实测 245 个 Pod，140KB）。

**何时重新考虑**：集群 Pod 数增长到单次响应过大时，改为按命名空间分页拉取。

**附带一条**：聚合结果的字段名用 `cpuUsed`/`memoryUsed`，不复用 `NamespaceSummary.cpu`（那是配额，不是测量值）——展开行对象时同名字段会被静默覆盖。
