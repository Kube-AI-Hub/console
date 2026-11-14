# 租户(企业空间)成员（L3）

[子模块需求](./_index.md)

## 概述

租户(企业空间)管理员在 `/kube-frontend/workspaces/<ws>/members` 邀请已有平台用户、调整角色、移除绑定；点用户名进入详情，查看该成员可访问的项目与 DevOps 工程。不需要切回旧控制台。

## 用户故事

### US1 - 管理空间成员的访问权限 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **邀请用户并调整或撤销其空间角色**，以便 **让团队获得适合的权限**。

**Independent Test**：邀请一个一次性平台用户，回读角色；改为另一个空间角色并回读；移除后空间列表不再含该用户，平台账号仍然存在。

### US2 - 在成员表上找到人且不能操作自己 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **按名称搜索、看到邮箱与登录状态、点用户名进入详情，并且不能改或移除自己**，以便 **日常查人时不会把自己踢出空间**。

**Independent Test**：打开成员页，搜索一个已知成员能收窄列表；当前登录用户没有行菜单和复选框；其他成员行有「修改角色 / 移除成员」；批量移除需输入选中人数确认。

### US3 - 看清一名成员能进哪些项目 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **打开成员详情看到其空间角色、邮箱，以及可访问的项目和 DevOps 工程**，以便 **交接时知道对方实际能进哪里**。

**Independent Test**：打开 `/workspaces/<ws>/members/<name>`，核对租户(企业空间)/角色/邮箱；项目页签列出该用户的 namespaces（或空态）；DevOps 页签在模块未部署时显示空态而不是整页错误。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01** — 成员页提供邀请入口及行级修改角色、移除操作；角色选项仅来自当前空间。邀请要求已有账号和有效角色，修改时用户名不可变；保存后列表与 API 角色一致。移除需要输入用户名确认，仅移除空间绑定，不删除平台用户。读取和提交错误可见，失败保留输入；提交期间禁止重复操作，成功刷新空间成员列表。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-02** — 已知成员列表可读，当打开成员页，则用户名下显示邮箱并链到详情；状态显示「活跃 / 已停用」而非原始英文；从未登录显示「尚未登录」；可按名称搜索；当前登录用户不可勾选、无修改/移除菜单；批量移除需输入选中人数确认，且不包含自己。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03** — 已知某成员存在，当打开其详情，则展示租户(企业空间)、租户(企业空间)角色、邮箱；项目页签列出该成员可访问的项目（名称可点进项目控制台）或明确空态；DevOps 页签在接口 404 时为空态而非整页错误；非本人可从详情移除绑定。

## 设计目标

统一空间成员的授权闭环，并补齐旧页的查找、自我保护和成员下钻，与项目成员接口及平台账号管理明确分开。

## 约束与边界

- 角色权限、账号读取和成员写权限由服务端权威校验；403 不当作空集合。
- 无空间角色时显示说明，不提供可提交的空表单。
- 中文产品名统一为「租户(企业空间)」，不得再单独写「企业空间」。
- 当前登录用户不能改自己的空间角色或把自己移出空间。

## UI 交互设计

邀请是唯一主操作；修改角色和移除放在行菜单。表单复用 ResourceForm，角色页与弹窗共用角色数据。
移除复用 DeleteDialog：单人输入用户名，批量输入人数。列表提供搜索、刷新、多选和加载反馈。
用户名链到详情；详情用页签切换项目与 DevOps，返回链到成员列表。

## 文案与校验

- 租户(企业空间)专属描述使用 `workspace.members.*`；通用用户名和操作文案复用已有键。
- 用户名不可为空，角色必须属于本次接口返回的空间角色集合。
- 状态：`platform.status.active` / `platform.status.disabled`；未登录：`platform.column.notLoginYet`。

| key | 中文 | 英文 | 用途 |
| --- | --- | --- | --- |
| `workspace.members.title` | 租户(企业空间)成员 | Workspace members | 列表标题 |
| `workspace.members.search` | 按名称搜索 | Search by name | 搜索框 |
| `workspace.field.workspaceRole` | 租户(企业空间)角色 | Tenant (workspace) role | 详情属性 |

## 边界情况

- 角色读取失败不展示自由文本角色，提供错误信息和可适用的重试。
- 已删除账号不得创建虚假的角色绑定；邀请前确认账号存在。
- DevOps 集合 404：该页签空态，不把整页打成错误。
- 搜索无匹配：表格空，不重新请求接口。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01** — 邀请、改角色、移除与刷新闭环。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-02** — 列表搜索、邮箱、状态文案、自我保护与批量移除。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03** — 成员详情展示身份属性、项目与 DevOps 页签。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01** — 三次写入的回读结果正确，移除后平台账号保持存在。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-02** — 当前用户行无复选框与写菜单；搜索只过滤已加载集合；批量确认词是人数。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03** — 详情属性与 IAM 成员对象一致；DevOps 404 不产生整页错误。

## 明确不做

- 不删除平台用户，不编辑角色权限规则，不管理项目角色绑定。
- 邀请不改成旧页的用户搜索弹窗（继续输入用户名 + 存在性 GET）。
- 详情页签不做成独立 URL `/members/:name/projects`（页内 Tabs，避免多一层路由）。

## 假设

- IAM v1alpha2 服务提供空间成员和角色集合；操作者有相应读取和写入权限。
- 成员可访问项目走 tenant `workspacemembers/<user>/namespaces`；DevOps 走同路径 `/devops`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-02`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03`
