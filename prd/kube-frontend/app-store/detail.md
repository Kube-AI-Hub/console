# 应用详情（L3）

[子模块需求](./_index.md)

## 概述

商店列表的每张应用卡片进入本页：应用名、图标、分类、简介、基本信息、版本列表、Chart 的 README，以及一个**禁用**的安装/部署入口。数据来自 openpitrix 的三个只读端点：应用详情、版本列表、某版本的 chart 文件（README.md 在 files 的 base64 里）。

实测（2026-11-15，组件开启后）：/kapis/openpitrix.io/v1/apps 共 30 个应用、7 个分类（接口另有空分类时以接口为准）；应用详情返回 app_id/name/description/category_set/home/isv/status/latest_app_version（图标只在 latest_app_version.icon）；版本列表返回 {items,total_count}，每个版本有 version_id/name/status/create_time，但**没有**版本类型字段；类型来自应用的 app_version_types（当前全部为 helm）；/apps/<id>/versions/<version_id>/files 返回 {files:{路径: base64}}，README.md 在其中。

## 用户故事

### US1 - 判断这个应用是否值得安装 (Priority: P1)

作为 **平台用户**，我希望 **从应用卡片进入详情，看到应用的分类、简介、版本历史和 README**，以便 **在安装之前判断它的用途、当前可用的版本，以及安装它需要什么**。

**Independent Test**：从 /kube-frontend/apps 点击一张卡片，详情页出现应用名与分类；版本表行数等于 /apps/<id>/versions 的 items 数；展开 Readme 后出现该版本 README.md 的文本；安装按钮禁用并给出原因。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01** — 已知商店里有应用，当在 /kube-frontend/apps 点击一张应用卡片，则进入 /kube-frontend/apps/<appId>，页面显示应用名、图标或首字母占位、分类、简介；版本表逐行显示版本号、类型（取自应用的 app_version_types，因为版本对象没有 type 字段）、创建时间与状态，行数等于版本接口的 items 数；Readme 默认折叠，展开后显示该版本 README.md 解码后的纯文本（没有 README 时回退到应用描述）；安装/部署按钮处于禁用状态并说明写操作下一轮开放，点击不发请求；当 appId 不存在或应用已下架，则显示「应用不存在」的空状态与返回入口，而不是空白或重试按钮；页面不提供任何写操作。

## 设计目标

1. 一个详情页回答「这是什么、有哪些版本、怎么用（README）」。
2. 只读：安装/部署不在本轮，入口明确禁用并解释，而不是隐藏或点了没反应。
3. 字段与 API 一致：版本类型这类版本对象没有的字段不伪造。

## 约束与边界

- 只读三个 kapis 端点：GET /kapis/openpitrix.io/v1/apps/<appId>、GET .../apps/<appId>/versions、GET .../apps/<appId>/versions/<versionId>/files。
- 图标来自 latest_app_version.icon；部分应用没有图标（实测 30 个中 8 个），显示名称首字母占位而不是坏图。
- 版本类型取自应用的 app_version_types；版本接口没有 type 字段，页面不为每行编造。
- README 在 files 响应的 files["README.md"] 里，是 base64；页面解码为纯文本展示。新 UI 没有 Markdown 渲染依赖，不为了一个 README 引入新库。
- Readme 默认折叠；展开时才把已加载内容放进 DOM，避免长文本把版本表推离首屏。
- 应用不存在（404）是确定结果：页面显示空状态，不做自动重试；其他错误显示错误面板与重试。
- 安装/部署按钮禁用：本轮不调用 openpitrix 写接口，也不依赖安装向导的协议与版本选择流程。

## UI 交互设计

- 列表：每张卡片整体是链接，句柄 app-store:card:<appId>，点击进入详情。
- 详情：返回应用商店 → 头部（图标/首字母、名称、状态徽章、简介、分类徽章、禁用的安装/部署按钮+原因）→ 基本信息（分类/应用类型/应用 ID/发布时间/首页/维护者/源码）→ 版本列表（版本号/类型/创建时间/状态）→ Readme（折叠 + 展开/收起）。
- 句柄：app-detail:surface、app-detail:back、app-detail:name、app-detail:icon、app-detail:versions、app-detail:version:<version_id>、app-detail:readme、app-detail:readme-toggle、app-detail:readme-empty、app-detail:install-disabled、app-detail:not-found、app-detail:retry。
- 无写操作；安装入口 hover 不出现新提示，原因写在按钮旁。

## 文案与校验

- 版本数提示「共 {count} 个版本」；空版本「这个应用还没有发布版本。」
- Readme 提示「来自版本 {version} 的 README.md，按纯文本展示。」；无内容「这个版本没有 README.md，也没有应用描述。」
- 无简介「没有应用简介。」；未找到「应用不存在 / 这个应用可能已从商店下架，或链接里的应用 ID 有误。」
- 安装禁用原因「安装与部署属于写操作，下一轮开放；本页只提供只读详情。」

## 边界情况

- 应用没有图标：显示名称首字母，不渲染空 img。
- 应用没有版本：版本区显示空文案，Readme 区显示描述或空文案。
- 版本没有 README.md：Readme 展开后回退到应用描述；两者都没有才显示空文案。
- Readme 很长：容器最大高度滚动，不撑破页面。
- 应用状态不是 active（例如 suspended）：状态徽章按原值显示，不改变可读性。
- appId 不存在：一次请求后进入 not-found，不展示重试按钮。
- 列表缓存里已下架、直接打开详情 URL：同上 not-found。

## 明确不做

- **安装 / 部署（/apps/:appId/deploy）**：写操作与安装向导（版本选择、values、协议）下一轮实现；本轮按钮禁用并说明。
- **应用实例列表**：老 console 详情有实例页签；实例属于部署后的运行时对象，随安装一起做。
- **审核/上架/编辑应用**：商店管理页的职责，不在详情。
- **Markdown 渲染与截图轮播**：README 以纯文本展示；截图字段本轮没有可靠数据源，不伪造。
- **版本切换 Readme**：默认展示最新版本 README；按版本切换随安装向导一起做。
- **任何写接口**：详情页不调用 openpitrix 的 POST/PUT/DELETE。

## 假设

- openpitrix 模块开启，三个端点均 200（实测）。
- appId 由列表返回的 app_id 直接构成详情 URL，不需要额外编码语义（页面仍 encodeURIComponent）。
- 版本对象没有 type 字段，版本类型由应用级 app_version_types 表达。
- README 文件以 base64 出现在 files 映射里，路径固定为 README.md。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01** — 列表卡片可进入详情；详情加载应用与版本，并显示名称/图标或占位/分类/简介。
- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-02** — 版本表行数等于版本接口 items 数，列含版本号、类型、创建时间、状态。
- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-03** — Readme 默认折叠，展开后显示解码后的 README.md 纯文本，缺失时回退描述/空文案。
- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-04** — 安装/部署入口禁用并向读者说明原因，不发起任何写请求。
- **FR-L3-KUBE-FRONTEND-APP_STORE-DETAIL-05** — appId 不存在显示 not-found 与返回入口；其他错误显示错误面板与重试。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01** — 从列表点击进入详情，应用名/分类/版本行数与接口一致；Readme 展开后有文本；安装按钮禁用；未知 appId 进入 not-found；全程无写请求。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01`
