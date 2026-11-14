# 企业空间角色（L3）

[子模块需求](./_index.md)

## 概述

企业空间控制台的 **角色** 页：`/kube-frontend/workspaces/<ws>/roles`。它列出这个企业空间内的 WorkspaceRole 及其规则数量，回答「这个空间里有哪些角色可以分配、每个角色授予多少条规则」。

数据来自 IAM 聚合的**工作空间作用域**集合 `/apis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles`；这不是平台级 `workspaceroles`（后者跨全部企业空间，需要客户端再按 label 过滤）。

## 用户故事

### US1 - 企业空间管理员核对可分配角色 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到该空间全部角色、规则数与创建时间**，以便 **在给成员分配角色前确认每个角色授予的权限规模**。

**Independent Test**：打开 `/workspaces/<ws>/roles`，核对行数与接口返回的 `totalItems` 一致；某个已知角色行的「规则数」等于该对象 `rules` 数组长度。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03** — 已知企业空间内有 R 个 WorkspaceRole（R 可能为 0），当打开该空间角色页，则列出 R 行，每行显示名称（有别名时显示别名并附对象名）、规则数（`rules` 长度，可为 0）、创建时间；R 为 0 时显示空态；接口失败时显示错误面板与重试。

## 设计目标

1. 一个空间一个列表：不把其他企业空间的角色混进来。
2. 规则数量是读者判断「这个角色有多大」的第一个信号，直接作为列，不要求点进详情。
3. 名称同时给出别名与对象名：别名是给人看的，对象名是成员绑定里真正引用的字符串。

## 约束与边界

- 只读：角色的创建、编辑信息、编辑权限、删除都需要写 IAM / 原生 RBAC 的接口，不在本页（见「明确不做」）。
- 一次取全（`limit=-1`），前端分页，页大小 20。
- 规则数按对象 `rules` 数组元素数计；`rules` 缺失按 0。

## UI 交互设计

- 页面头：标题「企业空间角色」、描述「该企业空间内的角色与规则。」
- 表：名称 / 规则数 / 创建时间；规则数右对齐等宽数字。
- 超过 20 行时出现分页器。
- `data-ai-id`：`workspace-roles:surface`（列表容器）、`workspace-roles:retry`（错误重试）。

## 文案与校验

- 列名：名称 → `workspace.field.name`；规则数 → `platform.column.ruleCount`；创建时间 → `workspace.field.createdAt`。
- 空态：标题「暂无数据」（`common.empty`），描述「创建角色后，这里会列出它们。」（`settings.roles.emptyDescription`；该键的描述文案与作用域无关，可复用）。
- 创建时间用控制台统一的 `formatTimestamp`；缺失显示 `-`。

## 边界情况

- 角色没有 `rules`（聚合产生的空角色）：规则数显示 0，不隐藏该行——隐藏会让人以为角色不存在。
- 别名与对象名相同/别名缺失：只显示一行名称，对象名不重复显示。
- 角色很多：一次取全后客户端分页；本部署实测 system-workspace 4 个、其他空间为 0。

## 明确不做

- 角色的创建与编辑（信息/权限/删除）：写路径是 IAM 聚合与原生 RBAC 两条，均需单独设计表单与校验；本页不提供按钮，避免出现「点了没反应」的假入口。
- 角色详情页（老 console 的 `/workspaces/:ws/roles/:name`）：规则明细表需要规则级编辑设计，另立。
- 平台角色：属于访问控制 › 平台角色，不在企业空间作用域。
- 模板角色标记：WorkspaceRole 的 `role-template-*` 主要由聚合注解引用，本部署没有独立模板角色行，故不加徽标。

## 假设

- 工作空间作用域的 `workspaceroles` 集合可用且只返回该空间对象（实测 `GET /kapis/iam.kubesphere.io/v1alpha2/workspaces/system-workspace/workspaceroles?limit=-1` → 200，`totalItems: 4`，其中 `system-workspace-admin` 有 1 条规则、`system-workspace-self-provisioner` 有 5 条）。
- 角色总量在 500 以内。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 角色页按工作空间作用域列出角色、规则数与创建时间。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05** — 空态与错误态可区分。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03** — 行数与作用域接口一致；规则数与对象 `rules` 长度一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03`
