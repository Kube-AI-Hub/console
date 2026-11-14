# 项目角色详情与已授权用户 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/role-detail.md)

## 概述

`/kube-frontend/<ws>/clusters/<cluster>/projects/<namespace>/roles/<name>`：项目角色的只读详情，两个页签——权限规则（默认）与已授权用户。规则来自 IAM 的 role 对象，已授权用户来自该角色的 RoleBinding subjects。

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01

## 设计目标与非目标

目标：两个页签各自回答「允许什么」「被谁持有」；以 RoleBinding 为授权权威，覆盖 User/ServiceAccount/Group。
非目标：角色与规则的写入、绑定增删、用户对象状态列。

## 关键约束

- 角色详情：`GET /kapis/iam.kubesphere.io/v1alpha2/namespaces/<ns>/roles/<name>`，经 `rolesApi(api).get({cluster, namespace, name})`。
- 绑定：`GET /apis/rbac.authorization.k8s.io/v1/namespaces/<ns>/rolebindings`（原生 RBAC，ks-apiserver 转发）；形如 `{items:[{metadata, roleRef:{kind,name}, subjects:[{kind,name,namespace}]}]}`。
- 没有「按角色查绑定」的接口：整命名空间一次读取后按 `roleRef.name` 过滤（default 实测 53 条，全部指向 viewer）。
- 页面只读：B200 当前 `ks-controller-manager` crash-loop，写类 webhook 连接被拒；本页所有请求都是读，不受影响。
- 依赖：路由布局 `routes/.../roles/route.tsx` 已存在（task-2），新增同级 `roles/$name.tsx`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01 — 已授权用户以 RoleBinding subjects 为源，而不是 users?role=

**为什么**：RoleBinding 是授权的权威对象，subjects 覆盖 User、ServiceAccount、Group；老 console 的 `users?role=<name>` 只列 User 主体，会漏掉服务账号（本集群 default 的 viewer 53 条绑定全是 ServiceAccount）。页面若用它，会显示「没有已授权用户」而实际上有 53 个主体。
**被否方案**：`GET /kapis/iam.kubesphere.io/v1alpha2/users?role=<name>`。漏 SA/Group，且把「绑定」与「用户」两种概念混为一谈。
**何时重新考虑**：产品只关心平台用户视角时，可另加「用户」列而不是替换主体列表。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-02 — 绑定在页面内直连原生 RBAC，不扩 api-client

**为什么**：现成 `roleBindingsApi` 只读 clusterrolebindings（平台角色详情用）；项目角色需要 namespaced 路径。本轮写作用域虽含 api-client，但该文件正被其他任务频繁改动，页面内一次请求 + 过滤把改动面压到最小；两个消费者出现后再统一收进 api-client。
**被否方案**：在 `packages/api-client/src/access.ts` 加 `projectRoleBindingsApi`。会与并行改动冲突，且本任务只需一处读取。
**何时重新考虑**：第二个页面需要项目 RoleBinding（成员页、权限编辑器）时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-03 — 绑定读取失败只降级该页签

**为什么**：规则页签的数据来自另一个接口，绑定读取 403/超时时读者仍应能看到规则；把整页变成错误面板会藏掉已拿到的信息。失败时该页签显示「授权信息不可用」+ 重试，且**不显示空态**（读不到 ≠ 没有）。
**被否方案**：两查询合并成 Promise.all；失败统一空态。
**何时重新考虑**：绑定成为页面主信息时。

## 系统现状

老 console `pages/projects/containers/Roles/Detail`：详情侧栏 + 两个路由页签（`authorizations` 默认、`users`）。新 UI 之前只有列表与「编辑权限」对话框，没有详情页；本轮补详情页与两个页签，规则表与「已授权用户」并页签呈现。

## 仓库落点

- 页面：`apps/console-next/src/pages/settings/RoleDetailPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/roles/$name.tsx`
- 列表入口：`pages/settings/SettingsListPage.tsx` 的角色名改为 `Link`（`data-ai-id=project-role-detail:link:<name>`），roles 路由传入 `workspace`
- 绑定读取：页面内 `apiClient.request`（DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-02）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 角色详情 | `/kapis/iam.kubesphere.io/v1alpha2/namespaces/<ns>/roles/<name>` | `metadata.annotations`（alias/description/creator）、`metadata.creationTimestamp`、`rules[]` |
| 角色绑定 | `/apis/rbac.authorization.k8s.io/v1/namespaces/<ns>/rolebindings` | `roleRef.name`、`subjects[].kind/name/namespace`、`metadata.name` |
| 用户详情（链接） | `/kube-frontend/access/users/<name>` | 仅 User 类型主体 |

## 不变量

1. 规则行数 = role 对象 `rules` 数组长度；为 0 时显示说明。
2. 已授权用户行数 = 所有 `roleRef.name === role` 的 binding 的 subjects 总数（同一主体在两条绑定中各一行）。
3. 绑定读取失败 → 不可用 + 重试，不是空态。
4. 只有 `kind === 'User'` 的主体渲染用户详情链接。
5. 页面不产生任何写请求。

## 已知坑

- **binding 的 roleRef 不是只有 Role**：过滤必须同时看 `roleRef.name`（本 ns 内 Role 与 ClusterRole 同名有可能，严格的实现还应校验 `roleRef.kind === 'Role'`；当前按名字过滤与老 console 的 role 查询一致）。
- **subjects 可能为空**：合法绑定可以没有 subjects，不产生行。
- **主体名 vs 用户对象**：用户被删后 binding 仍指向名字，页面按 binding 显示（不是 404）。
- **53 条绑定的量级**：一次读取足够；但若某项目绑定过千，应改服务端过滤或分页（当前接口不支持 fieldSelector on roleRef）。
- **webhook 故障**：本页绝不触发写；用户详情链接只导航，不写。
- **面 404 的路径**：`/kapis/iam.../namespaces/<ns>/rolebindings` 不可用；原生 RBAC 路径才是读源。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/project-settings/TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01.yaml`
可观测点：列表 `project-role-detail:link:<name>`；详情 `project-role-detail:surface/title/tab:rules/tab:users/rule-table/empty-rules/users/user-table/users-empty/users-unavailable/user:<name>`。

## 后续改进

- 绑定增删（需 webhook 恢复 + 权限模型）。
- 规则编辑器入口（复用 RolePermissionsDialog）。
- User 主体补状态列（需要额外读用户对象）。

## 验收用例

- TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01
