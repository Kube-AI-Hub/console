# 企业空间角色（L3）

[子模块需求](./_index.md)

## 概述

企业空间控制台的 **角色** 页：`/kube-frontend/workspaces/<ws>/roles`。它列出这个企业空间内的 WorkspaceRole 及其规则数量，回答「这个空间里有哪些角色可以分配、每个角色授予多少条规则」。

数据来自 IAM 聚合的**工作空间作用域**集合 `/apis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles`；这不是平台级 `workspaceroles`（后者跨全部企业空间，需要客户端再按 label 过滤）。

## 用户故事

### US1 - 企业空间管理员核对可分配角色 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到该空间全部角色、规则数与创建时间**，以便 **在给成员分配角色前确认每个角色授予的权限规模**。

**Independent Test**：打开 `/workspaces/<ws>/roles`，核对行数与接口返回的 `totalItems` 一致；某个已知角色行的「规则数」等于该对象 `rules` 数组长度。

### US2 - 维护自定义企业空间角色 (Priority: P2)

作为 **企业空间管理员**，我希望 **从平台权限模板组合出本空间的自定义角色，并能改别名/描述、调整模板集合、删除不再需要的角色**，以便 **按团队职责授权，而不用去平台权限里拼角色**。

**Independent Test**：创建一次性角色（勾选两个模板）→ 接口中角色存在且规则已由平台聚合；改别名后回读一致；编辑权限替换模板集合后规则数与内容变化；平台模板/预置角色行没有写入口；删除需输入角色名，确认后接口 404。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03** — 已知企业空间内有 R 个 WorkspaceRole（R 可能为 0），当打开该空间角色页，则列出 R 行，每行显示名称（有别名时显示别名并附对象名）、规则数（`rules` 长度，可为 0）、创建时间；R 为 0 时显示空态；接口失败时显示错误面板与重试。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11** — Given 打开企业空间角色页，When 点「创建角色」填合法名称、别名并勾选至少一个权限模板后提交，Then 发出 POST /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles，body 含 rules: [] 与 aggregation-roles 注解（模板名 JSON 数组）；成功后列表出现该角色且规则数由服务端聚合为非空。名称为空/非法或未选模板时提交被拦下并显示提示。When 行操作编辑信息（merge-patch 只发 annotations，清空键 null）或编辑权限（只替换 aggregation-roles），Then 回读注解/规则一致。平台维护（creator=system）与 role-template-* 角色不显示写入口；删除需输入角色名确认，成功后对象从接口与列表消失。

## 设计目标

1. 一个空间一个列表：不把其他企业空间的角色混进来。
2. 规则数量是读者判断「这个角色有多大」的第一个信号，直接作为列，不要求点进详情。
3. 名称同时给出别名与对象名：别名是给人看的，对象名是成员绑定里真正引用的字符串。

## 约束与边界

- 写能力（创建 / 编辑信息 / 编辑权限 / 删除）按 **2026-11-17 产品复核决定重纳**，入口在本页的行操作与主操作；写路径是 IAM 聚合，表单复用项目角色的编辑器（`RoleCreateDialog` / `RolePermissionsDialog`）。模板角色只读。
- 一次取全（`limit=-1`），前端分页，页大小 20。
- 规则数按对象 `rules` 数组元素数计；`rules` 缺失按 0。

## UI 交互设计

- 页面头：标题「企业空间角色」、描述「该企业空间内的角色与规则。」；右上「创建角色」。
- 表：名称 / 规则数 / 创建时间；规则数右对齐等宽数字。
- 行操作：编辑信息 / 编辑权限 / 删除（平台维护与 role-template-* 角色不显示）。
- 创建/编辑权限对话框：名称（创建必填、编辑锁定）、别名、描述、权限模板复选框（19 个模板）；提交后回读集合。
- 删除确认输入角色对象名。
- 超过 20 行时出现分页器。
- `data-ai-id`：`workspace-roles:surface`（列表容器）、`workspace-roles:retry`（错误重试）。

## 文案与校验

- 列名：名称 → `workspace.field.name`；规则数 → `platform.column.ruleCount`；创建时间 → `workspace.field.createdAt`。
- 空态：标题「暂无数据」（`common.empty`），描述「创建角色后，这里会列出它们。」（`settings.roles.emptyDescription`；该键的描述文案与作用域无关，可复用）。
- 创建时间用控制台统一的 `formatTimestamp`；缺失显示 `-`。

## 边界情况

- 角色没有 `rules`（聚合产生的空角色）：规则数显示 0，不隐藏该行——隐藏会让人以为角色不存在。
- 平台维护角色（creator=system）与 role-template-* 模板角色只读：写入口隐藏而不是点了失败。
- 创建后规则由服务端按模板聚合，客户端不手写 rules；编辑权限只改 aggregation-roles 注解。
- 写失败：弹窗保留输入与服务端原因；成功后重读集合，不做本地乐观成功。
- 别名与对象名相同/别名缺失：只显示一行名称，对象名不重复显示。
- 角色很多：一次取全后客户端分页；本部署实测 system-workspace 4 个、其他空间为 0。

## 明确不做

- 角色详情页（老 console 的 `/workspaces/:ws/roles/:name`）：规则明细表需要规则级编辑设计，另立。
- 平台角色：属于访问控制 › 平台角色，不在企业空间作用域。
- 模板角色标记：WorkspaceRole 的 `role-template-*` 主要由聚合注解引用，本部署没有独立模板角色行，故不加徽标。

## 假设

- 工作空间作用域的 `workspaceroles` 集合可用且只返回该空间对象（实测 `GET /kapis/iam.kubesphere.io/v1alpha2/workspaces/system-workspace/workspaceroles?limit=-1` → 200，`totalItems: 4`，其中 `system-workspace-admin` 有 1 条规则、`system-workspace-self-provisioner` 有 5 条）。
- 角色总量在 500 以内。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 角色页按工作空间作用域列出角色、规则数与创建时间。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05** — 空态与错误态可区分。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06** — 角色页提供创建（模板组合）、编辑信息、编辑权限与删除；平台/模板角色只读。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03** — 行数与作用域接口一致；规则数与对象 `rules` 长度一致。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 创建/编辑/删除后回读一致；平台与模板角色无写入口；删除确认词匹配后才提交。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11`
