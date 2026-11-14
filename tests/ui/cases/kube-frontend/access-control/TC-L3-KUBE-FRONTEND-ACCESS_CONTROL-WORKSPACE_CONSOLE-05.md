# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05 租户(企业空间)控制台 · 用户组创建、层级与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{workspace}/user-groups`
- **需求**: `prd/kube-frontend/access-control/workspace-user-groups.md`

## 产品功能

创建用户组并指定上级与租户(企业空间)角色，下级缩进一级；有下级时不能删除；无下级时输入显示名确认删除。

### 关联需求

- `prd/kube-frontend/access-control/workspace-user-groups.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05** — 已知该空间可写用户组，当点「创建用户组」并提交合法名称、上级与租户(企业空间)角色，则树出现该组；再创建下级组时节点缩进一级；编辑别名后树显示新别名；有下级时删除提示先删下级且对象仍在；删除无下级组需输入显示名确认，确认后组与绑定从接口消失。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-user-groups.md`](../../../../design/kube-frontend/access-control/workspace-user-groups.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 创建、改层级并删除用户组 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **创建用户组、指定上级与租户(企业空间)角色、改别名、再删掉它**，以便 **按部门结构授权，而不用去平台用户里逐个绑角色**。

**Independent Test**：创建一次性用户组（名称、角色，可选上级）→ 树出现该节点；编辑别名后树显示新别名；有下级时删除被拒绝；删掉下级后再删除本组，接口中对象消失。

## 前置与配置

- 已登录且有 groups 写权限
- 空间至少有一个可分配的租户(企业空间)角色
- 仅操作 unique 前缀的一次性用户组

## 测试步骤

1. 读空间列表与 workspaceroles
2. 打开用户组页，创建父组（名称、角色）
3. 再创建下级组，核对其 data-ai-depth 为 1
4. 编辑父组别名并核对树文案
5. 尝试删除仍有下级的父组，对象仍在
6. 删除下级，再删除父组，回读 groups 集合

## 期望结果

- 两棵测试组出现在树中，下级 depth=1
- 有下级时父组删除被拒绝
- finally 后测试组从接口消失

## 失败排查

- 创建 4xx：检查 POST 用 generateName 而不是 metadata.name
- 下级未缩进：parent 标签未写成父组对象名
- 删除父组成功：客户端未拦截 hasChildren

## 产品改版后如何更新自动化

- 选择器：workspace-user-groups:create / :tree-node / :delete / delete-input / delete-confirm
