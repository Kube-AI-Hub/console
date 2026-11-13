# 项目设置（L2）

[子模块需求](../../../prd/kube-frontend/project-settings/_index.md)

## 关联需求

- AC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01

## 概述

项目角色与项目成员两张表，共用同一套列表组件。

## 设计目标与非目标

目标：IAM 数据走正确的 kapis 组，模板角色可区分。非目标：角色编辑、成员邀请。

## 关键约束

- kapis 前缀 `/kapis/iam.kubesphere.io/v1alpha2`。
- 本模块只读。

## 方案决策

### DEC-L2-KUBE-FRONTEND-PROJECT_SETTINGS-01 — 角色与成员共用一个列表组件

**为什么**：两者都是「名称 + 几列」的只读列表，差异只有列集合与一个详情动作。

**被否方案**：两套页面。会让空态、分页、搜索各写两遍。

**何时重新考虑**：成员需要批量操作（改角色、移出）时——那是写操作，需要独立的交互设计。

### DEC-L2-KUBE-FRONTEND-PROJECT_SETTINGS-02 — 模板角色显示徽标而不是过滤掉

**为什么**：`role-template-*` 是平台内置角色的构建块，但管理员在排查「某人为啥能改 X」时需要看到它们。徽标既保留信息又标明不可分配。

**被否方案**：直接从列表过滤掉。会让规则与角色的对应关系出现无法解释的空洞。

**何时重新考虑**：角色数量增长到模板占绝大多数时，改为默认折叠。

## 系统现状

老 console `pages/projects/containers/{Roles,Members}`；角色列表列（名称/描述/创建时间）与本模块一致，本模块把「描述」折进副行并新增规则数。

## 仓库落点

- `apps/console-next/src/pages/settings/`
- `src/routes/.../{roles,members}/`
- `packages/api-client/src/iam.ts`

## 对外契约

读 `iam.kubesphere.io/v1alpha2`；只读。

## 不变量

1. 角色与成员都只经 IAM 组读取。
2. 空响应体等价于空列表。

## 已知坑

- 成员的「角色」是注解，不是字段；读错位置会显示空。
- 「最近活动」实际是最近改密时间，界面文案要与事实一致。

## 测试与可观测

E2E：`tests/kube-frontend/project-settings/`。

## 后续改进

角色编辑、成员邀请与改角色、其余项目设置页面。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01`

## 页面与技术结构

- 区域 `settings`（两页），路由每页一个文件夹。
- 组件 `SettingsListPage`，描述符在 `pages/settings/queries.ts`。

## 状态与数据归属

- 页面只持有 UI 态；数据在 Query 缓存，key 含 kind。

## 关键契约与依赖

- `rolesApi` / `membersApi`（`kapisPrefix: KAPIS_IAM`）。

## 明确不做

- 角色写操作、成员写操作、其余设置页。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 项目角色 | `prd/…/roles.md` | `design/…/roles.md` |
| 角色权限规则 | `prd/…/role-rules.md` | `design/…/role-rules.md` |
| 项目成员 | `prd/…/members.md` | `design/…/members.md` |
