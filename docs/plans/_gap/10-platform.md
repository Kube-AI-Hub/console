# 10 · 平台与全局作用域缺口分析

> **历史证据，2026-11-14 基线。** 下文“当前工作树/未迁移/模块关闭”均只代表分析当时，不能用于当前排期。
> 现行方法见[迁移指南](../../legacy-ui-migration-guide.md)，待复核项见[能力矩阵](../capability-matrix.md)。

> 作用域：老 console 里**不隶属于某个集群/项目**的全部页面 + 老顶栏的全局能力。
> 事实源：`console/src`（KubeSphere 3.1 fork）。新 UI：`console/kube-frontend/apps/console-next/src`。
> 本文所有结论都带 `路径:行号`。没读到的写「未核实」，不猜。
> **以当前工作树为准**：`console/` 是 git 仓库。分析期间工作树发生了两次变化，本文已对齐：`settings/notifications` 的 `route.tsx` 被删、新增 `settings/mail` 与 `src/shell/UserSettingsDialog.tsx`、`src/pages/platform/{MailChannelPage,PlatformInfoPage}.tsx`（**现已提交**）；`docs/plans/page-parity-report.md` 同期新增「修改他人密码」与 `user-settings` 两处登记（`page-parity-report.md:136`、`:147-151`）。涉及这些的条目都注明「本轮新增」或「有意不迁移」。

---

## 0. 结论摘要

| 指标 | 数量 |
| --- | --- |
| 本作用域老页面（含详情/子页签） | **82** |
| 真缺失 | **73** |
| 有替代（不等价） | **7** |
| 已迁移且基本等价 | **2** |
| 功能级缺口（仅针对「有替代/已迁移」页面） | **19 项** |
| 疑似回归（未登记为有意不迁移） | **10 项** |

三句话：

1. **本作用域缺口的绝对主体是「整块页面不存在」**：应用商店 7 页、企业空间 18 路由、DevOps 11 页、联邦项目 22 页、通知渠道 5 个 + 第三方登录、日志/事件/审计检索 3 页、账单、支持、终端 3 种、404 —— 新 UI 一个路由都没有。这不是「页面没做完」，是**整个平台/租户/DevOps 层没有对应路由**。
2. **容器终端 / kubectl / 节点 shell 是架构级缺失**，不是页面级。老 console 走 `ws://` 直连（`console/src/components/Terminal/index.jsx:36-39`），新 UI 的 `packages/api-client` 无任何 exec/stream 端点、`server/src/proxy.ts` 无 WebSocket upgrade。
3. **平台/访问控制这几个「已迁移」页面本身也有功能缺口**：批量启用停用、平台角色的「已授权用户」页签、通知渠道的筛选条件、全局工具箱、顶栏的文档与「关于」入口 —— 这些都不在 `page-parity-report.md` 的登记里，属于疑似回归。（「管理员改密」已在本轮被登记为有意不迁移，见 §10 说明。）

---

## 1. 判定口径

| 状态 | 含义 |
| --- | --- |
| **真缺失** | 老 console 有、新 UI 没有任何路由或替代路径 |
| **有替代** | 新 UI 用另一个页面承接了同一件事，但**不等价**（差距写进功能级表） |
| **已迁移** | 有对应页面且功能基本对齐 |
| **有意不迁移** | `console/docs/plans/page-parity-report.md` 或 `console/design/` 已登记理由 |

依赖模块的启用情况（`console/server/config.yaml` 线索）：

| 模块 | 老 console 引用 | 含义 |
| --- | --- | --- |
| `openpitrix.appstore` | `config.yaml:146`、`core/global.js:403-405` | 应用商店开关，`enableAppStore` 直接读它 |
| `devops` | `config.yaml:374`、`config.yaml:473` | DevOps 工程（集群侧 `configz.devops`） |
| `servicemesh` | `config.yaml:467` | 服务治理（联邦项目 Applications 详情依赖） |
| `edgeruntime` | `config.yaml:169` | 边缘节点 |
| `logging`/`events`/`auditing` | `config.yaml:310` | 日志/事件/审计检索三项工具 |
| `network` | `config.yaml:203-215` | 网络隔离、IP 池 |

> 本仓库没有可直接读出「本集群是否启用」的静态文件；`page-parity-report.md:126` 已登记「应用列表（依赖 openpitrix 模块，本集群关闭）」。其余模块的启用状态**未核实**（需要运行中的 ks-apiserver 返回的 `ksConfig`/`clusterConfig`）。

---

## 2. 全局页（`src/pages/console/routes/index.js`）

### 2.1 页面级缺口

| 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| NotFound（倒计时 10s 自动回首页） | `/404` | 无 | **真缺失** | 老：`console/src/pages/console/routes/index.js:28` + `containers/NotFound/index.jsx:28-44`。新 UI `routes/` 下只有 `__root.tsx`/`index.tsx`/`login.tsx`/`kube-frontend*`，**无 `$.tsx` 兜底路由**（`ls console/kube-frontend/apps/console-next/src/routes`）。未知路径会命中 TanStack Router 的默认 not-found，不是老 console 那个带倒计时的页面 |
| Dashboard 工作台 | `/dashboard` | `/kube-frontend` → `WorkbenchPage` | **有替代** | 老的 `/` 重定向到 `/dashboard`（`console/routes/index.js:35-38`）；新的 `/` 重定向到 `/kube-frontend`（`routes/index.tsx:12-17`）。**语义完全不同**：老的是「平台仪表盘」，新的是「企业空间 → 项目」入口。差距见 2.2 |
| LogQuery 容器日志查询 | `/logquery` | 无 | **真缺失** | `console/routes/index.js:30` → `containers/LogQuery/index.jsx:34` 渲染 `components/Modals/LogSearch`（独立窗口，含搜索/高亮/分页，见 `components/Modals/LogSearch/Logging/{Home,Search}/index.jsx`）。新 UI 无任何日志查询页 |
| EventSearch 资源事件检索 | `/eventsearch` | 无 | **真缺失** | `console/routes/index.js:31` → `containers/EventSearch/index.jsx:17` → `components/Modals/EventSearch`。新 UI 无 |
| AuditingSearch 审计日志检索 | `/auditingsearch` | 无 | **真缺失** | `console/routes/index.js:32` → `containers/AuditingSearch/index.jsx:17` → `components/Modals/AuditingSearch`。新 UI 无 |
| Bill 资源消费统计 | `/bill` | 无 | **真缺失** | `console/routes/index.js:33` → `containers/Bill/index.jsx:30-36` → `components/Modals/Bill`。新 UI 无 |
| Support 支持 | `/support` | 无 | **真缺失** | `console/routes/index.js:34` → `containers/Support/index.jsx:110-295`：社区支持 4 个入口（文档/论坛/Issue/Slack）、仓库/贡献/Star、工单支持、KSE/KSC 两个产品卡片。新 UI 无 |
| 容器终端（独立窗口） | `/terminal/...` | 无 | **真缺失** | `pages/terminal/index.jsx:57-91` 按路径分流三种模式。容器终端：`components/Modals/ContianerTerminal/index.jsx:153-163`（左终端 + 右容器信息：状态/镜像/命令/requests/limits/重启次数，容器可切换 `TypeSelect`） |
| kubectl 终端（独立窗口） | `/terminal/kubectl/:cluster` | 无 | **真缺失** | `pages/terminal/index.jsx:70-78` → `components/Modals/KubeCtl/index.jsx:140-152`（多集群下拉切换 `renderTips` 121-138 + kubectl 用法文档 + 全屏终端） |
| 节点终端（独立窗口） | `/terminal/nodename/:node` | 无 | **真缺失** | `pages/terminal/index.jsx:80-88` → 同一 `KubeCtl` 组件带 `nodename` |

