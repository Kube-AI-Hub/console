# 应用详情 · 技术方案（L3）

[需求](../../../prd/kube-frontend/app-store/detail.md)

## 概述

应用商店列表的一张卡片对应一个详情页：应用身份（名称/图标/分类/简介）、基本信息、版本历史、Chart README，以及安装入口。只读内容仍来自三个 openpitrix 端点；安装入口打开弹窗（企业空间/项目/版本/名称），提交时调用项目级 applications 创建端点，产生一条 openpitrix release。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01
- AC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-02
- AC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01
- AC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02

## 设计目标与非目标

目标：让读者在安装前独立判断「这是什么、有哪些版本、怎么用」；安装走一个显式的四步弹窗，成功/失败都如实呈现。

非目标：values 的结构化表单（schema 驱动）、协议确认弹窗、调度/集群选择、应用实例列表、审核/编辑应用、Markdown 渲染、截图轮播、卸载/升级入口（卸载在 `installed-apps.md`）。

## 关键约束

- 只读端点：GET /kapis/openpitrix.io/v1/apps/<appId>；GET .../apps/<appId>/versions；GET .../apps/<appId>/versions/<versionId>/files。
- 安装选项端点：GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces（2 个）；GET .../workspaces/<ws>/namespaces（如 public 下 spaces/csghub）。
- 安装写端点：POST /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications，body {app_id, version_id, name, description?, conf?}，返回 {message:"success"}。
  **`conf` 必须是 YAML 字符串**：传对象时实测报 `json: cannot unmarshal object into Go struct field CreateClusterRequest.conf of type string`。
- 版本文件端点 `…/versions/<versionId>/files` 同时提供 values.yaml（安装弹窗的默认值）与 values.schema.json（本部署 30 个应用都没有）。
- **没有 workspace 级创建路由**：GET /workspaces/<ws>/applications 只读（0 条），项目级 POST 空 body 返回 `helmapplicationversion.application.kubesphere.io "" not found`（校验先于创建，证明路由存在且需要 version_id）。
- 删除：DELETE /workspaces/<ws>/namespaces/<ns>/applications/<cluster_id>；按 release 名删除返回 200 但不生效（实测）。
- 实测字段：应用详情含 app_id/name/description/category_set/home/isv/status/status_time/app_version_types/cluster_total/latest_app_version；图标只在 latest_app_version.icon（30 个应用中 8 个没有）。
- 版本 objects：version_id/name/status/create_time/status_time/package_name/home/icon/maintainers/sources；**没有 type 字段**。版本列表响应为 {items,total_count}。
- README：files 响应 {files:{路径: base64}}，README.md 为其中一项；解码后是 UTF-8 文本。
- 404 是终态：不自动重试；其他错误才显示重试。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01 — 详情是独立路由，卡片整卡是链接

**为什么**：老 console 是 /apps/:appId；详情需要可分享、可刷新、可返回列表。列表卡片本身就是「进入详情」的入口，整卡链接比角落里的小链接更符合浏览行为，也让自动化有一个稳定的句柄 app-store:card:<appId>。

**被否方案**：列表内抽屉/弹窗。详情包含版本表与 README，弹窗会变成第二个页面且无法分享；返回时列表滚动位置还要额外维护。

**何时重新考虑**：详情缩短为几句话的预览、不再需要版本历史时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-02 — 版本类型取自应用的 app_version_types，不为每行伪造

**为什么**：版本对象没有 type 字段（实测），而应用级 app_version_types 表达的是这个应用使用哪种 Chart 类型（当前全部 helm）。表格的「类型」列因此显示应用级值；如果未来同一应用支持多种类型，需要 API 先给出每版本类型。

**被否方案**：从 package_name 后缀猜类型。名字不保证包含类型，猜错会让读者按错误类型理解安装包。

**何时重新考虑**：版本对象增加 type/package_type 字段时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-03 — README 从 files 端点解码为纯文本，折叠展示

**为什么**：README 只在 chart files 里（base64 的 README.md），应用详情没有 readme 字段。新 UI 没有 Markdown 渲染组件，为一个 README 引入新依赖不值得；纯文本加最大高度滚动保留内容又不破坏布局。默认折叠，展开才渲染，避免长 README 把版本表挤出首屏。

**被否方案**：引入 markdown-it/react-markdown 渲染。体积与 XSS 处理成本超过本轮价值；README 来自应用仓库，按不可信文本处理更稳。

