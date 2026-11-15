# 集群成员 · 写能力（邀请 / 改角色 / 移除 / 批量移除）

> 单元：CHECK-05「成员/角色/用户全任务」中集群成员的写能力。日期 2026-11-16。
> 方法：docs/legacy-ui-migration-guide.md；模板：docs/plans/page-migration-template.md。
> 规格：prd|design/kube-frontend/cluster-management/cluster-members.md（US2、AC-CLUSTER_MEMBERS-02、DEC-02..04、CON-02、GOT-02/03）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务 | 集群管理员把平台账号授予集群角色、事后调整角色或收回，而不必手写 ClusterRoleBinding |
| 旧入口/源码 | `clusters/containers/Members/index.jsx`（邀请 + 行内改角色/移除 + 批量移除 + 自己不可操作） |
| 新入口/文件 | `/kube-frontend/clusters/<cluster>/members`；`pages/cluster/ClusterMembersPage.tsx`；`packages/api-client/src/iam.ts`（clusterMembersApi） |
| 环境/角色 | B200 host，admin；本地全栈 BFF 8092 → 隧道 18088 |
| 视口 | 1024/1280/1600 + 英文 1280；深色主题 |
| 子页面与状态 | 列表（四列）/ 邀请弹窗 / 改角色弹窗 / 移除确认（单条输入用户名、批量列名单）/ 空错态 / 无写权限说明 |
| 并行边界 | 只改 ClusterMembersPage、api-client iam.ts、locales、cluster-members PRD/design、该页 spec/test；未触碰并行线的 cluster monitor / custom monitoring / gateway 在途文件 |

## 2. 旧能力与归宿

| 旧能力 | 归宿 | AC / 用例 |
| --- | --- | --- |
| 列表四列（用户名/状态/集群角色/最近登录） | 保留（已交付） | AC-01；TC-01 |
| 邀请成员（用户名 + 角色下拉） | **补齐**：POST clustermembers（数组 body），角色候选只列 `cluster-*` 与含 aggregation-roles 注解的角色 | AC-02；TC-02 |
| 行内改角色 | **补齐**：PUT …/clustermembers/<username> | AC-02；TC-02 |
| 行内移除（输入用户名确认） | **补齐**：DELETE …/clustermembers/<username>，确认按钮在输入正确用户名前禁用 | AC-02；TC-02 |
| 批量移除（勾选多行） | **补齐**：不可写/自己的行不可勾选；确认弹窗列出名单 | AC-02；TC-02 |
| 自己那一行不可操作 | **补齐**：显示「当前账号」，无复选框、无行操作 | AC-02；TC-02 |
| 无写权限时隐藏入口 | **补齐**：SSAR（create/delete clustermembers），检查失败 fail-open | AC-02 |
| 角色规则本身 | 不迁移（属平台角色详情，已登记） | PRD 明确不做 |

## 3. 数据契约与全链路（2026-11-16 实测）

| 动作 | 请求 | 回读证据 |
| --- | --- | --- |
| 列成员 | `GET /kapis/iam.kubesphere.io/v1alpha2/clustermembers?limit=-1` | 本集群 1 条（admin / cluster-admin） |
| 角色候选 | `GET …/clusterroles?limit=-1` | 211 条，其中 `cluster-admin`、`cluster-viewer` 为可分配（其余为插件控制器角色） |
| 邀请 | `POST …/clustermembers`，body `[{username, roleRef}]` | 200；成员集合出现该账号，注解 `iam.kubesphere.io/clusterrole` = 所选角色 |
| 改角色 | `PUT …/clustermembers/<username>`，body `{username, roleRef}` | 200；注解更新 |
| 移除 | `DELETE …/clustermembers/<username>` | 200；集合不再包含该账号（可能延迟数秒） |

## 4. 交互、视觉与复用

- 主操作「邀请成员」在工具栏右侧；批量「删除」只在有选中时可用（共享 ResourceList 的既有行为）；行操作收在行尾更多菜单。
- 移除确认沿用项目成员页的模式：单条要输入用户名，批量列出名单。
- 未新增公共组件：复用 ResourceList / Modal / Select / Input / Button 与 actionProps。

## 5. 编码与回归

- api-client `clusterMembersApi` 增加 `roles()/invite()/changeRole()/remove()`，并在 barrel 导出 `ClusterRoleOption`。
- 修复一处**真实缺陷**：邀请弹窗的重置 effect 依赖了异步到达的 `roles`，角色列表加载完成时会把已输入的用户名清空（表现为「填了名字却说请输入用户名」）。改为重置只依赖 `open`，默认角色用函数式更新补齐（GOT-02）。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未通过或未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 上表 7 项全部有归宿；角色规则不迁移已登记 | — |
| 数据语义 | 通过 | 邀请/改角色/移除均按接口回读核对（注解、集合成员） | — |
| 交互与权限 | 通过 | 自我保护（无复选框、无行操作）、批量移除（禁用→选中→启用）、本地校验（空用户名不发请求） | 真实非 admin 身份的 403 分支未验收（本环境仅 admin） |
| 视觉与主题 | 通过（人工） | `/tmp/cluster-members-{1024,1280,1600}.png`、`/tmp/cluster-members-en-1280.png`；三档 overflow=0 | 浅色/第二色调未验 |
| 静态/类型/构建/测试 | 通过 | check_docs --strict 本批 0/0；console-next tsc 0；vite build ✓；契约套件 1442 passed；成员相关 E2E 6 passed（-n 0） | 全仓串行 E2E 未跑 |
| 本地全栈/B200 | 通过 | BFF→B200 真实读写，测试账号与成员均清理（收尾集合仅 admin） | 新版部署未验 |
