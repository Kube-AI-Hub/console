# 租户(企业空间)用户组（L3）

[子模块需求](./_index.md)

## 概述

租户(企业空间)控制台的 **用户组** 页：`/kube-frontend/workspaces/<ws>/user-groups`。管理员在这里维护该空间的部门树（IAM Group），并把平台用户加进或移出选定的组。成员关系写在 `GroupBinding` 上，组对象本身不含成员列表。

旧页是左侧部门树 + 右侧已分配/未分配用户；创建部门时还可绑定租户(企业空间)角色。新页承接这三项：树、组的增删改、组成员增删，以及创建/编辑时的空间角色。

## 用户故事

### US1 - 看清该空间的用户组层级与规模 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **以树看到全部用户组及每个组的成员数**，以便 **判断哪些组该维护、哪些组没人**。

**Independent Test**：打开 `/workspaces/<ws>/user-groups`。无组时看到空态与「创建用户组」。有组时树节点数等于该空间 `groups` 集合；节点上的成员数等于 `groupbindings` 中指向该组的 `users` 长度之和。

### US2 - 创建、改层级并删除用户组 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **创建用户组、指定上级与租户(企业空间)角色、改别名、再删掉它**，以便 **按部门结构授权，而不用去平台用户里逐个绑角色**。

**Independent Test**：创建一次性用户组（名称、角色，可选上级）→ 树出现该节点；编辑别名后树显示新别名；有下级时删除被拒绝；删掉下级后再删除本组，接口中对象消失。

### US3 - 把人加进或移出当前用户组 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **把已有平台用户加入当前组、或从组里移除**，以便 **一批人共享该组的租户(企业空间)角色**。

**Independent Test**：选定测试组，添加一次性账号 → 成员表与 `groupbindings` 含该用户；输入用户名确认移除 → 绑定消失，平台账号仍在。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 已知租户(企业空间)内有 G 个用户组（G 可能为 0），当打开该空间用户组页，则 G 为 0 时显示空态「还没有用户组」且「创建用户组」可见；G > 0 时左侧树有 G 个节点，节点主文案为别名（否则 `generateName`），节点上的成员数等于绑定中该组的用户数之和；接口失败时显示错误面板与重试。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05** — 已知该空间可写用户组，当点「创建用户组」并提交合法名称、上级与租户(企业空间)角色，则树出现该组；再创建下级组时节点缩进一级；编辑别名后树显示新别名；有下级时删除提示先删下级且对象仍在；删除无下级组需输入显示名确认，确认后组与绑定从接口消失。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06** — 已知已选中一个用户组，当点「添加成员」并提交存在的平台用户名，则成员表出现该用户，且 `groupbindings` 含该组与该用户；对该成员执行「移除成员」并输入用户名确认后，成员表与绑定中不再含该用户，平台账号仍在。

## 设计目标

1. 部门层级在一页上可见，不必先打开旧的「设置部门」弹窗。
2. 写路径与旧 store 相同：Group POST/PATCH/DELETE，成员走 GroupBinding 数组 POST 与按 binding 名 DELETE，空间角色走 workspacerolebinding。
3. 不伪造字段：组名优先别名，其次 `generateName`；成员数只来自绑定。

## 约束与边界

- 组在 IAM 工作空间作用域：`/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groups`。
- 成员在 `/workspaces/<ws>/groupbindings`；POST 体为 `[{ userName, groupName }]`。
- 上级为标签 `iam.kubesphere.io/group-parent`（值为父组对象名）；根节点是租户(企业空间)本身，不是一个 Group 对象。
- 创建时名称写入 `metadata.generateName`（KubeSphere 显示名），对象名由服务端生成。
- 当前登录用户可以加入或移出用户组（旧页未保护自己）；这与空间成员页的自我保护不同，因为组绑定不是把人踢出空间。

## UI 交互设计

- 页面头：标题「用户组」、描述「该租户(企业空间)的用户组与成员。」、主操作「创建用户组」。
- 空态：「还没有用户组」+「先创建一个用户组，再把成员加进去。」
- 有数据：左树右成员。树节点显示显示名与成员数；右侧是选定组的成员表，主操作「添加成员」，行操作「移除成员」，以及「编辑用户组 / 删除用户组」。
- 创建/编辑弹窗：名称（创建必填、编辑锁定）、别名、上级用户组、租户(企业空间)角色（必填）。
- 删除组、移除成员均走 DeleteDialog：确认词是显示名或用户名。
- `data-ai-id`：`workspace-user-groups:surface` / `:table` / `:tree` / `:tree-node:<name>` / `:create` / `:edit` / `:delete` / `:add-member` / `:search` / `:retry`。

## 文案与校验

| key | 中文 | 英文 | 用途 |
| --- | --- | --- | --- |
| `workspace.userGroups.title` | 用户组 | User groups | 页标题 |
| `workspace.userGroups.create` | 创建用户组 | Create user group | 主操作 |
| `workspace.userGroups.empty` | 还没有用户组 | No user groups | 空态 |
| `workspace.userGroups.parentRoot` | 租户(企业空间) | Tenant (workspace) | 上级根 |
| `workspace.userGroups.error.hasChildren` | 先删除下级用户组，再删除这一级。 | Delete child groups before deleting this one. | 删父组 |

- 名称：`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`，且 `generateName` 在该空间唯一。
- 角色必须属于当前空间的 workspaceroles。
- 添加成员时用户名必须对应已有平台账号。

## 边界情况

- 组没有绑定：成员数为 0，节点仍显示。
- 绑定指向已删除的组：不产生树节点。
- 父组标签指向不存在的组：该组按根节点显示。
- 名称与对象名不同：树主文案用显示名，对象名在右侧副行。
- 写失败：弹窗保留输入与错误；成功后刷新树与成员。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 系统必须按工作空间作用域展示用户组树与成员数，空态与错误态可区分。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05** — 系统必须支持用户组的创建、编辑（别名/上级/空间角色）与删除，删除有下级的组必须被拒绝。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06** — 系统必须能把已有平台用户加入选定组，或从该组移除，且不删除平台账号。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 树节点数与组接口一致；节点成员数与绑定合并结果一致。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05** — 创建后接口可回读；下级缩进一级；删除无下级组后对象消失。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06** — 添加后绑定含该用户；移除后绑定不含该用户，账号 GET 仍 200。

## 明确不做

- 项目角色 / DevOps 角色的 ArrayInput：旧 SET_DEPARTMENTS 弹窗里的跨项目授权，归 CHECK-05 的跨作用域授权，本页不写 `rolebindings`。
- 未分配用户双栏点选：新页按空间成员邀请的方式输入用户名，不拉全量平台用户。
- 部门树的 websocket watch。
- 多集群下为每个集群挑选项目角色。

## 假设

- GroupBinding 的 `users` 是成员关系的唯一来源。
- 创建 Group 时 `generateName` 由 apiserver 生成对象名；显示仍用 `generateName`。
- 用户组与绑定数量都在 500 以内，一次 `limit=-1` 可读完。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06`