> 终端三模式的共同底座：`components/Terminal/index.jsx:35-39` 用 `ws://`（`getWebSocketProtocol`）+ `getClusterUrl` 拼 WebSocket 地址，`terminal.jsx` 是 xterm 封装。
> **新 UI 侧确认**：`grep -rn "terminal|Terminal|kubectl|WebSocket|websocket"` 在 `console-next/src` 只命中注释与 locale key（如 `pages/cluster/ClusterOverviewPage.tsx:516` 的 `cluster.overview.module.terminal`），`packages/api-client/src` 无 exec/logs/stream 端点，`server/src/proxy.ts` 无 WebSocket upgrade。**架构级缺失**。

### 2.2 功能级缺口：Dashboard → WorkbenchPage

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 工作台 | 用户卡片：头像、`DASHBOARD_TITLE` 问候、平台角色、最后登录时间 | 无用户卡片，只有 `workbench.title`/`description` 标题 | 缺 3 项（头像/平台角色/最后登录时间） | 老 `containers/Dashboard/index.jsx:73-101`；新 `pages/workbench/WorkbenchPage.tsx:68-71` |
| 工作台 | 平台管理员面板：版本号、集群数（可点击跳 `/clusters`） | 无 | 缺平台版本与集群数卡片 | 老 `Dashboard/Admin/index.jsx:61,77-97`；新无 |
| 工作台 | 平台资源统计：企业空间数、用户数、应用模板数（每项可点击跳对应列表，读 `kubesphere_*_count` 指标） | 无 | 缺 3 项统计及其跳转 | 老 `Dashboard/Admin/PlatformStatus/index.jsx:33-55,72-84`；新无 |
| 工作台 | 东巴（Dongba）两个入口卡片：发现 / 运行时控制台 | 无（东巴只在顶栏平台切换器里作为一个平台） | 缺 2 个深链 | 老 `Dashboard/Admin/index.jsx:65-76`；新 `shell/AppShell.tsx:143` 只有平台级跳转 |
| 工作台 | 「最近访问」：`localStorage['history-cache']` 记录最近 8 条访问，卡片列出 | 无 | 缺访问历史 | 老 `Dashboard/Admin/History/index.jsx:31-58` + `core/global.js:426-439`（`cacheHistory` 写 8 条）；新无 |
| 工作台 | 非管理员登录后**自动重定向**到 `/access/workspaces`（有 create 权限）或 `/workspaces/:ws`（有企业空间） | 新页面按「集群 → 企业空间 → 项目」分组展示全部项目 | 不是缺失而是**语义替换**：老的「登录后落到我的企业空间」变成「列出所有集群下的所有项目」。对只有单企业空间的普通用户，新页面信息量更大但需要自己再点一次 | 老 `Dashboard/index.jsx:40-48,55-71`；新 `WorkbenchPage.tsx:93-134` |

---

## 3. 平台：集群列表与访问控制

### 3.1 页面级缺口

| 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| Clusters 集群列表（host/成员集群分组、卡片、分页） | `/clusters` | `/kube-frontend/clusters` → `MultiClusterListPage` | **有替代** | 老 `pages/clusters/containers/Clusters/index.jsx:158-262`；新 `routes/kube-frontend.clusters.index.tsx:13-19` → `pages/cluster/MultiClusterListPage.tsx`。差距见 3.2 |
| Accounts 用户列表 | `/access/accounts` | `/kube-frontend/access/users` → `PlatformListPage` | **有替代** | 老 `access/containers/Accounts/index.jsx:154-214`；新 `pages/platform/PlatformListPage.tsx:82-131` |
| AccountDetail 用户详情 | `/access/accounts/:name` | `/kube-frontend/access/users/$name` → `UserDetailPage` | **有替代** | 老 `access/containers/Accounts/Detail/index.jsx:120-167` + `Detail/routes.js:25-33`（`login-history` 子路由）；新 `pages/platform/UserDetailPage.tsx:24-101` |
| Roles 平台角色列表 | `/access/roles` | `/kube-frontend/access/clusterroles` → `PlatformListPage` | **有替代** | 老 `access/containers/Roles/index.jsx:99-157`；新 `PlatformListPage.tsx:132-170` |
| RoleDetail 平台角色详情（两个页签） | `/access/roles/:name` | `/kube-frontend/access/clusterroles/$name` → `ClusterRoleDetailPage` | **有替代** | 老 `Roles/Detail/index.jsx:136-159` + `Detail/routes.js:26-40`（`authorizations` / `users` 两页签）；新 `ClusterRoleDetailPage.tsx:25-100` 只有一页 |
| Workspaces 企业空间列表 | `/access/workspaces` | `/kube-frontend/access/workspaces` → `PlatformListPage` | **有替代** | 老 `access/containers/Workspaces/index.jsx`；新 `PlatformListPage.tsx:171-215`。**新 UI 多出**一个详情页 `WorkspaceDetailPage`（老 console 无独立详情页，编辑走行内弹窗） |

