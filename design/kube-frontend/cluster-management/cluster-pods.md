# 集群级容器组 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-pods.md)

## 概述

跨项目容器组列表，带项目列与写回项目详情页的链接。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01

## 设计目标与非目标

目标：一屏回答「集群里跑着什么」并能进到对象。非目标：状态/节点筛选（代理不支持）、其余 7 类工作负载的集群页（本轮之后）。

## 关键约束

- `GET /kapis/resources.kubesphere.io/v1alpha3/pods`（无 namespace 段 = 跨项目）。
- 项目 → workspace 需要额外读一次命名空间列表（`kubesphere.io/workspace` 标签）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01 — workspace 由命名空间标签反查

**为什么**：Pod 对象没有 workspace 字段，而新控制台的项目详情链接必须带 workspace 段。一次读入命名空间列表（≤500）建索引，比每行再查一次便宜，也比猜 `public` 正确。
**被否方案**：链接只带项目段。新控制台路由没有这种形态，会落到 Not Found。
**何时重新考虑**：后端提供 projects→workspace 的批量接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-02 — 与项目级 Pod 页共用同一套列语义

**为什么**：节点、Pod IP、状态的取值与项目页完全一致（同一 `toWorkloadSummary`），避免两处字段口径分叉；差异只有多一列「项目」和链接的前缀。
**被否方案**：另写一个集群版 mapper。两份映射迟早会不一致。
**何时重新考虑**：集群版需要字段裁剪时。

## 系统现状

老 console：集群 → 工作负载 → 容器组，列含 PROJECT。本页迁移容器组这一页；其余 7 类同模式，按后续轮次补。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterPodsPage.tsx`
- 路由：`routes/kube-frontend.clusters.$cluster/pods/`
- 注册：`areas/registry.ts`（集群资源分组）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 容器组（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/pods |
| 命名空间（取 workspace） | /kapis/resources.kubesphere.io/v1alpha3/namespaces |

## 不变量

1. 行数 = min(20, total)。
2. 项目列 = 对象命名空间。
3. 名称链接含 workspace 段。

## 已知坑

- **registry 的 path 必须是单段**：`workloads/pods` 会被契约检查判为带 area 段；用 `pods`。
- **代理不支持 `fieldSelector`**：筛选做成服务端参数会「选了就空」（§52）。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01.yaml`
可观测点：`cluster-pods:surface`、名称链接 `cluster-pods:name:<name>`。

## 后续改进

- 其余 7 类工作负载的集群页。
- 按项目/状态筛选（需代理支持 fieldSelector）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01