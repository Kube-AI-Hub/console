# 已安装应用（L3）

[子模块需求](./_index.md)

## 概述

企业空间控制台的 **已安装应用** 区域：`/kube-frontend/workspaces/<ws>/apps/instances`（列表）与
`…/instances/<releaseId>`（详情）。数据来自 openpitrix 的跨项目汇总只读集合
`GET /kapis/openpitrix.io/v1/workspaces/<ws>/applications`，release 本体来自
`application.kubesphere.io/v1alpha1` 的 `helmreleases`（集群级对象，用 `rls-…` id 读取）。

这一页存在的理由：安装（商店详情 / 应用模板详情）提交后必须能回读结果。老 console 把已安装应用
放在项目作用域（`/projects/<ns>/applications/template`）并额外提供「应用实例」页签；新 UI 目前没有
项目级应用页，因此把**企业空间内全部 release** 作为安装结果的唯一回读入口，并从安装成功面板直接链到本页。

## 用户故事

### US1 - 确认安装结果并看清 release 的真实状态 (Priority: P1)

作为 **企业空间用户**，我希望 **看到本空间所有项目里已安装的应用及其状态、版本与项目归属**，以便 **确认我刚提交的安装是否真的落地、现在处于什么状态**。

**Independent Test**：在商店详情安装一个应用后打开本页，能看到该 release 行（名称/状态/应用/版本/项目/创建时间）；行数等于
`GET /workspaces/<ws>/applications` 的 `items` 数；搜索框能按 release 名/应用名/项目过滤。

### US2 - 查看一个 release 的详情并卸载它 (Priority: P1)

作为 **企业空间用户**，我希望 **打开某个 release 看到它的基本信息、创建的资源、事件、安装时提交的 values 与对象 YAML，并在确认后卸载**，以便 **判断它是否正常工作、并在不需要时清理**。

**Independent Test**：打开任一 release 详情，基本信息页签字段与接口一致；资源页签按
`app.kubesphere.io/instance=<release>` 列出 chart 创建的工作负载/服务/路由；YAML 页签显示 helmrelease 原文；
点卸载并在确认框确认后，接口与列表都不再包含该 release（用 `rls-…` id 删除）。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01** — 已知企业空间 `<ws>` 有 N 个 release（N 可能为 0），当打开 `/kube-frontend/workspaces/<ws>/apps/instances`，则列表行数等于 `GET /workspaces/<ws>/applications` 的 `items` 数，每行显示 release 名称（次行为描述）、状态徽标、应用名、版本、项目、创建时间；N=0 时显示空态标题「还没有已安装的应用」与说明；接口失败显示错误面板与重试按钮；页面显式说明「跨项目汇总接口没有服务端分页与搜索，筛选在本页内完成」并且**不渲染分页器**；在搜索框输入应用名后只显示匹配行，清空后恢复全部行。
- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02** — 已知存在一个 release，当打开它的详情页，则「基本信息」页签显示名称/状态/应用/版本/项目/集群/创建者/修订版本/创建时间/最近更新/部署历史，取值与 `helmreleases` 对象的 `spec`/`status` 一致；「资源」页签按 `app.kubesphere.io/instance=<release>` 列出 deployments/statefulsets/daemonsets/services/ingresses 及其摘要（就绪/期望副本或服务类型），没有资源时显示空态而不是空表；「事件」页签列出该 release 的 Kubernetes 事件，没有事件时显示空态；「配置」页签显示安装时提交的 values YAML（`spec.values` 的 base64 解码），没有自定义 values 时显示「使用 chart 默认值」；「YAML」页签显示 helmrelease 对象原文；页面对升级/回滚给出「接口无升级路由」的说明且不提供该控件。
- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-03** — 当在列表行操作或详情页点「卸载」并在确认框中确认，则向 `DELETE /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications/<cluster_id>` 发送请求（用 release 的 `rls-…` id，而不是 release 名），成功后接口回读与列表都不再包含该 release；失败时显示服务端原因且不关闭确认框、不伪造成功；取消不发请求。

## 设计目标

1. 安装结果可回读：安装成功面板与本页同源，行数与接口一致。
2. 如实标注数据源能力：接口没有服务端分页/搜索时，页面不画分页器，筛选在页内完成并写明。
3. 卸载用对象 id；按名字删会 200 但不生效（实测），页面不提供会静默失败的路径。

## 约束与边界

