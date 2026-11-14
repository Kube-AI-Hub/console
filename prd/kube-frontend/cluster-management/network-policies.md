# 集群级网络策略（L3）

[子模块需求](./_index.md)

## 概述

跨项目查看集群内全部 NetworkPolicy：名称、所属项目、策略类型、入站/出站规则数、创建时间；行内的项目链接到该项目的「网络隔离」页。

## 用户故事

### US1 - 知道整个集群哪里做了网络隔离 (Priority: P2)

作为 **平台运维**，我希望 **在一个页面看到所有项目的网络策略**，以便 **判断哪些项目已经隔离流量、哪些还没有**，而不必逐个项目点开。

**Independent Test**：打开集群网络策略页，能看到跨项目的策略列表与所属项目列；点击某行的名称能进到该策略所属项目的网络隔离页。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01** — 当打开集群网络策略页，则列出集群内全部 NetworkPolicy，带「项目」列。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-02** — 当集群没有策略，则空态说明策略在项目内创建，并指向项目设置 › 网络隔离。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-03** — 当点击某行名称，则进入该策略所属项目（含其企业空间段）的网络隔离页。

## 设计目标

一眼看出「谁隔离了、谁没隔离」，并且能一步跳到编辑处。

## 约束与边界

- 只读列表：策略的增删改在项目内的「网络隔离」页完成，避免两处编辑器语义不一致。

## UI 交互设计

列表列：名称（链接）、项目、策略类型徽标、入站/出站规则数、创建时间。

## 文案与校验

空态文案明确「在项目内创建」。

## 边界情况

- 策略所属项目已被删除：链接仍指向该项目路径，页面自身会给出 404 —— 不猜一个存在的项目。
- 无法读到企业空间归属时退回 `public`。

## 明确不做

- 在本页创建/编辑/删除策略。
- 策略规则的图形化查看器（老 console 的 RuleInfo，属项目作用域）。

## 假设

- NetworkPolicy 是核心 Kubernetes 对象，不依赖 KubeSphere 的 network 模块开关。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01** — 跨项目列出策略并显示所属项目。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-02** — 行内链接进入所属项目的网络隔离页。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01** — 用例覆盖列表、空态与链接跳转。
