# 企业空间应用模板（L3）

[子模块需求](./_index.md)

## 概述

企业空间控制台的 **应用** 区域（老 console `APP_TEMPLATE`）：`/kube-frontend/workspaces/<ws>/apps`（列表）与
`…/apps/<appId>`（详情）。模板来自上传 Helm chart（`POST /kapis/openpitrix.io/v1/workspaces/<ws>/apps`），
其版本走审核状态机（draft → submitted → passed → active），发布后才进入商店。

本页同时是企业空间「应用仓库同步出来的应用」的落点：仓库索引后应用出现在同一集合里
（`/workspaces/<ws>/apps`，实测 system-workspace 15 条）。

## 用户故事

### US1 - 上传一个 Helm 模板并管理它的版本 (Priority: P1)

作为 **企业空间开发者**，我希望 **上传 Helm chart 建立模板、查看版本状态并推进审核/发布**，以便 **把自研应用放进企业空间供项目安装**。

**Independent Test**：在应用列表点「上传模板」，选择 .tgz 后提交，列表出现该模板（名称/状态/最新版本）；
进入详情看到版本页签里有该版本，状态为 `draft`；点提交审核后状态变为 `submitted`，撤销后回到 `draft`。

### US2 - 从模板详情安装到项目并查看实例 (Priority: P1)

作为 **企业空间用户**，我希望 **从模板详情直接安装到某个项目，并看到该模板的安装实例**，以便 **不离开企业空间控制台就完成部署与回读**。

**Independent Test**：模板详情点「安装」，选择企业空间/项目/版本/名称并提交；实例页签出现该 release；
再点实例行进入已安装应用详情。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01** — 已知企业空间 `<ws>` 有 N 个应用模板（N 可能为 0），当打开 `/kube-frontend/workspaces/<ws>/apps`，则列表行数等于 `GET /workspaces/<ws>/apps` 的 `items` 数，列含名称（次行描述）、状态、最新版本、版本类型、更新时间、创建时间；N=0 显示空态；接口失败显示错误面板与重试；刷新按钮可用且点击重新请求；权限不足时「上传模板」按钮禁用并给出说明（不隐藏页面）。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02** — 当在列表点「上传模板」，选择唯一名称与一个 .tgz/.tar.gz 的 Helm chart 并提交，则先以 `version_type=helm`+`version_package`(base64) 调用 `?validate=true` 解析出模板名与版本，再 `POST /workspaces/<ws>/apps` 创建；成功后列表出现该模板且 `GET /workspaces/<ws>/apps` 回读一致；非法扩展名/超过 2 MiB 在客户端拦截且不发请求；服务端拒绝时显示服务端原因且不新增行。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-03** — 当打开模板详情 `…/apps/<appId>`，则「版本」页签行数等于 `GET …/apps/<appId>/versions` 的 `items` 数，每行显示版本号/状态/提交者/更新时间；状态为 `draft` 的行提供「提交审核」，`submitted` 提供「撤销提交」，`passed` 提供「发布」，`active`/`suspended` 提供下架/重新上架；点击后调用 `POST …/versions/<versionId>/action` 并回读新状态；「应用实例」页签按 app 过滤列出该模板的 release（来自 `/workspaces/<ws>/applications`），空态有说明；「基本信息」页签显示状态/版本类型/最新版本/分类/创建者/首页/创建与更新时间。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-04** — 当模板还有版本时点「删除模板」，则确认框说明「请先删除版本」且确认按钮禁用、不发请求；删除某个可删版本（draft/rejected/passed/suspended）后该版本从接口与列表消失；版本清空后删除模板成功并回到列表。

## 设计目标

1. 模板的完整写链路（上传/创建/版本状态机/删除）在页面上可达，且失败原因来自服务端。
2. 列表列语义与老 console 对齐（名称/状态/最新版本/更新时间），并保留版本类型这一真实字段。
3. 模板详情复用商店的安装弹窗：安装目标与参数完全一致，不出现第二套向导。

## 约束与边界

