# 附录：老 console 页面 → 新 UI 路由 全量映射

> **历史映射，2026-11-14 基线。** 192条路由和表中符号不是当前迁移进度，旧模块结论不能继承为不做。
> 当前段级输出用 `gap_check.py`，完整能力仍需[单页清单](../page-migration-template.md)；
> 当前复核任务见[能力矩阵](../capability-matrix.md)，不继续维护第二份手写全站映射。

判定图例：✓ 已迁移 ／ ⇄ 有替代（改名、合并或拆分，需核对等价性）／ ✗ 真缺失 ／ ⊘ 有意不迁移（依赖模块或已登记理由）

> 统计口径：老 console 的路由取自 `console/src/pages/*/routes/*.js`，已剔除重定向与 `*` 兜底路由，合计 192 条（含详情页）。新 UI 路由取自 `apps/console-next/src/routes/` 的目录结构。

## A. 全局与平台入口（老 `src/pages/console/routes`、`src/core/routes.js`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/login` | `/login` | ✓ |  |
| `/login/confirm` | — | ✗ | 首次登录二次确认（如强制改密）；新 UI 无此环节 |
| `/password/confirm` | — | ✗ | 密码过期强制改密；新 UI 无 |
| `/dashboard` | `/kube-frontend` | ⇄ | 新工作台（WorkbenchPage）只有入口卡片；老仪表盘的资源统计与快捷入口未迁 |
| `/logquery` | — | ✗ | 日志检索页 |
| `/eventsearch` | — | ✗ | 事件检索页 |
| `/auditingsearch` | — | ✗ | 审计检索页 |
| `/bill` | — | ✗ | 账单页 |
| `/support` | — | ✗ | 支持页 |
| `/404` | — | ✗ | 新 UI 无兜底路由，未匹配路径没有 404 页 |
| `/clusters` | `/kube-frontend/clusters` | ✓ | 集群列表 |
| `/terminal/*` | — | ✗ | 容器终端 / kubectl / 节点终端（独立新窗口）整条链路缺失 |

## B. 平台访问控制（老 `/access`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/access/accounts` | `/kube-frontend/access/users` | ⇄ | 改名 accounts → users |
| `/access/accounts/:name` | `/kube-frontend/access/users/$name` | ✓ |  |
| `/access/roles` | `/kube-frontend/access/clusterroles` | ⇄ | 改名 roles → clusterroles |
| `/access/roles/:name` | `/kube-frontend/access/clusterroles/$name` | ✓ |  |
| `/access/workspaces` | `/kube-frontend/access/workspaces` | ✓ | 新 UI 另有 workspaces/$name 详情（老 console 无） |

## C. 平台设置（老 `/settings`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/settings/base-info` | `/kube-frontend/settings/info` | ⇄ | 工作树中正在迁移 |
| `/settings/third-login` | — | ✗ | 第三方登录（OAuth / LDAP / AD）配置 |
| `/settings/mail` | `/kube-frontend/settings/mail` | ⇄ | 工作树中正在迁移 |
| `/settings/feishu` | — | ✗ | 通知渠道 |
| `/settings/dingtalk` | — | ✗ | 通知渠道 |
| `/settings/wecom` | — | ✗ | 通知渠道 |
| `/settings/slack` | — | ✗ | 通知渠道 |
| `/settings/webhook` | — | ✗ | 通知渠道 |

## D. 应用商店（老 `/apps`、`/apps-manage`，依赖 openpitrix）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/apps` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps/:appId` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps/:appId/deploy` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps-manage/store` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps-manage/store/:appId` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps-manage/categories` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps-manage/reviews/:type` | — | ⊘ | 依赖 openpitrix.appstore |

## E. 企业空间（老 `/workspaces/:workspace`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `overview（页签 usage / ranking / clusters）` | — | ✗ | 整个企业空间作用域在新 UI 不存在 |
| `projects` | — | ✗ |  |
| `federatedprojects` | — | ✗ | 依赖多集群联邦 |
| `devops` | — | ⊘ | 依赖 devops 模块 |
| `apps / apps/:appId` | — | ⊘ | 依赖 openpitrix |
| `repos / repos/:repo_id` | — | ⊘ | 依赖 openpitrix |
| `base-info` | — | ✗ |  |
| `quota` | — | ✗ | 企业空间配额 |
| `roles / roles/:name` | — | ✗ |  |
| `members / members/:name` | — | ✗ | 新 UI 的 `access/workspaces/$name` 只做详情 + 成员列表，不是企业空间控制台 |
| `groups` | — | ✗ | 部门 / 用户组 |

