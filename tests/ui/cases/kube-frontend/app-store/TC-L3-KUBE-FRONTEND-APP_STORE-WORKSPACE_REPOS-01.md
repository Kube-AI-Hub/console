# TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01 企业空间应用仓库 · 仓库列表与仓库应用

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `workspace-repos`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/repos`
- **需求**: `prd/kube-frontend/app-store/workspace-repos.md`

## 产品功能

企业空间作用域的应用仓库区域：仓库列表（名称/地址/类型/状态/创建时间）与仓库应用（名称/版本类型/状态/创建时间），空态/失败态明确，只读。

### 关联需求

- `prd/kube-frontend/app-store/workspace-repos.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/workspace-repos.md`](../../../../prd/kube-frontend/app-store/workspace-repos.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01** — 已知企业空间 `<ws>` 有 N 个应用仓库、M 个仓库应用（N/M 可能为 0），当打开该空间的仓库列表，则列出 N 行（名称 / 地址 / 类型 / 状态 / 创建时间），N 为 0 时显示「该企业空间还没有应用仓库」；打开仓库应用页则列出 M 行（名称 / 版本类型 / 状态 / 创建时间），M 为 0 时显示「该企业空间还没有应用」；接口失败时显示错误面板与重试；两页的读路径只读（写入口见 AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02 起）。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/workspace-repos.md`](../../../../design/kube-frontend/app-store/workspace-repos.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/workspace-repos.md`](../../../../prd/kube-frontend/app-store/workspace-repos.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 企业空间管理员查看应用仓库与仓库应用 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到本空间添加的应用仓库（地址/状态/创建时间）以及仓库同步来的应用**，以便 **确认仓库是否同步成功、空间里有哪些可部署应用**。

**Independent Test**：打开 `/workspaces/<ws>/repos`，行数等于 `GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos` 的条目数；打开 `/workspaces/<ws>/apps`，行数等于同一工作空间 `apps` 集合条目数；两者为 0 时分别显示空态。

## 前置与配置

- 已登录，且能访问至少一个企业空间
- openpitrix 已开启，工作空间级 repos/apps 集合可读（可能为空）
- 只读用例，不依赖 webhook

## 测试步骤

1. 用 API 读企业空间列表，优先选有仓库的空间
2. 读 /kapis/openpitrix.io/v1/workspaces/<ws>/repos 得到仓库数 N 与条目
3. 读 /kapis/openpitrix.io/v1/workspaces/<ws>/apps 得到应用数 M
4. 打开该空间仓库列表，核对行数 N、表头与状态徽标；N=0 核对空态
5. 打开仓库应用页，核对行数 M 与表头；M=0 核对空态
6. 核对侧栏包含 仓库列表 / 仓库应用

## 期望结果

- workspace-repos:surface 可见且 data-ai-state 为 ready 或 empty
- 仓库行数 = N；表头含 名称/地址/类型/状态/创建时间
- workspace-apps:surface 可见；应用行数 = M；表头含 名称/版本类型/状态/创建时间
- 空集合显示对应空态文案，不渲染空表头
- 全程无写请求

## 失败排查

- 行数为 0 但接口有数据：应用页漏了 /workspaces/<ws> 前缀（读到平台全量或 404）
- 仓库类型列恒空：本部署 repo 对象没有 type 字段，属预期（design DEC-03），不得硬编码 helm
- 应用页按 repo_id 过滤：接口忽略该参数（实测带与不带相同），不要据此声称已过滤（DEC-02）
- 页面 404：workspace 作用域路由未建或 URL 少了 /workspaces/<ws> 段

## 产品改版后如何更新自动化

- 选择器：workspace-repos:surface/retry、workspace-apps:surface/retry、tr[data-ai-row]；页面 pages/appstore/WorkspaceReposPage.tsx 与 WorkspaceAppsPage.tsx
