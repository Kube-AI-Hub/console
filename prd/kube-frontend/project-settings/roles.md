# 项目角色列表（L3）

[子模块需求](./_index.md)

## 概述

项目角色的列表：名称（副行描述）、规则数、创建时间；模板角色带「模板」徽标。

## 用户故事

### US1 - 看清项目里有哪些角色、各有多少规则 (Priority: P1)

作为 **项目管理员**，我希望 **在列表上看到规则数与是否模板**，以便 **判断哪些是可分配的角色**。

**Independent Test**：打开角色列表，核对列与模板徽标。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02** — 已知角色列表中有一个非模板角色，当「编辑信息」并填写别名，则该角色的 `kubesphere.io/alias-name` 注解被更新；当「删除」并确认，则该角色从列表消失且 API 返回 404。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-03** — 已知列表中有 `role-template-*` 角色，当打开其行操作，则只提供「详情」，不提供编辑与删除（平台拒绝写模板角色）。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01** — 已知项目内至少有一个角色，当打开角色列表，则显示名称、规则数、创建时间三列，且 `role-template-*` 的行带「模板」徽标。

## 设计目标

落实「模板角色可区分」这条不变量。

## 约束与边界

- 读 IAM 组；只读。
- 规则数取 `rules` 数组长度。

## UI 交互设计

名称两行：名称（别名优先）与描述；模板角色在名称旁加徽标。

## 文案与校验

- 列：名称、规则数、创建时间。
- 徽标：模板。

## 边界情况

- 项目没有任何角色时显示空态。

## 明确不做

- 角色的**创建**（需要规则编辑器）。
- 对模板角色的任何写操作：平台会拒绝，界面只给「详情」。

## 假设

- IAM 接口返回 `rules` 数组。

## 验收用例

- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01** — 列表展示名称、规则数、创建时间，并标出模板角色。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01** — 名称集合与 `kubectl get roles -n <ns>` 一致。
