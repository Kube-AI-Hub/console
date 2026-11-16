# 应用详情（L3）

[子模块需求](./_index.md)

## 概述

商店列表的每张应用卡片进入本页：应用名、图标、分类、简介、基本信息、版本列表、Chart 的 README，以及一个可用的安装入口。只读内容来自 openpitrix 的三个端点（应用详情、版本列表、chart 文件）；安装入口**只读地**打开安装弹窗（企业空间/项目/版本/名称），提交时才写：`POST /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications` 创建项目里的 openpitrix release。

实测（2026-11-15，组件开启后）：/kapis/openpitrix.io/v1/apps 共 30 个应用、7 个分类；应用详情返回 app_id/name/description/category_set/home/isv/status/latest_app_version（图标只在 latest_app_version.icon）；版本列表返回 {items,total_count}，每个版本有 version_id/name/status/create_time，但**没有**版本类型字段；类型来自应用的 app_version_types（当前全部为 helm）；/apps/<id>/versions/<version_id>/files 返回 {files:{路径: base64}}，README.md 在其中。

安装写路径实测（2026-11-15）：创建只能走**项目级**路由（`/workspaces/<ws>/namespaces/<ns>/applications` 或带 `/clusters/<cluster>` 的变体），workspace 级没有创建路由（GET `/workspaces/<ws>/applications` 只读、跨项目汇总）；请求体为旧 console 的 deploy 体（app_id/version_id/name/description）；200 表示 release 对象已创建，chart 的最终状态是异步的（探针用的 memcached 因 chart 要求 policy/v1beta1 的 PDB 而最终 failed，release 行仍如实出现在列表里）；删除必须用 release 对象 id（列表里的 cluster.cluster_id），按 release 名删除返回 200 但不删任何东西。

## 用户故事

### US1 - 判断这个应用是否值得安装 (Priority: P1)

作为 **平台用户**，我希望 **从应用卡片进入详情，看到应用的分类、简介、版本历史和 README**，以便 **在安装之前判断它的用途、当前可用的版本，以及安装它需要什么**。

**Independent Test**：从 /kube-frontend/apps 点击一张卡片，详情页出现应用名与分类；版本表行数等于 /apps/<id>/versions 的 items 数；展开 Readme 后出现该版本 README.md 的文本；安装按钮可用，打开弹窗后取消不产生写请求。

### US2 - 从详情把应用安装到企业空间的项目 (Priority: P1)

作为 **企业空间用户**，我希望 **在详情里选择企业空间、项目、版本与安装名称，然后提交安装**，以便 **不用切换旧控制台就能把商店应用装进项目并看到结果**。

**Independent Test**：打开任一应用详情，点安装，选择企业空间与项目、版本，填写名称并提交；确认接口返回成功、弹窗显示安装已提交与查看入口；再次提交同名会得到「同名」提示；失败（如版本不存在/权限不足）时弹窗显示服务端原因。

### US3 - 安装时按 chart 默认值调整配置 (Priority: P1)

作为 **平台用户**，我希望 **在安装弹窗里看到并修改该版本的 values.yaml 再提交**，以便 **不必先装一遍再用别的方式改配置**。

**Independent Test**：打开任一应用详情的安装弹窗，配置框已预填该版本 chart 的 values.yaml；修改一个键后提交，
release 的 `spec.values` 解码后与提交内容一致；点「恢复默认」回到 chart 原值；留空提交则 `spec.values` 为空（使用 chart 默认值）。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01** — 已知商店里有应用，当在 /kube-frontend/apps 点击一张应用卡片，则进入 /kube-frontend/apps/<appId>，页面显示应用名、图标或首字母占位、分类、简介；版本表逐行显示版本号、类型（取自应用的 app_version_types，因为版本对象没有 type 字段）、创建时间与状态，行数等于版本接口的 items 数；Readme 默认折叠，展开后显示该版本 README.md 解码后的纯文本（没有 README 时回退到应用描述）；安装按钮可点并打开安装弹窗（打开与取消都不发写请求）；当 appId 不存在或应用已下架，则显示「应用不存在」的空状态与返回入口，而不是空白或重试按钮。
- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01** — 已知商店里有带版本的应用、且目标企业空间有项目，当在详情点安装，则弹窗提供企业空间（tenant workspaces）、项目（该空间的命名空间）、版本（该应用的版本）、安装名称与 values 配置；提交合法值时向 `/kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications` 发送 `{app_id, version_id, name, conf}`（`conf` 为 **YAML 字符串**），成功后弹窗显示「已提交安装：<name>」与跳转该企业空间已安装应用列表的入口；提交同名（项目内已有该 release 名）时不发请求并提示「该项目内已有同名安装」；服务端失败时弹窗显示服务端原因（错误文案，不伪造成功）；名称为空/非法、项目或版本缺失时不发请求并提示对应字段。
- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-03** — 已知安装弹窗可切换企业空间，当把企业空间从 A 改为 B，则项目选择立即清空并重新填入 B 的项目列表首项（不会保留 A 的项目）；当 B 没有任何项目时项目选择为空且提交被本地拦截并提示「请选择项目。」，不发出创建请求；当选中的项目不在当前企业空间的项目列表里（例如列表刷新后被移除），同样回落到列表首项而不是带着一个不可安装的组合提交。
- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02** — 已知某版本 chart 带 values.yaml，当打开安装弹窗，则 values 编辑框预填该文件内容（`GET …/versions/<versionId>/files` 的 `values.yaml` 解码）；点「恢复默认」把编辑框还原为该文件内容；清空编辑框后提交，请求体不含 `conf`（使用 chart 默认值）；修改后提交，请求体的 `conf` 是编辑框里的 YAML 文本（不是对象）；读取 values.yaml 失败时提示「读取 values.yaml 失败，可手工填写或留空使用默认值」但仍可提交；切换版本后编辑框回到新版本的 values.yaml（不保留上一个版本的编辑）。
- **AC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-02** — 已知应用有多个已发布版本，当在 Readme 区切换版本，则 Readme 文本随之切换为该版本的 README.md（`GET …/versions/<versionId>/files`），提示文案里的版本号同步更新；只有 1 个版本时不显示版本选择器；应用对象没有 `keywords` 字段时（本部署实测）不渲染关键词行，有该字段时按 `/` 连接展示。

