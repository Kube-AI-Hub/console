# TC-FULL-KUBE-FRONTEND-APP_STORE-01 应用商店两个顶栏入口可达且页签可切换

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-APP_STORE-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `app-store` ``
- **入口**: `{BASE_URL}/kube-frontend/apps`
- **需求**: `prd/kube-frontend/app-store/_index.md`

## 产品功能

顶栏「应用商店」与「平台管理 › 应用商店管理」都指向真实页面，管理页三个页签可切换。

### 关联需求

- `prd/kube-frontend/app-store/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/_index.md`](../../../../prd/kube-frontend/app-store/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-APP-STORE-01** — 当从顶栏进入应用商店与商店管理，两者各自渲染且页签可切换。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/_index.md`](../../../../design/kube-frontend/app-store/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/_index.md`](../../../../prd/kube-frontend/app-store/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开应用商店，在浏览与管理之间切换并看到各自的数据 (Priority: P1)

作为 **平台用户/管理员**，我希望 **能进入应用商店与管理页**，以便 **找到可安装的应用，或查看商店里发布了什么**。

**Independent Test**：从顶栏进入 `/kube-frontend/apps` 看到分类与应用区；进入 `/kube-frontend/apps-manage` 默认落在「应用」页签，三个页签可切换。

## 前置与配置

- 已登录平台管理

## 测试步骤

1. 打开 /kube-frontend/apps
2. 打开 /kube-frontend/apps-manage
3. 依次切换三个页签

## 期望结果

- 两个地址都渲染，不是 404 或空白
- 三个页签都出现

## 失败排查

- 空白：壳层声明了路径但路由目录缺失（曾长期如此）

## 产品改版后如何更新自动化

- 顶栏入口变化时同步