> 注：`page-parity-report.md:130-138` 已把 `access-control` 5 个页面登记为已迁移。**引用时需注意时效**：该报告在本轮分析期间被修改过两次。(a) 旧的「用户列表 · 编辑用户信息」一条已被替换为「修改他人密码」（`page-parity-report.md:136`）—— 说明编辑用户信息**已实现**；(b) 新增 `user-settings` 小节（`:147-151`）。企业空间编辑/删除、平台角色创建现在也都有实现（`PlatformListPage.tsx:74-80` 的 primaryAction、`217-256` 的 rowActions），而报告里 `:137-138` 仍写着「另立功能点」——**这两条报告文本已落后于代码**。

### 3.2 功能级缺口

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 集群列表 | host 集群与成员集群**分组展示**（host 用 `labelSelector: 'cluster-role.kubesphere.io/host='`，成员用 `!cluster-role.kubesphere.io/host`） | 单一表格，无分组 | 缺 host/成员分区 | 老 `Clusters/index.jsx:74-88,217-259`；新 `MultiClusterListPage.tsx:94-180` 单一 columns |
| 集群列表 | **卡片视图**（`ClusterCard`，每卡带状态/版本/节点数/到期天数，按 `expiredDay` 排序） | 表格视图 | 缺卡片视图与到期排序 | 老 `Clusters/index.jsx:213-249`；新 `MultiClusterListPage.tsx` 用 `ResourceList` |
| 集群列表 | 按 name / alias **两列过滤**（`FilterInput columns`） | 单一搜索框 | 缺 alias 单独检索 | 老 `Clusters/index.jsx:264-277,286-294`；新 `MultiClusterListPage.tsx` schema 的 `search` |
| 集群列表 | 行操作：编辑信息 / 更新 kubeconfig（仅非 host 且非 proxy 连接）/ 移除集群 | 有 add / edit / kubeconfig / remove（`rowActions`） | 基本对齐；差异：新 UI 的 kubeconfig 与 remove 是否按 `isHost`/`connectionType` 条件显示**未核实** | 老 `Clusters/index.jsx:114-156`；新 `MultiClusterListPage.tsx:183-205` |
| 用户列表 | **批量启用 / 批量停用**（`selectActions`，按选中行状态动态禁用，`handledisabled` 三态判定） | 无批量操作 | **缺批量启用/停用** | 老 `Accounts/index.jsx:102-152`；新 `PlatformListPage.tsx:217-256` 只有逐行 enable/disable |
| 用户列表 | 保护规则：`presetUsers` 内账号与**自己**不可操作（`showAction`） | 只保护 `admin`（`username !== 'admin'`） | 保护面变窄：`presetUsers` 里其他预置账号现在可被停用/删除 | 老 `Accounts/index.jsx:36-41,147-151`；新 `PlatformListPage.tsx:233,241` |
| 用户详情 | 操作区：编辑 / **修改密码** / 删除 | 详情页只读；编辑/停用/删除在列表行操作 | 缺「修改密码」（管理员重置他人密码）入口 —— **有意不迁移**，本轮已登记：`page-parity-report.md:136`「修改他人密码（老 console 在用户详情页提供）：属管理员重置流程，另立功能点」 | 老 `Accounts/Detail/index.jsx:79-118`（`modifyPassword` 在 92-102）；新 `UserDetailPage.tsx:60-98` 无操作区 |
| 用户详情 | 属性区：平台角色 / 邮箱 / 最后登录 | 基本信息 6 项 + 描述 | 对齐（新 UI 更多） | 老 `Accounts/Detail/index.jsx:120-143`；新 `UserDetailPage.tsx:64-74` |
| 用户详情 | `login-history` **独立页签**（表格式，分页） | 内联「最近登录」区块，固定 `limit: 10` | 差距：无分页、无「查看更多」；够用但不完整 | 老 `Detail/routes.js:26-32` + `Detail/LoginHistory/index.jsx`；新 `UserDetailPage.tsx:33-36,77-96` |
| 平台角色列表 | 行操作：编辑信息 / **编辑权限** / 删除；创建时带 `roleTemplates`（按模块分组的模板选择） | 创建 + 编辑信息 + 删除；`RoleEditorDialog` 的规则只有**一行** | **规则编辑能力弱化**：老的是「资源选择器 + 多规则」，新的只有一条 `{apiGroups, resources, verbs}`。parity report:134 登记了「规则的多条编辑（当前一次一条）」，属于**有意不迁移** | 老 `Roles/index.jsx:45-88,134-141`；新 `RoleEditorDialog.tsx:11-13`（注释自述）、`44`、`148-152` |
| 平台角色详情 | 页签 1 `authorizations`：规则**按模块分组**（`iam.kubesphere.io/module` 注解 → `RuleList`） | 扁平规则表（apiGroups/resources/verbs 三列） | 缺按模块分组；信息不减但可读性下降 | 老 `Roles/Detail/AuthorizationList/index.jsx:44-61`；新 `ClusterRoleDetailPage.tsx:76-94` |
| 平台角色详情 | 页签 2 `users`：**已授权用户列表**（用户名/状态/最后登录，分页） | 无 | **缺整个页签**；代码注释已自述原因（需跨平台扫 rolebinding），但 **`page-parity-report.md` 未登记** | 老 `Roles/Detail/AuthorizedUsers/index.jsx:54-109`；新 `ClusterRoleDetailPage.tsx:16-19` |
| 企业空间列表 | 列表 + 创建/编辑/删除（行内弹窗） | 列表 + 创建/编辑/删除 + 详情页 | 对齐（新 UI 更多） | 老 `access/containers/Workspaces/index.jsx`；新 `PlatformListPage.tsx:251-255,327-370` |

---

## 4. 平台设置（`src/pages/settings/routes/index.js`）

### 4.1 页面级缺口

