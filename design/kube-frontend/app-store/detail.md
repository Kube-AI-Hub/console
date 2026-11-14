# 应用详情 · 技术方案（L3）

[需求](../../../prd/kube-frontend/app-store/detail.md)

## 概述

应用商店列表的一张卡片对应一个详情页：应用身份（名称/图标/分类/简介）、基本信息、版本历史、Chart README，以及一个禁用的安装入口。三个只读 openpitrix 端点支撑全部内容；页面不调用任何写接口。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01

## 设计目标与非目标

目标：让读者在安装前独立判断「这是什么、有哪些版本、怎么用」；布局与老 console 详情同源，但不迁移写流程。

非目标：安装/部署向导、应用实例列表、审核/编辑应用、Markdown 渲染、截图轮播、按版本切换 README。

## 关键约束

- 只读端点：GET /kapis/openpitrix.io/v1/apps/<appId>；GET .../apps/<appId>/versions；GET .../apps/<appId>/versions/<versionId>/files。
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

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-04 — 安装/部署入口禁用并写明下一轮

**为什么**：安装调用 openpitrix 写接口并依赖版本选择、values、协议与权限流程，本轮只做只读详情。把按钮禁用且解释原因，比隐藏按钮（读者会以为功能不存在）或可点击但无反应（读者会以为坏了）都诚实。

**被否方案**：放一个可点击按钮跳到未实现路由。会造出第二个死链，正是本轮要清理的问题。

**何时重新考虑**：安装向导落地时，用同一个版本选择数据源打开 /apps/:appId/deploy。

### DEC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-05 — 404 单独 not-found，不自动重试

**为什么**：应用不存在/已下架是确定结果，不是网络抖动。详情查询 retry:false，404 显示「应用不存在」与返回入口；其他错误（5xx/网络）才显示错误面板与重试。这样读者不会对着一个永不成功的重试按钮等待。

**被否方案**：统一错误面板。会把「已下架」渲染成「加载失败」，读者第一反应是刷新。

**何时重新考虑**：商店需要区分「未发布」与「无权限」时，扩展错误码分支。

## 系统现状

老 console 的 /apps/:appId 页面有 Banner（返回/图标/名称/简介）与三个页签：应用信息（简介/截图/版本表）、应用详情（README/版本选择/关键词）、应用实例（部署后的实例列表），右上角是安装按钮。本实现迁移 Banner、基本信息与版本表、README，去掉截图/关键词/实例/安装；版本表列按本项目的列表风格（版本号/类型/创建时间/状态）展示。

## 仓库落点

- 页面：apps/console-next/src/pages/appstore/AppStoreAppDetailPage.tsx（详情）；AppStorePage.tsx（卡片改为链接）
- 路由：apps/console-next/src/routes/kube-frontend.apps.$appId.tsx
- 接口：packages/api-client/src/appstore.ts 的 storeAppsApi.get / versions / readme、toStoreAppDetail / toStoreAppVersion / decodeStoreFile
- 文案：packages/locales/src/index.ts 的 store.detail.*
- 测试：tests/ui/{specs,tests}/kube-frontend/app-store/...APP_STORE-DETAIL-01

## 对外契约

| 用途 | 路径 | 方法 | 实测 |
| --- | --- | --- | --- |
| 列表（入口） | /kapis/openpitrix.io/v1/apps | GET | 200，30 个应用、total_count |
| 应用详情 | /kapis/openpitrix.io/v1/apps/<appId> | GET | 200；图标在 latest_app_version.icon；category_set 提供分类名 |
| 版本列表 | /kapis/openpitrix.io/v1/apps/<appId>/versions | GET | 200，{items,total_count}；版本无 type 字段 |
| Chart 文件 | /kapis/openpitrix.io/v1/apps/<appId>/versions/<versionId>/files | GET | 200，{files:{路径:base64}}；README.md 在其中 |
| 不存在 | /kapis/openpitrix.io/v1/apps/<unknown> | GET | 404 |

字段映射：

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

## 不变量

1. 列表卡片链接到 /kube-frontend/apps/<app_id>，详情加载的是同一个 app_id。
2. 版本表行数 = 版本接口 items 数；版本类型列取应用级值。
3. Readme 默认折叠；展开后内容要么是 README 解码文本，要么是应用描述，要么是空文案。
4. 安装/部署按钮始终 disabled，且不触发任何请求。
5. 未知 appId 渲染 not-found（含返回入口），不渲染重试面板。
6. 详情页不调用任何 openpitrix 写方法。

## 已知坑

- **版本没有 type**：不要从 name/package_name 猜；类型列必须用应用级 app_version_types。
- **图标并非必有**：30 个应用中 8 个 latest_app_version.icon 为空；直接 img 会得到坏图，需要首字母占位。
- **README 只在 files 端点**：应用详情/版本详情都没有 readme 字段；files 响应里所有 chart 文件都是 base64，体积可能较大，只解码 README.md。
- **files 端点 404 不代表应用不存在**：只有应用详情 404 才是 not-found；README 失败只退化为空。
- **total_count vs items**：版本接口信封是 {items,total_count}，不能只读 total。
- **maintainers/sources 是 JSON 字符串**：直接渲染会显示原始 JSON；解析成数组再展示，解析失败按空处理。
- **appId 来自 URL**：encodeURIComponent；非法/不存在都走 404 分支。
- **列表卡片是 Link**：测试点击卡片后要等 URL 变化再断言 surface，不能只等元素。

## 测试与可观测

- E2E：tests/ui/specs/kube-frontend/app-store/TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01.yaml：从列表点击第一张卡片 → 详情 URL 与 surface；版本行数等于 API items；展开 Readme 得到非空文本；安装按钮 disabled；未知 appId → not-found；全程无写请求（通过 page.on("request") 断言 method 不含 POST/PUT/PATCH/DELETE 到 openpitrix）。
- 可观测点：app-store:card:<id>、app-detail:surface、:name、:versions、:version:<id>、:readme、:readme-toggle、:install-disabled、:not-found、:back、:retry。
- 失败时先看：详情请求是否 404、版本接口信封、README base64 解码、按钮是否真的 disabled。

## 后续改进

- 安装/部署向导（/apps/:appId/deploy，版本选择 + values + 协议）。
- 应用实例列表（部署后的运行时对象）。
- 安全的 Markdown README 与截图。
- 按版本切换 README/关键词。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01
