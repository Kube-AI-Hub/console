# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01 服务账户 · 375px 视口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `mobile`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/mobile.md`

## 产品功能

窄屏列表无横向滚动；详情可读。

### 关联需求

- `prd/kube-frontend/serviceaccounts/mobile.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/mobile.md`](../../../../prd/kube-frontend/serviceaccounts/mobile.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01** — Given 375px 宽视口打开服务账户列表与详情，When 等待加载完成，Then 列表页 `scrollWidth` 不超过视口、导航收进抽屉、触控目标不小于 44px，只显示名称列；详情页属性区单列、kubeconfig 预览可滚动且不撑破页面。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/mobile.md`](../../../../design/kube-frontend/serviceaccounts/mobile.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/mobile.md`](../../../../prd/kube-frontend/serviceaccounts/mobile.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为在手机上检查权限的用户，看到账户列表并打开详情


**Independent Test**：375×667 视口打开列表，无横向滚动；点名称进入详情，能看到 kubeconfig 预览。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 视口 375x667

## 测试步骤

1. 打开列表测量 scrollWidth
2. 打开一个有令牌的账户详情并测量 scrollWidth

## 期望结果

- 两页的 scrollWidth 都不超过 innerWidth
- 列表只显示名称列
- 详情 kubeconfig 预览可滚动

## 失败排查

- 出现页面级横向滚动时检查 kubeconfig pre 的 overflow

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
