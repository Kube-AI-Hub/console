# 企业空间角色 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-roles.md)

## 概述

`/kube-frontend/workspaces/<ws>/roles`：列出该企业空间的 WorkspaceRole，显示名称、规则数、创建时间。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03

## 设计目标与非目标

目标：角色列表与成员页使用的角色名对齐；规则数直接可见。
非目标：角色与规则编辑、角色详情、平台角色、模板角色管理。

## 关键约束

- 角色来自 IAM 聚合：`GET /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles?limit=-1`（实测 200；system-workspace `totalItems: 4`）。
- 平台级 `/workspaceroles?limit=-1` 跨全部企业空间，需客户端再按 label 过滤，不采用。
- 页面在 workspace 作用域，URL 不带 cluster 段。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06 — 读工作空间作用域集合，而不是全局集合 + label 过滤

**为什么**：作用域路径由 ks-apiserver 直接按 workspace label 过滤（见 `pkg/models/iam/group` 同类的 label 机制），页面不需要知道 label 名；返回的 `totalItems` 就是本空间的准确总数。
**被否方案**：全局 `/workspaceroles?limit=-1` + 客户端匹配 `metadata.labels.kubesphere.io/workspace`。多企业空间时会把别的空间对象带进响应再过滤，浪费且容易漏过滤。
**何时重新考虑**：需要跨企业空间的角色搜索页时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07 — 名称列同时显示别名与对象名

**为什么**：别名是给人读的，成员绑定里的 `iam.kubesphere.io/workspacerole` 存的是对象名；只显示别名会让读者在成员页看到一个对不上的字符串。
**被否方案**：只显示别名（成员页对不上）；只显示对象名（可读性差）。
**何时重新考虑**：成员页改为显示别名为止。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08 — 页面直接调用 apiClient.request

理由同配额页 DEC-05：本轮读接口只有本页使用、`api-client` 有并行改动；接口稳定后迁移。

## 系统现状

老 console `src/pages/workspaces/containers/Roles`：`RoleStore('workspaceroles')` + `withList`，列 = 名称（Avatar 链接）/描述/创建时间，行操作编辑信息、编辑权限、删除。新 UI 本轮只读，规则数作为新列。

## 仓库落点

- 页面：`apps/console-next/src/pages/workspace/WorkspaceRolesPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.workspaces.$workspace/roles/{route,index}.tsx`
- 侧栏/区域：`areas/registry.ts` workspace 区域（已有条目）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 空间角色列表 | `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles?limit=-1` | `metadata.name`、`metadata.creationTimestamp`、`metadata.annotations["kubesphere.io/alias-name"]`、`rules[]` |

## 不变量

1. 行数 = 作用域接口返回的 `items.length`（`totalItems` 一致时）。
2. 规则数 = `rules` 数组长度；`rules` 缺失为 0。
3. 同一角色只出现一次。

## 已知坑

- `rules` 可能为 `null`：用 `item.rules ?? []`，否则 `.length` 抛错。
- 别名注解来自 `metadata.annotations`，不是 `spec`；从 spec 读会永远为空。
- 列表顺序由服务端决定；页面不排序（无排序控件），测试不要假设首行是某个角色。
- 创建时间是 RFC3339，必须经 `formatTimestamp` 本地化，直接渲染会出现带 `T`/`Z` 的原始串。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03.yaml`
可观测点：`workspace-roles:surface`、`workspace-roles:retry`、`tr[data-ai-row]`（值为对象名）。

## 后续改进

- 角色创建/编辑/删除（需要规则编辑器的权限模型）。
- 迁移到 `packages/api-client`。
- 角色详情页（规则明细）。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03
