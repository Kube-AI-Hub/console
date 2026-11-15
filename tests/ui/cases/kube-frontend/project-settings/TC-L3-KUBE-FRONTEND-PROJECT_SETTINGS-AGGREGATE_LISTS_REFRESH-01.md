# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01 聚合型列表刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `aggregate-lists-refresh`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor-resource`
- **需求**: `prd/kube-frontend/project-settings/aggregate-lists-refresh.md`

## 产品功能

集群资源监控、企业空间用户组、企业空间成员详情三处聚合表的刷新覆盖全部来源。

### 关联需求

- `prd/kube-frontend/project-settings/aggregate-lists-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/aggregate-lists-refresh.md`](../../../../prd/kube-frontend/project-settings/aggregate-lists-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01** — 已知集群资源监控页、企业空间用户组页、企业空间成员详情页均已加载，则三处都有「刷新」入口且空闲时可用；当点击刷新，则对应的**全部**来源查询重新发起（资源监控：指标与归属两个查询；用户组：用户组树与成员两个查询；成员详情：页面上的四个查询一起失效并重取）；句柄分别为 `cluster-resource-monitor:refresh`、`workspace-user-groups:refresh`、`workspace-member-<tab>:refresh`。即使还没有任何用户组，用户组页的刷新也保持可用（读者可能在别处刚创建了组）。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/aggregate-lists-refresh.md`](../../../../design/kube-frontend/project-settings/aggregate-lists-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/aggregate-lists-refresh.md`](../../../../prd/kube-frontend/project-settings/aggregate-lists-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 聚合表也能重读 (Priority: P1)

作为 **集群或企业空间管理员**，我希望 **在这些聚合列表上直接刷新**，以便 **在看板上确认刚发生的调度/授权变化，而不必退出页面**。

**Independent Test**：打开集群资源监控页点击「刷新」，pod 指标请求重新发起；打开企业空间用户组页，成员表刷新后行数与接口一致；成员详情页的「项目」表有刷新入口。

## 前置与配置

- 已登录且有集群/企业空间权限

## 测试步骤

1. 打开集群资源监控页，确认刷新入口可用并点击，观察指标请求
2. 打开企业空间用户组页，确认刷新入口存在且可用
3. 打开企业空间成员详情页，确认资源表的刷新入口存在

## 期望结果

- 聚合表的刷新覆盖它显示的所有来源

## 失败排查

- 刷新后半新半旧：只重取了其中一个来源
- 面板型列表两个刷新按钮：重复接入

## 产品改版后如何更新自动化

- 选择器：cluster-resource-monitor:refresh / workspace-user-groups:refresh / workspace-member-<tab>:refresh
