# 企业空间角色详情（L3）

[子模块需求](./_index.md)

## 概述

企业空间控制台的 **角色详情** 页：`/kube-frontend/workspaces/<ws>/roles/<name>`。它回答「这个角色具体允许什么、现在有多少成员持有它」，是老 console `/workspaces/:ws/roles/:name` 详情页（权限 / 已授权用户两个页签）的只读迁移。

列表页（`…/roles`）说明有哪些角色、规则数多少；详情页展示规则明细与持有该角色的成员数。角色列表的名称是进入本页的入口。

## 用户故事

### US1 - 企业空间管理员核对一个角色的权限与持有人 (Priority: P1)

作为 **企业空间管理员**，我希望 **打开一个角色看到它的规则明细和绑定成员数**，以便 **在授权前确认这个角色到底能做什么、目前谁已经拥有它**。

**Independent Test**：从角色列表点击一个角色名进入详情，核对规则条数与接口 `rules` 数组长度一致、成员数与 `workspacemembers` 中角色注解匹配的条数一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01** — 已知企业空间 `<ws>` 的角色 `<name>` 有 R 条规则（R 可能为 0）且被 M 个成员持有（M 可能为 0），当从角色列表进入该角色详情，则显示角色名、别名/描述（缺失为 `-`）、创建者与创建时间，规则表列出 R 行（API 组 / 资源 / 动作），成员计数为 M 并列出持有者用户名；R 为 0 时显示「该角色没有规则」；角色不存在或读取失败时显示错误面板与重试，而不是空白页。

## 设计目标

1. 规则明细可核对：每行一条规则，三个维度与 Role 对象一致，不再从聚合注解二次推导。
2. 成员数可信：与成员页使用同一数据源（`workspacemembers` 的角色注解），口径一致。
3. 成员数据失败不拖垮整页：角色规则仍可读，成员区显示不可用说明。

## 约束与边界

- 只读。角色的创建/编辑信息/编辑权限/删除不在本页，写入口统一在角色列表页（见「明确不做」）。
- 详情接口是工作空间作用域 IAM：`GET /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles/<name>`（实测 200；不存在返回 404 `workspacerole... not found`）。
- 成员数没有单角色接口：一次读 `workspacemembers?limit=-1`，客户端按注解过滤计数；成员量在本部署为个位数。
- 角色的 `rules` 以详情对象为准；`iam.kubesphere.io/aggregation-roles` 只是聚合来源，不是最终授权结果。

## UI 交互设计

- 顶部：返回「企业空间角色」链接；标题为别名（无别名时角色名），别名存在时下方显示对象名。
- 基本信息卡：名称、别名、创建者、创建时间、描述。
- 成员卡：标题「已授权用户」+ 数字；列出持有者用户名；无成员时说明；读取失败时「成员数据不可用」。
- 规则卡：标题「权限规则」+ 数字；表格列 API 组 / 资源 / 动作；无规则时说明「该角色没有规则」。
- `data-ai-id`：`workspace-role-detail:surface`（状态容器）、`:title`、`:name`、`:alias`、`:creator`、`:description`、`:created-at`、`:member-count`、`:member-list`、`:rule-count`、`:rule-table`、`:empty-rules`、`:retry`。

## 文案与校验

- 标题/返回：`workspace.roles.title`；基本信息 `workspace.detail.basic`；字段名复用 `workspace.detail.{name,alias,creator,createdAt,description}`。
- 成员与规则：`platform.roles.subjects`（已授权用户）、`settings.roles.rules`（权限规则）、`settings.roles.ruleApiGroups` / `ruleResources` / `ruleVerbs`；空态 `settings.roles.noRules`、`platform.roles.noSubjects`；成员不可用 `workspace.detail.membersUnavailable`。
- 创建时间经 `formatTimestamp` 本地化；缺失字段显示 `-`。

## 边界情况

- 角色没有别名/描述：字段显示 `-`，标题回落为对象名。
- 角色没有规则：规则卡显示说明，不渲染空表头。
- 角色没有成员：成员计数为 0，显示「该角色还没有授权给任何账号」。
- 角色存在但成员列表读取 403：整页仍在，成员区显示「成员数据不可用」。
- 角色不存在（URL 手输/已被删除）：错误面板显示「资源不存在」，提供重试。
- 对象名含 URL 特殊字符：路径段用 `encodeURIComponent`。

## 明确不做

- 编辑角色信息、编辑权限规则、删除角色：**不在本页**。该写能力已按 2026-11-17 产品复核决定重纳，入口在角色列表页的行操作（复用项目角色的 `RoleCreateDialog` / `RolePermissionsDialog`）；详情页保持只读，遵循「同一对象只有一处编辑入口」。
- 角色模板/聚合来源展示：`aggregation-roles` 是实现细节，页面只展示最终 `rules`。
- 逐成员解除绑定：在成员页做，详情页只读计数。
- 分页：成员与规则均为一次性读取（个位数量级）。

## 假设

- 工作空间作用域的 `workspaceroles` / `workspacemembers` 均可读（本部署实测 200；public 空间 4 角色、1 成员）。
- 成员与角色的绑定关系以成员对象上的 `iam.kubesphere.io/workspacerole` 注解为唯一来源。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01** — 角色详情展示基本信息、规则明细与绑定成员数。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-02** — 规则/成员为空或成员读取失败时分别给出明确状态，不渲染假数据。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01** — 规则行数 = 接口 `rules` 长度；成员计数 = 注解匹配的成员条数；列表→详情导航可达。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01`
