# TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02 配置字典 · 窄屏列折叠

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `mobile`
- **入口**: `{BASE_URL}/c/host/p/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/mobile.md`

## 产品功能

窄屏隐藏辅助列，保留名称与操作。

### 关联需求

- `prd/kube-frontend/configmaps/mobile.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/mobile.md`](../../../../prd/kube-frontend/configmaps/mobile.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02** — Given 视口宽 375px 且列表已加载，When 查看表格，Then「键」与「创建时间」列不显示，名称与操作列可见且操作按钮高度不小于 44px。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/mobile.md`](../../../../design/kube-frontend/configmaps/mobile.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/mobile.md`](../../../../prd/kube-frontend/configmaps/mobile.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为在手机上巡检的用户，打开列表不左右拖


**Independent Test**：375px 宽打开列表，页面无横向滚动，表格只显示名称与操作列。

### US2 - 作为在手机上的用户，通过抽屉进入模块


**Independent Test**：点击页头左侧按钮打开抽屉，选择「配置字典」后抽屉关闭且页面跳转。

## 前置与配置

- 视口宽 375px
- 列表已加载

## 测试步骤

1. 打开 {BASE_URL}/c/host/p/default/configmaps
2. 查看表头

## 期望结果

- 「键」与「创建时间」列不显示
- 名称与操作列可见
- 操作按钮高度不小于 44px

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
