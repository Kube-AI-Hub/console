# 集群级网络策略（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/network-policies.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-03

## 概述

跨项目的 NetworkPolicy 列表，行内可跳到所属项目的网络隔离页。

## 系统现状

老 console 集群导航有「网络策略」页（列：名称、项目、创建时间）。迁移计划把它和 IP 池一起
登记为「network 模块未开启」。**这条也不成立**：NetworkPolicy 是核心 Kubernetes 对象
（`networking.k8s.io/v1`），与 KubeSphere 的 network 模块无关，跨命名空间读返回 200（实测）。

## 仓库落点

- `packages/api-client/src/iam.ts` 的 `networkPoliciesApi`（已存在，复用）
- `apps/console-next/src/pages/cluster/ClusterNetworkPoliciesPage.tsx`
- `routes/kube-frontend.clusters.$cluster/networkpolicies/{route,index}.tsx`

## 对外契约

`GET /kapis/resources.kubesphere.io/v1alpha3/networkpolicies?cluster=<c>`（`namespace` 为空即跨项目）。

行链接需要企业空间段：读一次 `namespaces`（pageSize 500）建 `namespace → workspace` 映射，
缺失时回退 `public`。

## 设计目标与非目标

目标：一眼看出谁隔离了、谁没隔离，并能一步跳到编辑处。非目标：本页编辑策略。

## 关键约束

- 不复用项目级编辑器：项目页有隔离开关 + 规则聚合视图，两处编辑器会语义分叉。
- 项目已删除时链接照旧构造，由目标页给出 404，不猜一个存在的项目。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-NETWORK_POLICIES-01 — 只读列表 + 跳转编辑

**为什么**：策略的语义依赖项目（隔离开关是命名空间注解），在集群视角编辑会绕开那条注解。

**被否方案**：本页内嵌规则编辑器。

**何时重新考虑**：平台需要批量下发统一策略时（那是策略模板，不是本页）。

## 不变量

1. 「项目」列永远显示，即使只有一个项目。
2. 空态文案指向「项目设置 › 网络隔离」，而不是「去创建」。

## 已知坑

- 企业空间归属要额外一次命名空间读取；读不到时用 `public` 而不是留空（留空会让链接拼错）。

## 测试与可观测

`test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NETWORK_POLICIES_01.py`：列表列、空态、行链接指向正确项目路径。

## 后续改进

- 规则聚合视图（老 console 的 RuleInfo）。
- 批量策略模板。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01`