| 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| BaseInfo 平台信息 | `/settings/base-info` | `/kube-frontend/settings/info` → `PlatformInfoPage` | **已迁移**（本轮新增，已提交） | 老 `settings/containers/BaseInfo/index.jsx:40-74`；新 `routes/kube-frontend.settings/info/index.tsx:6-11` → `pages/platform/PlatformInfoPage.tsx:24-80`。**本轮新增**：`PlatformInfoPage.tsx` 比老页面多一个「外观」分区（`design/kube-frontend/platform-settings/appearance.md`） |
| ThirdPartyLogin 第三方登录 | `/settings/third-login` | 无 | **真缺失** | `settings/routes/index.js:46-49` → `containers/ThirdPartyLogin/index.jsx`（OAuth / GitHub OAuth 两个弹窗见 `settings/components/Modals/{OAuth,GithubOAuth}/index.jsx`，LDAP 配置）。新 UI 无路由 |
| Mail 邮件通知渠道 | `/settings/mail` | `/kube-frontend/settings/mail` → `MailChannelPage` | **已迁移**（本轮新增，已提交） | 老 `settings/containers/Notification/Mail/index.jsx:170-187`；新 `routes/kube-frontend.settings/mail/index.tsx:6-11` → `MailChannelPage.tsx:99-382`。**本轮新增**（同时新增 `packages/api-client/src/notification.ts`） |
| FeiShu 飞书 | `/settings/feishu` | 无 | **真缺失** | `settings/routes/index.js:54-57` → `Notification/FeiShu/index.jsx:335-353`（`FeiShuForm`：appID/appSecret + 群机器人 webhook/secret/keywords + 部门/用户） |
| DingTalk 钉钉 | `/settings/dingtalk` | 无 | **真缺失** | `settings/routes/index.js:58-61` → `Notification/DingTalk/index.jsx`（`DingTalkForm` 208 行） |
| WeCom 企业微信 | `/settings/wecom` | 无 | **真缺失** | `settings/routes/index.js:62-65` → `Notification/WeCom/index.jsx`（`WeComForm` 185 行） |
| Slack | `/settings/slack` | 无 | **真缺失** | `settings/routes/index.js:66-69` → `Notification/Slack/index.jsx`（`SlackForm` 86 行） |
| Webhook | `/settings/webhook` | 无 | **真缺失** | `settings/routes/index.js:70-73` → `Notification/Webhook/index.jsx`（`WebhookForm` 164 行） |
| （老重定向）`/settings/notification-configuration` → `/settings/mail` | — | `/kube-frontend/settings/notifications` → 重定向 `/settings/mail` | **已迁移** | 老 `settings/routes/index.js:75-79`；新 `routes/kube-frontend.settings/notifications/index.tsx:13-18`。该路由的 `route.tsx` 已在本轮删除，只剩 `index.tsx` 做重定向；`design/kube-frontend/platform-settings/notifications.md` 与 `prd/` 下同名文件也已删除 |

### 4.2 功能级缺口：邮件通知渠道

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 邮件渠道 | 启用开关（`receiver.spec.email.enabled`） | 有 checkbox `mail.enabled` | 对齐 | 老 `Forms/Notification/BaseForm/index.jsx:105-144`；新 `MailChannelPage.tsx:245-256` |
| 邮件渠道 | SMTP 服务器地址 + 端口（`UrlInput` 拆 host/port，带 host/port 正则校验、默认端口 25） | host + port 两个 input，校验端口为 1-65535 整数 | 基本对齐；差距：老有 host 格式正则（`PATTERN_HOST`），新的只判非空 | 老 `MailForm/index.jsx:48-63`；新 `MailChannelPage.tsx:261-282,203-206` |
| 邮件渠道 | 使用 SSL 安全连接（`requireTLS` checkbox） | 有 | 对齐 | 老 `MailForm/index.jsx:64-73`；新 `MailChannelPage.tsx:284-294` |
| 邮件渠道 | SMTP 用户名 / 密码 / 发件人邮箱 | 有 | 对齐 | 老 `MailForm/index.jsx:74-109`；新 `MailChannelPage.tsx:296-328` |
| 邮件渠道 | 收件人：**逐个添加的列表**（`BoxInput` + `List`，可删除单条，校验重复/格式/最大条数 `notification.wecom.max_number_of_email`） | 单个文本框，逗号/空白分隔后 split | 差距：无「已添加」可视化列表、无重复校验、无最大条数限制；删掉一个收件人要手工编辑字符串 | 老 `MailForm/Item.jsx:47-111`；新 `MailChannelPage.tsx:331-343,92-97` |
| 邮件渠道 | **筛选条件**（`FILTER_CONDITIONS`：`receiver.spec.email.alertSelector.matchExpressions` 的键/操作符/值数组，决定哪些告警才走这个渠道） | 无 | **真缺失**：新页面完全不写 `alertSelector`，保存时 `receiverSpec` 只有 `{to, enabled}`。后果：所有渠道会对全部告警发送，无法按严重级别/规则过滤 | 老 `Forms/Notification/BaseForm/index.jsx:157-181,224-228` + `BaseForm/ConditionSelect/index.jsx`；新 `MailChannelPage.tsx:138-140,192` |
| 邮件渠道 | 发送测试消息（`verification` 端点，看响应体 `Status`） | 有 `mail.sendTest` 按钮 | 对齐 | 老 `BaseForm/index.jsx:64-95`；新 `MailChannelPage.tsx:178-197,365-376` |
| 邮件渠道 | 保存 / 取消（`BaseForm` 底部按钮） | 只有保存（`common.confirm`），无取消（表单即页面，符合新设计） | 有意差异，`design/kube-frontend/platform-settings/mail.md:48-54` 已登记 | 老 `BaseForm/index.jsx:200-215`；新 `MailChannelPage.tsx:361-364` |

### 4.3 功能级缺口：平台信息

| 页面 | 老 console 的功能 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 平台信息 | 平台地址（`location.host`）、平台标题、平台描述、logo | title / description / consoleUrl + logo + host | 对齐（新 UI 多 `consoleUrl`） | 老 `settings/containers/BaseInfo/index.jsx:48-71`；新 `PlatformInfoPage.tsx:42-73` |
| 平台信息 | 无外观设置 | **新增**「外观」分区（深/浅色 + 两套色调，写 `localStorage`） | 反向超出，`design/kube-frontend/platform-settings/appearance.md:1-69` 有方案 | 老无；新 `PlatformInfoPage.tsx:95-160` |
| 平台信息 | 编辑平台信息 | 无（`page-parity-report.md:144` 登记为有意不迁移：安装器字段） | 有意不迁移 | — |

---

## 5. 应用商店（openpitrix 模块，`src/pages/apps/routes/index.js`）

