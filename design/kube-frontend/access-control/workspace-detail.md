# 企业空间详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-detail.md)

## 概述

读一个企业空间对象与其项目列表（按命名空间标签），只读展示。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01

## 设计目标与非目标

目标：一屏回答「这个企业空间里有什么」；项目名可点。非目标：成员/角色、编辑/删除。

## 关键约束

- 企业空间：`/kapis/tenant.kubesphere.io/v1alpha2/workspaces/<name>`（与写同一存储）。
- 项目：`/kapis/resources.kubesphere.io/v1alpha3/namespaces?labelSelector=kubesphere.io/workspace=<name>&limit=-1`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01 — 项目归属只认标签

**为什么**：KubeSphere 把项目归属写成命名空间上的 `kubesphere.io/workspace` 标签，没有反向索引。按标签过滤是唯一与平台一致的判定；任何本地缓存或按名称推断都会在项目改名/迁移后失效。

**被否方案**：读企业空间对象的 `status` 找项目列表。该字段并不存在（实测 status 为 null）。

**何时重新考虑**：平台提供按企业空间反查项目的接口时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02 — 成员与角色不显示

**为什么**：`/workspaces/<name>/members` 在本集群返回 404，成员数据在另一个聚合里。**放出空表比不显示更糟**——空表会被读成「这个企业空间没有任何人有权限」。

**被否方案**：显示空成员表并加一句「暂未迁移」。同一页面上「空」与「未实现」看起来一样。

**何时重新考虑**：成员接口可用时（届时与企业空间成员页一起做）。

## 系统现状

老 console 的企业空间详情有概览/项目/成员/角色/集群/配额等多个页签。本页迁出「概览里的静态事实 + 项目列表」；成员、角色、配额编辑与删除均为独立功能点。

## 仓库落点

- 页面：`apps/console-next/src/pages/platform/WorkspaceDetailPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.access/workspaces/$name.tsx`
- 接口：`packages/api-client/src/access.ts` 的 `workspaceDetailApi`
- 文案：`packages/locales/src/index.ts`（`workspace.detail.*`）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 企业空间 | /kapis/tenant.kubesphere.io/v1alpha2/workspaces/&lt;name&gt; |
| 项目 | /kapis/resources.kubesphere.io/v1alpha3/namespaces?labelSelector=kubesphere.io/workspace=&lt;name&gt; |

## 不变量

1. 项目数等于带该标签的命名空间数。
2. 管理员取 `spec.template.spec.manager`，创建者取 `kubesphere.io/creator` 注解。
3. 读取失败只影响对应区块。

## 已知坑

- **status 为 null**：不要从 status 里找项目或状态，状态在列表行里由对象推断。
- **项目链接需要 workspace 段**：项目 URL 是 `/kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/…`；企业空间详情在平台段下，构造链接时必须把 workspace 补上。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01.yaml`
可观测点：`workspace-detail:surface`、`workspace-detail:basic`、`workspace-detail:projects`、`workspace-detail:project-list`。

## 后续改进

- 成员与角色（依赖成员接口）。
- 企业空间配额与编辑。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01
