# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04 租户(企业空间)控制台 · 用户组树

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/user-groups`
- **需求**: `prd/kube-frontend/access-control/workspace-user-groups.md`

## 产品功能

租户(企业空间)独立作用域：用户组页以树列出该空间的 IAM Group，成员数由 GroupBinding 合并计算。

### 关联需求

- `prd/kube-frontend/access-control/workspace-user-groups.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 已知租户(企业空间)内有 G 个用户组（G 可能为 0），当打开该空间用户组页，则 G 为 0 时显示空态「还没有用户组」且「创建用户组」可见；G > 0 时左侧树有 G 个节点，节点主文案为别名（否则 `generateName`），节点上的成员数等于绑定中该组的用户数之和；接口失败时显示错误面板与重试。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-user-groups.md`](../../../../design/kube-frontend/access-control/workspace-user-groups.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清该空间的用户组层级与规模 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **以树看到全部用户组及每个组的成员数**，以便 **判断哪些组该维护、哪些组没人**。

**Independent Test**：打开 `/workspaces/<ws>/user-groups`。无组时看到空态与「创建用户组」。有组时树节点数等于该空间 `groups` 集合；节点上的成员数等于 `groupbindings` 中指向该组的 `users` 长度之和。

## 前置与配置

- 已登录，且能看到至少一个租户(企业空间)
- 该空间的 groups 与 groupbindings 集合可读（可能均为 0 条）

## 测试步骤

1. 用 API 读企业空间列表，选一个有数据的空间
2. 读 /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groups?limit=-1 得到组 G
3. 读 /workspaces/<ws>/groupbindings?limit=-1，按 groupRef.name 归并 users 计算每组期望成员数
4. 打开该空间的 /user-groups 页
5. 等待 surface 离开 loading
6. G 为 0 时核对空态与创建按钮；G > 0 时核对树节点数与成员数

## 期望结果

- surface 可见且 data-ai-state 从 loading 变为 ready 或 empty
- G 为 0 时空态可见，「创建用户组」可见，树节点为 0
- G > 0 时树节点数等于 G；节点上的成员数等于期望值
- 侧栏含 配额 / 租户(企业空间)角色 / 用户组

## 失败排查

- 页面错误：groups 与 groupbindings 两个请求任一失败都会报错，先单独探测两个路径
- 节点含其他空间组：用了全局 /groups 且没按企业空间过滤
- 成员数恒 0：只读了 Group 对象，没有合并 groupbindings

## 产品改版后如何更新自动化

- 选择器：WorkspaceUserGroupsPage.tsx 的 workspace-user-groups:surface / :tree / :create
