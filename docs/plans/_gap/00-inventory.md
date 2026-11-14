# 老 console 页面清单 vs 新 UI 路由清单（事实底稿）

> 这份文件是缺口分析的事实底稿，由 Lead 直接从源码抽取，**不要改它**。
> 老 console 事实源：`console/src/pages/**/routes/*.js`、`console/src/core/routes.js`
> 新 UI 事实源：`console/kube-frontend/apps/console-next/src/routes/`（文件系统即路由）、`src/areas/registry.ts`

## 0. 两个应用的作用域命名

| 老 console | 新 UI |
| --- | --- |
| `/:workspace/clusters/:cluster/projects/:namespace`（项目） | `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace` |
| `/clusters/:cluster`（集群） | `/kube-frontend/clusters/:cluster` |
| `/access`（平台） | `/kube-frontend/access` |
| `/settings`（平台设置） | `/kube-frontend/settings` |
| `/clusters`（集群列表，平台级） | `/kube-frontend/clusters` |
| `/`（工作台） | `/kube-frontend` |
| `/workspaces/:workspace`（企业空间） | **无** |
| `/:workspace/clusters/:cluster/devops/:devops` | **无** |
| `/:workspace/federatedprojects/:namespace` | **无** |
| `/apps`、`/apps-manage`（应用商店） | **无** |

## 1. 老 console 全量页面（按 routes 源文件抽取）

### 1.1 全局 / 平台级（`src/pages/console/routes/index.js`、`src/pages/access`、`src/pages/settings`）

| 老路由 | 容器组件 | 说明 |
| --- | --- | --- |
| `/login` | core/containers/Login | 登录 |
| `/login/confirm` | core/containers/LoginConfirm | 二次确认（如首次登录改密） |
| `/password/confirm` | core/containers/PasswordConfirm | 密码过期改密 |
| `/dashboard` | console/containers/Dashboard | 工作台仪表盘 |
| `/logquery` | console/containers/LogQuery | 日志查询 |
| `/eventsearch` | console/containers/EventSearch | 事件检索 |
| `/auditingsearch` | console/containers/AuditingSearch | 审计检索 |
| `/bill` | console/containers/Bill | 账单 |
| `/support` | console/containers/Support | 支持 |
| `/404` | console/containers/NotFound | 404 |
| `/terminal/*` | pages/terminal/index.jsx | **独立新窗口**：容器终端、`kubectl`、节点终端 |
| `/clusters` | clusters/containers/Clusters | 集群列表（多集群） |
| `/access/accounts` | access/containers/Accounts | 用户列表 |
| `/access/accounts/:name` | access/containers/Accounts/Detail | 用户详情 |
| `/access/roles` | access/containers/Roles | 平台角色列表 |
| `/access/roles/:name` | access/containers/Roles/Detail | 平台角色详情 |
| `/access/workspaces` | access/containers/Workspaces | 企业空间列表 |
| `/settings/base-info` | settings/containers/BaseInfo | 平台信息 |
| `/settings/third-login` | settings/containers/ThirdPartyLogin | 第三方登录（OAuth/LDAP） |
| `/settings/mail` | settings/containers/Notification/Mail | 邮件通知渠道 |
| `/settings/feishu` | .../FeiShu | 飞书 |
| `/settings/dingtalk` | .../DingTalk | 钉钉 |
| `/settings/wecom` | .../WeCom | 企业微信 |
| `/settings/slack` | .../Slack | Slack |
| `/settings/webhook` | .../Webhook | Webhook |

### 1.2 应用商店（openpitrix 模块，`src/pages/apps/routes/index.js`）

| 老路由 | 组件 |
| --- | --- |
| `/apps` | apps/containers/Home（应用商店首页） |
| `/apps/:appId` | apps/containers/AppDetail |
| `/apps/:appId/deploy` | apps/containers/AppDeploy（部署向导） |
| `/apps-manage/store` | apps/containers/StoreManage（商店管理） |
| `/apps-manage/categories` | apps/containers/Categories（分类管理） |
| `/apps-manage/reviews/:type` | apps/containers/Reviews（审核） |

