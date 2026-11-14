# TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01 商店管理 · 三个页签与默认重定向

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `manage`
- **入口**: `{BASE_URL}/kube-frontend/apps-manage`
- **需求**: `prd/kube-frontend/app-store/manage.md`

## 产品功能

/apps-manage 重定向到 /store；三个页签「应用/分类/审核」各自渲染列表或空态；有刷新按钮。

### 关联需求

- `prd/kube-frontend/app-store/manage.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/manage.md`](../../../../prd/kube-frontend/app-store/manage.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01** — 当打开 `/kube-frontend/apps-manage`，则重定向到 `/store` 并显示「应用/分类/审核」三个页签。
- **AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02** — 当切到「分类」，则列出商店分类及其应用数。
- **AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-03** — 当切到「审核」，则列出审核记录；没有记录时说明需要先发布应用。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/manage.md`](../../../../design/kube-frontend/app-store/manage.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/manage.md`](../../../../prd/kube-frontend/app-store/manage.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 管理商店里有什么 (Priority: P2)

作为 **平台管理员**，我希望 **看到商店里已发布的应用、分类与审核记录**，以便 **知道商店的状态与管理入口在哪**。

**Independent Test**：打开 `/kube-frontend/apps-manage`，默认落在「应用」页签；三个页签都能切换且各自显示内容或空态。

## 前置与配置

- 已登录平台管理

## 测试步骤

1. 打开 /kube-frontend/apps-manage，确认 URL 落到 /store
2. 依次切到「分类」「审核」页签
3. 在每个页签确认表格或空态，并确认刷新按钮存在

## 期望结果

- URL 重定向到 /apps-manage/store
- 三个页签都在，且切换不刷新整页
- 每个页签都有可见内容（列表或空态）

## 失败排查

- 页签为空：areaOfPage 的 segment 与 registry path 不一致
- 刷新无效：按钮用 location.reload，整页刷新属预期

## 产品改版后如何更新自动化

- 页签增减时同步 registry 与用例
