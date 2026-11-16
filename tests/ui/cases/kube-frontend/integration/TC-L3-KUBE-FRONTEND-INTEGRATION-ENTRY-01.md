# TC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01 同源集成 · 老控制台顶部入口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `integration` `entry`
- **入口**: `{BASE_URL}/dashboard`
- **需求**: `prd/kube-frontend/integration/entry.md`

## 产品功能

老控制台顶部导航有「新版控制台」入口，点击整页跳到新前端工作台。

### 关联需求

- `prd/kube-frontend/integration/entry.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/integration/entry.md`](../../../../prd/kube-frontend/integration/entry.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01** — Given 已登录且新前端已挂载，When 查看顶部导航，Then 「新版控制台」出现在「工作台」之后，按钮高度与相邻项一致、水平间距一致；点击后地址变为 `/kube-frontend/`。

### 关联设计

- 技术方案 [`design/kube-frontend/integration/entry.md`](../../../../design/kube-frontend/integration/entry.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/integration/entry.md`](../../../../prd/kube-frontend/integration/entry.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为平台用户，从老控制台一键进入新前端


**Independent Test**：登录老控制台，顶部导航出现「新版控制台」；点击后整页跳转到 `/kube-frontend/`，落在新前端工作台且已是登录态。

## 前置与配置

- 已登录老控制台
- 新前端已挂载

## 测试步骤

1. 登录后停在控制台首页，读取顶部导航所有产品入口的文案、x、width、height、y
2. 点击「新版控制台」
3. 观察地址与页面

## 期望结果

- 「新版控制台」出现在「工作台」之后、「智能体工坊」之前
- 该按钮的 height 与 y 与相邻按钮完全一致，相邻水平间距与其他按钮一致
- 点击后地址变为 /kube-frontend/，页面为新前端工作台且工作台区域进入 ready
- 不出现新前端的登录表单

## 失败排查

- 入口不出现：检查 client.portal.newConsole 是否为 true（取决于 ks-console 的 local_config.yaml）
- 点击后落到老控制台的 404：检查是否误用了 routing.push 而不是 location.assign
- 文案显示成 NEW_CONSOLE：检查 locales/*/l10n-appStore-list.js 是否有该键

## 产品改版后如何更新自动化

- 入口文案或位置变化时同步本用例与 design 的对齐表
