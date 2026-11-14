# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08 用户列表 · 预置账号与当前用户保护

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

admin、sonarqube（若存在）和当前登录用户不能勾选，行菜单不含停用/删除/重置密码等写操作；临时用户有这些入口。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08** — 已知当前登录用户是平台管理员，当打开用户列表，则 `admin` 与 `sonarqube`（若列表中有）以及当前登录用户既没有行复选框，行菜单也不含停用、启用、编辑信息、修改平台角色、重置密码、删除；一个非预置临时用户的行菜单含上述写操作（启用/停用按状态互斥）。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 不能误操作预置账号和自己 (Priority: P1)

作为 **平台管理员**，我希望 **预置账号和当前登录用户没有停用、删除、改角色、重置密码入口，也不能被勾选**，以便 **不会把平台锁在门外，也不会停掉正在用的会话**。

**Independent Test**：打开用户列表，`admin` 行没有复选框、没有停用/删除/重置密码；一个临时用户这些入口都在。

## 前置与配置

- 已登录平台管理
- 用例自行创建临时用户（tc-e2e- 前缀），finally 中删除

## 测试步骤

1. 用 API 创建临时用户
2. 打开用户列表，核对该行菜单含重置密码、停用、删除
3. 核 admin 行没有复选框，若有更多菜单则不含停用/删除/重置密码

## 期望结果

- 临时用户可写
- admin 不可选、无破坏性行操作

## 失败排查

- admin 仍能勾选：isRowSelectable 只排除了字符串 admin 以外的预设
- 临时用户没有重置密码：行操作未加 resetPassword

## 产品改版后如何更新自动化

- 选择器见 PlatformListPage.tsx
