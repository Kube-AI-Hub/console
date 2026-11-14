# 租户(企业空间)成员 — 技术方案（L3）

[关联需求](../../../prd/kube-frontend/access-control/workspace-members.md)

## 概述

WorkspaceMembersPage 管列表与写操作，WorkspaceMemberDetailPage 管下钻；workspaceMembersApi 封装 IAM 成员集合与 tenant 下的成员项目/DevOps 集合。角色选项仍走 workspaceRolesApi。

## 关联需求

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-02`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03`

## 设计目标与非目标

- **目标**：在同一 IAM 成员对象上补齐旧页的查找、自我保护、批量解绑和成员下钻，不另开数据源。
- **非目标**：角色规则编辑、平台账号删除、项目成员绑定、邀请搜索弹窗。

## 关键约束

- 成员读写：`/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspacemembers`。tenant 同名集合 404，不能换路径。
- 成员项目：`/kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>[/klusters/<cluster>]/workspacemembers/<user>/namespaces`。
- 成员 DevOps：同上，末段 `/devops`。
- 中文界面「企业空间」一律写成「租户(企业空间)」，键名不改。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01 — 复用表单组件而非项目成员接口

**为什么**：交互相同但授权作用域和请求结构不同；共享 ResourceForm 和 DeleteDialog，将空间 API 与 schema 留在本模块，角色页复用同一 reader。

**被否方案**：把工作空间名当 namespace 调项目接口；会授予错误作用域的权限。自由文本角色也不能证明角色存在，必须由当前空间集合提供。

**何时重新考虑**：多个作用域出现一致的授权策略时提取通用授权外壳，仍保留各自 adapter。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-02 — 列表一次拉全量，搜索与自我保护在客户端做

**为什么**：空间成员通常远小于平台用户；旧页 `searchType=name` 也是对当前集合过滤。`limit=-1` 后按用户名/邮箱包含匹配，不必再发明服务端 name= 参数。当前用户用 `useAuth().user.name` 隐藏行菜单并 `isRowSelectable=false`，避免勾选后批量移除把自己踢出。

**被否方案**：每次按键请求 `name=`。成员少时只会放大延迟，且搜索框已经是受控本地状态。把自我保护做成点了再报错：旧页直接不给入口，点了才失败会让人以为权限坏了。

**何时重新考虑**：单空间成员过千且出现可分页的 workspacemembers 查询参数时，再把搜索交给服务端。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03 — 详情页内 Tabs；DevOps 404 当空

**为什么**：旧详情有 `/members/:name/projects|devops` 两个路由，新路由树已用 `$name` 一页承接身份属性；再拆子路由只为复刻 URL，不增加可观察能力。DevOps 在旧页受 `ksModule: devops` 开关控制，本集群常常没有该 CRD，404 等于「未启用」，整页错误会让人以为成员丢了。

**被否方案**：缺 DevOps 就隐藏页签。读者无法区分「没有这个模块」和「实现漏了」。独立 `/projects` `/devops` 路由会让面包屑和侧栏高亮再分一套。

**何时重新考虑**：DevOps 成为默认安装且需要可分享的子 URL 时，再把页签做成子路由。

## 系统现状

旧页 `pages/workspaces/containers/Members`：邀请、改角色、移除、批量移除、按名搜索、用户名+邮箱链到详情、`USER_${status}`、未登录文案、不能操作自己。详情属性 WORKSPACE / WORKSPACE_ROLE / EMAIL，页签项目与 DevOps。新页原先只有邀请/改角色/单人移除，缺其余。

## 仓库落点

- 页面：`apps/console-next/src/pages/workspace/{WorkspaceMembersPage,WorkspaceMemberDetailPage,WorkspaceMemberDialog}.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.workspaces.$workspace/members/{index,route,$name}.tsx`
- 接口：`packages/api-client/src/access.ts` 的 `workspaceMembersApi`
- 文案：`packages/locales/src/index.ts`（`workspace.members.*`）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 角色集合 | GET `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles?limit=-1` |
| 账号存在 | GET `/kapis/iam.kubesphere.io/v1alpha2/users/<username>` |
| 邀请 | POST `/workspaces/<ws>/workspacemembers` 体 `[{username, roleRef}]` |
| 改角色 | PUT `/workspaces/<ws>/workspacemembers/<username>` 体 `{username, roleRef}` |
| 移除 | DELETE 同上对象路径；批量是连续 DELETE，不是新动词 |
| 成员对象 | GET 同上对象路径 |
| 成员项目 | GET tenant `.../workspacemembers/<user>/namespaces` |
| 成员 DevOps | GET tenant `.../workspacemembers/<user>/devops` |

## 不变量

1. 邀请和改角色不得把别名提交为 roleRef。
2. 移除只调用空间成员对象 DELETE，不调用 users DELETE。
3. 写失败保留弹窗与输入；成功 invalidates 当前空间成员查询。
4. 当前登录用户不能出现在选择集，也不能看到修改/移除。
5. `spec.email` 优先于注解；`status.lastLoginTime` 优先于改密注解。

## 已知坑

- POST 是数组，PUT 是单对象；URL 用户名必须与 PUT body 一致。
- 账号读取可能独立于成员写权限，读取拒绝时停止邀请并显示错误，不跳过存在性校验。
- 移除空间绑定不表示项目中的独立绑定也被移除。
- DevOps 404 必须当空，403 仍要当权限错误露出。
- 批量确认词是人数不是拼接用户名（DeleteDialog 既有规则）。

## 测试与可观测

API 单测检查路径、请求体、邮箱映射、404 DevOps、批量 DELETE。UI 单测检查无效角色、锁定身份、搜索、自我保护。B200 用例创建唯一用户，只在一次性账号上写权限，finally 移除绑定并删除测试账号。句柄：`workspace-members:invite/search/select/bulk-remove/dialog/delete-input/delete-confirm`，详情 `workspace-member-detail:surface/basic/tab:projects/tab:devops`。

## 后续改进

项目成员、配额、用户组仍在 CHECK-05 其余项；邀请搜索弹窗等有明确产品要求时再改。中文产品名已切到「租户(企业空间)」。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-02`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03`
