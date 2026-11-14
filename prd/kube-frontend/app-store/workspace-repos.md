# 企业空间应用仓库（L3）

[子模块需求](./_index.md)

## 概述

企业空间控制台的 **应用仓库** 区域：仓库列表 `/kube-frontend/workspaces/<ws>/repos` 与仓库应用 `/kube-frontend/workspaces/<ws>/apps`。openpitrix 组件已开启，两条工作空间级集合实测可读（本集群 system-workspace：1 个仓库、15 个应用）。只读。

老 console 把这两页放在 `/:workspace/repos` 与 `/:workspace/apps`（企业空间菜单），新 UI 在 workspace 作用域补上同样入口。

## 用户故事

### US1 - 企业空间管理员查看应用仓库与仓库应用 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到本空间添加的应用仓库（地址/状态/创建时间）以及仓库同步来的应用**，以便 **确认仓库是否同步成功、空间里有哪些可部署应用**。

**Independent Test**：打开 `/workspaces/<ws>/repos`，行数等于 `GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos` 的条目数；打开 `/workspaces/<ws>/apps`，行数等于同一工作空间 `apps` 集合条目数；两者为 0 时分别显示空态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01** — 已知企业空间 `<ws>` 有 N 个应用仓库、M 个仓库应用（N/M 可能为 0），当打开该空间的仓库列表，则列出 N 行（名称 / 地址 / 类型 / 状态 / 创建时间），N 为 0 时显示「该企业空间还没有应用仓库」；打开仓库应用页则列出 M 行（名称 / 版本类型 / 状态 / 创建时间），M 为 0 时显示「该企业空间还没有应用」；接口失败时显示错误面板与重试；两页均只读。

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02** — 已知企业空间有一个可访问的 Helm 仓库地址，当在仓库列表点「添加仓库」填写名称与该地址并提交，则列表新增该仓库（名称/地址可见、接口回读一致）；地址不可达时提交显示服务端返回的具体原因且不新增行；对新增仓库执行「移除」后接口与列表都不再包含它。

## 设计目标

1. 仓库与应用同属一个区域，两个页签式入口（侧栏两项）互相可达。
2. 空态明确：没有仓库/应用是正常状态，不显示「加载中」或空白表。
3. 不伪造：接口不提供的字段（仓库类型、应用与仓库的关联）不做猜测展示。

## 约束与边界

- 仓库：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos`（实测 200，system-workspace 1 条：builtin-stable / https://charts.kubesphere.io/stable）。
- 应用：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/apps`（实测 200，system-workspace 15 条，`app_version_types=helm`）。
- 按仓库过滤不可行（探测证据见「明确不做」），应用页展示工作空间全部应用。
- 只读：仓库新建/同步/删除、应用部署均不在本轮。
- URL 属 workspace 作用域（`/kube-frontend/workspaces/<ws>/…`），与老 console 的 `/:workspace/...` 对齐。

## UI 交互设计

- 侧栏：仓库列表 / 仓库应用（区域 app-repos）。
- 仓库列表：名称 / 地址 / 类型 / 状态（徽标）/ 创建时间。
- 仓库应用：名称（描述作次行）/ 版本类型 / 状态 / 创建时间。
- 两者空态：标题 + 说明；失败态：错误面板 + 重试。
- `data-ai-id`：`workspace-repos:surface`、`workspace-repos:retry`；`workspace-apps:surface`、`workspace-apps:retry`。行使用 `data-ai-row`（repo_id / app_id）。

## 文案与校验

- 区域/页面：`appRepos.title`、`appRepos.repos.title`、`appRepos.apps.title`；说明 `appRepos.repos.description`、`appRepos.apps.description`。
- 空态：`appRepos.repos.emptyTitle/emptyDescription`、`appRepos.apps.emptyTitle/emptyDescription`。
- 列：名称/创建时间复用 `cluster.column.name/createdAt`；地址 `appRepos.repos.column.url`；类型 `appRepos.repos.column.type`；版本类型 `appRepos.apps.column.versionType`；状态 `cluster.column.status`。
- 时间经 `formatTimestamp`；缺失值 `-`。

## 边界情况

- 仓库状态 `successful` / `active` 显示成功徽标，其它值显示警告徽标（如 syncing/failed），不隐藏行。
- 仓库没有 `url`：显示 `-`。
- 仓库对象没有类型字段（本部署实测）：类型列显示 `-`，不硬编码 helm。
- 应用没有 `app_version_types`：版本类型列显示 `-`。
- 接口失败：错误面板 + 重试，不降级为空态。

## 明确不做

- 仓库的新建/验证/同步/删除：写接口下一批。
- 应用部署/安装：属于项目作用域的「应用」流程，另立。
- **按仓库过滤应用**：实测 `repo_id` 参数被服务端忽略（`/workspaces/<ws>/apps?repo_id=builtin-stable` 与不带参数均返回 15 条；全局 `/apps?repo_id=` 返回 30 条），且应用对象没有 `repo_id` 字段可供客户端过滤。把未过滤结果标注为「某仓库的应用」会误导，故应用页只展示工作空间全部应用；设计 DEC-02 记录。
- 商店管理（平台侧 apps/categories/reviews）：已在应用商店管理页面。

## 假设

- openpitrix 模块保持开启，工作空间级 repos/apps 集合可读（实测 200）。
- 仓库状态字段取 `status`，应用状态字段取 `status`；分页字段为 `total_count`（本页用 `limit=-1` 一次取全，条目量级小）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01** — 工作空间仓库列表与仓库应用列表，空态/失败态明确。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02** — 两页只读，字段缺失如实显示 `-`，不伪造类型或关联。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01** — 两页行数与各自 openpitrix 集合一致；空态文案可见；失败可重试。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01`
