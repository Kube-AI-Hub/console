# 企业空间控制台 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-console.md)

## 概述

`/kube-frontend/workspaces/<ws>/{overview,projects,members}` 三页，属于新的 `workspace` 作用域。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01

## 设计目标与非目标

目标：把企业空间做成独立作用域（URL、侧栏、面包屑都分开）。非目标：成员邀请、配额、部门、DevOps/联邦项目/应用商店（模块未部署或需额外设计）。

## 关键约束

- 成员：`/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspacemembers`（tenant 路径 404）。
- 项目：`/kapis/resources.kubesphere.io/v1alpha3/namespaces?labelSelector=kubesphere.io/workspace=<ws>`。
- 空间详情：`/kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01 — 新增 `workspace` 作用域，而不是挂在平台下

**为什么**：企业空间的侧栏是它自己的（概览/项目/成员），平台侧的 `访问控制` 侧栏属于另一个读者；把两者混在一处会让「我在哪个作用域」失去意义，也重现了老 console 特意分层的结构。
**被否方案**：在 `access/workspaces/<name>` 上加页签。那是平台管理员查看资产的角度，不是空间管理员的工作台。
**何时重新考虑**：若产品决定取消企业空间层级。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02 — 项目链接的 cluster 段取 placement 的首个集群

**为什么**：项目控制台 URL 必须带 cluster；企业空间的 `spec.placement.clusters` 就是它被放置的集群列表，空列表时回落 `host`。
**被否方案**：用「最后访问的集群」。跨空间跳转会把人带到没放这个空间的集群。
**何时重新考虑**：企业空间支持多集群项目视图时。

## 系统现状

老 console：`/workspaces/:ws/*` 18 条路由（概览、项目、成员、角色、部门、配额、DevOps、应用仓库等）。本页迁前三页；其余属「需额外接口/模块」或「未部署模块」。

## 仓库落点

- 作用域：`areas/registry.ts` 的 `AreaScope` + `workspace` 区域
- 侧栏：`shell/AppShell.tsx` 的 `workspacePath` 分支
- 页面：`apps/console-next/src/pages/workspace/{WorkspaceOverviewPage,WorkspaceProjectsPage,WorkspaceMembersPage}.tsx`
- 路由：`routes/kube-frontend.workspaces.$workspace/{overview,projects,members}/`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 空间详情 | /kapis/tenant.kubesphere.io/v1alpha2/workspaces/&lt;ws&gt; |
| 空间成员 | /kapis/iam.kubesphere.io/v1alpha2/workspaces/&lt;ws&gt;/workspacemembers |
| 空间项目 | /kapis/resources.kubesphere.io/v1alpha3/namespaces?labelSelector=kubesphere.io/workspace=&lt;ws&gt; |

## 不变量

1. 概览的项目数/成员数 = 对应接口返回条数。
2. 项目链接含 workspace / cluster / project 三段。
3. 侧栏三项都在该作用域可达。

## 已知坑

- **`AreaScope` 是联合类型**：新增作用域后，`areasFor` 与 shell 的 active 解析都要有分支，否则侧栏会落回项目菜单且不高亮。
- **成员接口不在 tenant 路径**：`/kapis/tenant.../workspaces/<ws>/members` 返回 404。
- **URL 段 `workspaces` 与工作空间名的冲突**：作用域根是字面量 `workspaces`；若真有同名工作空间，其控制台 URL 会与作用域根同形（当前无此对象）。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01.yaml`
可观测点：`workspace-overview:title/project-count/member-count`、`workspace-projects:surface`、`workspace-members:surface`。

## 后续改进

- 邀请/移除成员已由 [workspace-members.md](./workspace-members.md) 使用空间角色集合承接。
- 配额与部门。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01
