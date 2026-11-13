# 集群成员 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-members.md)

## 概述

读 clustermembers 聚合接口，映射为「用户名 / 状态 / 集群角色 / 最近登录」四列，只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01

## 设计目标与非目标

目标：一页回答「谁能管理这个集群」。非目标：成员增删、集群角色规则。

## 关键约束

- GET /kapis/iam.kubesphere.io/v1alpha2/clustermembers?limit=-1
- 角色：iam.kubesphere.io/clusterrole 注解；状态：status.state；最近登录：status.lastLoginTime。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MEMBERS-01 — 只读，不做邀请/移除

**为什么**：邀请与移除要写集群角色绑定；KubeSphere 对该聚合的写入是**整份成员列表的 PUT**，并发编辑会互相覆盖。这类操作需要单独的确认与冲突处理，不适合顺手迁入。

**被否方案**：列表 + 行删除按钮。删除即整表 PUT，两个管理员同时操作会丢人。

**何时重新考虑**：平台提供按成员粒度的写接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MEMBERS-02 — 角色作为列而非详情

**为什么**：cluster-admin 与 cluster-regular 的差别就是「能否管理集群」，这是列表要回答的第一问题；藏进详情等于让读者多点一次才能判断。

**被否方案**：与项目成员页保持完全相同的列（项目页角色也是列，所以这其实是一致性要求）。

**何时重新考虑**：一个成员可持有多个集群角色时（改为徽标组）。

## 系统现状

老 console 的集群设置里有「集群成员」页，列与项目成员一致。本页迁移列与只读视图；写操作按上面的决策暂不做。

## 仓库落点

- 页面：apps/console-next/src/pages/cluster/ClusterMembersPage.tsx
- 路由：apps/console-next/src/routes/kube-frontend.clusters.$cluster/members/
- 接口：packages/api-client/src/iam.ts 的 clusterMembersApi
- 区域注册：areas/registry.ts（集群设置分组）

## 对外契约

GET /kapis/iam.kubesphere.io/v1alpha2/clustermembers

## 不变量

1. 行数等于接口返回数。
2. 角色取 iam.kubesphere.io/clusterrole，缺失显示 -。
3. 状态缺失按 Active。

## 已知坑

- **注册守卫按子串匹配会误判**：registry 里已存在项目级 key: 'members'，用 'key: members' 是否存在于全文判断会把集群页跳过；注册应锚定集群作用域段落里的唯一行。
- **clustermembers 是一份聚合列表**：不要在用户的 rolebinding 里逐个拼。

## 测试与可观测

用例：tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01.yaml
可观测点：cluster-members:surface、data-ai-row=<用户名>。

## 后续改进

- 成员增删（需要按成员粒度的写接口）。
- 点用户名进入平台用户详情。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01