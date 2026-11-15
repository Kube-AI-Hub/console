# TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02 企业空间应用模板 · 上传、版本状态机与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `workspace-apps`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/public/apps`
- **需求**: `prd/kube-frontend/app-store/workspace-apps.md`

## 产品功能

上传 Helm chart 建立模板、推进版本状态机（draft→submitted→draft）、删除版本与模板。

### 关联需求

- `prd/kube-frontend/app-store/workspace-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/workspace-apps.md`](../../../../prd/kube-frontend/app-store/workspace-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02** — 当在列表点「上传模板」，选择唯一名称与一个 .tgz/.tar.gz 的 Helm chart 并提交，则先以 `version_type=helm`+`version_package`(base64) 调用 `?validate=true` 解析出模板名与版本，再 `POST /workspaces/<ws>/apps` 创建；成功后列表出现该模板且 `GET /workspaces/<ws>/apps` 回读一致；非法扩展名/超过 2 MiB 在客户端拦截且不发请求；服务端拒绝时显示服务端原因且不新增行。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-03** — 当打开模板详情 `…/apps/<appId>`，则「版本」页签行数等于 `GET …/apps/<appId>/versions` 的 `items` 数，每行显示版本号/状态/提交者/更新时间；状态为 `draft` 的行提供「提交审核」，`submitted` 提供「撤销提交」，`passed` 提供「发布」，`active`/`suspended` 提供下架/重新上架；点击后调用 `POST …/versions/<versionId>/action` 并回读新状态；「应用实例」页签按 app 过滤列出该模板的 release（来自 `/workspaces/<ws>/applications`），空态有说明；「基本信息」页签显示状态/版本类型/最新版本/分类/创建者/首页/创建与更新时间。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-04** — 当模板还有版本时点「删除模板」，则确认框说明「请先删除版本」且确认按钮禁用、不发请求；删除某个可删版本（draft/rejected/passed/suspended）后该版本从接口与列表消失；版本清空后删除模板成功并回到列表。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/workspace-apps.md`](../../../../design/kube-frontend/app-store/workspace-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/workspace-apps.md`](../../../../prd/kube-frontend/app-store/workspace-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 上传一个 Helm 模板并管理它的版本 (Priority: P1)

作为 **企业空间开发者**，我希望 **上传 Helm chart 建立模板、查看版本状态并推进审核/发布**，以便 **把自研应用放进企业空间供项目安装**。
进入详情看到版本页签里有该版本，状态为 `draft`；点提交审核后状态变为 `submitted`，撤销后回到 `draft`。

**Independent Test**：在应用列表点「上传模板」，选择 .tgz 后提交，列表出现该模板（名称/状态/最新版本）；

### US2 - 从模板详情安装到项目并查看实例 (Priority: P1)

作为 **企业空间用户**，我希望 **从模板详情直接安装到某个项目，并看到该模板的安装实例**，以便 **不离开企业空间控制台就完成部署与回读**。
再点实例行进入已安装应用详情。

**Independent Test**：模板详情点「安装」，选择企业空间/项目/版本/名称并提交；实例页签出现该 release；

## 前置与配置

- admin 可写工作空间模板；用例自建唯一名称模板并在 finally 清理（先删版本再删模板）
- chart 包来源：从 GET …/apps/<appId>/versions/<versionId>/package 取现成 base64 包

## 测试步骤

1. 打开应用列表，点「上传模板」
2. 填写唯一模板名，选择一个 .tgz chart 包，提交
3. 回读 GET /workspaces/<ws>/apps 确认出现该模板
4. 打开模板详情，核对版本页签行数与 GET …/versions 一致
5. 点「提交审核」，回读版本状态为 submitted；再点「撤销提交」，回读为 draft
6. 打开「应用实例」页签，核对与 /workspaces/<ws>/applications 按 app 过滤后一致
7. 删除版本，回读 versions 为 0；再删除模板，回读 apps 不再包含它

## 期望结果

- 上传前先发 POST …/apps?validate=true，再发 POST …/apps；成功后列表出现该模板
- 版本状态从 draft 变 submitted 再回 draft（POST …/versions/<id>/action）
- 有版本时删除模板的确认按钮 disabled，并显示「该模板还有版本，请先删除版本」
- 删除版本后 versions total=0；删除模板后 apps 回读 0 条

## 失败排查

- 创建 400：包字段名写错（创建用 version_package，新增版本用 package）
- 删除模板 500 app … has some versions not deleted：先删版本
- 上传后列表未更新：靠 invalidateQueries 重取，不靠本地插入

## 产品改版后如何更新自动化

- 句柄：workspace-apps:create / :create:name / :create:file / :create:submit；workspace-app:tab:{versions,instances,info}；workspace-app-version:transition / :delete / :delete:confirm；workspace-app:delete:confirm
