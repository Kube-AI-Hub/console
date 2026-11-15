# 访问控制列表刷新（L3）

[子模块需求](./_index.md)

## 概述

平台用户、集群成员、集群列表与联邦项目列表回答的是「谁在平台里、谁在这套集群里、有哪些集群、哪些项目被联邦」——这些集合随邀请、纳管与授权而变。读者需要一个明确的重读入口；老 console 的每个列表都有刷新。

## 用户故事

### US1 - 主动重读权限相关集合 (Priority: P1)

作为 **平台管理员或集群管理员**，我希望 **在用户、集群成员、集群、联邦项目列表上直接刷新**，以便 **在刚邀请一个用户或刚纳管一个集群后立刻确认结果，而不必退出页面再进来**。

**Independent Test**：打开平台用户列表点击「刷新」，列表重新发起请求；四个页面的刷新入口都存在且空闲时可用。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01** — 已知平台用户、集群成员、集群、联邦项目四个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求，刷新期间按钮处于忙碌状态并在返回后恢复；句柄分别为 `users:refresh`、`cluster-members:refresh`、`clusters:refresh`、`federated-projects:refresh`。

## 设计目标

1. 四个页面共用 `useListRefresh`，句柄与文案一致。
2. 刷新是读者主动触发的重读。

## 约束与边界

- 平台用户与联邦项目页面按 `kind` / `workspace` 取数，刷新只重发当前查询。
- 集群列表本就有内联刷新（节点/集群的同构列表），本批只补齐其余三页并统一到同一 hook 语义。

## UI 交互设计

- 工具栏右侧「刷新」按钮；忙碌时禁用，返回后恢复。
- 空态给出「刷新」按钮。

## 文案与校验

- 文案取 `common.refresh`；无表单，不做输入校验。

## 边界情况

- 平台角色或联邦组件未安装：页面显示空态说明，刷新仍可点。
- 慢请求：按钮保持忙碌且禁用，避免重复触发。

## 假设

- 四个页面的查询互不依赖。

## 明确不做

- 定时轮询与 watch 推送（R-27）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01** — 访问控制四个列表的刷新与空态出口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01** — 点击刷新后列表重新请求并反映最新状态。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01
