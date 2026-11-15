# 集群配置与资源列表刷新（L3）

[子模块需求](./_index.md)

## 概述

集群侧栏「配置」与「资源」里的四个列表——服务账号、网络策略、组件、IP 池——是平台自检入口：组件是否健康、IP 段是否还有余量、某个跨项目策略是谁写的。这些状态随安装与变更而变，读者需要明确的重读入口；老 console 的每个列表都有刷新。

## 用户故事

### US1 - 主动重读集群配置与组件状态 (Priority: P1)

作为 **集群管理员**，我希望 **在服务账号、网络策略、组件、IP 池四个列表上直接刷新**，以便 **在安装组件或调整网络后立刻确认结果，而不必退出页面再进来**。

**Independent Test**：打开组件列表点击「刷新」，列表重新发起请求；四个页面的刷新入口都存在且空闲时可用。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01** — 已知集群的服务账号、网络策略、组件、IP 池四个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求，刷新期间按钮处于忙碌状态并在返回后恢复；句柄分别为 `cluster-serviceaccounts:refresh`、`cluster-networkpolicies:refresh`、`components:refresh`、`ip-pools:refresh`。

## 设计目标

1. 四个页面共用 `useListRefresh`，句柄与文案一致。
2. 刷新是读者主动触发的重读。

## 约束与边界

- 每个页面只刷新自己的查询；跨项目的读取不含项目段。
- 组件列表带类型筛选，刷新保留当前筛选与排序。

## UI 交互设计

- 工具栏右侧「刷新」按钮；忙碌时禁用，返回后恢复。
- 空态给出「刷新」按钮。

## 文案与校验

- 文案取 `common.refresh`；无表单，不做输入校验。

## 边界情况

- 集群未启用网络组（无 ippools / networkpolicies）：页面显示错误或空态说明，刷新仍可点。
- 组件接口慢：按钮保持忙碌且禁用，避免重复触发。

## 假设

- 四个页面的查询互不依赖。

## 明确不做

- 定时轮询与 watch 推送（R-27）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01** — 集群配置与资源四个列表的刷新与空态出口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01** — 点击刷新后列表重新请求并反映最新状态。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01
