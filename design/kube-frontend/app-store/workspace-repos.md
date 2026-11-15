# 企业空间应用仓库 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/app-store/workspace-repos.md)

## 概述

`/kube-frontend/workspaces/<ws>/repos`（列表）、`…/repos/<repoId>`（详情：基本信息 + 事件）与
`…/apps`（应用模板，见 `workspace-apps.md`）。仓库是可写的：新增/编辑/删除/同步索引全部走
`/kapis/openpitrix.io/v1/workspaces/<ws>/repos`。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01
- AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02
- AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03
- AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04
- AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-05
- AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-06
- AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-07

## 设计目标与非目标

目标：两个入口可达、行数与 openpitrix 工作空间集合一致、空态/失败态明确；仓库的增改删与索引同步可用且失败原因来自服务端；
仓库详情能区分「还没同步/同步成功/同步失败」。

非目标：应用部署（见 `installed-apps.md`）、按仓库过滤应用（接口不支持，DEC-02）、凭证加密（PRD「明确不做」）。

## 关键约束

- 工作空间仓库：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos`（实测 200，`items[].repo_id/name/url/status/create_time/creator/credential/sync_period/status_time`，`total_count`）。
- 工作空间应用：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/apps`（实测 200，`items[].app_id/name/description/app_version_types/status/create_time/latest_app_version`）。
- 写入：`POST …/repos`（创建，body `{name,url,description?,credential?,sync_period?,app_default_status}`）、`PATCH …/repos/<id>`、`DELETE …/repos/<id>`、`POST …/repos/<id>/action {action:"index"}`、`GET …/repos/<id>/events`、`POST …/repos?validate=true`。
- 底层对象是**集群级** `HelmRepo`（`application.kubesphere.io/v1alpha1`，`namespaced=false`，靠 `kubesphere.io/workspace` 标签关联）；
  `/apis/application.kubesphere.io/v1alpha1/namespaces/<ws>/helmrepos` 实测 404。
- 两个页面都在 workspace 作用域，URL 由 workspace 控制台侧栏生成。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01 — 页面内直连 openpitrix 工作空间集合，不扩 api-client（**已被 DEC-04 取代**）

**当时的理由**：`packages/api-client/src/appstore.ts` 面向平台商店（`/apps|categories|reviews`），工作空间集合是另一前缀；
只有两个页面读它，直接在页面内请求可以把改动面压到最小。

**为什么后来判断错了**：本单元新增了仓库的增改删/索引/事件与模板版本状态机，页面内 `request()` 调用从 2 处涨到 10+ 处，
映射逻辑（`repo_id`→id、`total_count`、`status_time` 零值）在页面里重复且无法单测；同时「第二个消费者」已经出现
（仓库详情、模板详情、安装弹窗都要读同一批集合）。保留原判断会让每个新入口再抄一份映射。

**保留原记录**：不删除上面的理由，避免下一个人再推翻一次；结论见 DEC-04。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04 — 工作空间仓库/模板收进 api-client

**为什么**：写入与映射需要单测（`toWorkspaceRepo`/`toRepoEvent`/`toAppTemplate`），而页面内请求既不能单测也无法复用；
仓库详情、模板详情、安装弹窗都要读同一批集合，复制三份必然漂移。
**被否方案**：继续页面内直连（DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01 的原方案）。否决理由见上。
**何时重新考虑**：不再考虑；契约变化只改 api-client 一处。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02 — 应用页不按仓库过滤

**为什么**：实测 `repo_id` 参数被服务端忽略——`/workspaces/system-workspace/apps?repo_id=builtin-stable` 与不带参数都返回 15 条，
`/apps?repo_id=` 返回全部 30 条；且应用对象没有 `repo_id` 字段。若仍按 repo 展示「该仓库的应用」，是拿一个未过滤的列表冒充过滤结果，比不做过滤更糟。
**被否方案**：客户端按 `repo_id` 过滤（对象上没有该字段）；或从 repo 详情推导应用集合（repo 详情不含应用列表）。
**何时重新考虑**：openpitrix 修正过滤或应用对象补充 repo 关联字段时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03 — 仓库类型如实显示 `-`

**为什么**：本部署的 repo 对象没有 `type`/`repo_type` 字段（实测 sample 只有 repo_id/name/url/status/create_time/creator/credential/sync_period/status_time）。
任务期望的「类型（helm 等）」不能从对象得出；硬编码 helm 是在没有依据时声称一个事实。
本单元改为：`credential` 含 `accessKeyID` 时显示 `s3`（这是唯一能从对象推断出的协议），其余显示 `-`。
**被否方案**：默认填 helm。否决理由：仓库对象未声明类型，接口变化时默认值会变成错误信息。
**何时重新考虑**：repo 对象补充 `type` 字段，或应用/仓库接口提供类型枚举。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-05 — 同步周期用老 console 的字符串语义与区间

**为什么**：老 console 的 `sync_period` 是 `"3600s"` 这类字符串，表单校验要求非 0 时落在 180s–86400s（`configs` 与 `AppRepoCreate/time.input`），
服务端原样存。页面沿用同一语义，避免出现「页面能存、控制器不认」的值。
**被否方案**：改成纯数字秒。否决理由：会与老 console 已写入的对象语义不一致，且服务端字段是带单位的字符串。
**何时重新考虑**：后端提供结构化字段（`syncPeriodSeconds`）时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-06 — 权限门控用 SSAR 且 fail-open

