# 项目内应用（应用实例）

> 模块：应用商店（app-store）· 功能点：project-apps。作用域：项目（命名空间）。
> 迁移自旧 console 项目控制台的 `/projects/<ns>/applications/template`（列表 + 安装 + 编辑 + 删除 + 详情）。

## 用户故事

### US1 - 看清这个项目里装了哪些应用 (Priority: P1)

作为项目使用者，我在项目控制台的应用页看到本项目内所有已安装应用（release），并能判断每个应用的状态、版本和创建时间。

### US2 - 从应用商店往本项目安装应用 (Priority: P1)

作为项目使用者，我不离开项目就能挑一个商店应用装到当前项目，安装时能看到并修改 values，安装完成后在本页看到新行。

### US3 - 打开一个应用看它的资源与配置，或者卸载它 (Priority: P1)

作为项目使用者，我从列表点进应用详情查看基本信息/资源/事件/配置/YAML，并在需要时卸载；卸载以 release 的真实对象 id 为准。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01** — 已知项目 `<ns>` 内有 N 个 release（N 可能为 0），当打开 `/kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/applications`，则表格行数等于 `GET /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications?limit=-1` 的 `items` 数；每行显示 release 名称（次行为描述）、状态徽标、应用名、版本、创建时间；N=0 时显示空态标题与说明；接口失败显示错误面板与重试；页面不渲染分页器（该集合一次返回全量），搜索在本页内完成并在说明里写明。
- **AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02** — 当点主操作「安装应用」，则弹出应用选择列表（可按名称搜索，数据来自 `/kapis/openpitrix.io/v1/apps`）；选中一个应用后进入安装弹窗，工作空间与项目两栏预填为当前上下文且**不可修改**，可选择版本、编辑 values、填 release 名称；提交发出 `POST /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications`（`conf` 为 YAML 字符串），成功后弹窗显示 release 名并提供回本页的链接，列表重新读取后出现该行；名称为空/非法、版本缺失、release 重名时在本地拒绝且不发请求。
- **AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03** — 当在列表点 release 名称，则进入项目内应用详情（基本信息/资源/事件/配置/YAML 五页签，取值与 `helmreleases` 对象一致）；当在行操作点「卸载」并确认，则发出 `DELETE /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications/<cluster_id>`（用 `rls-…` 对象 id 而不是 release 名），成功后该行消失且回读不再存在；失败显示服务端原因、保留确认框；取消不发请求。

## 设计目标

- 项目页与「企业空间 › 已安装应用」共用同一个列表组件：同一批 release、同一套列与状态映射，作用域只切换数据源与可见动作（企业空间视图只读，项目视图可安装/卸载）。
- 安装复用商店的安装弹窗，不另写一套向导；项目页只负责把目标上下文锁定，避免选择已经在的场景。

## 约束与边界

- 项目集合返回的行结构与工作空间汇总一致（`cluster.cluster_id`、`app`、`version`、`status`）；分页与搜索由页面承担，因为该集合忽略 `keyword`。
- 卸载按对象 id 删除：按名称删除会返回 200 但不生效（实测）。删除是异步的，回读可能在数秒内仍返回该 release。

## UI 交互设计

- 信息层次：标题「应用」+ 说明（项目名）；右上主操作「安装应用」；工具条为 搜索 + 刷新；表格列 名称（含描述）/ 状态 / 应用 / 版本 / 创建时间；名称可点进详情。
- 空态说明「从应用商店安装后 release 会出现在这里」，并提供「清空搜索与筛选」「刷新」两个出口。
- 安装流程两步：选择应用（搜索列表）→ 目标锁定的安装弹窗（版本/values/release 名称）。

## 功能需求

- FR-1 读取项目集合，一次 `limit=-1` 取全，失败可重试。
- FR-2 行操作：卸载（危险色，二次确认）；名称链到项目内详情。
- FR-3 主操作：安装应用（两步）。
- FR-4 中英文文案成对；所有控件带 `data-ai-id`。

## 成功标准

- SC-1 列表行数与接口一致（含 0 与 N>0 两种），空态/错误可恢复。
- SC-2 安装后本页可见且接口回读一致；非法输入不发请求。
- SC-3 卸载后行消失、接口回读 404；失败不伪造成功。

## 明确不做

- **CRD 组装应用（`applications/composing`）**：旧 console 的另一类应用（由 CRD 组装，带 Tracing/灰度发布页签）。它依赖 CRD 应用的 composition 模型，与商店 release 不是同一对象，本单元只交付 `applications/template` 这一支；CRD 应用页另立单元。
- **应用「编辑信息」**：旧 console 的 `openpitrix.app.edit` 在升级/改名上有独立的接口语义，本部署的 release 升级无接口（已登记在 `installed-apps.md` 的明确不做）；改名未验证，不交付控件。

## 假设

- openpitrix 模块开启：`/kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications`、`/apps`、版本 `files` 均 200（实测）。
- 安装目标必须是项目；没有工作空间级创建路由。
