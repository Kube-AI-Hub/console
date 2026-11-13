# 平台角色列表（L3）

[子模块需求](./_index.md)

## 概述

平台角色列表：名称（副行描述）、规则数、创建时间；模板角色带徽标。

## 用户故事

### US1 - 看清平台上有哪些角色 (Priority: P1)

作为 **平台管理员**，我希望 **看到规则数与是否模板**，以便 **区分可分配与内置角色**。

**Independent Test**：打开平台角色页，核对列与某个角色行。

### US2 - 看清一个平台角色到底授权了什么 (Priority: P1)

作为 **平台管理员**，我希望 **在角色详情里看到逐条规则**，以便 **判断这个角色能不能给人**。

**Independent Test**：从列表点进一个非模板角色，核对其规则条数等于对象 `rules` 长度。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-02** — 已知在平台角色页，当点「创建」填写名称、资源与动作并确认，则该角色的 `rules` 写入且 `apiGroups` 为核心组的 `[""]`；当删除，则角色不存在；当查看 `role-template-*` 角色，则其行没有操作菜单。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01** — 已知平台上有角色，当打开平台角色页，则显示名称、规则数、创建时间三列，且 `role-template-*` 行带「模板」徽标。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-03** — 已知平台角色超过一页，当打开列表，则分页控件带稳定标识 `<list>:page:prev` / `<list>:page:next`；点「下一页」则内容变化，点「上一页」则回到与首页一致的顺序。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-04** — 已知平台角色列表中有角色，当点击角色名称进入详情，则显示名称、别名、规则数、创建时间与描述，并逐条列出该角色的授权规则（API 组、资源、动词）；规则条数等于角色对象 `rules` 的长度；`role-template-*` 角色带「模板」徽标并只读。

## 设计目标

与项目角色一致的列与徽标规则。

## 约束与边界

- 读 IAM 组 `clusterroles`。

## UI 交互设计

名称两行；模板角色带徽标。

## 文案与校验

- 列：名称、规则数、创建时间。
- 徽标：模板。

## 边界情况

- 没有角色时空态且不渲染表头。

## 明确不做

- 规则的多条编辑（当前一次一条）。
- 创建、编辑、删除平台角色已迁移。

## 假设

- 规则数为 `rules` 数组长度。

## 验收用例

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01** — 列表展示三列并标出模板角色。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01** — 名称集合与 `kubectl get clusterroles` 一致。
