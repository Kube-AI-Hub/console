# 集群作用域角色（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/roles.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02

## 概述

集群控制台的集群角色列表与详情（规则 / 已授权用户两页签）。读当前集群的 IAM 聚合集合；只读。来源 N-06。

## 设计目标与非目标

目标：集群上下文自洽；规则可扫读；用户列表与 IAM 聚合一致。非目标：本页写角色、组/SA 授权、平台角色页多集群切换（登记后续）。

## 关键约束

- 列表 GET /kapis/iam.kubesphere.io/v1alpha2/clusterroles?limit=-1（host）；成员集群 /kapis/clusters/<c>/iam.kubesphere.io/v1alpha2/clusterroles。
- 详情 GET 同集合 /<name>；规则按 rules[] 原样展示，不改写。
- 已授权用户 GET /users?clusterrole=<name>&limit=-1（同一 IAM 前缀）；只含 IAM 用户，原生绑定不在其中。
- 页面只读：不渲染创建/编辑/删除入口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01 — 集群作用域页按集群前缀读，而不是复用平台页的 host 固定值

**为什么**：平台「集群角色」页固定读 host；在成员集群控制台里它答非所问。新增集群作用域页并把集群作为路径参数，host 与成员各读各的 IAM 前缀，页面数据才与 URL 自洽。

**被否方案**：给平台角色页加集群下拉。会把平台作用域页面变成集群作用域，且平台页的其他列（创建者等）语义不一致；多集群切换登记为平台页后续改进。

**何时重新考虑**：平台角色页需要跨集群只读浏览时，再在平台页加选择器并复用本页的读取函数。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02 — 已授权用户为空是合法结果，不隐藏页签

**为什么**：IAM 聚合 users?clusterrole= 只覆盖 IAM 管理的绑定；Kubernetes 原生绑定（system:*、ServiceAccount、安装时的 admin）不在其中。把 0 当错误或隐藏页签，会让人以为页面漏数据。空态明确说明只列直接绑定的 IAM 用户。

**被否方案**：从 clusterrolebindings 拉全量再客户端过滤。会混入非 IAM 主体且与服务端语义分叉；老 console 也用同一个 IAM 聚合。

**何时重新考虑**：IAM 聚合提供组/SA 的授权视图时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-04 — 平台角色页加集群选择器，成员视图只读

**为什么**：平台角色页固定读 host（N-06 登记的问题）；多集群安装下管理员需要核对成员集群角色。列表读取已经按集群前缀实现，选择器只需切换数据源。成员视图**只读**：平台页的写接口是 host 作用域的，把成员写入口放这里会打错集群；成员写操作留在集群控制台（那里已有角色写能力的落点规划）。

**被否方案**：让成员视图复用平台写操作并把 API 参数化。写路径/权限提示尚未在成员集群验证，隐藏入口比写错集群安全。

**何时重新考虑**：成员集群角色写能力在集群控制台交付后，可从本页链接过去而不是内嵌写操作。

## 系统现状

老 console clusters/containers/Roles：列表 + 详情路由 authorizations/users 两个子页；AuthorizedUsers 用 UserStore + ROLE_QUERY_KEY['clusterroles']='clusterrole' 查询。新 UI 此前无集群作用域 roles 路由；平台访问控制页只读 host。

## 仓库落点

- apps/console-next/src/pages/cluster/ClusterRolesPage.tsx
- apps/console-next/src/pages/cluster/ClusterRoleDetailPage.tsx
- apps/console-next/src/routes/kube-frontend.clusters.$cluster/roles/{route,index,$name}.tsx
- apps/console-next/src/areas/registry.ts（集群设置 › 集群角色）
- packages/api-client/src/access.ts（clusterRolesForClusterApi）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 角色列表 | GET /kapis/iam…/clusterroles?limit=-1（成员 /kapis/clusters/<c>/…） | metadata.name/creationTimestamp、rules[] |
| 角色详情 | GET 同集合/<name> | rules[]、annotations |
| 已授权用户 | GET /kapis/iam…/users?clusterrole=<name>&limit=-1 | metadata.name、status.state、status.lastLoginTime |

## 不变量

1. 列表行数 = 当前集群集合 items.length。
2. 规则行数 = 对象 rules.length；rules 空显示空态。
3. 用户行集合 = IAM users?clusterrole= 返回集合；空集合显示空态。
4. 页面无写入口。
5. 成员集群读取失败 → 错误面板，不回退 host 数据。

## 已知坑

- 平台角色页的 clusterRolesApi 固定 host；成员集群必须用集群前缀函数，否则数据串集群。
- IAM 用户过滤不包含原生 k8s 绑定；「0 个用户」可能是正确结果（实测 cluster-admin 也是 0）。
- role-template-* 是系统角色，只读但要显示规则。
- 详情用户查询参数名是 clusterrole（不是 roleRef 或 role）。
- 角色列表 218 条：一次取全后前端分页，别用服务端分页假设 totalItems 分页字段。

## 测试与可观测

E2E：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01（B200 host）。
可观测点：cluster-roles:surface/table/name:<name>；cluster-role-detail:surface/rules/rule:<i>/tab:rules/tab:users/users/user:<name>/rules-empty/users-empty/retry；平台页 clusterroles:cluster（选择器）、clusterroles:member-readonly、clusterroles:create。

## 后续改进

平台角色页多集群切换；组与 ServiceAccount 授权视图；角色写能力入口统一。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02
