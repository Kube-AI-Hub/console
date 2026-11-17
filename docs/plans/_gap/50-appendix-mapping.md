# 附录：老 console 页面 → 新 UI 路由全量映射（2026-11-17 复验）

> **复验基线**：2026-11-17，HEAD `3ee0da93d` 工作树。
> 旧实现取自 `console/src/pages/*/routes/*.js`（脚本枚举，非导航）；新实现取自 `console/kube-frontend/apps/console-next/src/routes/` 的目录与 `$*.tsx` 文件。
> 上一版（2026-11-14）的映射表保留在文末，标注为历史基线。

## 0. 计数

| 作用域 | 老路由 | 路径级已交付 | 结构性对应 | 真缺口 | 未核实 | 批准不做 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 全局 | 7 | 1 | 4 | 0 | 2 |
| 平台访问控制 | 5 | 5 | 0 | 0 | 0 |
| 平台设置 | 9 | 7 | 1 | 0 | 1 |
| 应用商店 | 7 | 4 | 3 | 0 | 0 |
| 企业空间 | 14 | 13 | 1 | 0 | 0 |
| DevOps 工程 | 11 | 11 | 0 | 0 | 0 |
| 联邦项目 | 23 | 0 | 19 | 0 | 4 |
| 集群 | 74 | 67 | 6 | 0 | 1 |
| 项目 | 50 | 48 | 2 | 0 | 0 |
| **合计** | **200** | **156** | **32** | **2** | **2** | **8** |

> 路径级直配 = 新旧 URL 段能一对一映射（含改名）。结构性对应 = 详情页页签、弹窗、重定向或另一作用域承接。
> **真缺口 2 条**：快照类型详情页、项目网关详情页——这是 200 条老路由里唯一没有新落点的两页。其余 198 条有落点（含 36 条由页签/弹窗/重定向/另一作用域承接），另有 4 条未核实。
> **但这只证明「页面有落点」，不证明「能力完整」**——能力级对照见 `10-platform.md` / `20-cluster.md` / `30-project.md` / `40-cross-cutting.md` 的 2026-11-17 复验节。

## 全局

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/404` | `routes/$.tsx` 兜底路由 | 已交付 | — |
| `/auditingsearch` | `clusters/:c/audit-logs`（审计日志） | 别处承接 | — |
| `/bill` | — | 批准不做（部署无计量数据源） | — |
| `/dashboard` | `/kube-frontend`（WorkbenchPage） | 有替代 | — |
| `/eventsearch` | `clusters/:c/events`（资源事件） | 别处承接 | — |
| `/logquery` | `clusters/:c/logs`（集群作用域日志查询） | 别处承接 | — |
| `/support` | — | 已从源码删除（2026-11-17，含路由/页面/文案/资源） | — |

## 平台访问控制

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/access/accounts` | `kube-frontend.access/users` | 已交付 | — |
| `/access/accounts/:name` | `kube-frontend.access/users` | 已交付 | — |
| `/access/roles` | `kube-frontend.access/clusterroles` | 已交付 | — |
| `/access/roles/:name` | `kube-frontend.access/clusterroles` | 已交付 | — |
| `/access/workspaces` | `kube-frontend.access/workspaces` | 已交付 | — |

## 平台设置

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/settings/base-info` | `kube-frontend.settings/info` | 已交付 | — |
| `/settings/dingtalk` | `kube-frontend.settings/dingtalk` | 已交付 | — |
| `/settings/feishu` | `kube-frontend.settings/feishu` | 已交付 | — |
| `/settings/mail` | `kube-frontend.settings/mail` | 已交付 | — |
| `/settings/notification-configuration` | 重定向到 `settings/mail` | 重定向 | — |
| `/settings/slack` | `kube-frontend.settings/slack` | 已交付 | — |
| `/settings/third-login` | — | 批准不做（服务端注入，控制台无写入路径） | — |
| `/settings/webhook` | `kube-frontend.settings/webhook` | 已交付 | — |
| `/settings/wecom` | `kube-frontend.settings/wecom` | 已交付 | — |

## 应用商店

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/apps` | `kube-frontend.apps` | 已交付 | — |
| `/apps-manage/categories` | `kube-frontend.apps-manage/categories` | 已交付 | — |
| `/apps-manage/reviews/:type` | `apps-manage/reviews` 页签 | 有替代 | — |
| `/apps-manage/store` | `kube-frontend.apps-manage/store` | 已交付 | — |
| `/apps-manage/store/:appId` | `apps-manage/store` 内详情 | 未核实 | 10-platform 复验列为未核实 |
| `/apps/:appId` | `kube-frontend.apps.$appId.tsx` | 已交付 | — |
| `/apps/:appId/deploy` | 安装弹窗（非独立路由） | 未核实 | 30-project/10-platform 未逐项核对安装向导字段 |