## F. DevOps 工程（老 `/:ws/clusters/:cluster/devops/:devops`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `pipelines / pipelines/:name` | — | ⊘ | 依赖 devops 模块 |
| `cd / cd/:cd` | — | ⊘ | 依赖 devops 模块 |
| `code-repo` | — | ⊘ | 依赖 devops 模块 |
| `base-info` | — | ⊘ | 依赖 devops 模块 |
| `roles / roles/:name` | — | ⊘ | 依赖 devops 模块 |
| `members` | — | ⊘ | 依赖 devops 模块 |
| `credentials / credentials/:credential_id` | — | ⊘ | 依赖 devops 模块 |

## G. 联邦项目（老 `/:ws/federatedprojects/:ns`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `overview` | — | ✗ | 联邦项目作用域整体缺失 |
| `applications(+:name)` | — | ✗ |  |
| `deployments(+:name)` | — | ✗ |  |
| `statefulsets(+:name)` | — | ✗ |  |
| `services(+:name)` | — | ✗ |  |
| `ingresses(+:name)` | — | ✗ |  |
| `volumes(+:name)` | — | ✗ |  |
| `configmaps(+:name)` | — | ✗ |  |
| `secrets(+:name)` | — | ✗ |  |
| `base-info` | — | ✗ |  |
| `quota` | — | ✗ | 联邦项目配额 |
| `gateways(+:gatewayName)` | — | ✗ |  |
| `log-collections` | — | ✗ |  |

## H. 集群作用域（老 `/clusters/:cluster`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/overview` | `overview` | ✓ |  |
| `/nodes` | `nodes` | ✓ |  |
| `/nodes/:node` | `nodes/$name` | ✓ |  |
| `/nodes/:node/gpus/:gpuUuid` | — | ✗ | 单卡详情页 |
| `/edgenodes、/edgenodes/:node` | — | ⊘ | 依赖 edgeruntime 模块 |
| `/gpus` | — | ✗ | GPU 卡列表页（集群级） |
| `/components` | `components` | ✓ |  |
| `/components/:namespace/:name` | — | ✗ | 系统组件详情页 |
| `/projects` | `namespaces` | ⇄ | 改名 projects → namespaces |
| `/projects/:namespace（集群下的项目详情布局）` | — | ✗ | 老 console 可从集群入口直接进项目详情；新 UI 只能先切 workspace 再进项目 |
| `/customresources、/customresources/:name` | `custom-resources、custom-resources/$name` | ✓ |  |
| `/deployments` | — | ✗ | **集群级全命名空间**应用负载页 |
| `/statefulsets` | — | ✗ | 同上 |
| `/daemonsets` | — | ✗ | 同上 |
| `/jobs` | — | ✗ | 同上 |
| `/cronjobs` | — | ✗ | 同上 |
| `/pods` | — | ✗ | 同上 |
| `/services` | — | ✗ | 同上 |
| `/ingresses` | — | ✗ | 同上 |
| `/secrets` | — | ✗ | **集群级**配置 |
| `/configmaps` | — | ✗ | 同上 |
| `/serviceaccounts` | — | ✗ | 同上 |
| `/storageclasses、/storageclasses/:name` | `storageclasses、storageclasses/$name` | ✓ |  |
| `/volumes（PVC，集群级）` | — | ✗ | 集群级持久卷声明列表 |
| `/volume-snapshots` | — | ✗ | 集群级卷快照 |
| `/volume-snapshot-classes、/:name` | — | ✗ | 卷快照类 |
| `/volume-snapshot-content/:name` | — | ✗ | 快照内容详情 |
| `/snapshots/:namespace?` | — | ✗ | 快照页签入口 |
| `/pv/:name` | `persistentvolumes、persistentvolumes/$name` | ⇄ | 老 console 的 PV 详情挂在 `volumes` 页签里；新 UI 拆成独立页（老无 PV 列表路由） |
| `/juicefs-storage` | — | ✗ | 共享存储（JuiceFS 配额/性能/卷） |
| `/monitor-cluster` | `monitor` | ⇄ | 改名；需逐项核对图表与下钻 |
| `/gpu-resource` | — | ✗ | GPU 资源监控页 |
| `/monitor-resource` | — | ✗ | 应用资源监控页 |
| `/alerts` | — | ✗ | **集群级**告警消息 |
| `/alert-rules、/alert-rules/:name（含 builtin）` | — | ✗ | **集群级**告警策略与详情 |
| `/custom-monitoring` | — | ✗ | 自定义监控（需图表引擎） |
| `/base-info` | `settings` | ⇄ | 改名 base-info → settings；可写字段范围不同 |
| `/visibility` | `visibility` | ✓ |  |
| `/members` | `members` | ✓ |  |
| `/roles、/roles/:name` | — | ✗ | **集群级**角色（区别于平台角色 `access/clusterroles`） |
| `/networkpolicies` | — | ✗ | **集群级**网络策略 |
| `/ippools、/ippools/:name` | — | ✗ | 容器组 IP 池 |
| `/log-collections/:component、/:name` | `log-collections` | ⇄ | 老 console 按 logging / events / auditing 三类分页签并各有详情页；新 UI 单页只读展示四类对象 |
| `/gateways/:component、/:gatewayName` | — | ✗ | 集群网关 |
| `/kubeConfig` | — | ✗ | 集群 kubeconfig 管理 |