## 设计目标

1. 一个详情页回答「这是什么、有哪些版本、怎么用（README）」。
2. 详情本身保持只读；安装是唯一写入口，且只有用户在弹窗里显式提交才写。
3. 字段与 API 一致：版本类型这类版本对象没有的字段不伪造；安装结果如实显示服务端原因。

## 约束与边界

- 只读端点：GET /kapis/openpitrix.io/v1/apps/<appId>、GET .../apps/<appId>/versions、GET .../apps/<appId>/versions/<versionId>/files；另有 GET tenant workspaces 与 GET 某工作空间的 namespaces 为安装弹窗提供选项。
- 安装写端点（唯一）：POST /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications，body 为 {app_id, version_id, name, description?}；返回 {message:"success"}。
- 创建必须在**项目**里：openpitrix 的 handler 把 release 创建成项目命名空间内的 HelmRelease；workspace 级只有只读的汇总列表，没有创建路由（实测 workspace 级 POST 无对应路由；项目级空 body 的 POST 返回 helmapplicationversion not found，说明路由与校验顺序）。
- 同名判定在客户端：提交前读该项目现有 applications，release 名相同则提示并不发请求（服务端对重复的名字返回不透明的错误）。
- 异步语义：200 表示 release 对象已创建，不代表 chart 已成功；探针安装的 memcached release 因 chart 的 PodDisruptionBudget 使用 policy/v1beta1 而最终 failed，页面因此只说「已提交安装」。
- 删除按 release id：本项目/本任务的清理路径是 DELETE /workspaces/<ws>/namespaces/<ns>/applications/<cluster_id>；按名字删会 200 但不生效。
- 图标来自 latest_app_version.icon；部分应用没有图标（实测 30 个中 8 个），显示名称首字母占位而不是坏图。
- 版本类型取自应用的 app_version_types；版本接口没有 type 字段，页面不为每行编造。
- README 在 files 响应的 files["README.md"] 里，是 base64；页面解码为纯文本展示。新 UI 没有 Markdown 渲染依赖，不为了一个 README 引入新库。
- 应用不存在（404）是确定结果：页面显示空状态，不做自动重试；其他错误显示错误面板与重试。

## UI 交互设计

- 列表：每张卡片整体是链接，句柄 app-store:card:<appId>，点击进入详情。
- 详情：返回应用商店 → 头部（图标/首字母、名称、状态徽章、简介、分类徽章、安装按钮）→ 基本信息（分类/应用类型/应用 ID/发布时间/首页/维护者/源码）→ 版本列表（版本号/类型/创建时间/状态）→ Readme（折叠 + 展开/收起）。
- 安装弹窗：企业空间下拉（tenant workspaces）→ 项目下拉（随企业空间刷新）→ 版本下拉（默认最新版本）→ 安装名称（默认 `<应用名>-<随机后缀>`）→ 取消/确认；成功后同一弹窗显示「已提交安装：<name>」+ 查看企业空间应用入口。
- 句柄：app-detail:surface、app-detail:back、app-detail:name、app-detail:icon、app-detail:versions、app-detail:version:<version_id>、app-detail:readme、app-detail:readme-toggle、app-detail:readme-empty、app-detail:install、app-detail:install-dialog、app-detail:install-workspace、app-detail:install-project、app-detail:install-version、app-detail:install-name、app-detail:install-submit、app-detail:install-cancel、app-detail:install-success、app-detail:install-success-link、app-detail:install-error、app-detail:not-found、app-detail:retry。

## 文案与校验