### 1.3 企业空间作用域（`/workspaces/:workspace`，`src/pages/workspaces/routes/*.js`）

| 老路由 | 组件 |
| --- | --- |
| `overview`（含子页签 usage / ranking / clusters） | Overview + ResourceUsage / UsageRanking / Clusters |
| `projects` | Projects |
| `federatedprojects` | FedProjects |
| `devops` | DevOps |
| `apps` / `apps/:appId` | Apps / AppDetail |
| `repos` / `repos/:repo_id` | Repos / RepoDetail |
| `base-info` | BaseInfo |
| `quota` | QuotaManage |
| `roles` / `roles/:name` | Roles / RoleDetail |
| `members` / `members/:name` | Members / MemberDetail |
| `groups` | Groups（用户组） |

### 1.4 DevOps 工程（`/:workspace/clusters/:cluster/devops/:devops`）

| 老路由 | 组件 |
| --- | --- |
| `pipelines` / `pipelines/:name` | PipelinesList / PipelineDetail |
| `cd` / `cd/:cd` | CDList / CDDetail（持续部署） |
| `code-repo` | CRList（代码仓库） |
| `base-info` | BaseInfo |
| `roles` / `roles/:name` | Roles / RoleDetail |
| `members` | Members |
| `credentials` / `credentials/:credential_id` | Credential / CredentialDetail |

### 1.5 联邦项目（`/:workspace/federatedprojects/:namespace`）

overview、applications(+:name)、deployments(+:name)、statefulsets(+:name)、services(+:name)、ingresses(+:name)、volumes(+:name)、configmaps(+:name)、secrets(+:name)、base-info、quota、gateways(+:gatewayName)、log-collections

### 1.6 集群作用域（`/clusters/:cluster`，`src/pages/clusters/routes/*.js`）

| 分组 | 老路由 |
| --- | --- |
| 概览 | `overview` |
| 节点 | `nodes`、`nodes/:node`、`nodes/:node/gpus/:gpuUuid`、`edgenodes`、`edgenodes/:node`、`gpus` |
| 系统组件 | `components`、`components/:namespace/:name` |
| 项目 | `projects`、`projects/:namespace`（ProjectLayout，含项目内全部详情页） |
| 自定义资源 | `customresources`、`customresources/:name` |
| 应用负载（**集群级全命名空间**） | `deployments`、`statefulsets`、`daemonsets`、`jobs`、`cronjobs`、`pods`、`services`、`ingresses` |
| 配置（集群级） | `secrets`、`configmaps`、`serviceaccounts` |
| 存储 | `storageclasses`(+:name)、`volumes`、`volume-snapshots`、`volume-snapshot-classes`(+:name)、`volume-snapshot-content/:name`、`snapshots/:namespace?`、`pv/:name`、`juicefs-storage` |
| 监控告警 | `monitor-cluster`、`gpu-resource`、`monitor-resource`、`alerts`、`alert-rules`、`alert-rules/:name`（含 builtin）、`custom-monitoring` |
| 集群设置 | `base-info`、`visibility`、`members`、`roles`、`roles/:name`、`networkpolicies`、`ippools`(+:name)、`log-collections/:component`(+/:name)、`gateways/:component`(+/:gatewayName)、`kubeConfig` |

### 1.7 项目作用域（`/:workspace/clusters/:cluster/projects/:namespace`，`src/pages/projects/routes/*.js`）

