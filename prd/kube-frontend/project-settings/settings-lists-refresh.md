# 项目设置列表刷新（L3）

[子模块需求](./_index.md)

## 概述

项目设置里有两类列表：网络隔离页的网络策略列表，以及项目成员与项目角色的同构列表（`SettingsListPage`）。它们随授权与策略下发而变，读者需要明确的重读入口；老 console 的这两个列表都有刷新。

## 用户故事

### US1 - 主动重读项目内的授权与策略 (Priority: P1)

作为 **项目管理员**，我希望 **在项目成员、项目角色与网络策略列表上直接刷新**，以便 **在刚邀请成员或刚下发策略后立刻确认结果，而不必退出页面再进来**。

**Independent Test**：打开项目成员列表点击「刷新」，列表重新发起请求；网络策略、项目角色页面同样有刷新入口且空闲时可用。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01** — 已知项目成员、项目角色、网络策略三个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求并在返回后恢复可用；句柄分别为 `members:refresh`、`roles:refresh`、`networkpolicies:refresh`（成员与角色共用 `SettingsListPage`，句柄随 `kind` 变化）。

## 设计目标

1. 共用 `useListRefresh`，句柄与文案一致。
2. 网络策略页的刷新只重读策略列表，不改变隔离开关状态。

## 约束与边界

- `SettingsListPage` 按 `kind` 切换成员/角色，刷新句柄随 `kind` 变化。
- 网络隔离页的开关与列表是两个查询，刷新只针对列表。

## UI 交互设计

- 工具栏右侧「刷新」按钮；忙碌时禁用，返回后恢复。
- 空态给出「刷新」按钮。

## 文案与校验

- 文案取 `common.refresh`；无表单，不做输入校验。

## 边界情况

- 项目没有网络策略时列表为空态，刷新仍可点（策略可能刚被下发）。
- 成员列表刷新不会重置项目筛选（筛选在列表状态里）。

## 假设

- 三个列表的查询互不依赖。

## 明确不做

- 定时轮询与 watch 推送（R-27）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01** — 项目成员、项目角色、网络策略三个列表的刷新与空态出口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01** — 点击刷新后列表重新请求并反映最新状态。

## 验收用例

- TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01
