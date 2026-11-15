# 企业空间应用仓库（L3）

[子模块需求](./_index.md)

## 概述

企业空间控制台的 **应用仓库** 区域：仓库列表 `/kube-frontend/workspaces/<ws>/repos`、仓库详情 `…/repos/<repoId>`，
以及应用模板 `…/apps`（另见 `workspace-apps.md`）。openpitrix 组件已开启，两条工作空间级集合实测可读
（本集群 system-workspace：1 个仓库、15 个应用）。

仓库是**可写**的：新增（服务端拉取 `index.yaml` 校验）、编辑、删除、同步索引（`action: index`）都走
`/kapis/openpitrix.io/v1/workspaces/<ws>/repos`，本单元已实测通过（创建 → 回读 → PATCH → index → events → DELETE → 回读 0 条）。

老 console 把这两页放在 `/:workspace/repos` 与 `/:workspace/apps`（企业空间菜单），新 UI 在 workspace 作用域补上同样入口。

## 用户故事

### US1 - 企业空间管理员查看应用仓库与仓库应用 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到本空间添加的应用仓库（地址/状态/创建时间）以及仓库同步来的应用**，以便 **确认仓库是否同步成功、空间里有哪些可部署应用**。

**Independent Test**：打开 `/workspaces/<ws>/repos`，行数等于 `GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos` 的条目数；打开 `/workspaces/<ws>/apps`，行数等于同一工作空间 `apps` 集合条目数；两者为 0 时分别显示空态。

### US2 - 维护仓库（新增/编辑/删除/同步索引） (Priority: P1)

作为 **企业空间管理员**，我希望 **添加、编辑、删除应用仓库并手动触发索引同步**，以便 **在仓库地址或凭证变化后让应用重新可用，并清掉不再使用的仓库**。

**Independent Test**：添加一个可达的 Helm 仓库（唯一名称）→ 列表与接口回读一致；编辑其描述与同步周期 → 回读一致；
点「同步索引」→ `POST …/repos/<id>/action {action:"index"}` 返回 200 且详情页事件页签出现一条同步记录；删除后接口与列表都不再包含它。

### US3 - 看清仓库的索引状态与最近同步 (Priority: P2)

作为 **企业空间管理员**，我希望 **在列表与详情里看到仓库的索引状态、创建者与最近同步时间，并能翻看同步事件**，以便 **区分「还没同步」「同步成功」「同步失败」**。

**Independent Test**：仓库详情「基本信息」显示名称/地址/描述/状态/创建者/同步周期/最近同步/创建时间；
「事件」页签行数等于 `GET …/repos/<id>/events` 的条目数，列含创建时间/状态/消息；没有事件时显示空态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01** — 已知企业空间 `<ws>` 有 N 个应用仓库、M 个仓库应用（N/M 可能为 0），当打开该空间的仓库列表，则列出 N 行（名称 / 地址 / 类型 / 状态 / 创建时间），N 为 0 时显示「该企业空间还没有应用仓库」；打开仓库应用页则列出 M 行（名称 / 版本类型 / 状态 / 创建时间），M 为 0 时显示「该企业空间还没有应用」；接口失败时显示错误面板与重试；两页的读路径只读（写入口见 AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02 起）。

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02** — 已知企业空间有一个可访问的 Helm 仓库地址，当在仓库列表点「添加仓库」填写名称与该地址并提交，则列表新增该仓库（名称/地址可见、接口回读一致）；地址不可达时提交显示服务端返回的具体原因且不新增行；对新增仓库执行「移除」后接口与列表都不再包含它。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03** — 已知列表里有一个仓库，当点行操作「编辑」，则弹窗预填名称/协议/地址/同步周期/描述；修改描述与同步周期后保存，`PATCH …/repos/<repoId>` 成功且列表与 `GET …/repos/<repoId>` 回读一致；同步周期非法（非 `<数字>s|m|h` 或非 0 且不在 180s–86400s）时不发请求并提示「同步周期需在 180s 到 86400s 之间（或 0s 关闭自动同步）」；名称为空或地址为空时不发请求并提示对应字段。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04** — 已知列表里有一个仓库，当点行操作「同步索引」，则向 `POST …/repos/<repoId>/action` 发送 `{action:"index"}`，成功后重新读取列表；失败时在页面上显示「同步失败：{reason}」且不假装成功。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-05** — 已知存在一个仓库，当打开 `…/repos/<repoId>`，则「基本信息」页签显示名称/地址/描述/状态/创建者/同步周期/最近同步/创建时间，取值与 `GET …/repos/<repoId>` 一致（`status_time` 为零值时显示 `-`）；「事件」页签行数等于 `GET …/repos/<repoId>/events` 的 `items` 数，列含创建时间/状态/消息，0 条时显示空态；仓库不存在时显示错误面板与重试，不白屏。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-06** — 当当前身份对 `helmrepos`（`application.kubesphere.io`）的 `create` 被 `SelfSubjectAccessReview` 明确拒绝，则列表页隐藏「编辑/同步索引/删除」行操作并把「添加仓库」按钮置为禁用，同时显示说明「当前身份没有在该企业空间管理应用仓库的权限，写入入口已隐藏」；权限探测失败（网络/旧 BFF）时保持入口可用（fail-open），不以探测失败当拒绝。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-07** — 当界面语言为中文，则仓库页的主按钮、弹窗标题/说明、字段标签、行操作与提示全部为中文（不得出现 `Add repository` 之类的英文串）；当语言为英文（`kube-frontend-locale=en`），同一批文案全部为英文（不得出现中文）。

## 设计目标

1. 仓库与应用同属一个区域，两个页签式入口（侧栏两项）互相可达。
2. 空态明确：没有仓库/应用是正常状态，不显示「加载中」或空白表。
3. 不伪造：接口不提供的字段（仓库类型、应用与仓库的关联）不做猜测展示。

