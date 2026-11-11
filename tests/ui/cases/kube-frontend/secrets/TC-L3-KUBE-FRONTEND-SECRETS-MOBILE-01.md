# TC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01 保密字典 · 375px 视口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `mobile`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/mobile.md`

## 产品功能

窄屏无页面级横向滚动，只保留名称列，导航收进抽屉。

### 关联需求

- `prd/kube-frontend/secrets/mobile.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/mobile.md`](../../../../prd/kube-frontend/secrets/mobile.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01** — Given 375px 宽视口打开保密字典列表，When 等待加载完成，Then 页面 `document.scrollingElement.scrollWidth` 不超过视口宽度、导航收进抽屉（`shell:nav-toggle` 存在）、搜索框与创建按钮高度不小于 44px，列表只显示名称列（类型、字段数、创建时间折叠）。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/mobile.md`](../../../../design/kube-frontend/secrets/mobile.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/mobile.md`](../../../../prd/kube-frontend/secrets/mobile.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为在手机上排查问题的运维，看清有哪几条 Secret 以及它们是什么类型


**Independent Test**：在 375×667 视口打开列表，页面无横向滚动；能看到名称与描述；「字段数」列隐藏，「类型」列在手机上隐藏（`lg` 以下），但名称单元格仍然可点进详情。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 视口 375x667

## 测试步骤

1. 打开列表并等待加载
2. 测量 scrollWidth 与 innerWidth
3. 读取可见表头与导航开关

## 期望结果

- scrollWidth 不超过 innerWidth
- 可见表头只有名称
- shell:nav-toggle 存在

## 失败排查

- 出现横向滚动时检查长值容器的 break-all / overflow-x-auto

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