| 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| Home 应用商店首页 | `/apps` | 无 | **真缺失** | `apps/routes/index.js:64` → `containers/Home/index.jsx`（`components/AppList`、分类筛选、搜索）。依赖 `openpitrix.appstore`（`core/global.js:403-405`）。**新 UI 顶栏有入口但无路由**：`shell/AppShell.tsx:244-250` 声明 `module.appStore` 指向 `/kube-frontend/apps`，而 `routes/` 下没有 `kube-frontend.apps*` —— 这是一个**指向不存在路由的死链** |
| AppDetail 应用详情 | `/apps/:appId` | 无 | **真缺失** | `apps/routes/index.js:65` → `containers/AppDetail/index.jsx`（README/版本/截图/安装/评价） |
| AppDeploy 部署向导 | `/apps/:appId/deploy` | 无 | **真缺失** | `apps/routes/index.js:66` → `containers/AppDeploy/index.jsx` + `Steps/index.jsx`（多步表单） |
| StoreManage 商店管理 | `/apps-manage/store` | 无 | **真缺失** | `apps/routes/index.js:40-44`。**同样是死链**：`AppShell.tsx:239` 的 `admin.appsManage` 指向 `/kube-frontend/apps-manage`，无路由 |
| StoreManage/Detail 商店应用详情（4 页签） | `/apps-manage/store/:appId` | 无 | **真缺失** | `apps/routes/detail.js:22-25` → `StoreManage/Detail/{AppInformation,AppInstances,VersionManage,AuditRecord}/index.jsx`（4 个页签） |
| Categories 分类管理 | `/apps-manage/categories` | 无 | **真缺失** | `apps/routes/index.js:45-49` → `containers/Categories/index.jsx`（树 + 增删改） |
| Reviews 审核 | `/apps-manage/reviews/:type` | 无 | **真缺失** | `apps/routes/index.js:50-54` + 默认重定向 `reviews/unprocessed`（`56-60`）→ `containers/Reviews/index.jsx` |

> 该作用域共 **7 页**，全部真缺失，且其中 **2 个入口在顶栏是死链**。是否属于「依赖模块已关闭」需运行态确认（`page-parity-report.md:126` 提到 openpitrix 在本集群关闭）。若模块确实关闭，老 console 的 `enableAppStore` 会让这两个顶栏入口不渲染（`components/Layout/Header/index.jsx:174-185`）；新 UI **没有这个开关**，所以死链是无条件出现的。

---

## 6. 企业空间（`/workspaces/:workspace`，`src/pages/workspaces/routes/*.js`）

**新 UI 完全没有 `/workspaces/:workspace` 这一层路由**（`00-inventory.md:17` 已记录）。企业空间在新 UI 里只有平台侧的两个页面：列表 `access/workspaces` 与详情 `access/workspaces/$name`（`WorkspaceDetailPage`）。下面 15 个路由全部真缺失。

| 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| Overview 布局（Banner + 子页签 + 多集群提示） | `/workspaces/:ws/overview` | 无 | **真缺失** | `workspaces/routes/overview.js:38-46` + `containers/Overview/index.jsx:30-67` |
| └ ResourceUsage 资源用量 | `.../overview/usage` | 无 | **真缺失** | `Overview/ResourceUsage/index.jsx:94-116`：集群下拉切换 + 物理资源 + 虚拟资源两栏（`Physical`/`Virtual`），单集群时额外 `ResourceStatistics` |
| └ UsageRanking 用量排行 | `.../overview/ranking` | 无 | **真缺失** | `Overview/UsageRanking/index.jsx:111-207`：集群选择 + 排序指标选择（`sort_metric_options`）+ 升降序 + **导出 JSON** + 分页 |
| └ Clusters 集群信息卡片 | `.../overview/clusters` | 无 | **真缺失** | `Overview/Clusters/index.jsx:55-72`（多集群时才出现，`overview.js:34` 的 `multiCluster: true`） |
| Projects 项目列表 | `/workspaces/:ws/projects` | 无 | **真缺失** | `workspaces/routes/index.js:49-53` → `containers/Projects/index.jsx:316-350`。列：名称/状态/**GPU 用量/GPU 显存/CPU 用量/内存用量/Pod 数**/创建时间；行操作：编辑信息、**编辑配额**、删除；按 name/alias 双列检索；带集群下拉；项目/多集群项目两个页签 |
| FedProjects 多集群项目列表 | `/workspaces/:ws/federatedprojects` | 无 | **真缺失** | `routes/index.js:44-48` → `containers/FedProjects/index.jsx:203-227`。行操作：编辑信息、**添加集群**、删除；**批量删除**；列含集群列表 |
| DevOps 工程列表 | `/workspaces/:ws/devops` | 无 | **真缺失** | `routes/index.js:54-58` → `containers/DevOps/index.jsx:226-257`。列：名称/状态/创建者/创建时间；行操作：编辑、删除；**批量删除**；按 name/alias 检索；集群下拉只列 `configz.devops` 为真的集群（`85-96`）。依赖 `devops` 模块 |
| Apps 应用列表 | `/workspaces/:ws/apps` | 无 | **真缺失** | `routes/index.js:59-63` → `containers/Apps/index.jsx:151-165`。列：名称/状态/最新版本/更新时间；创建 + 上传模板。依赖 `openpitrix` |
| AppDetail 企业空间应用详情 | `/workspaces/:ws/apps/:appId` | 无 | **真缺失** | `routes/detail.js:35-38` → `containers/Apps/Detail/index.jsx`（`AppInstances` + `VersionManage` 两页签，见 `Detail/routes.js`） |
| Repos 应用仓库列表 | `/workspaces/:ws/repos` | 无 | **真缺失** | `routes/index.js:69-73` → `containers/Repos/index.jsx:180-199`。列：名称/状态/URL；行操作：编辑、删除；**批量同步索引**（`handleIndex` 112-127）；websocket 监听 `HelmRepo` 变更自动刷新（172-178）。依赖 `openpitrix` |
| RepoDetail 仓库详情 | `/workspaces/:ws/repos/:repo_id` | 无 | **真缺失** | `routes/detail.js:39-42` → `containers/Repos/Detail/index.jsx`（含 `Events` 页签） |
| BaseInfo 企业空间基本信息 | `/workspaces/:ws/base-info` | 无 | **真缺失** | `routes/index.js:64-68` → `containers/BaseInfo/index.jsx:392-406`。区块：企业空间信息（名称/别名/描述/创建时间 + 项目数/DevOps 工程数/成员数三个统计）+ **网络隔离开关（按集群逐个，联邦 overrides 写入）** + 编辑信息/删除企业空间 |
| QuotaManage 配额管理 | `/workspaces/:ws/quota` | 无 | **真缺失** | `routes/index.js:74-78` → `containers/QuotaManage/index.jsx:62-82`：**每个集群一个 ResourceQuota 面板**，可编辑 |
| Roles 企业空间角色列表 | `/workspaces/:ws/roles` | 无 | **真缺失** | `routes/index.js:79-83` → `containers/Roles/index.jsx:158-177`。行操作：编辑信息、编辑权限、删除；创建（带 roleTemplates）；`presetWorkspaceRoles` 保护（47-50） |
| RoleDetail 企业空间角色详情 | `/workspaces/:ws/roles/:name` | 无 | **真缺失** | `routes/detail.js:31-34` → `containers/Roles/Detail/index.jsx`（含 `Authorizations`/`Users` 页签，见 `Detail/routes.js`） |
| Members 企业空间成员 | `/workspaces/:ws/members` | 无 | **真缺失** | `routes/index.js:84-88` → `containers/Members/index.jsx:185-204`。列：用户名/状态/**角色**/最后登录；**邀请成员**、改角色、移除、**批量移除**；不能操作自己（54-56） |
| MemberDetail 成员详情 | `/workspaces/:ws/members/:name` | 无 | **真缺失** | `routes/detail.js:27-30` → `containers/Members/Detail/index.jsx`（含 `Projects`/`DevOps` 两个页签，见 `Detail/routes.js`）—— 即「这个成员在本企业空间里有权限的项目/DevOps 工程」 |
| Groups 用户组（部门） | `/workspaces/:ws/groups` | 无 | **真缺失** | `routes/index.js:89-93` → `containers/Groups/index.jsx:236-281`。**树 + 右侧成员列表**双栏：`GroupTree` 选部门、`GroupUser` 列成员、勾选成员加入部门、`SET_DEPARTMENTS` 弹窗编辑部门树（含 ProjectSelect/DevopsSelect）、websocket 实时刷新（84-105） |

