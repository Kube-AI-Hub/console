# 集群成员（L3）

[子模块需求](./_index.md)

## 概述

拥有集群角色绑定的账号，及各自的集群角色、账号状态与最近登录。它是项目成员的集群级对应页：同样的「谁、什么角色、还在不在用」，只是作用域是整个集群。

## 用户故事

### US1 - 看清谁能管理这个集群 (Priority: P1)

作为 **集群管理员**，我希望 **在一页看到所有持有集群角色的账号**，以便 **回答「除了我还有谁能改这个集群」**。

**Independent Test**：打开集群成员页，核对行数等于 clustermembers 接口返回数，角色列等于账号的 iam.kubesphere.io/clusterrole 注解。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01** — 已知集群有成员，当打开集群成员页，则显示用户名、状态、集群角色、最近登录四列；行数等于 clustermembers 接口返回数；角色列等于该账号的 iam.kubesphere.io/clusterrole 注解；最近登录等于 status.lastLoginTime；没有成员时显示空态。

## 设计目标

1. 角色是一列，不是需要点开才看到的东西——cluster-admin 与 cluster-regular 的区别就是能否管理集群。
2. 与项目成员页同一套列，降低阅读成本。

## 约束与边界

- 读 /kapis/iam.kubesphere.io/v1alpha2/clustermembers（与平台用户同一 IAM 聚合）。
- 只读：邀请与移除需要写集群角色绑定，属独立功能点（平台对应接口是整份成员列表的 PUT）。

## UI 交互设计

- 单列表：用户名、状态徽标、集群角色、最近登录（窄屏折叠后两列）。

## 文案与校验

- 空态：暂无集群成员 / 还没有账号被授予集群角色。- 空值统一 -。

## 边界情况

- status.state 缺失：按 Active 显示（从未停用过）。
- status.lastLoginTime 缺失：回退到注解，仍无则 -。

## 明确不做

- 邀请/移除集群成员（写集群角色绑定）。
- 集群角色本身的规则（见平台角色详情）。

## 假设

- 集群成员由 clustermembers 聚合接口暴露，角色来自注解。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01** — 读 clustermembers 并映射为四列。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02** — 无成员时显示空态而不是空表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01** — 行数与接口一致；角色与注解一致。