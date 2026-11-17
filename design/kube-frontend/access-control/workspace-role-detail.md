# 企业空间角色详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-role-detail.md)

## 概述

`/kube-frontend/workspaces/<ws>/roles/<name>`：只读展示一个 WorkspaceRole 的基本信息、规则明细与绑定成员数。列表页（`…/roles`）的角色名链接进入本页。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01

## 设计目标与非目标

目标：规则可逐条核对（apiGroups/resources/verbs），成员数口径与成员页一致；成员读取失败不拖垮整页。
非目标：角色模板/聚合来源展示；逐成员解绑。写能力（创建/编辑信息/编辑权限/删除）已按 2026-11-17 产品复核决定重纳，但**入口在列表页**，本详情页保持只读（见 DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-04）。

## 关键约束

- 详情：`GET /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles/<name>`（实测 200；不存在 404 `workspacerole.iam.kubesphere.io "<name>" not found`）。
- 成员：`GET /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspacemembers?limit=-1`，角色在注解 `iam.kubesphere.io/workspacerole`；没有「按角色查成员」的接口。
- 路由 `roles/route.tsx` 是布局（task-2 已有），本页新增 `roles/$name.tsx`，不改 `roles/index.tsx`。
- 并行改动约束：`packages/api-client/src/access.ts` 正被另一条并行工作在改（邀请/改角色写接口），本页不向其新增函数。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01 — 详情与成员都用 apiClient.request 直连，暂不扩展 api-client

**为什么**：本轮只有本页读这两个形状，且 `access.ts` 正被并行修改；在里面追加 reader 会和写接口的改动互相踩，提交时也无法只带自己的 hunk。两个请求都在页面内完成映射，形状（`rules[]` 与成员注解）只在一处出现。
**被否方案**：扩展 `workspaceRolesApi` 加 `get()`、`workspaceMembersApi` 加 `membersOfRole()`。接口稳定后应迁移过去（见后续改进）。
**何时重新考虑**：第二个页面需要同一组读取，或并行改动落定后统一整理 api-client。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-02 — 成员数由 workspacemembers 注解过滤，而不是查 rolebindings

**为什么**：成员页展示的角色来源就是成员对象上的 `iam.kubesphere.io/workspacerole` 注解；详情页用同一来源计数，两个页面对「谁拥有这个角色」不会给出不同答案。rolebindings 是另一层对象（组/服务账号也可被绑定），用它计数会与成员页不一致。
**被否方案**：扫 `workspacerolebindings` 计数。结果可能大于成员页显示的人数（组绑定、平台账号绑定都会出现），读者会以为两个页面有一个在说谎。
**何时重新考虑**：产品改为以授权主体（而非成员）作为角色详情的读者视角。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-03 — 两个查询独立，成员失败降级为区块说明

**为什么**：打开详情页的第一诉求是看规则；成员集合的读取权限可能与角色读取不同（或恰好抖动）。让成员失败把整页变成错误面板，会把已经拿到的规则也藏起来。
**被否方案**：单个 `Promise.all` 查询，任一失败整页错误。
**何时重新考虑**：成员数成为主信息而非辅助信息时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-04 — 写能力重纳后，详情页仍保持只读

**新决定（2026-11-17 产品复核）**：企业空间角色的创建/编辑信息/编辑权限/删除重新纳入范围，但**写入口全部在角色列表页**（见 `workspace-roles.md` 的 DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-18）；本详情页继续只读。

**为什么推翻原判断**：原「明确不做」把「编辑角色信息、编辑权限规则、删除角色」整体登记为另立，写能力重纳后这句话不再成立——但它成立的**一半**仍然有效：详情页不做写。因此这里改写而不是删除：能力已重纳（事实变了），落点不在本页（边界没变）。

**被否方案（保留原记录）**：
1. 原方案 A「详情页提供编辑/删除入口」。被否原因：与项目角色页的既有约定（详情只读、写走列表）不一致，同一类对象两种交互。
2. 原方案 B「写能力重纳 = 详情页也补齐」。被否原因：写入口越少越好；两个入口会在并发修改时无法判断以谁为准（迁移指南 §4「同一对象只有一处编辑入口」）。

**何时重新考虑**：若详情页成为角色维护的主入口（例如列表改为纯索引），再把写入口迁进来。

**落地约定**：
1. 详情页不渲染任何写按钮；删除/编辑只在列表行操作出现。
2. 详情页读到的规则与列表页编辑后的规则必须同源（`rules` 数组），不出现两个口径。


## 系统现状

老 console `pages/workspaces/containers/Roles/Detail/index.jsx`：详情侧栏（名称/别名/创建时间/创建者/描述）+ 两个页签，默认跳 `authorizations`（权限规则表），另一页签 `users`（已授权用户）。本页把两者合并为一页只读信息，规则表直接呈现，已授权用户收敛为计数 + 用户名列表。

## 仓库落点

- 页面：`apps/console-next/src/pages/workspace/WorkspaceRoleDetailPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.workspaces.$workspace/roles/$name.tsx`
- 列表入口：`pages/workspace/WorkspaceRolesPage.tsx` 的名称列改为 `Link`（新增 `data-ai-id="workspace-roles:name:<name>"`）
- 侧栏/区域：`areas/registry.ts` 的 workspace 区域已有 roles 条目，无需改动

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 角色详情 | `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles/<name>` | `metadata.annotations["kubesphere.io/alias-name"]`、`["kubesphere.io/description"]`、`["kubesphere.io/creator"]`、`metadata.creationTimestamp`、`rules[]` |
| 空间成员 | `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspacemembers?limit=-1` | `metadata.name`、`metadata.annotations["iam.kubesphere.io/workspacerole"]` |

## 不变量

1. 规则表行数 = 详情对象 `rules` 长度；为 0 时渲染说明而非空表头。
2. 成员计数 = `workspacemembers` 中 `iam.kubesphere.io/workspacerole` 等于该角色对象名的条数。
3. 成员读取失败不把页面置为 error；角色读取失败才显示错误面板。
4. 标题/名称使用对象名，不把别名提交或当作身份。

## 已知坑

- **角色名要按路径段编码**：对象名可能含 `.` 等字符；未编码会拼出错误路径。
- **404 是业务态**：手输不存在的角色会得到 `404 workspacerole... not found`，页面用错误面板展示「资源不存在」，不重试成空页。
- **`rules` 可能为空数组**：预设/聚合角色在规则尚未生效时是空数组，必须显示说明而不是「加载中」。
- **`aggregation-roles` 不是授权结果**：从注解二次展开会与 `rules` 不一致，本页只显示 `rules`。
- **成员角色是注解而非字段**：从 `spec`/`status` 读取会永远为空。
- 成员读取可能 403：`workspacemembers` 的读权限与角色读权限不同，已在 DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-03 处理。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01.yaml`
可观测点：列表 `workspace-roles:name:<name>` 链接；详情 `workspace-role-detail:surface/title/name/rule-count/rule-table/empty-rules/member-count/member-list/retry`。

## 后续改进

- 并行改动落定后，把两个读取迁入 `packages/api-client`（DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01）。
- 规则编辑与角色删除：已重纳，落点在角色列表页（`workspace-roles.md` 的 DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-18），本页不跟进。
- 已授权用户按组/服务账号展开（需要 rolebindings）。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01
