# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01 租户(企业空间)成员 · 邀请、改角色与移除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-members`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{workspace}/members`
- **需求**: `prd/kube-frontend/access-control/workspace-members.md`

## 产品功能

租户(企业空间)成员的可写管理：邀请账号并授予空间角色、修改成员角色、移除成员；名字在每一步都由接口回读核对。

### 关联需求

- `prd/kube-frontend/access-control/workspace-members.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-members.md`](../../../../prd/kube-frontend/access-control/workspace-members.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01** — 成员页提供邀请入口及行级修改角色、移除操作；角色选项仅来自当前空间。邀请要求已有账号和有效角色，修改时用户名不可变；保存后列表与 API 角色一致。移除需要输入用户名确认，仅移除空间绑定，不删除平台用户。读取和提交错误可见，失败保留输入；提交期间禁止重复操作，成功刷新空间成员列表。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-members.md`](../../../../design/kube-frontend/access-control/workspace-members.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-members.md`](../../../../prd/kube-frontend/access-control/workspace-members.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 管理空间成员的访问权限 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **邀请用户并调整或撤销其空间角色**，以便 **让团队获得适合的权限**。

**Independent Test**：邀请一个一次性平台用户，回读角色；改为另一个空间角色并回读；移除后空间列表不再含该用户，平台账号仍然存在。

## 前置与配置

- 已登录且有账号、空间角色读取及成员写入权限
- 空间至少有两个角色；仅操作唯一命名的一次性测试用户

## 测试步骤

1. 创建一次性平台账号并打开空间成员页
2. 邀请账号并选择真实空间角色，回读成员角色
3. 修改为另一个空间角色，回读角色
4. 输入用户名确认移除，回读成员集合与平台账号

## 期望结果

- 两次写入的角色与用户选择一致
- 移除后空间成员不存在而平台账号仍在
- finally 移除测试绑定并删除测试账号

## 失败排查

- 邀请返回 4xx：确认空间角色存在且当前账号有 workspacemembers 写权限
- 回读角色没变：检查写的是注解 iam.kubesphere.io/workspacerole 还是 rolebinding
- 成员仍在：移除是解绑而不是删平台账号，别把两者混为一谈

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 的 workspace_member_* 辅助与 WorkspaceMemberDialog.tsx
