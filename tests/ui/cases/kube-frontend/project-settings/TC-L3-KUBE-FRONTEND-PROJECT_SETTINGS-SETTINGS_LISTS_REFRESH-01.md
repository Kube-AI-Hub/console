# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01 项目设置列表刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `settings-lists-refresh`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/members`
- **需求**: `prd/kube-frontend/project-settings/settings-lists-refresh.md`

## 产品功能

项目成员、项目角色、网络策略三个列表提供刷新入口。

### 关联需求

- `prd/kube-frontend/project-settings/settings-lists-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/settings-lists-refresh.md`](../../../../prd/kube-frontend/project-settings/settings-lists-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01** — 已知项目成员、项目角色、网络策略三个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求并在返回后恢复可用；句柄分别为 `members:refresh`、`roles:refresh`、`networkpolicies:refresh`（成员与角色共用 `SettingsListPage`，句柄随 `kind` 变化）。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/settings-lists-refresh.md`](../../../../design/kube-frontend/project-settings/settings-lists-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/settings-lists-refresh.md`](../../../../prd/kube-frontend/project-settings/settings-lists-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读项目内的授权与策略 (Priority: P1)

作为 **项目管理员**，我希望 **在项目成员、项目角色与网络策略列表上直接刷新**，以便 **在刚邀请成员或刚下发策略后立刻确认结果，而不必退出页面再进来**。

**Independent Test**：打开项目成员列表点击「刷新」，列表重新发起请求；网络策略、项目角色页面同样有刷新入口且空闲时可用。

## 前置与配置

- 已登录且为项目管理员

## 测试步骤

1. 打开项目成员列表，确认刷新入口可用
2. 点击刷新，观察是否重新发起请求
3. 打开项目角色与网络策略页面，确认各自的刷新入口

## 期望结果

- 网络策略页刷新不改变隔离开关

## 失败排查

- 按钮永久禁用：schema 依赖数组缺少 isFetching
- 成员与角色句柄相同：kind 未参与句柄

## 产品改版后如何更新自动化

- 选择器：members:refresh / roles:refresh / networkpolicies:refresh