**何时重新考虑**：商店需要富文本 README/截图时，统一做安全渲染组件。

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-04 — 详情保持只读；安装是唯一写入口，且只在显式提交时写

**为什么**：详情本身的数据全部来自 GET；安装入口从「禁用」改为「打开弹窗」，但打开、切换字段、取消都不发写请求，只有点确认才 POST 一次。这样既交付了安装，又不把浏览变成有副作用的操作。

**被否方案**：保留禁用按钮等待完整部署向导（/apps/:appId/deploy 的 values/协议流程）。本任务的目标就是打通写路径，且默认 values 安装已能覆盖主要场景。

**何时重新考虑**：需要编辑 values/协议时，扩展弹窗为向导（同一个创建端点，body 增加 conf/advanced_param）。

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-05 — 404 单独 not-found，不自动重试

**为什么**：应用不存在/已下架是确定结果，不是网络抖动。详情查询 retry:false，404 显示「应用不存在」与返回入口；其他错误（5xx/网络）才显示错误面板与重试。这样读者不会对着一个永不成功的重试按钮等待。

**被否方案**：统一错误面板。会把「已下架」渲染成「加载失败」，读者第一反应是刷新。

**何时重新考虑**：商店需要区分「未发布」与「无权限」时，扩展错误码分支。

### DEC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01 — 安装目标是项目，弹窗必须先选企业空间再选项目

**为什么**：openpitrix 的创建 handler 把 release 写成项目命名空间里的 HelmRelease，只有项目级路由（`/workspaces/<ws>/namespaces/<ns>/applications`）；workspace 级集合只读。工作空间选择仍然必要：它把项目下拉收敛到该空间的命名空间，也决定了成功后可跳转的 workspace 应用列表。

**被否方案**：只让用户选企业空间（老 console 的 /:workspace/clusters/:cluster/devops 风格）。服务端会因缺少 namespace 无法创建；或者退化为在某个默认项目安装，那是在替用户决定部署目标。

**何时重新考虑**：openpitrix 提供 workspace 级 release 创建时，可把项目改为可选（默认放到同名项目）。

### DEC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02 — 同名检查在客户端做，成功后只声称「已提交」

**为什么**：项目内已有同名 release 时，服务端返回的是不透明的错误（实测重复名不是结构化 409），读者无法据此修正；因此提交前读一次该项目 applications，`cluster.name` 与输入相同就提示「该项目内已有同名安装」且不发请求。创建返回 200 只代表 release 对象已创建，chart 的最终状态是异步的（探针 memcached 安装最终 failed），所以成功文案是「已提交安装」而不是「安装成功」。

**被否方案**：直接 POST 并把服务端错误原样展示。错误不可读且已经产生了半成品对象；或轮询 release 状态再报告成功——项目应用列表页尚未实现，弹窗不应承担状态机。

**何时重新考虑**：服务端返回结构化 duplicate 错误，或新增 release 状态查询页时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-06 — 安装弹窗内置 values 编辑，conf 以 YAML 文本提交

**为什么**：老 console 的安装是两步向导，第二步从 chart 的 values.yaml 起编辑（无 schema 时用 YAML 编辑，有 schema 时用表单+YAML 切换）。
本单元把这一步并进弹窗：打开时按所选版本拉 `files`，预填 `values.yaml`，提交时把文本作为 `conf` 发送。空值不发送 `conf`，即使用 chart 默认值。
**被否方案**：新建 `/apps/<appId>/deploy` 两步向导页（老 console 结构）。否决理由：安装目标是项目、参数与弹窗完全相同，新增页面只是把同一表单搬到另一个路由，且会与「一个动作一个入口」冲突。
**何时重新考虑**：需要按版本预设 values 模板、或需要 schema 驱动的分步表单时（那时把弹窗扩展为向导，仍是同一个创建端点）。

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-07 — 不实现 values.schema.json 表单视图（无真实样本）

**为什么**：老 console 在 chart 带 `values.schema.json` 时提供表单视图。本商店 30 个应用的版本里没有任何一个带该文件（逐版本 files 实测），
表单视图没有可验证的真实样本；按不可验证路径实现等于交付一个没人能验收的控件。
**被否方案**：照老 console 实现 SchemaForm 再说。否决理由：没有样本就无法断言渲染、必填、类型校验与提交格式，属于未验收交付。
**何时重新考虑**：商店里出现带 values.schema.json 的 chart（复查条件：`GET …/versions/<id>/files` 的 keys 含 `values.schema.json`）。

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-08 — README 支持按版本切换，关键词按字段有无渲染

