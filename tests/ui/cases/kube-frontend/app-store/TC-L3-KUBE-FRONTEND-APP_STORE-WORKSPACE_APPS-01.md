# TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01 企业空间应用模板 · 列表、表头与刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `workspace-apps`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/apps`
- **需求**: `prd/kube-frontend/app-store/workspace-apps.md`

## 产品功能

应用模板列表行数与工作空间 apps 集合一致，列含名称/状态/最新版本/版本类型/更新时间/创建时间，刷新可用。

### 关联需求

- `prd/kube-frontend/app-store/workspace-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/workspace-apps.md`](../../../../prd/kube-frontend/app-store/workspace-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01** — 已知企业空间 `<ws>` 有 N 个应用模板（N 可能为 0），当打开 `/kube-frontend/workspaces/<ws>/apps`，则列表行数等于 `GET /workspaces/<ws>/apps` 的 `items` 数，列含名称（次行描述）、状态、最新版本、版本类型、更新时间、创建时间；N=0 显示空态；接口失败显示错误面板与重试；刷新按钮可用且点击重新请求；权限不足时「上传模板」按钮禁用并给出说明（不隐藏页面）。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/workspace-apps.md`](../../../../design/kube-frontend/app-store/workspace-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/workspace-apps.md`](../../../../prd/kube-frontend/app-store/workspace-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 上传一个 Helm 模板并管理它的版本 (Priority: P1)

作为 **企业空间开发者**，我希望 **上传 Helm chart 建立模板、查看版本状态并推进审核/发布**，以便 **把自研应用放进企业空间供项目安装**。
进入详情看到版本页签里有该版本，状态为 `draft`；点提交审核后状态变为 `submitted`，撤销后回到 `draft`。

**Independent Test**：在应用列表点「上传模板」，选择 .tgz 后提交，列表出现该模板（名称/状态/最新版本）；

## 前置与配置

- 已登录；openpitrix 开启；工作空间 apps 集合可读（可能为空）

## 测试步骤

1. 读 GET /kapis/openpitrix.io/v1/workspaces/<ws>/apps?limit=-1 得到 N 与条目
2. 打开应用列表，等 workspace-apps:surface 离开 loading
3. 核对表头、行数与首行名称
4. 点刷新按钮，确认重新发出 GET /apps 请求

## 期望结果

- 表头包含 名称/状态/最新版本/版本类型/更新时间/创建时间
- 行数 = N（N=0 时显示空态「还没有应用」）
- workspace-apps:refresh 可见且 enabled，点击触发一次 GET 请求

## 失败排查

- 行数比接口多：漏了 /workspaces/<ws> 前缀（读到平台全量 30 条）
- 刷新按钮禁用：schema 的 useMemo 依赖漏了 query.isFetching

## 产品改版后如何更新自动化

- 句柄：workspace-apps:surface / :table / :refresh / :name:<id>
