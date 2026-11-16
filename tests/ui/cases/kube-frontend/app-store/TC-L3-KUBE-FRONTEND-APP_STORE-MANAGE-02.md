# TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02 应用商店管理 · 三个视图的显示列与刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `manage`
- **入口**: `{BASE_URL}/kube-frontend/apps-manage/store`
- **需求**: `prd/kube-frontend/app-store/manage.md`

## 产品功能

应用商店管理的应用/分类/审核三个视图各自提供「显示列」与刷新；取消勾选即时隐藏并按视图分别持久化，重置恢复。

### 关联需求

- `prd/kube-frontend/app-store/manage.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/manage.md`](../../../../prd/kube-frontend/app-store/manage.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-04** — 已知三个视图（应用/分类/审核）都是多列表格，当点工具栏的「显示列」，则只列出可隐藏列（名称不可隐藏）；取消勾选后该表头立即消失、选择按视图分别保存（`kube-frontend.columns.store-manage:{apps,categories,reviews}`）、刷新页面仍保持，「重置」恢复全部列；三个视图各自独立，隐藏「应用」的一列不影响「分类」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/manage.md`](../../../../design/kube-frontend/app-store/manage.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/manage.md`](../../../../prd/kube-frontend/app-store/manage.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 管理商店里有什么 (Priority: P2)

作为 **平台管理员**，我希望 **看到商店里已发布的应用、分类与审核记录**，以便 **知道商店的状态与管理入口在哪**。

**Independent Test**：打开 `/kube-frontend/apps-manage`，默认落在「应用」页签；三个页签都能切换且各自显示内容或空态。

## 前置与配置

- 已登录；商店有分类与应用数据

## 测试步骤

1. 依次打开 apps-manage/store、/categories、/reviews
2. 每个视图点「显示列」，取消勾选一个可隐藏列，核对表头减一
3. 核对 localStorage 的 kube-frontend.columns.store-manage:<视图> 记录新集合
4. 用菜单里的「重置」恢复全部列

## 期望结果

- 三个视图都有 <视图键>:columns 触发器（store-manage:apps / :categories / :reviews）
- 取消勾选后表头数减一、选择已持久化
- 重置后表头恢复；三个视图互不影响

## 失败排查

- 选择器不出现：schema 没有 refresh/search/filters，工具栏不渲染（列选择器在工具栏里）
- 三个视图互相影响：存储键没有按视图区分

## 产品改版后如何更新自动化

- 句柄：store-manage:{apps,categories,reviews}:columns 与 :columns:<key>、:columns:reset；视图 surface 为 store-manage:<view>:surface