## I. 集群下的项目详情入口（老 `/clusters/:cluster/projects/:namespace/...`，16 条）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/projects/:namespace 及其下 deployments/statefulsets/daemonsets/jobs/cronjobs/pods(+containers)/services/ingresses/secrets/configmaps/serviceaccounts/volumes/volume-snapshots/networkpolicies 详情` | — | ✗ | 老 console 允许「从集群管理直接进入某个项目的资源详情」；新 UI 的项目页只挂在 `/:workspace/clusters/:cluster/projects/:namespace` 下，必须经过 workspace 上下文。**这是入口能力缺口，不是页面缺失** |

## J. 项目作用域（老 `/:ws/clusters/:cluster/projects/:ns`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/overview` | `overview` | ✓ |  |
| `/applications、/applications/composing(+:name)、/applications/template(+:id)` | — | ✗ | composing 部分不依赖 openpitrix（CRD 应用），template 依赖 openpitrix |
| `/deployments(+:name)` | `deployments(+$name)` | ✓ |  |
| `/statefulsets(+:name)` | `statefulsets(+$name)` | ✓ |  |
| `/daemonsets(+:name)` | `daemonsets(+$name)` | ✓ |  |
| `/jobs(+:name)` | `jobs(+$name)` | ✓ |  |
| `/cronjobs(+:name)` | `cronjobs(+$name)` | ✓ |  |
| `/pods` | `pods` | ✓ |  |
| `/pods/:podName` | `pods/$name` | ✓ |  |
| `/pods/:podName/containers/:containerName` | — | ✗ | **独立容器详情页**（监控/环境变量/日志/终端/文件等页签） |
| `/services(+:name)` | `services(+$name)` | ✓ |  |
| `/ingresses(+:name)` | `ingresses(+$name)` | ✓ |  |
| `/s2ibuilders(+:name)` | — | ⊘ | 依赖 devops 模块 |
| `/grayrelease（cates / jobs）` | — | ⊘ | 依赖 servicemesh 模块 |
| `/volumes(+:name)` | `persistentvolumeclaims(+$name)` | ⇄ | 改名 volumes → persistentvolumeclaims |
| `/volume-snapshots(+:name)` | `volumesnapshots(+$name)` | ✓ |  |
| `/base-info` | `baseinfo` | ✓ |  |
| `/networkpolicies` | `networkpolicies` | ⇄ | 列表已迁，详情未迁 |
| `/networkpolicies/:name` | — | ✗ |  |
| `/configmaps(+:name)` | `configmaps(+$name)` | ✓ |  |
| `/secrets(+:name)` | `secrets(+$name)` | ✓ |  |
| `/serviceaccounts、/serviceAccounts/:name` | `serviceaccounts(+$name)` | ✓ | 老 console 详情路径拼作 `serviceAccounts`（大小写不一致） |
| `/roles` | `roles` | ⇄ | 列表已迁，详情未迁 |
| `/roles/:name` | — | ✗ |  |
| `/members` | `members` | ✓ |  |
| `/log-collections` | `log-collections` | ✓ |  |
| `/gateways` | `gateways` | ⇄ | 列表已迁，详情未迁 |
| `/gateways/:gatewayName` | — | ✗ |  |
| `/alert-rules、/alert-rules/:name（含 builtin）` | `alertingrules` | ⇄ | 改名 alert-rules → alertingrules；详情未迁 |
| `/alerts` | `alerts` | ✓ |  |
| `/custom-monitoring` | — | ✗ | 自定义监控（需图表引擎） |

## 计数

| 判定 | 条数 |
| --- | --- |
| ✓ 已迁移 | 31 |
| ⇄ 有替代 | 15 |
| ✗ 真缺失 | 74 |
| ⊘ 有意不迁移 | 20 |
| **合计（映射条目）** | **140** |
