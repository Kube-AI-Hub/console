# 企业空间角色 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-roles.md)

## 概述

`/kube-frontend/workspaces/<ws>/roles`：列出该企业空间的 WorkspaceRole，显示名称、规则数、创建时间。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11

## 设计目标与非目标

目标：角色列表与成员页使用的角色名对齐；规则数直接可见。
非目标：角色详情页、平台角色、模板角色管理。
**已移出非目标**：角色与规则的写能力（创建 / 编辑信息 / 编辑权限 / 删除）——2026-11-17 产品复核决定重纳，见 DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-18。

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

理由同配额页的接口决策（见 workspace-quota.md 的对应决策）：本轮读接口只有本页使用、`api-client` 有并行改动；接口稳定后迁移。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-18 — 企业空间角色恢复写能力，入口在列表页

**新决定（2026-11-17 产品复核）**：企业空间角色恢复 CRUD——创建（可从模板复制）、编辑信息、编辑权限规则、删除。入口在角色**列表页**（主操作「创建角色」+ 行操作「编辑信息 / 编辑权限 / 删除」），详情页保持只读。表单复用项目角色的 `RoleCreateDialog` 与 `RolePermissionsDialog`，不另写一套 RBAC 编辑器。

**为什么推翻原判断**：原登记写「写路径是 IAM 聚合与原生 RBAC 两条，均需单独设计表单与校验；本页不提供按钮，避免出现『点了没反应』的假入口」。前半句的担心成立，但结论下错了——项目作用域已经交付了可用的角色编辑器（同一套 `iam.kubesphere.io` 语义，只差作用域参数），因此不需要「单独设计表单」；后半句「假入口」是**不做**的理由，不是**不能做**的证据（迁移指南 §2.3）。

**被否方案（保留原记录）**：
1. 原方案 A「不做写能力，只提供只读列表」。被否原因：产品复核认为空间管理员必须能维护本空间角色，否则只能回平台侧操作。
2. 原方案 B「为空间角色单独写一套规则编辑器」。被否原因：与项目角色的表单/校验会立刻分叉，同一条规则在两处解释（违反宪法「一个事实只出现一次」）。
3. 原方案 C「写入口放详情页」。被否原因：与项目角色页的既有约定不一致（详情只读、写走列表），会造成同一类对象两种交互。

**何时重新考虑**：若空间角色与项目角色的规则模型出现实质差异（例如空间专属的资源类型），再拆独立编辑器。

**落地约定**：
1. **作用域参数化**：复用组件时把 workspace 作为作用域入参传下去，不复制组件、不在页面里再拼一套 IAM URL。
2. **模板角色只读**：`role-template-*` 等平台维护的角色不给写入口（行操作按谓词隐藏，不显示后点击失败）。
3. **写后回读**：创建/编辑/删除成功后重读集合，不以本地缓存乐观更新冒充成功；失败原因留在弹窗内。

**交付（2026-11-17）**：`US2` + `AC-…-11` + `TC-…-11`。实现说明：项目角色的 `RoleCreateDialog`/`RolePermissionsDialog` 把 namespace 与原生 RBAC 写路径写死在组件内，直接参数化会把两个作用域的写语义塞进一个组件；本页改为 `WorkspaceRoleDialog`（同一交互与校验：名称/别名/描述 + 权限模板复选框），写路径走 IAM 聚合。模板来自同集合的 `labelSelector=iam.kubesphere.io/role-template`（实测 19 个）；创建写 `rules: []` + aggregation-roles 注解，由服务端聚合；编辑信息用 merge-patch（清空键 null），编辑权限只替换 aggregation-roles；平台维护（creator=system）与 role-template-* 行操作隐藏；删除输入对象名确认；写后 invalidate 回读。


## 系统现状

老 console `src/pages/workspaces/containers/Roles`：`RoleStore('workspaceroles')` + `withList`，列 = 名称（Avatar 链接）/描述/创建时间，行操作编辑信息、编辑权限、删除。新 UI 增加规则数列；写能力本批按 DEC-18 交付。

## 仓库落点

- 页面：`apps/console-next/src/pages/workspace/WorkspaceRolesPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.workspaces.$workspace/roles/{route,index}.tsx`
- 侧栏/区域：`areas/registry.ts` workspace 区域（已有条目）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 空间角色列表 | `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles?limit=-1` | `metadata.name`、`metadata.creationTimestamp`、`metadata.annotations["kubesphere.io/alias-name"]`、`rules[]` |
| 权限模板 | 同上 + `labelSelector=iam.kubesphere.io/role-template` | 模板名/别名/规则数 |
| 创建 | POST 同集合 | `metadata.name`、annotations `iam.kubesphere.io/aggregation-roles`（JSON 字符串数组）、`rules: []` |
| 编辑信息 | PATCH 对象（merge-patch） | 只发 metadata.annotations，清空键为 null |
| 编辑权限 | PATCH 对象（merge-patch） | 只替换 aggregation-roles |
| 删除 | DELETE 对象 | — |

## 不变量

1. 行数 = 作用域接口返回的 `items.length`（`totalItems` 一致时）。
2. 规则数 = `rules` 数组长度；`rules` 缺失为 0。
3. 同一角色只出现一次。
4. 平台维护（`kubesphere.io/creator=system`）与 `role-template-*` 角色不显示任何写入口。
5. 自定义角色的规则由服务端按 aggregation-roles 聚合；客户端从不手写 `rules`。
6. 写成功后重新读取集合；删除必须输入对象的完整名称。

## 已知坑

- `rules` 可能为 `null`：用 `item.rules ?? []`，否则 `.length` 抛错。
- 别名注解来自 `metadata.annotations`，不是 `spec`；从 spec 读会永远为空。
- 列表顺序由服务端决定；页面不排序（无排序控件），测试不要假设首行是某个角色。
- 创建时间是 RFC3339，必须经 `formatTimestamp` 本地化，直接渲染会出现带 `T`/`Z` 的原始串。

## 测试与可观测

用例：`TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03`（读）与 `…-11`（写）。
可观测点：`workspace-roles:surface`、`workspace-roles:retry`、`tr[data-ai-row]`（值为对象名）、`:create`、`:dialog`、`:name`、`:alias`、`:description`、`:submit`、`:templates`、`:template:<name>`、`:error`、`:delete-input`、`:delete-confirm`。
单测：`packages/api-client/test/workspace-role-writes.test.ts`（创建 body/模板过滤/merge-patch/权限替换/删除）、`apps/console-next/test/workspace-role-writes.test.tsx`（只读判定、表单校验、模板回填）。

## 后续改进

- 角色创建/编辑/删除：已重纳（DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-18），本页跟进实现与用例，不再作为「后续」。
- 迁移到 `packages/api-client`。
- 角色详情页（规则明细）。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11