| 分组 | 老路由 |
| --- | --- |
| 概览 | `overview` |
| 应用 | `applications/composing`、`applications/composing/:name`、`applications/template`、`applications/template/:id` |
| 应用负载 | `deployments`(+:name)、`statefulsets`(+:name)、`daemonsets`(+:name)、`pods`、`pods/:podName`、`pods/:podName/containers/:containerName`、`jobs`(+:name)、`cronjobs`(+:name)、`services`(+:name)、`ingresses`(+:name) |
| 构建/灰度 | `s2ibuilders`(+:name)（镜像构建器）、`grayrelease`（含 cates / jobs 两个子页） |
| 存储 | `volumes`(+:name)、`volume-snapshots`(+:name) |
| 配置 | `configmaps`(+:name)、`secrets`(+:name)、`serviceaccounts`（详情路径拼作 `serviceAccounts/:name`） |
| 监控告警 | `alert-rules`(+:name，含 builtin)、`alerts`、`custom-monitoring` |
| 项目设置 | `base-info`、`networkpolicies`(+:name)、`roles`(+:name)、`members`、`log-collections`、`gateways`(+:gatewayName) |

## 2. 新 UI 现有路由（`apps/console-next/src/routes/`）

| 作用域 | 路由段 |
| --- | --- |
| 全局 | `/login`、`/`、`/kube-frontend`（工作台入口） |
| 平台 | `/kube-frontend/clusters`（集群列表）、`/kube-frontend/access/users`(+$name)、`/kube-frontend/access/clusterroles`(+$name)、`/kube-frontend/access/workspaces`(+$name)、`/kube-frontend/settings/info`、`/kube-frontend/settings/mail`、`/kube-frontend/settings/notifications`（**正在改动中**） |
| 集群（13） | `overview`、`nodes`(+$name)、`node-usage`、`components`、`namespaces`、`custom-resources`(+$name)、`storageclasses`(+$name)、`persistentvolumes`(+$name)、`monitor`、`log-collections`、`members`、`visibility`、`settings` |
| 项目（22） | `overview`、`deployments`(+$name)、`statefulsets`(+$name)、`daemonsets`(+$name)、`jobs`(+$name)、`cronjobs`(+$name)、`pods`(+$name)、`services`(+$name)、`ingresses`(+$name)、`configmaps`(+$name)、`secrets`(+$name)、`serviceaccounts`(+$name)、`persistentvolumeclaims`(+$name)、`volumesnapshots`(+$name)、`networkpolicies`、`gateways`、`log-collections`、`alerts`、`alertingrules`、`baseinfo`、`members`、`roles` |

## 3. 老 console 的跨页面通用能力（`src/components`、`src/core`）

新 UI 没有对应物的老通用组件/能力，逐条确认是否缺失：

| 老组件/能力 | 位置 | 用途 |
| --- | --- | --- |
| `Terminal` / `Modals/ContianerTerminal` / `Modals/KubeCtl` | `src/components/Terminal`、`src/components/Modals` | 容器 exec、kubectl、节点 shell |
| `KubeTools` | `src/components/KubeTools` | 图形化 kubectl（命令面板/资源浏览器） |
| `Charts` / `Graph` | `src/components/Charts`、`Graph` | 监控图表、资源用量曲线 |
| `EditMode` / `EditForms` | `src/components/EditMode`、`EditForms` | 详情页内联编辑（YAML/表单切换） |
| `DiffYaml` | `src/components/DiffYaml` | YAML 变更 diff |
| `MoreActions` | `src/components/MoreActions` | 行内「更多操作」下拉 |
| `Tables`（含分页/排序/列设置） | `src/components/Tables` | 列表基础能力 |
| `TextPreview` | `src/components/TextPreview` | 长文本预览弹窗 |
| `Tree` | `src/components/Tree` | 资源树（如自定义资源、项目树） |
| `ToggleView` | `src/components/ToggleView` | 卡片/列表视图切换 |
| `CodeRepoSelector` | `src/components/CodeRepoSelector` | DevOps 代码仓库选择 |
| 全局搜索 / 快捷键 / 通知中心 / 语言切换 / 用户设置下拉 | `src/components/Layout`、`src/core/containers` | 顶栏能力 |
