# TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01 项目内应用 · 列表、行数与空态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `project-apps`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/applications`
- **需求**: `prd/kube-frontend/app-store/project-apps.md`

## 产品功能

项目内应用列表来自项目集合，行数与接口一致，失败可重试，不渲染服务端无法兑现的分页器。

### 关联需求

- `prd/kube-frontend/app-store/project-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/project-apps.md`](../../../../prd/kube-frontend/app-store/project-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01** — 已知项目 `<ns>` 内有 N 个 release（N 可能为 0），当打开 `/kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/applications`，则表格行数等于 `GET /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications?limit=-1` 的 `items` 数；每行显示 release 名称（次行为描述）、状态徽标、应用名、版本、创建时间；N=0 时显示空态标题与说明；接口失败显示错误面板与重试；页面不渲染分页器（该集合一次返回全量），搜索在本页内完成并在说明里写明。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/project-apps.md`](../../../../design/kube-frontend/app-store/project-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/project-apps.md`](../../../../prd/kube-frontend/app-store/project-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清这个项目里装了哪些应用 (Priority: P1)

作为项目使用者，我在项目控制台的应用页看到本项目内所有已安装应用（release），并能判断每个应用的状态、版本和创建时间。

## 前置与配置

- 已登录；GET /workspaces/<ws>/namespaces/<ns>/applications 可读

## 测试步骤

1. 读项目集合得到 N 与条目
2. 打开 /kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/applications，等 installed-apps:surface 离开 loading
3. 核对行数与表头；N>0 时核对首行 release 名
4. 核对 installed-apps:source-note 与是否出现分页器

## 期望结果

- 行数 = N；N=0 显示空态标题
- 表头含 名称/状态/应用/版本/创建时间（项目列在项目作用域隐藏）
- 页面有 installed-apps:source-note，且不渲染分页器

## 失败排查

- 行数与接口不一致：读错了集合（用了工作空间汇总）
- 出现分页器：项目集合一次返回全量，不应有分页

## 产品改版后如何更新自动化

- 句柄：installed-apps:surface / :table / :source-note / :refresh
