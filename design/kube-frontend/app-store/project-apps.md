# 项目内应用（应用实例）· 技术方案

## 概述

项目控制台的「应用」页是 openpitrix release 的写视图：列表读项目集合，安装走商店的安装弹窗（目标锁定），
详情复用已安装应用详情，卸载按 `rls-…` 对象 id 删除。它与企业空间的只读汇总共用同一套列表实现。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01`
- `AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02`
- `AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03`

## 设计目标与非目标

- 目标：一个组件同时服务「企业空间只读汇总」与「项目内可写列表」，避免列/状态/卸载语义各写一份后漂移。
- 目标：安装只保留一套弹窗（版本/values/名称校验都在里面），项目页只提供目标与「挑哪个应用」。
- 非目标：release 改名/升级（无可用接口，已登记不做）。
- **已移出非目标**：CRD 组装应用（`applications/composing`）——2026-11-17 产品复核决定重纳，作为独立页面交付（见 DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-05），不并入本页。

## 关键约束

- 项目集合 `GET …/namespaces/<ns>/applications?limit=-1` 返回全量、忽略 `keyword`，因此页面负责搜索且不渲染分页器。
- 安装 `conf` 必须是 YAML **字符串**；传对象会被服务端以 unmarshal 错误拒绝。
- 卸载必须用 `cluster_id`（`rls-…`）：按 release 名 DELETE 返回 200 但不生效；删除是异步的。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01 — 与工作空间「已安装应用」共用一个列表组件

旧 console 有两个视图看同一批 release：项目内的「应用」（可安装/删除）和企业空间的「应用实例」（只读汇总）。
新 UI 第一版只交付了企业空间视图。给项目页再写一份列表会让列、状态映射、卸载语义各写一次并开始漂移，所以
`InstalledAppsPage` 增加 `project`/`cluster` 两个可选属性：给了 project 就改读项目集合、改标题/说明/详情链接、
并打开安装与卸载；不给就是原来的工作空间只读视图。被否方案：新建 `ProjectAppsPage` 复制 200 行——两个视图的列已经
一致，复制只会让下一次改列漏掉一边。

### DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02 — 安装弹窗接收「已确定的目标」

`AppInstallDialog` 原本从商店详情打开，因此自带 工作空间/项目 两个选择器。项目页打开的安装流程里这两个值已经确定，
再让用户选一次是多余且容易选错（装到别的项目）。因此弹窗新增 `lockedWorkspace`/`lockedProject`：两者存在时预填并
禁用对应的下拉，同时跳过「自动选第一个」的副作用；`onInstalled` 回调让调用方刷新自己的列表。被否方案：项目页另写
一个只有版本/values 的简化向导——values 编辑与校验逻辑会立刻分叉（`conf` 必须是 YAML 字符串这类坑会各踩一次）。

### DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03 — 应用选择放在项目页，而不是跳到商店

旧 console 的「创建」是选模板后安装。让用户跳到商店再回来会丢失项目上下文（商店页不知道来源项目）。
因此项目页内先弹一个可按名称搜索的商店应用列表（`/kapis/openpitrix.io/v1/apps`），选中后再把 appId/名称/版本交给
锁定了目标的安装弹窗。选择器只承担「挑哪一个」，版本与 values 仍在安装弹窗里完成，避免第二个配置界面。

### DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-04 — 项目作用域隐藏「项目」列

同一列在项目视图里只会重复表头信息（每一行都是本项目），按「一个事实只出现一次」隐藏；企业空间视图保留该列，
因为那里的行来自不同项目。被否方案：保留列以复用同一列定义——可见的冗余比一次条件判断更伤阅读。

### DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-05 — CRD 组装应用重纳为独立页面，原「扩展资源别处承接」作废

**新决定（2026-11-17 产品复核）**：旧 console 的 `/projects/<ns>/applications/composing`（自制 CRD 组装应用）**重新纳入迁移范围**，作为**独立页面**交付：列表（按应用聚合 Deployment/StatefulSet/Service/Ingress，显示健康、组件数、创建时间）+ 详情 4 页签（组件 / 灰度 / 流量治理 / 链路追踪）。它**不并入**本页的 `applications` 路由。

**为什么推翻原判断**：原登记写「→扩展资源 别处承接」，理由不成立——扩展资源是通用 CRD 浏览器，只能按 CRD 类型列出对象，没有「按 app 标签聚合」的应用视图，也没有聚合健康、组件下钻、流量治理与链路追踪。按迁移指南 §4「别处承接必须证明任务等价」，该承接未被证明，属未映射能力而非已承接。

**被否方案（保留原记录）**：
1. 原方案 A「不做，另立单元」——即本页原「明确不做」与「后续改进」里的写法。被否原因：产品复核认为自制 CRD 应用是项目控制台的主路径能力，不能长期缺失。
2. 原方案 B「→扩展资源 别处承接」——被否原因如上，任务不等价。
3. 原方案 C「并入本页 `applications`，用页签区分」——被否原因：两者对象不同（openpitrix release 实例 vs 按 app 标签聚合的工作负载），列表列、行操作、详情页签、写能力都不同；同路由分页签会让「当前在看哪类应用」失去锚点，也与本页 INV「列表只展示当前项目集合返回的行」冲突。

**何时重新考虑**：若后端提供统一的「应用」聚合资源（同时覆盖 release 与 CRD 组装应用），可合并为一个路由。

**落地约定**：
1. **路由并存**：`applications` 保留给 openpitrix release（本页）；CRD 组装应用使用**另一个路由段**（`crd-apps`，或 `applications/composing`），两者互不覆盖。落地前需先在 `prd/tools/tree.py` 建独立功能点，不在本文件扩写。
2. **聚合口径**：按应用标签聚合工作负载，健康与组件数必须与聚合来源一致；聚合读不到时显示「读取失败」而不是「0 个组件」。
3. **依赖与阻塞分开登记**：流量治理/链路追踪依赖 servicemesh 控制器，本集群可能无数据——按**环境阻塞**登记（页面显示「本集群未上报」），不得写成「不做」。

**待补**：本决策目前只有登记，尚无 `US`/`AC`/`TC`；新功能点建立后按 `AC-L3-KUBE-FRONTEND-<模块>-<特性>-NN` 续编并补对应用例。


## 系统现状

- `pages/appstore/InstalledAppsPage.tsx` 原本只接收 `workspace`，读工作空间汇总并只提供卸载。
- `pages/appstore/AppInstallDialog.tsx` 原本从商店详情打开：工作空间/项目两个下拉都要手动选。
- 项目作用域原本没有 `applications` 路由；旧 console 的 `/projects/<ns>/applications/template` 无对应页面。

## 仓库落点

| 仓库 | 文件 | 变更 |
| --- | --- | --- |
| console | `kube-frontend/packages/api-client/src/appstore.ts` | `installedReleasesApi.listProject`（项目集合） |
| console | `kube-frontend/apps/console-next/src/pages/appstore/InstalledAppsPage.tsx` | `project`/`cluster` 作用域、安装入口与选择器、按作用域切换标题/列/说明 |
| console | `kube-frontend/apps/console-next/src/pages/appstore/AppInstallDialog.tsx` | `lockedWorkspace`/`lockedProject`/`onInstalled` |
| console | `kube-frontend/apps/console-next/src/routes/…/projects.$namespace/applications/{route,index,$releaseId}.tsx` | 新路由 |
| console | `kube-frontend/apps/console-next/src/areas/registry.ts` | 工作负载区域新增「应用」页 |
| console | `kube-frontend/packages/locales/src/index.ts` | `installedApps.project*` 等键（zh/en 成对） |

## 对外契约

- **CON-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01** — 项目集合：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications?limit=-1`，返回 `{items, total_count}`，每项形状与工作空间汇总一致（`cluster.cluster_id`、`app{name,app_id}`、`version{name,version_id}`、`status`、`create_time`）。
- **CON-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02** — 安装：`POST` 同一集合，body `{app_id, version_id, name, description?, conf}`；`conf` 必须是 YAML 字符串（对象会被服务端以 unmarshal 错误拒绝）。
- **CON-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03** — 卸载：`DELETE …/namespaces/<ns>/applications/<cluster_id>`，必须是 `rls-…` 对象 id；按 release 名删除返回 200 但不生效。

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01** — 列表只展示当前项目集合返回的行；不把工作空间汇总在客户端过滤后冒充项目集合（total 会与服务器不一致）。
- **INV-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02** — 锁定目标时安装请求的工作空间/项目必须等于页面上下文，不得被弹窗自动选择改写。
- **INV-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03** — 页面不渲染分页器：项目集合一次返回全量，搜索在页内完成并在说明里写明。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01** — 卸载是异步的：DELETE 返回 200 后集合可能仍在数秒内返回该 release。用例必须轮询到消失（≤90s），不能即时断言；finally 清理同样要「仍在则按 cluster_id 再删并轮询」。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02** — `InputSearch` 的 `onChange/onSearch` 回调参数是字符串（不是事件）；写成 `event.target.value` 会在 tsc 报错、运行时静默拿到 undefined。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03** — 项目集合的 `items` 可能含刚创建、`status=creating` 的 release；状态列必须如实显示 creating 而不是当成失败。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-04** — 页面不会因为外部 API 创建了对象而自动刷新；用例从 API 造数后必须先点刷新再断言行数。

## 测试与可观测

- 列表/安装/详情+卸载三条用例（`TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01..03`）在 B200 本地全栈串行跑，写用例自建唯一 release 并在 finally 清理。
- 句柄：`installed-apps:surface`、`installed-apps:table`、`installed-apps:install`、`installed-apps:pick`、`installed-apps:pick-search`、`installed-apps:pick-app:<appId>`、`installed-apps:source-note`、`installed-app:uninstall`、`installed-app:uninstall:confirm`。

## 后续改进

- CRD 组装应用（`applications/composing`）：已重纳为独立单元（DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-05），本页不再追踪。
- release 改名/升级若后端提供路由，可在行操作里补「编辑信息/升级」，无需改列表结构。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01`
- `TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02`
- `TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03`
