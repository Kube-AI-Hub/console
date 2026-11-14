# 访问控制（L2）

[上级模块](../_index.md)

平台级的三张表：用户、平台角色、企业空间。它们不属于任何项目，地址形如 `/kube-frontend/access/<page>`。

## 概述

- **路由**：`/kube-frontend/access/{users,clusterroles,workspaces}`
- **谁用**：平台管理员，确认「谁能登录、拥有什么平台角色、平台上有哪些企业空间」。
- **做哪几步**：打开用户 → 看状态与平台角色；切到平台角色 → 看规则数；切到企业空间 → 看状态与集群关联。
- **看到什么**：三张列表，各自四列；用户页含创建与行操作。

## 用户故事

### US1 - 在平台视角下切换三张表 (Priority: P1)

作为 **平台管理员**，我希望 **在三个页签之间切换**，以便 **不必反复从顶部切换模块**。

**Independent Test**：从用户切到企业空间再切回，核对页签高亮变化且无整页刷新。

### US2 - 明确知道这些页面与项目无关 (Priority: P2)

作为 **平台管理员**，我希望 **页面不出现项目切换器**，以便 **不会误以为筛选会生效**。

**Independent Test**：打开任一平台页，核对没有项目工作区栏。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01** — 已知已登录且有平台权限，当在三个页签之间切换，则每次都显示对应列表（或空态），页签高亮跟随，切换不产生文档请求，且页面不出现项目工作区栏。

## 设计目标

1. 三张表共用一套列表组件，差异由描述符表达。
2. 平台作用域有独立布局，不复用项目或集群布局。

## 约束与边界

- 用户与平台角色读 `iam.kubesphere.io/v1alpha2`；企业空间读 resources 代理。
- 用户与平台角色的写操作已迁移：创建用户、改平台角色、停用/启用/删除、编辑邮箱与描述、批量停用启用、从模板创建项目角色不属本模块。
- 企业空间的创建、编辑与成员管理不在本模块（成员接口在本集群返回 404，见企业空间详情）。

## UI 交互设计

区域页签（用户、平台角色、企业空间）在最上方；无项目切换器；列按窄屏依次折叠。

## 页面结构

| 页签 | 路由 |
|---|---|
| 用户 | `/kube-frontend/access/users` |
| 平台角色 | `/kube-frontend/access/clusterroles` |
| 企业空间 | `/kube-frontend/access/workspaces` |
| 企业空间角色详情 | [workspace-role-detail.md](./workspace-role-detail.md) |

## 文案与校验

- 用户列：用户名、状态、平台角色、最近登录。
- 平台角色列：名称、规则数、创建时间；模板角色带「模板」徽标。
- 企业空间列：名称、状态、集群、创建时间。

## 异常态

- 加载中：骨架；空：空态且不渲染表头；失败：错误面板 + 重试。
- 用户量大（数千）时首屏较慢，必须给加载态。

## 功能点

| 功能点 | 需求 |
|---|---|
| 用户 | [users.md](./users.md) |
| 用户详情 | [user-detail.md](./user-detail.md) |
| 平台角色 | [platform-roles.md](./platform-roles.md) |
| 企业空间 | [workspaces.md](./workspaces.md) |

## 明确不做

- 企业空间的创建与编辑：见企业空间列表/详情的明确不做。
- 角色规则的多条编辑（当前一次一条）。
- 头像、语言偏好等个人资料设置。

## 假设

- 用户与平台角色由 IAM 聚合 API 服务；企业空间由 resources 代理服务。

## 验收用例
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01`

- `TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01`

## 功能需求

- **FR-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01** — 三张表共用列表组件。
- **FR-FULL-KUBE-FRONTEND-ACCESS_CONTROL-02** — 平台级页面不渲染项目工作区栏。

## 成功标准

- **SC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01** — 企业空间名称集合与 `kubectl get workspaces` 一致。