## 约束与边界

- 仓库：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos`（实测 200，system-workspace 1 条：builtin-stable / https://charts.kubesphere.io/stable）。
- 应用：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/apps`（实测 200，system-workspace 15 条，`app_version_types=helm`）。
- 按仓库过滤不可行（探测证据见「明确不做」），应用页展示工作空间全部应用。
- 写入端点：`POST/PATCH/DELETE …/repos[/<repoId>]`、`POST …/repos/<repoId>/action`、`POST …/repos?validate=true`、`GET …/repos/<repoId>/events`（全部实测 200）。
- 同步索引是异步的：`action:index` 只表示已触发，状态由控制器回写，页面因此重新读取而不是宣布完成。
- 凭证：仅 `s3://` 仓库开放 Access Key ID / Secret Access Key（老 console 的 `credential` 只在 s3 协议下可编辑，其它协议固定 `{}`）。
- URL 属 workspace 作用域（`/kube-frontend/workspaces/<ws>/…`），与老 console 的 `/:workspace/...` 对齐。

## UI 交互设计

- 侧栏：仓库列表 / 仓库应用（区域 app-repos）。
- 仓库列表：名称（次行描述，名称链到详情）/ 地址 / 类型 / 状态（徽标）/ 创建者 / 创建时间；页内搜索按名称过滤。
- 行操作（权限允许时）：编辑 / 同步索引 / 删除；主按钮「添加仓库」。
- 仓库详情 `…/repos/<repoId>`：基本信息（名称/地址/描述/状态/创建者/同步周期/最近同步/创建时间）+ 事件页签。
- 仓库应用：名称（描述作次行）/ 版本类型 / 状态 / 创建时间。
- 两者空态：标题 + 说明；失败态：错误面板 + 重试。
- `data-ai-id`：`workspace-repos:surface`、`workspace-repos:retry`；`workspace-apps:surface`、`workspace-apps:retry`。行使用 `data-ai-row`（repo_id / app_id）。

## 文案与校验

- 区域/页面：`appRepos.title`、`appRepos.repos.title`、`appRepos.apps.title`；说明 `appRepos.repos.description`、`appRepos.apps.description`。
- 空态：`appRepos.repos.emptyTitle/emptyDescription`、`appRepos.apps.emptyTitle/emptyDescription`。
- 列：名称/创建时间复用 `cluster.column.name/createdAt`；地址 `appRepos.repos.column.url`；类型 `appRepos.repos.column.type`；版本类型 `appRepos.apps.column.versionType`；状态 `cluster.column.status`；创建者 `appRepos.repos.column.creator`；同步周期 `appRepos.repos.column.syncPeriod`。
- 写入：`appRepos.repos.edit/editTitle/index/indexSuccess/indexFailed/events/createSuccess/editSuccess/noPermission/field.syncPeriodInvalid` 等键中英双份齐备。
- 时间经 `formatTimestamp`；缺失值 `-`。

## 边界情况

- 仓库状态 `successful` / `active` 显示成功徽标，其它值显示警告徽标（如 syncing/failed），不隐藏行。
- 仓库没有 `url`：显示 `-`。
- 仓库对象没有类型字段（本部署实测）：类型列显示 `-`，不硬编码 helm。
- 应用没有 `app_version_types`：版本类型列显示 `-`。
- 接口失败：错误面板 + 重试，不降级为空态。

## 明确不做

- **应用部署/安装**：属于项目作用域的「应用」流程（见 `installed-apps.md` 与 `detail.md` 的安装弹窗）。
- **仓库凭证的加密存储**：接口返回的 `credential` 是明文 JSON 串（`{}` 或 `{accessKeyID,secretAccessKey}`）；页面只在 s3 协议下读写这两个字段，不做二次加密，也不把凭证写进日志或截图。
- **仓库类型的推断**：仓库对象没有 `type` 字段；页面只在 `credential` 含 access key 时显示 `s3`，其余显示 `-`，不硬编码 `helm`。
- **按仓库过滤应用**：实测 `repo_id` 参数被服务端忽略（`/workspaces/<ws>/apps?repo_id=builtin-stable` 与不带参数均返回 15 条；全局 `/apps?repo_id=` 返回 30 条），且应用对象没有 `repo_id` 字段可供客户端过滤。把未过滤结果标注为「某仓库的应用」会误导，故应用页只展示工作空间全部应用；设计 DEC-02 记录。
- 商店管理（平台侧 apps/categories/reviews）：已在应用商店管理页面。

## 假设

- openpitrix 模块保持开启，工作空间级 repos/apps 集合可读（实测 200）。
- 仓库状态字段取 `status`，应用状态字段取 `status`；分页字段为 `total_count`（本页用 `limit=-1` 一次取全，条目量级小）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01** — 工作空间仓库列表与仓库应用列表，空态/失败态明确。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02** — 字段缺失如实显示 `-`，不伪造类型或关联。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03** — 仓库新增/编辑/删除：客户端校验 + 服务端原因 + 回读一致。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04** — 同步索引：触发 action、重新读取、失败如实提示。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-05** — 仓库详情：基本信息 + 事件页签。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-06** — 权限门控：SSAR 明确拒绝时隐藏写入入口并说明，探测失败 fail-open。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-07** — 中英文文案双向齐全，无语言串台。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01** — 两页行数与各自 openpitrix 集合一致；空态文案可见；失败可重试。
- **SC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02** — 一次真实仓库生命周期：创建 → 编辑 → 同步索引 → 事件可见 → 删除 → 回读 0 条，失败也清理。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01`
- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02`
- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03`
- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04`
