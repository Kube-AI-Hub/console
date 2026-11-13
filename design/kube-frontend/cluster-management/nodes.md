# 节点列表（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/nodes.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01

## 概述

节点列表：名称/内网 IP、状态、角色、CPU、内存。

## 设计目标与非目标

落实「状态等于 Ready 条件」。非目标：节点写操作与使用率。

## 关键约束

- 集群级集合；`namespace` 为空串。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01 — 显示可分配量而不是使用率

**为什么**：可分配量来自 Node 对象本身，任何时候都能读到；使用率需要 metrics-server，共享集群上未必可用，且瞬时值不适合做「还剩多少」的判断依据。

**被否方案**：显示 CPU/内存使用率。需要额外接口与降级路径，首期不做。

**何时重新考虑**：metrics 接口稳定可用时，再增加使用率列并在不可用时优雅降级。

## 系统现状

老 console 节点列含状态、角色、GPU、CPU/内存使用率、版本等；本模块取状态、角色、可分配 CPU/内存。

## 仓库落点

- `pages/cluster/ClusterListPage.tsx`（nodes 分支）
- `packages/api-client/src/storage.ts` 的 `toNodeSummary` / `nodeStatus` / `nodeRole`

## 对外契约

只读。

## 不变量

状态等于 Ready 条件；角色缺省 `worker`。

## 已知坑

- 没有 Ready 条件的节点（刚接入）不能当作 Ready。
- 角色标签可能有多个，用逗号连接。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`；单测覆盖 `nodeStatus` / `nodeRole`。

## 后续改进

GPU 列、使用率列。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01`

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-NODES-02 — 用量列显示**百分比**，容量放在 title 里

**为什么**：老 console 的节点列表显示使用率，而第一版迁移只显示了可分配量（`127600m`）——那是容量，不是"现在多忙"。改为 `metrics.k8s.io` 的当前用量 ÷ 可分配量，绝对数值放进 `title`，需要时悬停可见。

**单位换算必须显式做**：指标返回 `9983741666n`（纳核），容量是 `127600m`（毫核）。直接相除会得到几百万倍的数字。`quantityToNumber` 统一换算，并有单测覆盖 `n`/`m`/`Ki`/`Gi`。

**被否方案**：显示原始字符串。读者要自己换算，且两个数字的单位不同时根本无法比较。

**何时重新考虑**：需要历史趋势时（改为图表，需要监控接口的时间序列）。
