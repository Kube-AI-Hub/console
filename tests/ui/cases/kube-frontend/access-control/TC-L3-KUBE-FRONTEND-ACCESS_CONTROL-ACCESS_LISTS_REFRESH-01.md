# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01 访问控制列表刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `access-lists-refresh`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/access-lists-refresh.md`

## 产品功能

平台用户、集群成员、集群、联邦项目四个列表提供刷新入口。

### 关联需求

- `prd/kube-frontend/access-control/access-lists-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/access-lists-refresh.md`](../../../../prd/kube-frontend/access-control/access-lists-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01** — 已知平台用户、集群成员、集群、联邦项目四个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求，刷新期间按钮处于忙碌状态并在返回后恢复；句柄分别为 `users:refresh`、`cluster-members:refresh`、`clusters:refresh`、`federated-projects:refresh`。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/access-lists-refresh.md`](../../../../design/kube-frontend/access-control/access-lists-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/access-lists-refresh.md`](../../../../prd/kube-frontend/access-control/access-lists-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读权限相关集合 (Priority: P1)

作为 **平台管理员或集群管理员**，我希望 **在用户、集群成员、集群、联邦项目列表上直接刷新**，以便 **在刚邀请一个用户或刚纳管一个集群后立刻确认结果，而不必退出页面再进来**。

**Independent Test**：打开平台用户列表点击「刷新」，列表重新发起请求；四个页面的刷新入口都存在且空闲时可用。

## 前置与配置

- 已登录且为平台管理员

## 测试步骤

1. 打开平台用户列表，确认刷新入口可用并点击，观察请求
2. 打开集群成员、集群、联邦项目列表，确认各自刷新入口

## 期望结果

- 刷新期间按钮忙碌；返回后恢复

## 失败排查

- 按钮不存在：路由写错（平台作用域是 /access/*，联邦是 /federatedprojects）
- 集群列表两个刷新按钮：重复接入

## 产品改版后如何更新自动化

- 选择器：users:refresh / cluster-members:refresh / clusters:refresh / federated-projects:refresh