> 规模：**18 个路由**（overview 布局 + 3 子页签 + 13 个列表/详情 + 1 个成员详情）。按「页面」算 15 个（overview 布局不计）。
> **`WorkspaceDetailPage` 不是替代**：它只显示基本信息、成员只读列表、项目列表（`pages/platform/WorkspaceDetailPage.tsx:64-137`），没有任何写操作，也不提供 overview 用量、配额、角色、部门、DevOps、应用仓库。它是「平台管理员看一眼这个租户」的只读视图，不是企业空间控制台。

---

## 7. DevOps 工程（`/:workspace/clusters/:cluster/devops/:devops`）

**新 UI 无此路由**（`00-inventory.md:18`）。依赖 `devops` 模块（`server/config.yaml:374`）。

| 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| Layout（左侧 DevOps 导航） | `.../devops/:devops` | 无 | **真缺失** | `devops/routes/index.js:37-57` + `containers/layout.jsx` |
| Pipelines 流水线列表 | `.../pipelines` | 无 | **真缺失** | `routes/index.js:46` → `containers/Pipelines/PipelinesList/index.jsx` |
| PipelineDetail 流水线详情（**7 个页签**） | `.../pipelines/:name` | 无 | **真缺失** | `routes/detail.js:27-30` → `containers/Pipelines/Detail/{Activity,Artifacts,Branch,CodeQuality,Commit,Events,Parameters,PullRequest,TaskStatus}`。含**图形化流水线编辑器**（`components/Pipeline/StepsEditor`、`StepsSelector`、`StepModals` 十余种步骤）、运行日志弹窗（`PipelineLogDialog` 含 `FullLogs`） |
| CD 持续部署列表 | `.../cd` | 无 | **真缺失** | `routes/index.js:47` → `containers/CD/CDList/index.jsx`（GitOps） |
| CDDetail 持续部署详情 | `.../cd/:cd` | 无 | **真缺失** | `routes/detail.js:35-38` → `containers/CD/detail/{FluxApp,SyncStatus}` |
| CRList 代码仓库 | `.../code-repo` | 无 | **真缺失** | `routes/index.js:48` → `containers/CodeRepo/CRList/index.jsx` |
| BaseInfo DevOps 基本信息 | `.../base-info` | 无 | **真缺失** | `routes/index.js:49` → `containers/BaseInfo/index.jsx` |
| Roles DevOps 角色 | `.../roles` | 无 | **真缺失** | `routes/index.js:50` → `containers/Roles/index.jsx` |
| RoleDetail DevOps 角色详情 | `.../roles/:name` | 无 | **真缺失** | `routes/detail.js:39-42` |
| Members DevOps 成员 | `.../members` | 无 | **真缺失** | `routes/index.js:51` → `containers/Members/index.jsx` |
| Credentials 凭证列表 | `.../credentials` | 无 | **真缺失** | `routes/index.js:52` → `containers/Credential/index.jsx` |
| CredentialDetail 凭证详情 | `.../credentials/:credential_id` | 无 | **真缺失** | `routes/detail.js:31-34` → `containers/Credential/detail/{detail,activity}` |

> **11 个页面全部真缺失**。这是本作用域里最重的一块：不仅是页面，还有整套流水线可视化编辑器与运行日志。

---

## 8. 联邦项目（`/:workspace/federatedprojects/:namespace`）

**新 UI 无此路由**（`00-inventory.md:19`）。依赖 `kubefed` + `servicemesh`（`server/config.yaml:467`）。

