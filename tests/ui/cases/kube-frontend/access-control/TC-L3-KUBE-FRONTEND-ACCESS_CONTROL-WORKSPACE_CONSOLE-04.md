# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04 企业空间控制台 · 用户组列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/user-groups`
- **需求**: `prd/kube-frontend/access-control/workspace-user-groups.md`

## 产品功能

企业空间独立作用域：用户组页列出该空间的 IAM Group，成员数由 GroupBinding 合并计算。

### 关联需求

- `prd/kube-frontend/access-control/workspace-user-groups.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 已知企业空间内有 G 个用户组（G 可能为 0），当打开该空间用户组页，则列出 G 行，每行显示组名（别名优先，否则 `generateName`）、成员数与描述；成员数等于绑定中该组的用户数之和；G 为 0 时显示空态；接口失败时显示错误面板与重试。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-user-groups.md`](../../../../design/kube-frontend/access-control/workspace-user-groups.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 企业空间管理员看用户组规模 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到该空间全部用户组及每个组的成员数**，以便 **判断哪些组该维护、哪些组没人**。

**Independent Test**：打开 `/workspaces/<ws>/user-groups`，核对行数等于该空间 `groups` 接口的 `totalItems`；某一组行的成员数等于全部 `groupbindings` 中 `groupRef.name` 指向它的 `users` 长度之和。

## 前置与配置

- 已登录，且能看到至少一个企业空间
- 该企业空间的 groups 与 groupbindings 集合可读（可能均为 0 条）

## 测试步骤

1. 用 API 读企业空间列表，选一个有数据的空间
2. 读 /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groups?limit=-1 得到组 G 与期望行数
3. 读 /workspaces/<ws>/groupbindings?limit=-1，按 groupRef.name 归并 users 计算每组期望成员数
4. 打开该空间的 /user-groups 页
5. 等待 surface 离开 loading
6. 核对表头三列与行数；若 G > 0，核对首行的成员数单元格等于期望值

## 期望结果

- surface 可见且 data-ai-state 从 loading 变为 ready 或 empty
- 表头含 名称 / 成员 / 描述
- 行数等于 G（超过 20 行时为第一页 20 行）
- G 为 0 时表格为空态，页面不报错

## 失败排查

- 页面错误：groups 与 groupbindings 两个请求任一失败都会报错，先单独探测两个路径
- 行数含其他空间组：用了全局 /groups 且没按企业空间过滤
- 成员数恒 0：只读了 Group 对象，没有合并 groupbindings

## 产品改版后如何更新自动化

- 选择器：pages/access_control.py（origin 拼接）、WorkspaceUserGroupsPage.tsx 的 workspace-user-groups:surface
