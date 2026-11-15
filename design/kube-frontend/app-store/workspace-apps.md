# 企业空间应用模板 · 技术方案（L3）

## 概述

企业空间应用模板的列表、上传创建、版本状态机、模板删除与安装入口。数据全部来自 openpitrix 的
workspace 作用域集合；安装复用商店的安装弹窗（项目作用域创建 release）。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01`
- `AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02`
- `AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-03`
- `AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-04`

## 设计目标与非目标

目标：模板写链路（上传/创建/版本动作/删除）可达且失败原因来自服务端；列表列语义与老 console 对齐；
安装只有一套向导。

非目标：应用信息编辑（图标/截图/分类）、审核记录页签、版本 chart 文件预览、按仓库过滤。

## 关键约束

- 集合路径全部带 `/workspaces/<ws>` 前缀；缺前缀会读到平台全量（30 条）而不是空间内的 15 条。
- 上传包必须是 base64；字段名在创建与新增版本之间不同：创建用 `version_package`，新增版本用 `package`。
- `?validate=true` 与创建走同一 handler：validate 只解析不落库，返回 `{name,version_name,description}`。
- 删除模板前必须删光版本（服务端 500 `app … has some versions not deleted`）。
- app 级 `action` 端点对 draft 返回 `500 action not support`；版本动作必须走版本级端点。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01 — 列语义：保留「版本类型」并补回「最新版本/更新时间」

- 背景：老 console 的列表列是 名称 / 状态 / 最新版本(`latest_app_version.name`) / 更新时间；上一轮迁移只做了名称/版本类型/状态/创建时间。
- 决定：在保留 版本类型（`app_version_types` 是真实字段）与 创建时间 的同时，补回 最新版本 与 更新时间 两列。
- 被否方案：直接按老 console 列集合替换。否决理由：会删掉已交付的版本类型列与既存用例断言（`TC-…WORKSPACE_REPOS-01` 要求表头含「版本类型」），属于未经批准的删减。
- 何时重新考虑：老列与新列冲突到影响窄屏可读性时，按 hideBelow 折叠而不是删除。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02 — 上传前先 validate，再创建

- 决定：选择文件后先 `POST …/apps?validate=true` 拿到 `{name,version_name,description}`，用它预填说明并展示解析结果，再创建。
- 被否方案：直接创建后从错误里猜原因。否决理由：创建失败的报文不足以区分「包坏了」「Chart.yaml 缺字段」「重名」，
  且会在失败时留下半成品对象。
- 何时重新考虑：后端提供 dry-run 语义的独立端点时，改为一次调用。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-03 — 版本状态机由前端映射，动作走版本级端点

- 决定：`VERSION_STATUS_ACTION` 在 api-client 里按状态给出唯一动作（draft→submit、submitted→cancel、rejected→submit、passed→release、active→suspend、suspended→recover），
  调用 `POST …/versions/<id>/action`。
- 被否方案：让页面自己 if/else。否决理由：状态机是契约，散落在页面里会在下一处再实现一遍并漂移。
- 何时重新考虑：后端返回可用动作列表时，直接渲染。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-04 — 安装复用商店安装弹窗

- 决定：模板详情直接渲染 `AppInstallDialog`，把模板版本适配成弹窗期望的版本结构。
- 被否方案：另写一套模板安装向导（老 console 的 AppDeploy 两步向导）。否决理由：release 的创建参数与商店完全相同，
  第二套向导只会与第一套漂移；两步向导的 values 编辑已并入弹窗。
- 何时重新考虑：需要「按版本预设 values 模板」这类模板专有能力时。

## 系统现状

- 老 console：`/:workspace/apps`（APP_TEMPLATE 列表，含上传模板/创建应用入口）、`/:workspace/apps/:appId` 详情
  （版本 / 应用信息 / 审核记录 / 应用实例 四页签；操作 编辑 / 安装 / 上传新版本 / 删除）。
- 新 UI 本单元之前：只有只读的「仓库应用」列表，没有详情页、没有上传/版本/删除，也没有实例页签。

## 仓库落点

- `packages/api-client/src/appstore.ts`：`appTemplatesApi`（list/get/versions/validatePackage/create/addVersion/deleteVersion/versionAction/update/remove/packageOf）、
  `appTemplateInstancesApi`、`VERSION_STATUS_ACTION`、`VERSION_DELETABLE`、`toAppTemplate`、`toAppTemplateVersion`。
- `apps/console-next/src/pages/appstore/WorkspaceAppsPage.tsx`、`WorkspaceAppDetailPage.tsx`。
- 路由：`routes/kube-frontend.workspaces.$workspace/apps/$appId.tsx`。

## 对外契约

### CON-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01 — 模板集合与版本

`GET /kapis/openpitrix.io/v1/workspaces/<ws>/apps`（`limit=-1`）→ `{items,total_count}`，项含
`app_id,name,description,status,app_version_types,latest_app_version{version_id,name,icon},category_set,create_time,update_time,status_time,owner`。
`GET …/apps/<appId>/versions` → `{items,total_count}`，项含 `version_id,name,status,owner,create_time,update_time,package_name,active`。

### CON-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02 — 上传与创建

`POST …/apps?validate=true` body `{version_type:"helm",version_package:"<base64>"}` → `{name,version_name,description}`；
`POST …/apps` body `{name,version_type:"helm",version_package,description?}` → `{app_id,version_id}`（新模板状态 `draft`）。

### CON-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-03 — 版本动作与删除

`POST …/apps/<appId>/versions/<versionId>/action` body `{action}` → `{message:"success"}`；
`DELETE …/versions/<versionId>` → 200；`DELETE …/apps/<appId>` 在仍有版本时 500 `app <id> has some versions not deleted`。

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01** — 列表行数恒等于 `/workspaces/<ws>/apps` 的 `items` 数。
- **INV-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02** — 上传弹窗只在 validate 成功后创建；validate 失败不落库。
- **INV-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-03** — 模板删除的确认按钮在版本数为 0 之前保持禁用。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01** — 创建与新增版本的包字段名不同（`version_package` vs `package`），写反会 400/空版本。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02** — 删除模板前必须删版本，否则 500；不要把它当成「模板不可删」。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-03** — app 级 action 端点对 draft 返回 `500 action not support`；版本动作只有版本级端点有效。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-04** — 集合漏掉 `/workspaces/<ws>` 会读到平台全量 30 条（含 `-store` 后缀的商店条目），列表会凭空变长。

## 测试与可观测

- E2E：`TC-…WORKSPACE_APPS-01`（列表行数与接口一致、表头、刷新、空态）、
  `TC-…WORKSPACE_APPS-02`（真实上传 → 回读 → 版本状态机 draft→submitted→draft → 删版本 → 删模板 → 回读 0）。
- 句柄见 PRD「UI 交互设计」。

## 后续改进

- 应用信息编辑（图标/截图/分类）、审核记录页签、版本 chart 文件预览：见「明确不做」，随商店管理写能力批次重开。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01`
- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02`