| 老页面 | 老路由 | 新 UI 对应 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| Overview | `.../overview` | 无 | **真缺失** | `fedprojects/routes/index.js:47-51` → `containers/Overview/index.jsx`（BaseInfo/LimitRange/ResourceUsage/UsageRanking/Help 五个区块） |
| Applications 应用列表 | `.../applications` | 无 | **真缺失** | `routes/index.js:52-56` |
| AppDetail 应用详情 | `.../applications/:name` | 无 | **真缺失** | `routes/detail.js:58-61` → `containers/Applications/Detail/{AppComponents,AppIngresses,TrafficManangement,Tracing}`（含**链路追踪**，依赖 servicemesh） |
| Deployments 部署列表 | `.../deployments` | 无 | **真缺失** | `routes/index.js:57-61`（默认页：`workloads` 重定向到它，`80-84`） |
| DeploymentDetail 部署详情 | `.../deployments/:name` | 无 | **真缺失** | `routes/detail.js:30-33` → `containers/Deployments/Detail/{Monitoring,ResourceStatus}` |
| StatefulSets 有状态副本集 | `.../statefulsets` | 无 | **真缺失** | `routes/index.js:62-66` |
| StatefulSetDetail | `.../statefulsets/:name` | 无 | **真缺失** | `routes/detail.js:34-37` |
| Services 服务 | `.../services` | 无 | **真缺失** | `routes/index.js:67` |
| ServiceDetail | `.../services/:name` | 无 | **真缺失** | `routes/detail.js:38-41` → `Services/Detail/{Ports,ResourceStatus,ServiceAccess}` |
| Ingresses 应用路由 | `.../ingresses` | 无 | **真缺失** | `routes/index.js:68` |
| RouteDetail | `.../ingresses/:name` | 无 | **真缺失** | `routes/detail.js:42-45` → `Routes/Detail/ResourceStatus` |
| Volumes 存储卷 | `.../volumes` | 无 | **真缺失** | `routes/index.js:69` |
| VolumeDetail | `.../volumes/:name` | 无 | **真缺失** | `routes/detail.js:46-49` → `Volumes/Detail/{ResourceStatus,VolumeMounts}` |
| BaseInfo 联邦项目信息 | `.../base-info` | 无 | **真缺失** | `routes/index.js:70` → `containers/BaseInfo/{ProjectInfo,DefaultResource}` |
| ConfigMaps 配置字典 | `.../configmaps` | 无 | **真缺失** | `routes/index.js:71` |
| ConfigMapDetail | `.../configmaps/:name` | 无 | **真缺失** | `routes/detail.js:54-57` |
| Secrets 保密字典 | `.../secrets` | 无 | **真缺失** | `routes/index.js:72` |
| SecretDetail | `.../secrets/:name` | 无 | **真缺失** | `routes/detail.js:50-53` |
| QuotaManage 配额 | `.../quota` | 无 | **真缺失** | `routes/index.js:73` |
| Gateway 网关 | `.../gateways` | 无 | **真缺失** | `routes/index.js:74` |
| GatewayDetail | `.../gateways/:gatewayName` | 无 | **真缺失** | `routes/detail.js:62-65`（复用 `clusters/containers/Gateway/Detail`） |
| LogCollection 日志收集 | `.../log-collections` | 无 | **真缺失** | `routes/index.js:75-79` |

> **22 个页面全部真缺失**。项目级已有 22 页迁移，但联邦版本一个都没有；两者并非同一份代码（联邦版每个详情页都多了 `ResourceStatus`/跨集群副本状态，见 `components/ClusterWorkloadStatus`、`components/ClusterDiffSettings`）。

---

## 9. 老顶栏的全局能力

| 老能力 | 老 console 位置 | 新 UI 现状 | 差距 | 证据 |
| --- | --- | --- | --- | --- |
| 平台下拉（`getGlobalNavs`：集群管理/访问控制/应用商店管理/平台设置，按权限过滤） | `components/Layout/Header/index.jsx:124-135,164-173` | 有：`MODULES` 里 `module.platform` 的 4 个 children（`clusters`/`access`/`appsManage`/`settings`） | **对齐**，但**不做权限过滤**（老 `checkNavItem` 会按 `ksModule`/`admin`/authKey 逐项裁剪，`core/global.js:141-199`）；且 `appsManage` 是死链（见 §5） | 新 `shell/AppShell.tsx:230-243` |
| 应用商店按钮 | `Header/index.jsx:174-185`（受 `enableAppStore` 控制） | 有入口 `module.appStore` → `/kube-frontend/apps` | **死链**：无对应路由，且不受模块开关控制 | 新 `AppShell.tsx:244-250` |
| 产品入口（工作台 / AGENT_WORKSHOP / 大模型 / 东巴 / 治理，由 `config.portal` 控制可见性） | `Header/index.jsx:62-108,186-189` + `utils/returnPath.visibleProductEntries` | 有平台切换器 `PLATFORMS`（算力/模型/Agent/东巴） | 基本对齐；差距：老有 5 个产品入口（含 `/operations` 治理与 `/studio-preview`），新有 4 个平台且 Agent 覆盖了 `/studio`（`AppShell.tsx:141`），**`/operations` 治理入口缺失** | 新 `AppShell.tsx:123-149` |
| 文档菜单（用户指南 + API 文档，`getWebsiteUrl`） | `Header/index.jsx:110-122,192-196` | **无** | **真缺失**：新 UI 顶栏没有帮助/文档入口 | 新 `AppShell.tsx:691-777` 右侧只有：移动端模块菜单、语言、主题、用户菜单 |
| 语言切换 | 老：用户设置弹窗里的「语言」下拉（写 `spec.lang` 后 `location.reload()`，`Modals/UserSetting/BaseInfo/index.jsx:89-97`） | 顶栏下拉，写 `localStorage`，不刷新（`AppShell.tsx:602-614,756-763`） | **有替代**，且更好。老入口在弹窗内，新入口在顶栏；`design/kube-frontend/user-settings/_index.md:106`（GOT-03）与 `UserSettingsDialog.tsx:23-26` 都登记了「弹窗内不再放语言」的理由 | — |
| 用户菜单（用户设置 / 退出 / **关于**） | `components/Layout/LoginInfo/index.jsx:78-96`；`AboutModal` 在 101-104 | 用户菜单：邮箱（只读）+ 用户设置 + 退出 | **缺「关于」**：老有 `AboutModal`（版本/许可信息）。新无 | 新 `AppShell.tsx:907-918` |
| 用户设置弹窗（基本信息 / 密码设置两个页签 + 未保存提示点 + 保存/取消条） | `Modals/UserSetting/index.jsx:140-174,212-231`；`tabs.js:22-35` | `UserSettingsDialog`：两个页签（基本信息/密码）、未保存提示点、每页签独立提交 | **对齐且更好**（改密后主动 signOut）。差距：老密码框有**强度指示器**（`PasswordSetting/index.jsx:124-131` 的 `withStrength`），新的只有一行规则文案（`UserSettingsDialog.tsx:306`）。**本轮新增** | — |
| 全局导航抽屉 `GlobalNav`（左侧滑出的平台级导航） | `components/Layout/GlobalNav/index.jsx:30-90`；挂载于 `core/layouts/Base/index.jsx:132-138` | 无抽屉；平台入口在顶栏下拉 | 交互形态变化，功能有替代（同一份 `getGlobalNavs`） | 新 `AppShell.tsx:296-326` |
| **工具箱 KubeTools**（右下可拖拽悬浮球，悬停展开 6 项 + 第三方工具） | `core/layouts/Base/index.jsx:19,144`（**每页都挂载**）；`components/KubeTools/index.jsx:74-151` | **无** | **真缺失**。老工具箱 6 项：容器日志查询(`/logquery`，需 logging)、资源事件检索(`/eventsearch`，需 events)、审计日志检索(`/auditingsearch`，需 auditing)、资源消费统计(`/bill`，需 metering)、kubeconfig(`/kubeConfig`，需 `config.enableKubeConfig`)、kubectl(`/terminal/kubectl`，需 platform admin)；外加 `config.thirdPartyTools` 第三方工具。**Shift+点击在新窗口打开**（`handleToolItemClick` 153-163），位置存 `localStorage['ks-toolbox-pos']`（172-177） | 新 UI 无任何对应物 |
| 快捷键 | — | — | **不存在**：`grep -rn "hotkeys\|HotKey\|shortcut"` 在 `console/src` 与 `console-next/src` 均无命中。任务描述里提到的「快捷键」在老 console 里**未核实到实现**，不作为缺口 | — |

