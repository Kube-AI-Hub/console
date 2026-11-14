# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06 租户(企业空间)控制台 · 用户组成员增删

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{workspace}/user-groups`
- **需求**: `prd/kube-frontend/access-control/workspace-user-groups.md`

## 产品功能

选定用户组后添加已有平台用户，移除时只删 GroupBinding，不删平台账号。

### 关联需求

- `prd/kube-frontend/access-control/workspace-user-groups.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06** — 已知已选中一个用户组，当点「添加成员」并提交存在的平台用户名，则成员表出现该用户，且 `groupbindings` 含该组与该用户；对该成员执行「移除成员」并输入用户名确认后，成员表与绑定中不再含该用户，平台账号仍在。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-user-groups.md`](../../../../design/kube-frontend/access-control/workspace-user-groups.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 把人加进或移出当前用户组 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **把已有平台用户加入当前组、或从组里移除**，以便 **一批人共享该组的租户(企业空间)角色**。

**Independent Test**：选定测试组，添加一次性账号 → 成员表与 `groupbindings` 含该用户；输入用户名确认移除 → 绑定消失，平台账号仍在。

## 前置与配置

- 已登录且有 groupbindings 写权限
- 仅操作 unique 前缀的一次性用户与用户组

## 测试步骤

1. 创建一次性平台账号与一次性用户组
2. 打开用户组页，选中该组，添加该账号
3. 回读 groupbindings 含该用户
4. 移除成员并输入用户名确认
5. 回读绑定与平台账号

## 期望结果

- 添加后成员表与绑定含该用户
- 移除后绑定不再含该用户，账号 GET 仍 200
- finally 删除测试组与测试账号

## 失败排查

- 添加 4xx：POST 体必须是 [{userName, groupName}]，groupName 是对象名
- 移除后账号 404：误走了 users DELETE

## 产品改版后如何更新自动化

- 选择器：workspace-user-groups:add-member / :search / 成员行 data-ai-row
