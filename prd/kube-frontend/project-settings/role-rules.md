# 角色权限规则（L3）

[子模块需求](./_index.md)

## 概述

角色行操作「详情」打开弹窗，列出该角色的权限规则：API 组、资源、动作。

## 用户故事

### US1 - 确认一个角色到底能做什么 (Priority: P1)

作为 **项目管理员**，我希望 **看到角色的规则明细**，以便 **回答「他能改什么」**。

**Independent Test**：对任一角色点「详情」，核对规则行与 `kubectl get role <name> -o yaml` 的 `rules` 一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01** — 已知角色列表有数据，当对某角色点「详情」，则弹窗显示该角色的规则表，行数等于其 `rules` 数量。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-02** — 已知一个带一条规则的项目角色，当行操作「编辑权限」则对话框先出现并载入现有规则；改为两行规则并确认，则 `rules` 被整体替换为两条，且核心组的 `apiGroups` 写成 `[""]`。

## 设计目标

把「谁能做什么」从注解与规则数组变成可读表。

## 约束与边界

- 详情按需请求单个角色（列表只有计数）。
- 规则为空时显示「该角色没有规则」。

## UI 交互设计

弹窗内一张三列表：API 组、资源、动作；值用等宽字体。

## 文案与校验

- 表头：API 组、资源、动作。
- 空：该角色没有规则。

## 边界情况

- 规则里 `resources` 或 `verbs` 为 `*` 时原样显示。

## 明确不做

- 规则的编辑。

## 假设

- 规则字段名为 `apiGroups` / `resources` / `verbs`。

## 验收用例

- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01`
- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01** — 详情列出规则的三个字段。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-02** — 编辑权限整体替换规则表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01** — 弹窗行数与 API 返回一致。
