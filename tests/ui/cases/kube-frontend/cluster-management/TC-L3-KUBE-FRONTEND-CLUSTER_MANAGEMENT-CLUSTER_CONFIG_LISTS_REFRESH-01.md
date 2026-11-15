# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01 集群配置与资源列表刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-config-lists-refresh`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/components`
- **需求**: `prd/kube-frontend/cluster-management/cluster-config-lists-refresh.md`

## 产品功能

集群的服务账号、网络策略、组件与 IP 池四个列表提供刷新入口，刷新保留筛选与排序。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-config-lists-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config-lists-refresh.md`](../../../../prd/kube-frontend/cluster-management/cluster-config-lists-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01** — 已知集群的服务账号、网络策略、组件、IP 池四个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求，刷新期间按钮处于忙碌状态并在返回后恢复；句柄分别为 `cluster-serviceaccounts:refresh`、`cluster-networkpolicies:refresh`、`components:refresh`、`ip-pools:refresh`。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-config-lists-refresh.md`](../../../../design/kube-frontend/cluster-management/cluster-config-lists-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config-lists-refresh.md`](../../../../prd/kube-frontend/cluster-management/cluster-config-lists-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读集群配置与组件状态 (Priority: P1)

作为 **集群管理员**，我希望 **在服务账号、网络策略、组件、IP 池四个列表上直接刷新**，以便 **在安装组件或调整网络后立刻确认结果，而不必退出页面再进来**。

**Independent Test**：打开组件列表点击「刷新」，列表重新发起请求；四个页面的刷新入口都存在且空闲时可用。

## 前置与配置

- 已登录且有集群管理员权限

## 测试步骤

1. 依次打开服务账号、网络策略、组件、IP 池页面，确认各自的刷新入口存在且可用
2. 在组件页选择一种类型后点击刷新，观察请求是否重新发起

## 期望结果

- 刷新期间按钮忙碌；返回后恢复

## 失败排查

- 按钮永久禁用：schema 依赖数组缺少 isFetching
- 刷新后筛选被清空：刷新走了列表状态重置

## 产品改版后如何更新自动化

- 选择器：cluster-serviceaccounts:refresh / cluster-networkpolicies:refresh / components:refresh / ip-pools:refresh
