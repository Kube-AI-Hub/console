# TC-L3-KUBE-FRONTEND-APP_STORE-APPSTORE_LISTS_REFRESH-01 应用商店列表刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-APPSTORE_LISTS_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `appstore-lists-refresh`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/apps`
- **需求**: `prd/kube-frontend/app-store/appstore-lists-refresh.md`

## 产品功能

企业空间的应用与仓库列表提供刷新入口；商店管理页保留其页面级刷新且不出现第二个按钮。

### 关联需求

- `prd/kube-frontend/app-store/appstore-lists-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/appstore-lists-refresh.md`](../../../../prd/kube-frontend/app-store/appstore-lists-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-APPSTORE_LISTS_REFRESH-01** — 已知企业空间的应用列表与仓库列表均已加载，则两页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求，刷新期间按钮处于忙碌状态并在返回后恢复；句柄分别为 `workspace-apps:refresh`、`workspace-repos:refresh`；商店管理页保留其原有的页面级刷新（句柄 `store-manage:<view>:refresh`），不新增第二个按钮。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/appstore-lists-refresh.md`](../../../../design/kube-frontend/app-store/appstore-lists-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/appstore-lists-refresh.md`](../../../../prd/kube-frontend/app-store/appstore-lists-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读可用应用与仓库 (Priority: P1)

作为 **企业空间成员**，我希望 **在应用列表与仓库列表上直接刷新**，以便 **在刚安装应用或刚添加仓库后立刻看到结果，而不必退出页面再进来**。

**Independent Test**：打开企业空间应用列表点击「刷新」，列表重新发起请求；仓库列表同样有刷新入口且空闲时可用。

## 前置与配置

- 已登录且可读企业空间应用商店

## 测试步骤

1. 打开企业空间应用列表，确认刷新入口可用并点击，观察请求
2. 打开仓库列表，确认刷新入口存在且可用
3. 打开商店管理页，确认只有原有的页面级刷新按钮

## 期望结果

- 刷新期间按钮忙碌；返回后恢复

## 失败排查

- 仓库页没有按钮：schema 缺 refresh 条目（只有 onRefresh 不足以渲染按钮）
- 商店管理页两个刷新：重复接入

## 产品改版后如何更新自动化

- 选择器：workspace-apps:refresh / workspace-repos:refresh / store-manage:<view>:refresh
