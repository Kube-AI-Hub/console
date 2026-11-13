# 角色权限规则（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/role-rules.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-02

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01

## 概述

角色详情的规则表。

## 设计目标与非目标

把规则数组变成可读表。非目标：规则编辑。

## 关键约束

- 详情按需请求单个角色；列表只带计数。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01 — 弹窗而不是详情页

**为什么**：角色详情只有一张小表，进入独立页面会丢失列表上下文（页码、搜索），返回后还要重找。

**被否方案**：`roles/:name` 路由。为一个三列表格增加一条路由不划算。

**何时重新考虑**：角色详情需要展示绑定用户、资源配额等更多区块时。

## 系统现状

老 console 的角色详情是独立页面，含规则表与绑定用户；本模块先做规则表。

## 仓库落点

- `pages/settings/SettingsListPage.tsx`（`RoleRules`）

## 对外契约

读 `GET .../namespaces/<ns>/roles/<name>`。

## 不变量

弹窗行数等于 `rules` 长度。

## 已知坑

- 列表行不含 `rules` 明细（只有计数），必须单独请求；请求期间显示骨架。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`。

## 后续改进

展示绑定该角色的成员。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01`
