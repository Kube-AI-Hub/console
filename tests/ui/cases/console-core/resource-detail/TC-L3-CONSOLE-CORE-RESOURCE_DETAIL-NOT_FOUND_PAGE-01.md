# TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND_PAGE-01 404 兜底页

- **用例 ID**: `TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND_PAGE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `console-core` / `resource-detail` `not-found-page`
- **入口**: `{BASE_URL}/kube-frontend/this-page-does-not-exist`
- **需求**: `prd/console-core/resource-detail/not-found-page.md`

## 产品功能

未知前端路径显示「页面不存在」并保留外壳，附带返回工作台入口。

### 关联需求

- `prd/console-core/resource-detail/not-found-page.md`

### 覆盖的验收场景

文案来自需求 [`prd/console-core/resource-detail/not-found-page.md`](../../../../prd/console-core/resource-detail/not-found-page.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND_PAGE-01** — 已知地址 `/kube-frontend/this-page-does-not-exist` 没有对应页面，当访问它时，则显示标题「页面不存在」、一句说明与「返回工作台」链接（指向 `/kube-frontend`），而不是空白页。

### 关联设计

- 技术方案 [`design/console-core/resource-detail/not-found-page.md`](../../../../design/console-core/resource-detail/not-found-page.md)

## 覆盖的用户故事

文案来自需求 [`prd/console-core/resource-detail/not-found-page.md`](../../../../prd/console-core/resource-detail/not-found-page.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开过期链接时知道发生了什么 (Priority: P2)

作为 **使用者**，我希望 **打开一个不存在的地址时看到明确说明**，以便 **不去怀疑系统坏了**。

**Independent Test**：访问一个不存在的 `/kube-frontend/...` 地址，页面出现「页面不存在」与返回入口。

## 前置与配置

- 已登录

## 测试步骤

1. 访问一个不存在的 /kube-frontend 地址
2. 核对标题、说明与返回链接

## 期望结果

- 出现 not-found:surface，标题为「页面不存在」
- 返回链接指向 /kube-frontend

## 失败排查

- 空白主区域：catch-all 路由未注册（routes/$.tsx）
- 落到登录页：登录态丢失（先登录再访问）
- build 后仍空白：静态产物未重建

## 产品改版后如何更新自动化

- 选择器见 pages/ 与 NotFoundPage.tsx