- 版本数提示「共 {count} 个版本」；空版本「这个应用还没有发布版本。」
- Readme 提示「来自版本 {version} 的 README.md，按纯文本展示。」；无内容「这个版本没有 README.md，也没有应用描述。」
- 无简介「没有应用简介。」；未找到「应用不存在 / 这个应用可能已从商店下架，或链接里的应用 ID 有误。」
- 安装按钮「安装」，旁注「选择企业空间、项目与版本；安装为异步操作。」；弹窗标题「安装应用」，说明「把该应用的一个版本安装到所选企业空间的项目里，生成一个 release。」
- 弹窗字段：企业空间/项目/版本/安装名称；名称提示「小写字母、数字与连字符，最长 32 个字符；同一项目内不能重名。」；空项目「该企业空间没有可安装的项目。」；空版本「这个应用没有可用版本。」
- 成功「已提交安装：{name}」+「安装是异步的：release 已创建，chart 的最终状态以项目应用列表为准。」+「查看企业空间应用」；错误提示按字段/服务端原因显示。

## 边界情况

- 应用没有图标：显示名称首字母，不渲染空 img。
- 应用没有版本：安装按钮禁用；版本区显示空文案，Readme 区显示描述或空文案。
- 版本没有 README.md：Readme 展开后回退到应用描述；两者都没有才显示空文案。
- Readme 很长：容器最大高度滚动，不撑破页面。
- 应用状态不是 active（例如 suspended）：状态徽章按原值显示，不改变可读性。
- appId 不存在：一次请求后进入 not-found，不展示重试按钮。
- 列表缓存里已下架、直接打开详情 URL：同上 not-found。
- 企业空间没有项目：项目下拉禁用并显示「该企业空间没有可安装的项目。」，不能提交。
- 名称非法/为空/超长：不发请求，提示「名称只能包含小写字母、数字与连字符，最长 32 个字符。」
- 同名安装：不发请求，提示「该项目内已有同名安装。」
- 服务端拒绝（版本失效、权限不足等）：弹窗显示服务端原因；不关弹窗、不伪造成功。
- 安装后 chart 失败：弹窗只声称「已提交安装」；release 的真实状态由项目应用列表承载（本轮无该页面）。

## 明确不做

- **安装 values 的结构化表单（values.schema.json 驱动的表单视图）**：老 console 在 chart 带 `values.schema.json` 时提供「表单 / YAML」切换。
  本商店 30 个应用的版本里**没有任何一个带 values.schema.json**（实测：逐版本 files 只有 Chart.yaml/values.yaml/templates/README.md 等），
  表单视图没有可验证的真实样本，本单元只交付 YAML 编辑（老 console 在无 schema 时也是 YAML 编辑）。样本出现后重开。
- **安装协议确认（AppAgreement）与高级参数（Placement/调度）**：老 console 对 `isv=system-workspace` 的应用先弹协议确认；
  本单元未实现协议弹窗（无协议文本数据源），安装直接进配置；调度与集群选择沿用「项目所在集群」的默认。
- **应用实例列表**：老 console 项目里有「应用实例」页签；新 UI 暂无该页面，release 列表以接口为准（用例直接查接口）。
- **审核/上架/编辑应用**：商店管理页的职责，不在详情。
- **Markdown 渲染与截图轮播**：README 以纯文本展示；截图字段本轮没有可靠数据源，不伪造。
- **工作空间级安装**：openpitrix 没有 workspace 级创建路由，安装目标必须是项目；弹窗因此包含项目选择。
- **卸载/升级入口**：本任务只创建 release；卸载是测试的清理手段，不是页面功能。

## 假设

- openpitrix 模块开启，只读端点均 200（实测）；安装端点对非法 body 返回校验错误（实测）。
- appId 由列表返回的 app_id 直接构成详情 URL，不需要额外编码语义（页面仍 encodeURIComponent）。
- 版本对象没有 type 字段，版本类型由应用级 app_version_types 表达。
- README 文件以 base64 出现在 files 映射里，路径固定为 README.md。
- tenant workspaces（2 个）与 workspace 的 projects（如 public 下 spaces/csghub）可读，安装目标从中选择。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01** — 列表卡片可进入详情；详情加载应用与版本，并显示名称/图标或占位/分类/简介。
- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-02** — 版本表行数等于版本接口 items 数，列含版本号、类型、创建时间、状态。
- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-03** — Readme 默认折叠，展开后显示解码后的 README.md 纯文本，缺失时回退描述/空文案。
- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-04** — 安装入口可点并打开弹窗；打开/取消不产生任何写请求。
- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-05** — appId 不存在显示 not-found 与返回入口；其他错误显示错误面板与重试。
- **FR-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01** — 安装弹窗提供企业空间/项目/版本/名称，提交时只调用项目级 applications 创建端点，成功显示已提交与跳转入口，失败显示服务端原因。
- **FR-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02** — 项目内同名 release 阻止提交；删除/清理按 release id。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01** — 从列表点击进入详情，应用名/分类/版本行数与接口一致；Readme 展开后有文本；安装按钮可点且取消不写；未知 appId 进入 not-found。
- **SC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01** — 提交一次真实安装：接口 200，该项目 applications 列表出现该 release 行；同名第二次被客户端拦截；清理后列表无残留（finally 删除）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01`
- `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02`