**为什么**：老 console 用 `authKey: 'app-repos'` 的模块权限表；新 UI 没有客户端权限模型，唯一真源是集群的授权判定。
用 `SelfSubjectAccessReview{verb:create, resource:helmrepos, group:application.kubesphere.io}` 问同一个问题，按钮状态与写入一致。
**fail-open 的理由**：权限探测失败（旧 BFF、网络抖动）不能变成「读者无权限」；只有明确 `allowed:false` 才隐藏写入入口并给出说明。
**被否方案**：前端硬编码角色名判断。否决理由：角色绑定是集群状态，硬编码会在换角色名后失效。
**何时重新考虑**：平台提供统一的权限上下文（登录响应里带可写区域）时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-07 — 详情页承载事件，而不是列表里的抽屉

**为什么**：老 console 的仓库详情是独立页（属性区 + 事件页签），事件有多行（每次索引一条），抽屉里放表格会挤在窄容器里；
且「最近同步时间」这个判断同步失败的关键字段在列表里放不下（窄屏要折叠）。
**被否方案**：行操作「事件」打开抽屉。否决理由：与详情页重复实现同一张表，且窄屏不可读。
**何时重新考虑**：事件需要与列表联动筛选时。

## 系统现状

老 console：`pages/workspaces/containers/Repos`（列表：名称/状态/URL；行操作 编辑/删除；表格操作 添加 + 批量「同步」；keyword 搜索；HelmRepo watch）
与 `Repos/Detail`（属性：创建时间/创建者；操作 编辑/删除；`events` 页签：创建时间/状态/消息）。
新 UI 本单元之前：只有只读列表（名称/地址/类型/状态/创建时间），无写入、无详情、无事件、无搜索、无创建者。

## 仓库落点

- api-client：`packages/api-client/src/appstore.ts` 的 `workspaceReposApi`（list/get/create/update/remove/index/events/validate）、`toWorkspaceRepo`、`toRepoEvent`。
- 页面：`apps/console-next/src/pages/appstore/WorkspaceReposPage.tsx`、`WorkspaceRepoDetailPage.tsx`。
- 路由：`apps/console-next/src/routes/kube-frontend.workspaces.$workspace/repos/{route,index}.tsx`、`repos/$repoId.tsx`。
- registry：`areas/registry.ts` 的 app-repos 区域。

## 对外契约

### CON-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01 — 仓库集合

`GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos` → `{items,total_count}`；项含
`repo_id,name,url,description,status,status_time,create_time,creator,credential,sync_period`。
`GET …/repos/<repoId>` 返回同一结构。

### CON-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02 — 仓库写入

`POST …/repos` body `{name,url,description?,credential?,sync_period?,app_default_status:"active"}` → `{repo_id}`；
`PATCH …/repos/<repoId>` body 为要改的字段子集 → `{message:"success"}`；
`DELETE …/repos/<repoId>` → `{message:"success"}`；
`POST …/repos/<repoId>/action` body `{action:"index"}` → `{message:"success"}`；
`GET …/repos/<repoId>/events` → `{items[{repo_id,create_time,status}],total_count}`。

### CON-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03 — 校验

`POST …/repos?validate=true` body 同创建；地址不可达时 400 且 body 是拉取 `index.yaml` 的失败原因
（实测空 body 时返回 `Get "/index.yaml": unsupported protocol scheme ""`）。

## 不变量

1. 仓库行数 = repos `items` 数（`limit=-1` 一次取全）。
2. 0 条显示空态，不显示空表头。
3. 缺失字段 `-`；不猜测仓库类型（除 credential 推出的 s3）、不声称应用与仓库的关联。
4. 写路径只用 `repo_id`；编辑是 PATCH 子集，不整对象替换（避免并发覆盖 `url`/`credential`）。
5. 权限被明确拒绝时，页面上不存在可触发的写控件（不是「点了才 403」）。

## 已知坑

- **repo_id 过滤是空操作**：带与不带参数返回同样结果（DEC-02）。
- **repo 对象没有 type**：不要按 URL 猜类型（DEC-03）。
- **`total_count` 而非 `totalItems`**：openpitrix 的分页字段名不同。
- **apps 的工作空间前缀**：`/kapis/openpitrix.io/v1/apps` 是平台商店全量（30），工作空间页必须带 `/workspaces/<ws>`（15）。
- **`status_time` 可能是零值**：新建仓库返回 `0001-01-01T00:00:00Z`（首次索引前），详情页显示 `-` 而不是 0001 年。
- **索引是异步的**：`action:index` 返回 200 只表示已触发；页面重新读取，状态由控制器回写。
- **helmrepos 是集群级**：按 `/namespaces/<ws>/helmrepos` 读会 404（实测），只能走 kapis 的 workspace 前缀。
- **中文键曾是英文**：`appRepos.repos.create/createTitle/createDescription/createRequired/removeTitle/removeDescription/removeFailed` 七条在 zh 字典里写的是英文，
  en 字典里写的是中文（反串）。本单元已互换，并纳入 AC-07 的双语断言。

## 测试与可观测

- 用例：`TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01`（列表/空态/表头）、`-02`（创建+移除）、`-03`（编辑/校验/同步索引/事件）、`-04`（权限门控 + 双语）。
- 可观测点：`workspace-repos:surface|table|refresh|search|create|create:name|create:url|create:protocol|create:sync-period|create:description|create:submit|create:error|edit|index|delete|delete:confirm|name:<id>`；
  详情 `workspace-repo-detail:surface|name|tab:info|tab:events|events|retry`；行 `data-ai-row` = repo_id。

## 后续改进

- 仓库凭证加密存储（当前明文 JSON）。
- 若 openpitrix 补上 repo↔app 关联，增加按仓库过滤的应用视图（DEC-02）。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01
- TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02
- TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03
- TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04
