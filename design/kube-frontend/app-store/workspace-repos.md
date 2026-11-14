# 企业空间应用仓库 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/app-store/workspace-repos.md)

## 概述

`/kube-frontend/workspaces/<ws>/repos` 与 `/apps`：工作空间级的 openpitrix 仓库列表与仓库应用列表，均为只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01

## 设计目标与非目标

目标：两个入口可达、行数与 openpitrix 工作空间集合一致、空态/失败态明确。
非目标：仓库写操作、应用部署、按仓库过滤应用（接口不支持，见 DEC-02）。

## 关键约束

- 工作空间仓库：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos`（实测 200，`items[].repo_id/name/url/status/create_time`，`total_count`）。
- 工作空间应用：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/apps`（实测 200，`items[].app_id/name/description/app_version_types/status/create_time`）。
- 两个页面都在 workspace 作用域，URL 由 workspace 控制台侧栏生成。
- 只读；当前集群写类 webhook 不稳，不提供写入口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01 — 页面内直连 openpitrix 工作空间集合，不扩 api-client

**为什么**：`packages/api-client/src/appstore.ts` 面向**平台商店**（`/kapis/openpitrix.io/v1/apps|categories|reviews`，无 workspace 段）；工作空间集合是同一服务下的另一前缀（`/workspaces/<ws>/repos|apps`）。本轮只有这两个页面读它，直接在页面内请求可以把改动面压到最小，避免与正在修改 api-client 的其他任务冲突。
**被否方案**：在 appstore.ts 增加 workspaceReposApi/workspaceAppsApi。接口稳定、第二个消费者出现后再迁移。
**何时重新考虑**：工作空间应用出现在第二个页面（如项目应用部署）时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02 — 应用页不按仓库过滤

**为什么**：实测 `repo_id` 参数被服务端忽略——`/workspaces/system-workspace/apps?repo_id=builtin-stable` 与不带参数都返回 15 条，`/apps?repo_id=` 返回全部 30 条；且应用对象没有 `repo_id` 字段。若仍按 repo 展示「该仓库的应用」，是拿一个未过滤的列表冒充过滤结果，比不做过滤更糟。
**被否方案**：客户端按 `repo_id` 过滤——对象上没有该字段，无从过滤；或从 repo 详情推导应用集合——repo 详情不含应用列表。
**何时重新考虑**：openpitrix 修正过滤或应用对象补充 repo 关联字段时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03 — 仓库类型如实显示 `-`

**为什么**：本部署的 repo 对象没有 `type`/`repo_type` 字段（实测 sample 只有 repo_id/name/url/status/create_time/sync_period 等）。任务期望的「类型（helm 等）」不能从对象得出；硬编码 helm 是在没有依据时声称一个事实。页面在字段存在时显示，缺失时为 `-`，PRD 边界情况与已知坑都记录。
**被否方案**：默认填 helm（KubeSphere 应用仓库通常为 Helm）；当前商店确实只收 Helm 应用，但仓库对象本身未声明类型，接口变化时默认值会变成错误信息。
**何时重新考虑**：repo 对象补充 `type` 字段，或应用/仓库接口提供类型枚举。

## 系统现状

老 console：`pages/workspaces/containers/Repos` 与 `Apps`，读 `stores/openpitrix/{repo,app}` 的 `kapis/openpitrix.io/v1/workspaces/<ws>/repos|apps`；列表列 NAME/STATUS/URL（apps 另有版本等）。新 UI 此前 registry 只有 planned 入口；本轮补两页只读列表。

## 仓库落点

- 仓库列表：`apps/console-next/src/pages/appstore/WorkspaceReposPage.tsx`
- 仓库应用：`apps/console-next/src/pages/appstore/WorkspaceAppsPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.workspaces.$workspace/{repos,apps}/{route,index}.tsx`
- registry：`areas/registry.ts` 的 app-repos 区域两页 status 改为 ready

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 工作空间仓库 | `/kapis/openpitrix.io/v1/workspaces/<ws>/repos` | `items[].repo_id/name/url/status/create_time`、`total_count` |
| 工作空间应用 | `/kapis/openpitrix.io/v1/workspaces/<ws>/apps` | `items[].app_id/name/description/app_version_types/status/create_time`、`total_count` |

## 不变量

1. 仓库行数 = repos `items` 数；应用行数 = apps `items` 数（一次取全，条目量级小）。
2. 0 条显示空态，不显示空表头。
3. 缺失字段 `-`；不猜测仓库类型、不声称应用与仓库的关联。
4. 页面不发出写请求。

## 已知坑

- **repo_id 过滤是空操作**：带与不带参数返回同样结果（见 DEC-02）。
- **repo 对象没有 type**：不要按 URL 猜类型（见 DEC-03）。
- **`total_count` 而非 `totalItems`**：openpitrix 的分页字段名不同；本页直接用 `items.length`（`limit=-1` 一次取全）。
- **apps 的工作空间前缀**：`/kapis/openpitrix.io/v1/apps` 是平台商店全量（30），工作空间页必须带 `/workspaces/<ws>`（15）。
- **状态值域**：repo `successful`/`syncing`/`failed`，app `active` 等；徽标 tone 只区分成功与其它，未知状态不隐藏。
- **只读**：当前环境写类 webhook 不稳，两页不提供任何写操作。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/app-store/TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01.yaml`
可观测点：`workspace-repos:surface` 与 `workspace-apps:surface`、`tr[data-ai-row]`、`:retry`；空态文案由列表面板的内置空态呈现。

## 后续改进

- 仓库新建/同步/删除（写接口下一批）。
- 应用部署入口（跳到项目应用安装流程）。
- 若 openpitrix 补上 repo↔app 关联，增加按仓库过滤的应用视图（DEC-02）。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01