- 集合：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/apps`（`limit=-1`）、`…/apps/<appId>`、`…/apps/<appId>/versions`。
- 上传：`POST …/apps?validate=true` body `{version_type:"helm",version_package:<base64>}` → `{name,version_name,description}`；
  `POST …/apps` body `{name,version_type:"helm",version_package,description?}` → `{app_id,version_id}`。
- 版本动作：`POST …/apps/<appId>/versions/<versionId>/action` body `{action:"submit|cancel|release|suspend|recover"}`。
- 删除：版本 `DELETE …/versions/<versionId>`；模板 `DELETE …/apps/<appId>`（有版本时 500 `app … has some versions not deleted`）。
- 安装：与商店一致，项目作用域 `POST …/namespaces/<ns>/applications`，`conf` 为 YAML 字符串。

## UI 交互设计

- 列表：标题「仓库应用」+ 说明 + 刷新 + 主按钮「上传模板」；列：名称（次行描述）/ 状态 / 最新版本 / 版本类型 / 更新时间 / 创建时间。
- 详情：返回入口 → 头部（名称 + 状态徽标 + 描述 + 安装 + 删除模板）→ 页签（版本 / 应用实例 / 基本信息）。
- 上传弹窗：模板名称 + chart 包选择（.tgz/.tar.gz，≤2 MiB）+ 解析结果提示 + 取消/确认。
- 句柄：`workspace-apps:surface`、`workspace-apps:table`、`workspace-apps:refresh`、`workspace-apps:create`、`workspace-apps:create:name`、`workspace-apps:create:file`、`workspace-apps:create:submit`、`workspace-apps:create:parsed`、`workspace-apps:create:error`、`workspace-apps:name:<id>`、`workspace-app:surface`、`workspace-app:name`、`workspace-app:install`、`workspace-app:delete`、`workspace-app:tab:{versions,instances,info}`、`workspace-app-version:transition`、`workspace-app-version:delete`、`workspace-app-version:delete:confirm`、`workspace-app:delete:confirm`、`workspace-app:delete-blocked`。

## 文案与校验

- 标题/说明沿用 `appRepos.apps.*`；主按钮「上传模板」；空态「该租户(企业空间)还没有应用 / 仓库同步索引后，应用会出现在这里」。
- 上传弹窗：说明「选择 .tgz / .tar.gz 的 Helm chart 包；服务端会解析出模板名与版本号」；文件提示「仅支持 .tgz / .tar.gz，最大 2 MiB」；解析成功「已解析：{name} / 版本 {version}」。
- 版本动作文案：提交审核 / 重新提交审核 / 撤销提交 / 发布 / 下架 / 重新上架；失败「操作失败：{reason}」。
- 删除模板：「将删除模板 {{name}} 及其全部版本；已安装的实例不受影响」；有版本时「该模板还有版本，请先删除版本」。

## 边界情况

- 版本为 0：安装按钮禁用；版本页签显示「这个模板还没有版本」。
- 状态为 `rejected`：提供「重新提交审核」。
- 状态不在映射内：不显示动作，徽标显示原值。
- chart 包非法（非 tgz / 超限）：客户端拦截并提示，不发请求。
- 服务端解析失败（chart 缺 Chart.yaml 等）：显示服务端原因，不创建。
- 删除模板被服务端拒绝（仍有版本）：确认按钮禁用 + 说明；若绕过则显示服务端原因。
- 上传后列表未刷新：`invalidateQueries` 重取，不靠本地插入。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01** — 列表：行数与接口一致、列语义、刷新、权限门控。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02** — 上传创建：validate → create，客户端校验与服务端原因。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-03** — 详情三页签 + 版本状态机动作 + 安装入口 + 实例页签。
- **FR-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-04** — 版本删除与模板删除（先版本后模板）。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01** — 一次真实上传：`GET /workspaces/<ws>/apps` 回读出现该模板；详情版本状态可从 draft 变 submitted 再回 draft；清理后接口 0 条。
- **SC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02** — 详情安装提交后 `/workspaces/<ws>/applications` 出现该 release，实例页签可见，卸载后消失。

## 明确不做

- **应用信息与审核记录页签的完整表单**：老 console 的 App Information 页签可编辑图标/截图/分类，审核记录页签列出逐版本审核历史；本部署的 `/reviews` 不按 app 过滤（实测），且没有可靠的截图数据源，本单元只交付「基本信息」只读页签，编辑图标/截图/分类登记为后续批次。
- **版本 YAML 编辑与 Chart 文件预览**：老 console 的版本行展开有 Chart 文件与 Readme 编辑；本单元不在模板详情内提供（商店详情已提供 README 只读预览）。
- **按仓库过滤应用**：`repo_id` 被服务端忽略（实测），且应用对象没有 `repo_id` 字段，见 `workspace-repos.md` 的 DEC。

## 假设

- openpitrix 的 workspace apps 集合可读可写（实测 create/validate/versions/action/delete 全部 200）。
- 上传的 chart 包为 `.tgz`/`.tar.gz` 且 ≤2 MiB（老 console 的 `UPLOAD_CHECK_RULES`）。
- 版本状态机与老 console 的 `configs/openpitrix/version.js` 一致（draft/submitted/rejected/in-review/passed/active/suspended）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01`
- `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02`