**为什么**：版本表已有多个版本，README 却固定取最新版本，读者无法判断旧版本差异；版本切换是纯读操作，成本低。
关键词（`keywords`）在本部署的应用详情里不存在（实测 keys 无该字段），因此按「有则显示、无则不渲染空行」处理，而不是渲染一行「无」。
**被否方案**：Readme 固定最新版本（上一轮结论）。否决理由：多版本应用里会给出与实际安装版本不一致的使用说明。
**何时重新考虑**：关键词成为搜索维度、需要筛选时，改为独立标签区。

## 系统现状

老 console 的 /apps/:appId 页面有 Banner（返回/图标/名称/简介）与三个页签：应用信息（简介/截图/版本表）、应用详情（README/版本选择/关键词）、应用实例（部署后的实例列表），右上角是安装按钮；安装跳 /apps/:appId/deploy 两步向导（基本信息 + 应用配置）。本实现迁移 Banner、基本信息与版本表、README，并把安装做成单弹窗：企业空间/项目/版本/名称 + 默认 values 提交；values 编辑、实例列表仍未迁移。

## 仓库落点

- 页面：apps/console-next/src/pages/appstore/AppStoreAppDetailPage.tsx（详情）
- 弹窗：apps/console-next/src/pages/appstore/AppInstallDialog.tsx
- 路由：apps/console-next/src/routes/kube-frontend.apps.$appId.tsx
- 接口：packages/api-client/src/appstore.ts 的 storeAppsApi.get / versions / readme、workspaceApplicationsApi（list/create/remove）、storeWorkspacesApi、storeWorkspaceProjectsApi
- 文案：packages/locales/src/index.ts 的 store.detail.*
- 测试：tests/ui/{specs,tests}/kube-frontend/app-store/...APP_STORE-DETAIL-01、...APP_STORE-INSTALL-01

## 对外契约

### CON-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01 — 安装请求体

`POST /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications`
body `{app_id, version_id, name, description?, conf?}`，其中 `conf` 是**YAML 文本**（不是对象）；
响应 `{message:"success"}`。成功后 release 出现在 `GET /workspaces/<ws>/applications` 与 `helmreleases` 集合里，
状态从 `creating` 变为 `active`（实测约 15 秒）。

### CON-L3-KUBE-FRONTEND-APP_STORE-DETAIL-02 — 版本文件

`GET /kapis/openpitrix.io/v1/apps/<appId>/versions/<versionId>/files` → `{files:{路径: base64}}`；
`README.md` 与 `values.yaml` 是其中两项（本部署无 `values.schema.json`）。

| 用途 | 路径 | 方法 | 实测 |
| --- | --- | --- | --- |
| 列表（入口） | /kapis/openpitrix.io/v1/apps | GET | 200，30 个应用、total_count |
| 应用详情 | /kapis/openpitrix.io/v1/apps/<appId> | GET | 200；图标在 latest_app_version.icon；category_set 提供分类名 |
| 版本列表 | /kapis/openpitrix.io/v1/apps/<appId>/versions | GET | 200，{items,total_count}；版本无 type 字段 |
| Chart 文件 | /kapis/openpitrix.io/v1/apps/<appId>/versions/<versionId>/files | GET | 200，{files:{路径:base64}}；README.md 在其中 |
| 不存在 | /kapis/openpitrix.io/v1/apps/<unknown> | GET | 404 |
| 企业空间 | /kapis/tenant.kubesphere.io/v1alpha2/workspaces | GET | 200，2 个（public、system-workspace） |
| 项目 | /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/namespaces | GET | 200，public 下 spaces/csghub |
| release 列表 | /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications | GET | 200；item.cluster.name 是 release 名、cluster.cluster_id 是删除用的 id |
| 安装 | 同上 | POST | 200 {message:"success"}；空 body 返回 helmapplicationversion not found（路由存在） |
| 删除 | 同上 + /<cluster_id> | DELETE | 200；按 name 删除不生效 |

字段映射（详情+安装）：

