# 企业空间用户组 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-user-groups.md)

## 概述

`/kube-frontend/workspaces/<ws>/user-groups`：列出该企业空间的 IAM Group，合并 GroupBinding 计算成员数，显示组名、成员数、描述。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04

## 设计目标与非目标

目标：组列表 + 成员数一次答完；作用域正确；不伪造 Group 没有的字段。
非目标：部门树、组的增删改、成员增删、组权限绑定展示。

## 关键约束

- 组在 IAM 聚合的工作空间作用域：`GET /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groups?limit=-1`（实测 200，本部署 `totalItems: 0`）。
- 成员在 `GroupBinding`：`GET /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groupbindings?limit=-1`（实测 200，本部署空集）。CRD：`GroupBinding{groupRef: {name}, users: []}`。
- Group CRD 无 description 字段（只有 `metadata.generateName` 与 `kubesphere.io/alias-name` 注解），描述列读 `kubesphere.io/description` 注解。
- 页面在 workspace 作用域，URL 不带 cluster 段。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE-CONSOLE-09 — 成员数在客户端由 groupbindings 合并，不给每个组发请求

**为什么**：成员关系只存在于绑定对象里，而绑定集合可以一次读完；逐组查询既没有接口也没有必要。一次 join 得到全表成员数，和为 0 时仍是空集而不是错误。
**被否方案**：读用户列表 `/users?group=<g>`（老 console 的 GroupUser 用过类似筛选）。那需要用户读权限，且每组一次请求。
**何时重新考虑**：组数量很大、需要服务端分页与成员过滤时。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-WORKSPACE-CONSOLE-10 — 描述列不把别名当描述

**为什么**：IAM Group 的字段只有名称与别名。把 `alias-name` 塞进「描述」列会让同一字段在两个列出现不同含义；别名放名称列、描述读 `kubesphere.io/description`（没有就 `-`）是唯一诚实的呈现。
**被否方案**：描述列显示别名。字段语义错位，且测试与产品会各自理解错。
**何时重新考虑**：后端给 Group 增加真正的 description 字段。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-WORKSPACE-CONSOLE-11 — 页面直接调用 apiClient.request

理由同配额页的接口决策（见 workspace-quota.md 的对应决策）：本轮读接口只有本页使用、`api-client` 有并行改动；接口稳定后迁移。

## 系统现状

老 console `src/pages/workspaces/containers/Groups`：树形部门视图（GroupTree + GroupUser），读 `stores/group.js` 的 `workspaces/<ws>/groups`，并用 websocket watch；成员通过 `users?group=<g>` 与 `groupbindings` 双读。新 UI 本轮做平铺只读列表。

## 仓库落点

- 页面：`apps/console-next/src/pages/workspace/WorkspaceUserGroupsPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.workspaces.$workspace/user-groups/{route,index}.tsx`
- 侧栏/区域：`areas/registry.ts` workspace 区域（已有条目）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 空间用户组 | `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groups?limit=-1` | `metadata.name`、`metadata.generateName`、`metadata.annotations` |
| 组绑定 | `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groupbindings?limit=-1` | `groupRef.name`、`users[]` |

## 不变量

1. 行集合 = groups 接口返回的 items，不多不少。
2. 成员数 = 所有 groupbindings 中 `groupRef.name` 等于该组对象名的 `users` 长度之和；无绑定为 0。
3. 组名优先别名，其次 `generateName`，最后对象名。

## 已知坑

- `metadata.generateName` 是 KubeSphere 的显示名（创建时必填），不是 K8s 的「随机后缀前缀」；对象名是生成的随机名。不要用对象名当主显示值。
- 绑定可能引用一个已不存在的组：页面的行以 groups 为准，脏绑定不产生行。
- 两个请求必须都成功才算 ready；任一失败显示错误面板（否则会显示「0 个组」的假空态）。
- 本部署无数据，测试对空态是通过路径；若未来有数据，测试按接口计数仍成立。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04.yaml`
可观测点：`workspace-user-groups:surface`、`workspace-user-groups:retry`、`tr[data-ai-row]`（值为组对象名）。

## 后续改进

- 部门树与父子组（`iam.kubesphere.io/group-parent`）。
- 组成员增删（GroupBinding 写路径）。
- 迁移到 `packages/api-client`。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE-CONSOLE-04
