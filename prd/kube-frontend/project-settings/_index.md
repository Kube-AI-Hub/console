# 项目设置（L2）

[上级模块](../_index.md)

项目空间的可访问性与权限。老 console 的「项目设置」分组里还有基本信息、网络隔离、网关与日志收集；本模块先迁移**角色**与**成员**，其余页面按同一套结构陆续加入。

## 概述

- **路由**：`/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/{roles,members}`
- **谁用**：项目管理员，确认「谁在这个项目里」「他能做什么」。
- **做哪几步**：打开角色列表 → 看某个角色有哪些规则；切到成员 → 看每个人的角色与是否活跃。
- **看到什么**：角色两行（名称 + 描述，模板角色带徽标）、规则数、创建时间；成员一行（用户名）、状态、角色、最近活动。

## 用户故事

### US1 - 在角色与成员之间切换 (Priority: P1)

作为 **项目管理员**，我希望 **在同一个功能区的两个页签之间切换**，以便 **对照某人的角色和它能做什么**。

**Independent Test**：从角色切到成员再切回，核对页签高亮与工作区栏项目不变，且没有整页刷新。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01** — 已知已登录且有项目权限，当在两个页签之间切换，则每次都显示对应列表（或空态），页签高亮跟随，切换不产生文档请求。

## 设计目标

1. 角色与成员都从 IAM 聚合 API 读取，不经过通用资源代理。
2. 模板角色（`role-template-*`）以徽标区分，不当成可分配角色。

## 约束与边界

- 读 `/kapis/iam.kubesphere.io/v1alpha2/...`；本模块只读，不提供创建/邀请/改角色。
- 成员的「角色」来自 `iam.kubesphere.io/role` 注解，「最近活动」来自 `iam.kubesphere.io/last-password-change-time`（该 API 没有登录时间字段）。

## UI 交互设计

工作区栏 + 区域页签（角色、成员）；角色行操作「详情」（弹窗列出规则）；成员无行操作。

## 页面结构

| 页签 | 路由 |
|---|---|
| 项目角色 | `…/roles` |
| 项目成员 | `…/members` |

## 文案与校验

- 角色列：名称、规则数、创建时间；模板角色徽标「模板」。
- 成员列：名称、状态、角色、最近活动；状态「活跃 / 未激活」。

## 异常态

- 加载中：骨架；空：空态且不渲染表头；失败：错误面板 + 重试；401/403：提示无权限。
- IAM 接口返回 200 空体时按空列表处理（与告警相同的兜底）。

## 明确不做

- 成员邀请与改角色（需要用户选择器）。
- 网关设置：本集群没有 Gateway 实例（`gateways` 资源存在但 0 条）。
- 日志收集：`logging.kubesphere.io` 只提供集群级 FluentBit 配置，没有项目级资源。
- 项目概览（用量与配额趋势需要指标接口）。

## 功能点

| 功能点 | 需求 |
|---|---|
| 项目角色 | [roles.md](./roles.md) |
| 角色权限规则 | [role-rules.md](./role-rules.md) |
| 项目成员 | [members.md](./members.md) |

## 假设

- IAM 接口在成员较多时仍按 `page`/`limit` 分页。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01`

## 功能需求

- **FR-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01** — 两个页面共用一套列表组件，差异由描述符表达。
- **FR-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-02** — 模板角色在列表中以徽标标出。

## 成功标准

- **SC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01** — 角色列表与 `kubectl get roles -n <ns>` 的名称集合一致。