| 页面字段 | 来源 |
| --- | --- |
| 应用名 | name |
| 图标 | latest_app_version.icon（缺失显示首字母） |
| 分类 | category_set[].name |
| 简介 | description |
| 应用类型 | app_version_types |
| 应用 ID | app_id |
| 发布时间 | status_time（缺省 create_time） |
| 首页 | home |
| 维护者 | latest_app_version.maintainers（JSON 字符串解析） |
| 源码 | latest_app_version.sources（JSON 字符串解析） |
| 版本号 | versions[].name |
| 版本类型 | 应用级 app_version_types |
| 版本创建时间 | versions[].create_time |
| 版本状态 | versions[].status |
| Readme | files["README.md"] base64 解码；缺失回退 description |
| 安装目标企业空间 | tenant workspaces 列表 |
| 安装目标项目 | 该空间 namespaces 列表 |
| 安装名称 | 用户输入；重复判定对照 applications[].cluster.name |

## 不变量

1. 列表卡片链接到 /kube-frontend/apps/<app_id>，详情加载的是同一个 app_id。
2. 版本表行数 = 版本接口 items 数；版本类型列取应用级值。
3. Readme 默认折叠；展开后内容要么是 README 解码文本，要么是应用描述，要么是空文案。
4. 打开/取消安装弹窗不产生写请求；一次确认只发出一次创建请求。
5. 未知 appId 渲染 not-found（含返回入口），不渲染重试面板。
6. 安装只发往项目级 applications 端点；成功文案只说「已提交」；失败时显示服务端原因且不关闭弹窗。

## 已知坑

- **版本没有 type**：不要从 name/package_name 猜；类型列必须用应用级 app_version_types。
- **图标并非必有**：30 个应用中 8 个 latest_app_version.icon 为空；直接 img 会得到坏图，需要首字母占位。
- **README 只在 files 端点**：应用详情/版本详情都没有 readme 字段；files 响应里所有 chart 文件都是 base64，体积可能较大，只解码 README.md。
- **files 端点 404 不代表应用不存在**：只有应用详情 404 才是 not-found；README 失败只退化为空。
- **total_count vs items**：版本接口信封是 {items,total_count}，不能只读 total。
- **maintainers/sources 是 JSON 字符串**：直接渲染会显示原始 JSON；解析成数组再展示，解析失败按空处理。
- **appId 来自 URL**：encodeURIComponent；非法/不存在都走 404 分支。
- **列表卡片是 Link**：测试点击卡片后要等 URL 变化再断言 surface，不能只等元素。
- **安装没有 workspace 级创建路由**：不要尝试 POST /workspaces/<ws>/applications；只能项目级。
- **创建返回 200 ≠ 安装成功**：release 对象已建，chart 状态异步（探针 memcached 最终 failed，原因是 PDB policy/v1beta1 不被新集群接受）；文案与文档都不能说「安装成功」。
- **删除按 id**：DELETE .../applications/<cluster_id>；传 release 名返回 200 但对象仍在（清理用例据此实现，finally 里按 id 删）。
- **重复名字**：服务端错误不透明，客户端先查 applications[].cluster.name 拦截。
- **选择器注意**：安装按钮 app-detail:install；弹窗字段与成功块都有独立句柄，E2E 用它们断言。

## 测试与可观测

- E2E（只读）：tests/ui/specs/kube-frontend/app-store/TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01.yaml：从列表点击第一张卡片 → 详情 URL 与 surface；版本行数等于 API items；展开 Readme 得到非空文本；安装按钮可点、打开弹窗后取消；未知 appId → not-found；打开与取消全程无写请求（page.on("request") 断言）。
- E2E（写）：tests/ui/specs/kube-frontend/app-store/TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01.yaml：选一个有 active 版本的应用 → 详情点安装 → 选 public/spaces（或第一个可选项目）、版本、名称 → 提交 → 断言成功块；轮询项目 applications 找到该 release（cluster.name）；finally 按 cluster_id DELETE 并复核列表无残留。
- 可观测点：app-store:card:<id>、app-detail:surface、:name、:versions、:version:<id>、:readme、:readme-toggle、:install、:install-dialog、:install-workspace/project/version/name、:install-submit、:install-cancel、:install-success、:install-success-link、:install-error、:not-found、:back、:retry。
- 失败时先看：详情请求是否 404、版本接口信封、README base64 解码、安装 POST 的 workspace/namespace、release 是否已存在（残留）、删除是否用了 cluster_id。

## 后续改进

- 安装 values/协议/高级参数（扩展弹窗为向导）。
- 应用实例列表（部署后的运行时对象，含状态与卸载/升级）。
- 安全的 Markdown README 与截图。
- 按版本切换 README/关键词。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01
- TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01
