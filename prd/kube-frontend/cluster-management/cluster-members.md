# 集群成员（L3）

[子模块需求](./_index.md)

## 概述

拥有集群角色绑定的账号，及各自的集群角色、账号状态与最近登录。它是项目成员的集群级对应页：同样的「谁、什么角色、还在不在用」，只是作用域是整个集群。

## 用户故事

### US1 - 看清谁能管理这个集群 (Priority: P1)

作为 **集群管理员**，我希望 **在一页看到所有持有集群角色的账号**，以便 **回答「除了我还有谁能改这个集群」**。

**Independent Test**：打开集群成员页，核对行数等于 clustermembers 接口返回数，角色列等于账号的 iam.kubesphere.io/clusterrole 注解。

### US2 - 授予、调整与收回集群角色 (Priority: P1)

作为 **集群管理员**，我希望 **直接把一个平台账号加进集群并给它一个集群角色，事后能改角色或移除它**，以便 **不必手写 ClusterRoleBinding**。

**Independent Test**：邀请一个账号 → 成员集合出现该账号且角色注解与所选一致；改角色后回读为新角色；移除后集合不再包含它。
## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02** — 已知当前身份可写集群成员，当点「邀请成员」填平台用户名并选择集群角色后提交，则发出 `POST /kapis/iam.kubesphere.io/v1alpha2/clustermembers`（body 为 `[{username, roleRef}]` 数组），成功后列表出现该账号且其 `iam.kubesphere.io/clusterrole` 注解等于所选角色；当对一行点「修改角色」并保存，则发出 `PUT …/clustermembers/<username>` 且回读注解更新；当点「移除」并输入用户名确认（或勾选多行批量移除），则发出 `DELETE …/clustermembers/<username>` 且集合不再包含该账号；当前登录账号所在行显示「当前账号」，**不渲染复选框，也不渲染改角色/移除入口**；用户名留空或不符合 `^[a-z0-9]([-a-z0-9.]*[a-z0-9])?# 集群成员（L3）

[子模块需求](./_index.md)

## 概述

拥有集群角色绑定的账号，及各自的集群角色、账号状态与最近登录。它是项目成员的集群级对应页：同样的「谁、什么角色、还在不在用」，只是作用域是整个集群。

## 用户故事

### US1 - 看清谁能管理这个集群 (Priority: P1)

作为 **集群管理员**，我希望 **在一页看到所有持有集群角色的账号**，以便 **回答「除了我还有谁能改这个集群」**。

**Independent Test**：打开集群成员页，核对行数等于 clustermembers 接口返回数，角色列等于账号的 iam.kubesphere.io/clusterrole 注解。

### US2 - 授予、调整与收回集群角色 (Priority: P1)

作为 **集群管理员**，我希望 **直接把一个平台账号加进集群并给它一个集群角色，事后能改角色或移除它**，以便 **不必手写 ClusterRoleBinding**。

**Independent Test**：邀请一个账号 → 成员集合出现该账号且角色注解与所选一致；改角色后回读为新角色；移除后集合不再包含它。
## 验收场景

 时本地拒绝且不发请求；当前身份没有写权限时隐藏写入入口并显示说明。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01** — 已知集群有成员，当打开集群成员页，则显示用户名、状态、集群角色、最近登录四列；行数等于 clustermembers 接口返回数；角色列等于该账号的 iam.kubesphere.io/clusterrole 注解；最近登录等于 status.lastLoginTime；没有成员时显示空态。

## 设计目标

1. 角色是一列，不是需要点开才看到的东西——cluster-admin 与 cluster-regular 的区别就是能否管理集群。
2. 与项目成员页同一套列，降低阅读成本。

## 约束与边界

- 读 /kapis/iam.kubesphere.io/v1alpha2/clustermembers（与平台用户同一 IAM 聚合）。
- 写入走平台的 `clustermembers` 聚合：集合 POST 接收 `[{username, roleRef}]` 数组（一次可加多人），单个成员用 PUT 更新、DELETE 移除；四个动词均于 2026-11-16 在 B200 实测。

## UI 交互设计

- 单列表：用户名、状态徽标、集群角色、最近登录（窄屏折叠后两列）。

## 文案与校验

- 空态：暂无集群成员 / 还没有账号被授予集群角色。- 空值统一 -。

## 边界情况

- status.state 缺失：按 Active 显示（从未停用过）。
- status.lastLoginTime 缺失：回退到注解，仍无则 -。

## 明确不做

- 通过直接编辑 ClusterRoleBinding 来授予角色（页面只经 `clustermembers` 聚合写入，避免绕过平台的角色模板校验）。
- 集群角色本身的规则（见平台角色详情）。

## 假设

- 集群成员由 clustermembers 聚合接口暴露，角色来自注解。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01** — 读 clustermembers 并映射为四列。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02** — 无成员时显示空态而不是空表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01** — 行数与接口一致；角色与注解一致。