## 企业空间

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/workspaces/:workspace/apps` | `kube-frontend.workspaces.$workspace/apps` | 已交付 | — |
| `/workspaces/:workspace/apps/:appId` | `kube-frontend.workspaces.$workspace/apps` | 已交付 | — |
| `/workspaces/:workspace/base-info` | `base-info/index.tsx` | 已交付 | — |
| `/workspaces/:workspace/devops` | `clusters/:c/devops`（集群作用域） | 别处承接 | — |
| `/workspaces/:workspace/federatedprojects` | `kube-frontend.workspaces.$workspace/federatedprojects` | 已交付 | — |
| `/workspaces/:workspace/groups` | `user-groups`（改名） | 已交付 | — |
| `/workspaces/:workspace/members` | `kube-frontend.workspaces.$workspace/members` | 已交付 | — |
| `/workspaces/:workspace/members/:name` | `kube-frontend.workspaces.$workspace/members` | 已交付 | — |
| `/workspaces/:workspace/projects` | `projects/index.tsx` | 已交付 | — |
| `/workspaces/:workspace/quota` | `kube-frontend.workspaces.$workspace/quota` | 已交付 | — |
| `/workspaces/:workspace/repos` | `kube-frontend.workspaces.$workspace/repos` | 已交付 | — |
| `/workspaces/:workspace/repos/:repo_id` | `kube-frontend.workspaces.$workspace/repos` | 已交付 | — |
| `/workspaces/:workspace/roles` | `kube-frontend.workspaces.$workspace/roles` | 已交付 | — |
| `/workspaces/:workspace/roles/:name` | `kube-frontend.workspaces.$workspace/roles` | 已交付 | — |

## DevOps 工程

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/:workspace/clusters/:cluster/devops/:devops/base-info` | `devops/$name` 详情页签 | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/cd` | `devops/$name` 详情页签 | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/cd/:cd` | `devops/$name` 详情页签 | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/code-repo` | `devops/$name` 详情页签 | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/credentials` | `devops/$name` 详情页签 | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/credentials/:credential_id` | `devops/$name` 详情页签 | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/members` | `devops/$name` 详情页签 | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/pipelines` | `devops/$name/pipelines` | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/pipelines/:name` | `devops/$name/pipelines/$pipeline.tsx` | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:devops/roles` | `devops/$name` 详情页签 | 已交付 | — |
| `/:workspace/clusters/:cluster/devops/:namespace/roles/:name` | `devops/$name` 详情页签 | 已交付 | — |

## 联邦项目

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/:workspace/federatedprojects/:namespace/applications` | `$name` 页签「工作负载」 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/applications/:name` | `$name/$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/base-info` | `$name` 详情页签「概览」的基本信息 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/configmaps` | `$name` 页签「配置」 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/configmaps/:name` | `$name/$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/deployments` | `$name` 页签「工作负载」+ `$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/deployments/:name` | `$name/$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/gateways` | — | 批准不做（见 capability-matrix CHECK-06） | — |
| `/:workspace/federatedprojects/:namespace/gateways/:gatewayName` | — | 批准不做（见 capability-matrix CHECK-06） | — |
| `/:workspace/federatedprojects/:namespace/ingresses` | `$name` 页签「工作负载」 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/ingresses/:name` | `$name/$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/log-collections` | — | 批准不做（见 capability-matrix CHECK-06） | — |
| `/:workspace/federatedprojects/:namespace/overview` | `$name` 详情页签「概览」 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/quota` | — | 批准不做（见 capability-matrix CHECK-06） | — |
| `/:workspace/federatedprojects/:namespace/secrets` | `$name` 页签「配置」 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/secrets/:name` | `$name/$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/services` | `$name` 页签「工作负载」 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/services/:name` | `$name/$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/statefulsets` | `$name` 页签「工作负载」 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/statefulsets/:name` | `$name/$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/volumes` | `$name` 页签「存储」 | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/volumes/:name` | `$name/$resource/$object` | 有替代 | — |
| `/:workspace/federatedprojects/:namespace/workloads` | 重定向到 `deployments` | 重定向 | — |

## 集群

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/clusters` | `kube-frontend.clusters.index.tsx` | 已交付 | — |
| `/clusters/:cluster/alert-rules` | `kube-frontend.clusters.$cluster/alerting-policies` | 已交付 | — |
| `/clusters/:cluster/alert-rules/:name` | `kube-frontend.clusters.$cluster/alerting-policies` | 已交付 | — |
| `/clusters/:cluster/alert-rules/builtin/:name` | `kube-frontend.clusters.$cluster/alerting-policies` | 已交付 | — |
| `/clusters/:cluster/alerts` | `kube-frontend.clusters.$cluster/alerting-messages` | 已交付 | — |
| `/clusters/:cluster/base-info` | `kube-frontend.clusters.$cluster/settings` | 已交付 | — |
| `/clusters/:cluster/components` | `kube-frontend.clusters.$cluster/components` | 已交付 | — |
| `/clusters/:cluster/components/:namespace/:name` | `kube-frontend.clusters.$cluster/components` | 已交付 | — |
| `/clusters/:cluster/configmaps` | `kube-frontend.clusters.$cluster/configmaps` | 已交付 | — |
| `/clusters/:cluster/cronjobs` | `kube-frontend.clusters.$cluster/cronjobs` | 已交付 | — |
| `/clusters/:cluster/custom-monitoring` | `kube-frontend.clusters.$cluster/custom-monitoring` | 已交付 | — |
| `/clusters/:cluster/customresources` | `kube-frontend.clusters.$cluster/custom-resources` | 已交付 | — |
| `/clusters/:cluster/customresources/:name` | `kube-frontend.clusters.$cluster/custom-resources` | 已交付 | — |
| `/clusters/:cluster/daemonsets` | `kube-frontend.clusters.$cluster/daemonsets` | 已交付 | — |
| `/clusters/:cluster/deployments` | `kube-frontend.clusters.$cluster/deployments` | 已交付 | — |
| `/clusters/:cluster/edgenodes` | `kube-frontend.clusters.$cluster/edgenodes` | 已交付 | — |
| `/clusters/:cluster/edgenodes/:node` | `kube-frontend.clusters.$cluster/edgenodes` | 已交付 | — |
| `/clusters/:cluster/gateways` | `kube-frontend.clusters.$cluster/gateways` | 已交付 | — |
| `/clusters/:cluster/gateways/:component` | `kube-frontend.clusters.$cluster/gateways` | 已交付 | — |
| `/clusters/:cluster/gateways/:component/:gatewayName` | `kube-frontend.clusters.$cluster/gateways` | 已交付 | — |
| `/clusters/:cluster/gpu-resource` | `kube-frontend.clusters.$cluster/gpu-resource` | 已交付 | — |
| `/clusters/:cluster/gpus` | `kube-frontend.clusters.$cluster/gpus` | 已交付 | — |
| `/clusters/:cluster/ingresses` | `kube-frontend.clusters.$cluster/ingresses` | 已交付 | — |
| `/clusters/:cluster/ippools` | `kube-frontend.clusters.$cluster/ippools` | 已交付 | — |
| `/clusters/:cluster/ippools/:name` | `kube-frontend.clusters.$cluster/ippools` | 已交付 | — |
| `/clusters/:cluster/jobs` | `kube-frontend.clusters.$cluster/jobs` | 已交付 | — |
| `/clusters/:cluster/juicefs-storage` | `kube-frontend.clusters.$cluster/juicefs-storage` | 已交付 | — |
| `/clusters/:cluster/kubeConfig` | — | 批准不做（读接口 405） | — |
| `/clusters/:cluster/log-collections` | `kube-frontend.clusters.$cluster/log-collections` | 已交付 | — |
| `/clusters/:cluster/log-collections/:component` | `log-collections` 页签 | 有替代 | — |
| `/clusters/:cluster/log-collections/:component/:name` | `log-collections` 页签 | 有替代 | — |
| `/clusters/:cluster/members` | `kube-frontend.clusters.$cluster/members` | 已交付 | — |
| `/clusters/:cluster/monitor-cluster` | `kube-frontend.clusters.$cluster/monitor` | 已交付 | — |
| `/clusters/:cluster/monitor-resource` | `kube-frontend.clusters.$cluster/monitor-resource` | 已交付 | — |
| `/clusters/:cluster/networkpolicies` | `kube-frontend.clusters.$cluster/networkpolicies` | 已交付 | — |
| `/clusters/:cluster/nodes` | `kube-frontend.clusters.$cluster/nodes` | 已交付 | — |
| `/clusters/:cluster/nodes/:node` | `kube-frontend.clusters.$cluster/nodes` | 已交付 | — |
| `/clusters/:cluster/nodes/:node/gpus/:gpuUuid` | `kube-frontend.clusters.$cluster/nodes` | 已交付 | — |
| `/clusters/:cluster/overview` | `kube-frontend.clusters.$cluster/overview` | 已交付 | — |
| `/clusters/:cluster/pods` | `kube-frontend.clusters.$cluster/pods` | 已交付 | — |
| `/clusters/:cluster/projects` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/configmaps/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/cronjobs/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/daemonsets/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/deployments/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/ingresses/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/jobs/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/networkpolicies/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/pods/:podName` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/pods/:podName/containers/:containerName` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/secrets/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/serviceaccounts/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/services/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/statefulsets/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/volume-snapshots/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/projects/:namespace/volumes/:name` | `kube-frontend.clusters.$cluster/namespaces` | 已交付 | — |
| `/clusters/:cluster/pv/:name` | `kube-frontend.clusters.$cluster/persistentvolumes` | 已交付 | — |
| `/clusters/:cluster/roles` | 平台 `access/clusterroles` | 别处承接 | — |
| `/clusters/:cluster/roles/:name` | 平台 `access/clusterroles/$name` | 别处承接 | — |
| `/clusters/:cluster/secrets` | `kube-frontend.clusters.$cluster/secrets` | 已交付 | — |
| `/clusters/:cluster/serviceaccounts` | `kube-frontend.clusters.$cluster/serviceaccounts` | 已交付 | — |
| `/clusters/:cluster/services` | `kube-frontend.clusters.$cluster/services` | 已交付 | — |
| `/clusters/:cluster/snapshots/:namespace?` | `kube-frontend.clusters.$cluster/snapshots` | 已交付 | — |
| `/clusters/:cluster/statefulsets` | `kube-frontend.clusters.$cluster/statefulsets` | 已交付 | — |
| `/clusters/:cluster/storageclasses` | `kube-frontend.clusters.$cluster/storageclasses` | 已交付 | — |
| `/clusters/:cluster/storageclasses/:name` | `kube-frontend.clusters.$cluster/storageclasses` | 已交付 | — |
| `/clusters/:cluster/visibility` | `kube-frontend.clusters.$cluster/visibility` | 已交付 | — |
| `/clusters/:cluster/volume-snapshot-classes` | `kube-frontend.clusters.$cluster/volume-snapshot-classes` | 已交付 | — |
| `/clusters/:cluster/volume-snapshot-classes/:name` | — | **真缺口** | 无 `$name.tsx`（20-cluster 复验 O-20） |
| `/clusters/:cluster/volume-snapshot-content/:name` | `kube-frontend.clusters.$cluster/volume-snapshot-content` | 已交付 | — |
| `/clusters/:cluster/volume-snapshots` | `kube-frontend.clusters.$cluster/volume-snapshots` | 已交付 | — |
| `/clusters/:cluster/volumes` | `kube-frontend.clusters.$cluster/persistentvolumeclaims` | 已交付 | — |
| `/clusters/:cluster/workloads` | 重定向到 `deployments` | 重定向 | — |

## 项目

| 老路由 | 新 UI | 判定 | 备注 |
| --- | --- | --- | --- |
| `/:workspace/clusters/:cluster/projects/:namespace/alert-rules` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/alertingrules` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/alert-rules/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/alertingrules` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/alert-rules/builtin/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/alertingrules` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/alerts` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/alerts` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/applications` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/applications` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/applications/composing` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/applications` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/applications/composing/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/applications` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/applications/template` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/applications` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/applications/template/:id` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/applications` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/base-info` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/baseinfo` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/configmaps` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/configmaps` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/configmaps/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/configmaps` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/cronjobs` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/cronjobs` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/cronjobs/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/cronjobs` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/custom-monitoring` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/custom-monitoring` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/daemonsets` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/daemonsets` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/daemonsets/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/daemonsets` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/deployments` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/deployments` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/deployments/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/deployments` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/gateways` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/gateways` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/gateways/:gatewayName` | — | **真缺口** | `gateways/` 只有 `index`（30-project 复验 A.3-7） |
| `/:workspace/clusters/:cluster/projects/:namespace/grayrelease` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/grayrelease` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/ingresses` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/ingresses` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/ingresses/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/ingresses` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/jobs` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/jobs` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/jobs/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/jobs` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/log-collections` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/log-collections` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/members` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/members` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/networkpolicies` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/networkpolicies` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/overview` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/overview` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/pods` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/pods` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/pods/:podName` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/pods` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/pods/:podName/containers/:containerName` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/pods` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/roles` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/roles` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/roles/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/roles` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/s2ibuilders` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/s2ibuilder` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/s2ibuilders/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/s2ibuilder` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/secrets` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/secrets` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/secrets/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/secrets` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/serviceAccounts/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/serviceaccounts` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/serviceaccounts` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/serviceaccounts` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/services` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/services` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/services/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/services` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/statefulsets` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/statefulsets` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/statefulsets/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/statefulsets` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/volume-snapshots` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/volumesnapshots` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/volume-snapshots/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/volumesnapshots` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/volumes` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/persistentvolumeclaims` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/volumes/:name` | `kube-frontend.$workspace.clusters.$cluster.projects.$namespace/persistentvolumeclaims` | 已交付 | — |
| `/:workspace/clusters/:cluster/projects/:namespace/workloads` | 重定向到 `deployments` | 重定向 | — |