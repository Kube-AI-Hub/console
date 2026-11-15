# 已安装应用 · 技术方案（L3）

## 概述

企业空间已安装应用（HelmRelease）的列表与详情，以及卸载。列表来自 openpitrix 的跨项目汇总只读集合，
详情与 YAML 来自 `application.kubesphere.io/v1alpha1` 的 `helmreleases`，资源按标签选择器读 kapis 资源代理，
事件读 kube events 集合。写入只有卸载一处（项目作用域 DELETE）。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01`
- `AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02`
- `AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-03`

## 设计目标与非目标

目标：安装结果可回读（列表行数与接口一致）、详情五页签取真实数据、卸载走对象 id 且失败不伪造成功。

非目标：项目作用域「应用」页、升级/回滚、CRD 应用、watch 实时刷新。

## 关键约束

- **数据源只有汇总只读集合**：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/applications` 返回 `{items,total_count}`；
  实测**忽略 `keyword`**（带与不带返回相同），也没有 `page/limit` 语义上的分页承诺。
- **helmreleases 是集群级对象**：`/apis/application.kubesphere.io/v1alpha1/helmreleases/<rls-id>` 可直读；
  `/apis/…/namespaces/<ns>/helmreleases` 返回 404（实测），所以不能按命名空间寻址。
- **删除必须用对象 id**：`DELETE …/applications/<cluster_id>`（`rls-…`）；按 release 名删除返回 200 但不删任何东西（实测）。
- 资源与事件都是命名空间级读取，release 的 `zone`（项目）与 `runtime_id`（集群）来自汇总行。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01 — 用企业空间汇总承接「已安装应用」回读

- 背景：安装写路径是项目级（`…/namespaces/<ns>/applications`），但新 UI 没有项目作用域的「应用」页。
- 决定：以 `/kube-frontend/workspaces/<ws>/apps/instances` 作为企业空间级回读入口，安装成功面板直接链到它。
- 被否方案：新增项目作用域 `…/projects/<ns>/applications` 页。否决理由：项目作用域路由与页面属于另一迁移单元，
  且汇总接口已能回答「装上了没有」，项目级页面属于后续批次（已在「明确不做」登记）。
- 何时重新考虑：项目作用域应用页进入迁移范围时，本页保留为跨项目视图，两者用同一 API 模块。

### DEC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02 — 不画分页器，筛选在页内完成

- 背景：汇总接口忽略 `keyword`，且没有可靠的服务端分页契约。
- 决定：一次 `limit=-1` 取全量，搜索框在页内过滤 release 名/应用名/项目/版本，并在页脚写明数据源限制。
- 被否方案：给汇总接口传 `page/limit` 并渲染分页器。否决理由：服务端不承诺分页语义，页码会变成死控件，
  与「不造分页器」的通用约定冲突（能力矩阵 CHECK-08）。
- 何时重新考虑：后端提供带 `total`/`keyword` 的正式分页时，改为服务端分页。

### DEC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-03 — 卸载用对象 id，且只提供卸载

- 决定：卸载调用项目作用域 DELETE，路径里的 id 取 `cluster.cluster_id`（`rls-…`）。
- 被否方案：按 release 名删除。否决理由：实测 200 但对象仍在，属于静默失败。
- 升级/回滚：不提供。openpitrix 没有 release 升级路由；app 级 action 对 draft 返回 `500 action not support`（实测），
  release 级也没有 upgrade handler。页面在基本信息页签写明原因，避免读者以为漏做。

## 系统现状

- 老 console：项目作用域 `/projects/<ns>/applications/template`（列表 + 创建向导）与 release 详情三页签
  （资源状态 / 应用模板 / 应用设置），另有 `InstanceList` 组件（按 app/version 过滤、集群选择、搜索、分页）。
- 新 UI：本单元之前没有任何已安装应用页面；安装成功面板只提示「以项目应用列表为准」。

## 仓库落点

- `kube-frontend/packages/api-client/src/appstore.ts`：`installedReleasesApi`（list/get/remove/resources）、
  `toInstalledRelease`、`toHelmRelease`、`decodeHelmValues`。
- `kube-frontend/apps/console-next/src/pages/appstore/InstalledAppsPage.tsx`、`InstalledAppDetailPage.tsx`。
- 路由：`routes/kube-frontend.workspaces.$workspace/apps/instances/{index,$releaseId}.tsx`。
- 侧栏：`src/areas/registry.ts` 的 `app-repos` 区域新增 `apps/instances` 页。

## 对外契约

### CON-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01 — 跨项目汇总集合

`GET /kapis/openpitrix.io/v1/workspaces/<ws>/applications` → `{items,total_count}`；每项
`cluster{name,cluster_id,app_id,version_id,status,zone,runtime_id,owner,create_time,status_time}`、
`app{app_id,name}`、`version{name,version_id}`。只读；`keyword` 被忽略（实测）。

### CON-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02 — HelmRelease 对象

`GET /apis/application.kubesphere.io/v1alpha1/helmreleases/<rls-id>` → `spec{appId,appVerId,chartName,chartVersion,chartAppVer,repoId,name,values(base64),version}`、
`status{state,lastUpdate,deployStatus[{state,deployTime}]}`；`metadata.labels` 含
`application.kubesphere.io/app-id|app-version-id|repo-id`、`kubesphere.io/namespace|workspace`。

### CON-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-03 — 卸载

`DELETE /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications/<cluster_id>` → `{message:"success"}`；
200 后对象从汇总集合消失（实测：删除后 total 0、helmreleases 0 条）。

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01** — 列表行数恒等于同一时刻 `/workspaces/<ws>/applications` 的 `items` 数（无页内截断）。
- **INV-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02** — 卸载请求路径最后一段恒为 `rls-…` 对象 id，不是 release 名。
- **INV-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-03** — 详情页在 helmrelease 对象缺失时仍渲染汇总行（不整页报错）。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01** — 按 release 名删除返回 200 但不生效。表现为「点了卸载、提示成功、列表里还在」。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02** — `helmreleases` 集群级：`/apis/…/namespaces/<ns>/helmreleases` 是 404，别按命名空间拼路径。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-03** — `spec.values` 是 base64 的 YAML；直接当对象读会得到乱码，必须解码后再展示。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-04** — 卸载进行中时 helmrelease 可能已消失而汇总行仍在；详情页因此把 CRD 读取失败降级为「无额外详情」，而不是错误页。

## 测试与可观测

- 契约/单测：`toInstalledRelease` / `toHelmRelease` / `decodeHelmValues` 的映射（api-client 测试）。
- E2E：`TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01`（列表行数与接口一致、页内搜索、无分页器）、
  `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02`（真实安装 → 详情页签取值 → 卸载 → 回读清理）。
- 句柄见 PRD「UI 交互设计」；`data-ai-row` 为 release id。

## 后续改进

- 项目作用域应用页与升级/回滚：见「明确不做」，随项目作用域批次或后端提供 upgrade 路由时重开。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01`
- `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02`
