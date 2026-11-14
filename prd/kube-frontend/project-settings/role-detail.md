# 项目角色详情与已授权用户（L3）

[子模块需求](./_index.md)

## 概述

项目控制台的角色详情页：`/kube-frontend/<ws>/clusters/<cluster>/projects/<namespace>/roles/<name>`。它把老 console `/projects/:namespace/roles/:name` 详情的两个页签搬过来——**权限规则** 与 **已授权用户**——只读。

项目角色列表（`…/roles`）的角色名是进入本页的入口。

「已授权用户」的数据源是 **RoleBinding**：该 role 的每条 RoleBinding 的 `subjects`（Kind / Name / Namespace），因此 ServiceAccount 与 Group 主体也会出现，而不是只列平台用户。

## 用户故事

### US1 - 项目管理员核对角色权限与已授权主体 (Priority: P1)

作为 **项目管理员**，我希望 **打开一个项目角色，能在「权限规则」和「已授权用户」两个页签之间切换**，以便 **确认这个角色允许什么、以及它当前被谁（用户/服务账号）持有**。

**Independent Test**：从项目角色列表点击角色名进入详情，规则页签行数等于角色对象 `rules` 长度；切到「已授权用户」页签，行数等于该角色全部 RoleBinding subjects 数；没有绑定时显示明确空态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01** — 已知项目 `<ns>` 的角色 `<name>` 有 R 条规则、它的 RoleBinding 共含 S 个 subject（R、S 可能为 0），当从角色列表进入该角色详情，则默认显示「权限规则」页签并列出 R 行（API 组 / 资源 / 动作）；切换到「已授权用户」页签后列出 S 行（类型 / 名称 / 命名空间），User 类型主体可跳转到用户详情；S 为 0 时显示「该角色还没有授权给任何账号」；绑定接口失败时该页签显示「授权信息不可用」与重试，而不是空态；页面只读。

## 设计目标

1. 两个页签各答一个问题：这个角色允许什么、它被谁持有。
2. 「已授权用户」以 RoleBinding 为准，覆盖 ServiceAccount/Group，不只看平台用户。
3. 只读且与写故障解耦：B200 当前 webhook 故障不影响本页（全部读操作）。

## 约束与边界

- 角色详情：`GET /kapis/iam.kubesphere.io/v1alpha2/namespaces/<ns>/roles/<name>`（`rolesApi.get`）。
- 绑定：`GET /apis/rbac.authorization.k8s.io/v1/namespaces/<ns>/rolebindings`，客户端按 `roleRef.name === role` 过滤。
- 只读：不提供编辑角色/规则、增删绑定的入口（写路径另立，且当前集群 webhook 故障）。
- 不做分页：绑定对象在项目里是几十条量级（default 实测 53 条 RoleBinding，全部指向 viewer）；一次读取后过滤，与老 console 一致。

## UI 交互设计

- 顶部：返回「项目角色」链接；标题为别名（无别名时角色名）。
- 基本信息卡：名称 / 别名 / 创建者 / 创建时间 / 描述。
- 页签：权限规则（默认）/ 已授权用户，各带数量。
- 权限规则：表格列 API 组 / 资源 / 动作；无规则显示说明。
- 已授权用户：表格列 类型 / 名称 / 命名空间；User 名称链到用户详情；无绑定显示说明；读取失败显示不可用 + 重试。
- `data-ai-id`：`project-role-detail:surface`、`:title`、`:tab:rules`、`:tab:users`、`:users`、`:user-table`、`:users-empty`、`:users-unavailable`、`:user:<name>`、`:rule-table`、`:empty-rules`、列表入口 `project-role-detail:link:<name>`。

## 文案与校验

- 页签/表格：`settings.roles.rules`（权限规则）、`settings.roles.ruleApiGroups/ruleResources/ruleVerbs`、`platform.roles.subjects`（已授权用户）、`cluster.customResources.kind`（类型）、`projectInfo.field.name`（名称）、`cluster.logCollections.namespace`（命名空间）。
- 空态：`settings.roles.noRules`、`platform.roles.noSubjects`；不可用：`platform.roles.subjectsUnavailable` + `common.retry`。
- 时间使用 `formatTimestamp`；缺失字段 `-`。

## 边界情况

- 角色没有规则：规则页签显示说明，不渲染空表头。
- 角色没有任何 RoleBinding：已授权用户页签显示空态；不把读取失败当空态。
- 绑定指向的用户已被删除：仍按 RoleBinding 显示（主体名来自 binding，不是用户对象）。
- 同一主体出现在多条绑定：每条的 subject 各成一行（行 key 含 binding 名）。
- ServiceAccount/Group 主体：不生成用户详情链接，只显示文本。
- 绑定列表读取超过一页：本实现一次取全（`namespaces/<ns>/rolebindings` 不传分页）；若将来绑定数量过大再改服务端过滤。

## 明确不做

- 编辑/删除角色、编辑规则：需要 RBAC 编辑器，且当前写类 webhook 故障。
- 增删 RoleBinding、修改成员：成员页与角色权限对话框各有入口，本页只读。
- 用户详情页本身：复用 `/kube-frontend/access/users/<name>`。
- 授权主体按用户状态/最近登录扩展列：老 console 的 users 页签有三个用户列，但我们以 RoleBinding 为源，用户对象状态不在这条读取里。

## 假设

- RoleBinding 的 `subjects` 是授权关系唯一权威来源；IAM 的 `users?role=` 只覆盖 User 主体。
- 绑定读取权限与角色读取权限对项目成员均可用（admin 实测 200）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01** — 角色详情提供「权限规则 / 已授权用户」两个只读页签。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-02** — 已授权用户以 RoleBinding subjects 为源，空态/不可用可区分。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01** — 规则行数 = `rules` 长度；已授权用户行数 = 该角色 binding subjects 总数；User 主体可跳用户详情。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01`
