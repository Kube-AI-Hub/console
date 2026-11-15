# 集群成员 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-members.md)

## 概述

读 clustermembers 聚合接口，映射为「用户名 / 状态 / 集群角色 / 最近登录」四列，只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02
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

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02 — 写入走 clustermembers 聚合，不直接写 ClusterRoleBinding

旧 console 的邀请/改角色/移除都打在 `kapis/iam.kubesphere.io/v1alpha2/clustermembers` 上：集合 POST 接收
`[{username, roleRef}]` 数组，单成员 PUT 改角色、DELETE 移除。新页面沿用同一条路径，而不是自己拼
`ClusterRoleBinding`：平台在聚合层做角色模板校验与成员对象维护，绕过它会得到「绑定了但成员页看不到」的状态。
被否方案：直接创建 `<user>-<role>` 形式的 RoleBinding——少一次抽象，却要自己保证命名、聚合角色与清理。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-03 — 角色候选只列 KubeSphere 的集群角色

`clusterroles` 集合在本部署返回 211 条，其中绝大多数是插件为控制器绑定的（`istiod-*`、`kiali-*`、
`edgemesh-agent` 等）。把 211 条全塞进下拉框等于没有选择。本部署的预置角色**没有** `kubesphere.io/role` 标签，
因此按 KubeSphere 的命名约定（`cluster-*`）并叠加注解 `iam.kubesphere.io/aggregation-roles` 作为第二判据，
实测得到 `cluster-admin` 与 `cluster-viewer` 两条。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-04 — 自我保护：不可操作自己，且不可勾选

旧 console 用 `showAction: username !== 当前用户` 隐藏自己那一行的操作，并把该行复选框置灰。新页面同样处理，
并且把「不可操作」扩展到选择：选择驱动批量移除，一条不能移除的行若能勾选，`已选 3 条` 里就混进一条必然失败的记录。
服务端本身也会拒绝移除自己，所以漏掉这条保护只会得到一个失败弹窗。
## 系统现状

老 console 的集群设置里有「集群成员」页，列与项目成员一致。本页迁移列与只读视图；写操作按上面的决策暂不做。

## 仓库落点

- 页面：apps/console-next/src/pages/cluster/ClusterMembersPage.tsx
- 路由：apps/console-next/src/routes/kube-frontend.clusters.$cluster/members/
- 接口：packages/api-client/src/iam.ts 的 clusterMembersApi
- 区域注册：areas/registry.ts（集群设置分组）

## 对外契约

GET /kapis/iam.kubesphere.io/v1alpha2/clustermembers

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02 — 成员写接口

| 动作 | 请求 | body |
| --- | --- | --- |
| 邀请 | `POST /kapis/iam.kubesphere.io/v1alpha2/clustermembers` | `[{username, roleRef}]`（数组，一次可多人） |
| 改角色 | `PUT …/clustermembers/<username>` | `{username, roleRef}` |
| 移除 | `DELETE …/clustermembers/<username>` | — |
| 角色候选 | `GET …/clusterroles?limit=-1` | 过滤 `cluster-*` 或含 `iam.kubesphere.io/aggregation-roles` |
## 不变量

1. 行数等于接口返回数。
2. 角色取 iam.kubesphere.io/clusterrole，缺失显示 -。
3. 状态缺失按 Active。

## 已知坑

- **注册守卫按子串匹配会误判**：registry 里已存在项目级 key: 'members'，用 'key: members' 是否存在于全文判断会把集群页跳过；注册应锚定集群作用域段落里的唯一行。
- **clustermembers 是一份聚合列表**：不要在用户的 rolebinding 里逐个拼。

### GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02 — 表单不能在角色列表到达时重置

角色候选是异步查询。把 `roles` 放进「重置表单」的 effect 依赖里，会在列表加载完成的那一刻把读者已经输入的
用户名清空——表现为「填了名字、选了角色，提交却说请输入用户名」。重置只依赖 `open`，角色默认值用函数式更新
（`setRoleRef(current => current || roles[0])`）补齐。改角色弹窗同理。

### GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-03 — 移除后集合不会立刻消失

DELETE 返回 200 后 `clustermembers?limit=-1` 仍可能在数秒内返回该账号。用例必须轮询到消失（≤60s），
finally 里再按 username 兜底删除，否则残留的成员会让后续用例看到多出来的一行。
## 测试与可观测

用例：tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01.yaml
可观测点：cluster-members:surface、data-ai-row=<用户名>。

## 后续改进

- 成员增删（需要按成员粒度的写接口）。
- 点用户名进入平台用户详情。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01