---

## 10. 疑似回归（老 console 有、新 UI 漏了、且**没有**登记为有意不迁移）

> 判定口径：`page-parity-report.md` 与 `console/design/` 里都找不到理由的，才算「疑似回归」。
>
> **复核过但不计入**（本轮已登记为有意不迁移，列出以免重复报）：
> - 「管理员重置他人密码」→ `page-parity-report.md:136`。
> - 「用户设置里的语言选择」→ `page-parity-report.md:149`、`design/kube-frontend/user-settings/_index.md:106`（GOT-03）。
> - 「平台角色的多规则编辑」→ `page-parity-report.md:134`。
> - 「平台信息编辑」→ `page-parity-report.md:144`。

| # | 项 | 老 console 证据 | 新 UI 现状 | 为什么算疑似回归 |
| --- | --- | --- | --- | --- |
| R-01 | 用户列表**批量启用/停用** | `access/containers/Accounts/index.jsx:118-152`（`selectActions` + `handledisabled` 三态） | `PlatformListPage.tsx:217-243` 只有逐行 enable/disable | parity report 的 `access-control` 小节（`:133-138`）没有任何一条提到批量操作；批量启停在运维场景是刚需 |
| R-02 | 用户列表**预置账号保护**（`presetUsers` 全员） | `Accounts/index.jsx:36-41,147-151` | `PlatformListPage.tsx:233,241` 只排除 `admin` | 保护面从「一组预置账号」缩到「一个 admin」，其余预置账号可被停用/删除 |
| R-03 | 平台角色详情**「已授权用户」页签** | `Roles/Detail/routes.js:33-38` + `AuthorizedUsers/index.jsx:54-109` | `ClusterRoleDetailPage.tsx` 无此区块 | 代码注释自述了原因（`ClusterRoleDetailPage.tsx:16-19`），但**没写进 parity report 也没写进 design** |
| R-04 | 通知渠道**筛选条件**（`alertSelector.matchExpressions`） | `Forms/Notification/BaseForm/index.jsx:157-181` | `MailChannelPage.tsx:138-140` 的 `receiverSpec` 只有 `{to, enabled}` | 这是通知路由的核心字段：没有它，渠道对所有告警全量发送。`design/.../mail.md` 未提 |
| R-05 | 顶栏**帮助/文档入口**（用户指南 + API 文档） | `Layout/Header/index.jsx:110-122,192-196` | `AppShell.tsx` 右侧 4 个控件里没有 | 未登记 |
| R-06 | 用户菜单**「关于」**（版本/许可） | `Layout/LoginInfo/index.jsx:87-89,101-104` | `AppShell.tsx:907-918` 只有邮箱/设置/退出 | 未登记 |
| R-07 | **全局工具箱**（KubeTools 悬浮球） | `core/layouts/Base/index.jsx:144` + `components/KubeTools/index.jsx:74-151` | 无 | 未登记。它承载 6 个工具入口，其中 4 个在新 UI 里连页面都没有（见 §2） |
| R-08 | 用户设置里的**密码强度指示器** | `Modals/UserSetting/PasswordSetting/index.jsx:124-131`（`withStrength`） | `UserSettingsDialog.tsx:306` 只有静态规则文案 | `design/kube-frontend/user-settings/password.md` 需复核；目前 `_index.md` 的「明确不做」未提强度指示器 |
| R-09 | 集群列表 **host/成员集群分组** + **卡片视图** | `Clusters/index.jsx:74-88,213-249` | `MultiClusterListPage.tsx` 单一表格 | parity report:32 登记了「集群注册/注销/上下线」「跨集群聚合指标」，但没提分组与卡片视图 |
| R-10 | 顶栏 `/operations`（治理）产品入口 | `Layout/Header/index.jsx:87-92` | `PLATFORMS` 只有算力/模型/Agent/东巴 | 需确认 `config.portal` 是否配置了 operations；若配置了，新 UI 少一个入口 |

---

## 11. 规模总结

本作用域（平台与全局）相对老 console 的缺口规模：

- **页面级：73 个真缺失**、7 个有替代（不等价）、2 个已迁移（均为本轮新增）。
  - 全局 9（404 + 日志/事件/审计检索 3 + 账单 + 支持 + 终端 3）
  - 平台设置 6（第三方登录 + 5 个通知渠道）
  - 应用商店 7
  - 企业空间 18（overview 布局 + 3 个子页签 + 13 个列表/详情 + 成员详情）
  - DevOps 11
  - 联邦项目 22（含 9 个详情页）
  - 另有 **2 个顶栏死链**（`/kube-frontend/apps`、`/kube-frontend/apps-manage`）
- **功能级：19 项**缺口，按「一条具体差距」计（工作台 6 → §2.2；集群列表 3、用户 3、平台角色 2 → §3.2；邮件渠道 2、平台信息 1 → §4.2/§4.3；顶栏 2 → §9）。各表里另有一些「已对齐」行，不计入缺口。
- **疑似回归：10 项**（R-01 ~ R-10），全部未在 `page-parity-report.md`/`design/` 登记。
- **架构级 1 项**：容器终端 / kubectl / 节点 shell 依赖 WebSocket，新 UI 的 api-client 与 BFF 均无此能力。

**一句话**：本作用域 82 个老页面里有 73 个在新 UI 完全没有路由（占 89%），其中 DevOps 11 页、联邦项目 22 页、企业空间 18 页是三个整块空白；已迁移的 7 个平台页面另有 19 项功能缺口与 10 项未登记回归。
