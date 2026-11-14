# TC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01 商店浏览 · 分类栏、空态与商店管理入口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `browse`
- **入口**: `{BASE_URL}/kube-frontend/apps`
- **需求**: `prd/kube-frontend/app-store/browse.md`

## 产品功能

应用商店首页：左侧分类栏（含应用数）与右侧应用区；商店为空时说明应用来自应用仓库；页头有「商店管理」入口。

### 关联需求

- `prd/kube-frontend/app-store/browse.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/browse.md`](../../../../prd/kube-frontend/app-store/browse.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01** — 当打开 `/kube-frontend/apps`，则显示分类栏（含分类的应用数）与应用区。
- **AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-02** — 当商店里没有应用，则显示空态：应用来自应用仓库，仓库为空商店就为空。
- **AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-03** — 当点击「商店管理」链接，则进入 `/kube-frontend/apps-manage`。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/browse.md`](../../../../design/kube-frontend/app-store/browse.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/browse.md`](../../../../prd/kube-frontend/app-store/browse.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 找到想安装的应用 (Priority: P1)

作为 **平台用户**，我希望 **按分类浏览商店里的应用**，以便 **找到可安装的模板并知道商店是否配置了仓库**。

**Independent Test**：打开应用商店，能看到分类栏与「全部分类」；点击某个分类后列表按其过滤；商店为空时显示说明而不是空白。

## 前置与配置

- 已登录

## 测试步骤

1. 打开 /kube-frontend/apps
2. 确认分类栏含「全部分类」
3. 若商店为空：确认空态说明来源是应用仓库
4. 点击「商店管理」

## 期望结果

- 页面进入 ready 或 empty 状态（不是 error）
- 空态文案包含「应用仓库」
- 跳转到 /kube-frontend/apps-manage

## 失败排查

- 仍为空白：/kube-frontend/apps 路由缺失（曾长期如此）
- 状态 error：openpitrix 接口不可用

## 产品改版后如何更新自动化

- 空态文案变化时同步用例断言