- 列表数据源唯一：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/applications`（只读、跨项目汇总、无服务端分页、忽略 `keyword`）。
- release 本体：`GET /apis/application.kubesphere.io/v1alpha1/helmreleases/<rls-id>`；`spec.values` 是 base64 的 YAML。
- 资源查询：`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/{deployments,statefulsets,daemonsets,services,ingresses}?labelSelector=app.kubesphere.io/instance=<release>`。
- 事件查询：`/api/v1/namespaces/<ns>/events?fieldSelector=involvedObject.name=<release>,involvedObject.kind=HelmRelease`。
- 卸载：`DELETE /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications/<cluster_id>`。

## UI 交互设计

- 列表：标题 + 说明 + 刷新 + 页内搜索；列：名称（次行描述）/ 状态 / 应用 / 版本 / 项目 / 创建时间；行操作「卸载」；行名链到详情。
- 详情：返回入口 → 头部（release 名 + 状态徽标 + 应用·版本 + 卸载按钮）→ 五个页签（基本信息 / 资源 / 事件 / 配置 / YAML）。
- 句柄：`installed-apps:surface`、`installed-apps:table`、`installed-apps:refresh`、`installed-apps:search`、`installed-apps:name:<id>`、`installed-apps:uninstall`、`installed-apps:uninstall:confirm`、`installed-apps:source-note`、`installed-app:surface`、`installed-app:name`、`installed-app:tab:{info,resources,events,config,yaml}`、`installed-app:uninstall`、`installed-app:uninstall:confirm`、`installed-app:not-found`。
- 行使用 `data-ai-row` = release id（`rls-…`）。

## 文案与校验

- 标题「已安装应用」，说明「该租户(企业空间)内所有项目安装的应用（release）」。
- 空态「还没有已安装的应用 / 从应用商店或应用模板安装后，release 会出现在这里」。
- 数据源说明「跨项目汇总接口只返回全量列表，没有服务端分页与搜索；下方搜索与筛选在本页内完成」。
- 卸载确认「将卸载 {{name}} 及其创建的资源；该操作不可撤销」；失败「卸载失败：{reason}」。
- 升级说明「升级 / 回滚未开放：接口只有项目级创建，没有升级路由（见 design DEC）」。

## 边界情况

- release 的 helmrelease 对象已被删除但汇总行还在（卸载中）：详情仍显示行数据，YAML/配置页签显示 `-`，不整页报错。
- `rls-id` 不存在：详情显示「应用实例不存在」与返回入口，不自动重试。
- 资源为 0：资源页签显示空态（说明按选择器查询），不渲染空表头。
- 事件为 0：事件页签显示空态。
- `spec.values` 为空：配置页签显示「安装时没有提交自定义 values，使用 chart 默认值」。
- 状态值不在已知集合（creating/active/failed/deleting/upgrading/upgraded/created）内：徽标按 neutral 显示原值，不隐藏行。
- 汇总接口失败：错误面板 + 重试，不降级为空态。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01** — 列表：跨项目汇总、行数与接口一致、页内搜索、空/错/加载三态可分。
- **FR-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02** — 详情五页签：基本信息/资源/事件/配置/YAML，缺数据有明确空态。
- **FR-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-03** — 卸载：用 release id 删除、确认后执行、失败显示原因、取消不写。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01** — 列表行数与 `/workspaces/<ws>/applications` 一致；搜索过滤生效；无分页器。
- **SC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02** — 一次真实安装的 release 能在本页被读到、详情页签取到真实 values 与资源，卸载后回读为 0 行。

## 明确不做

- **项目作用域的「应用」页**（老 console `/projects/<ns>/applications/template` 的列表与创建向导）：本页以企业空间汇总承接回读任务；项目级页面属于项目作用域，未在本单元交付。
- **升级 / 回滚**：openpitrix 没有 release 升级路由（`POST …/applications/<id>` 无对应 handler，实测 app 级 action 返回 `500 action not support`），页面如实说明，不提供控件。
- **CRD 应用（自制资源）**：老 console 的 `CRDApps` 另一类应用不在本单元范围。
- **实时 watch**：老 console 用 helmreleases watch 自动刷新；本页用刷新按钮 + 重新读取，watch 未纳入本批。

## 假设

- `/workspaces/<ws>/applications` 返回 `{items,total_count}` 且每项含 `cluster{name,cluster_id,app_id,version_id,status,zone,runtime_id,owner,create_time,status_time}`、`app{name,app_id}`、`version{name,version_id}`（实测）。
- `helmreleases` 是集群级对象，按 `rls-…` 名字直读（实测 200）。
- chart 创建的资源带 `app.kubesphere.io/instance=<release>` 标签（老 console 的资源状态页签用同一选择器）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01`
- `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02`
