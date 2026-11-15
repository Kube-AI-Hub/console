# TC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-01 监控告警页族的列表刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `list-refresh`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alerts`
- **需求**: `prd/kube-frontend/monitoring/list-refresh.md`

## 产品功能

项目与集群的告警消息、告警策略、自定义监控页面都提供刷新入口，刷新会重新发起查询。

### 关联需求

- `prd/kube-frontend/monitoring/list-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/list-refresh.md`](../../../../prd/kube-frontend/monitoring/list-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-01** — 已知项目告警消息、项目告警策略、项目自定义监控、集群告警消息、集群告警策略五个页面均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求（请求计数增加），刷新期间按钮处于忙碌状态并在返回后恢复；集群告警策略页的两个页签共用同一个刷新按钮，会同时重读自定义与内置策略；项目自定义监控页在没有任何仪表板时，空态块自身提供「刷新」出口（句柄 `project-custom-monitoring:empty:refresh`）。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/list-refresh.md`](../../../../design/kube-frontend/monitoring/list-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/list-refresh.md`](../../../../prd/kube-frontend/monitoring/list-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读告警状态 (Priority: P1)

作为 **项目或集群运维**，我希望 **在告警消息与告警策略列表上直接刷新**，以便 **在处置完问题后确认告警是否已恢复，而不必退出页面再进来**。

**Independent Test**：打开项目告警消息列表，点击「刷新」，列表重新发起请求；打开集群告警策略页，两个页签共用同一个刷新按钮并同时重读自定义与内置策略。

## 前置与配置

- 已登录且可读监控告警数据

## 测试步骤

1. 依次打开项目告警消息、项目告警策略、集群告警消息、集群告警策略页面，确认各自的刷新入口可用
2. 点击项目告警消息的刷新，观察请求计数
3. 打开项目自定义监控页，确认空态块自带刷新句柄

## 期望结果

- 刷新期间按钮忙碌；返回后恢复

## 失败排查

- 按钮永久禁用：schema 依赖数组缺少 isFetching
- 空态没有刷新：自定义监控的空态块未自带按钮

## 产品改版后如何更新自动化

- 选择器：alerts:refresh / alertingrules:refresh / cluster-alerting-messages:refresh / cluster-alerting-policies:refresh / project-custom-monitoring:empty:refresh
