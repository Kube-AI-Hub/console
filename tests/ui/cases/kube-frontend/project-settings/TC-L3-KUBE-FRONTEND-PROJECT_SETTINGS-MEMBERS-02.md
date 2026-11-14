# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02 项目成员 · 邀请、修改角色与移除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `members`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/members`
- **需求**: `prd/kube-frontend/project-settings/members.md`

## 产品功能

项目成员页可邀请平台用户、修改成员角色、移除成员；成员写入的请求形状与常规资源不同（POST 为数组、PUT/DELETE 按用户名）。

### 关联需求

- `prd/kube-frontend/project-settings/members.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/members.md`](../../../../prd/kube-frontend/project-settings/members.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02** — 已知项目内没有某成员，当点「邀请成员」并提交存在的用户名与项目角色，则该用户出现在成员列表中且 `iam.kubesphere.io/role` 为所选角色；对该成员执行「修改角色」并提交新角色后，回读角色已更新；执行「移除成员」确认后，该成员从列表与接口中消失（用户账号本身不受影响）。POST 体为数组成员；PUT/DELETE 按用户名。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/members.md`](../../../../design/kube-frontend/project-settings/members.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/members.md`](../../../../prd/kube-frontend/project-settings/members.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 邀请与移除项目成员 (Priority: P1)

作为 **项目管理员**，我希望 **把平台用户加入项目、改他们的角色、或把他们移出项目**，以便 **不用去平台级用户管理里绕一圈**。

**Independent Test**：邀请一次性账号为 viewer → 回读成员存在且角色为 viewer → 改为 operator → 回读角色更新 → 移除 → 回读成员不存在，平台账号仍在。

## 前置与配置

- 已登录，且对 default 项目有管理权限
- 使用测试账号 ui-test（平台已存在）；finally 中确保该成员被移除

## 测试步骤

1. 打开项目成员页，点「邀请成员」
2. 填 ui-test 并选择 viewer，提交
3. 用 API 回读成员列表与角色注解
4. 对 ui-test 执行「修改角色」，改为 operator
5. 回读角色注解
6. 执行「移除成员」并确认
7. 回读成员列表

## 期望结果

- 邀请后成员出现在列表，角色为 viewer
- 修改后角色为 operator
- 移除后成员不存在（用户账号仍在）

## 失败排查

- 邀请返回 400 且提示无法反序列化：POST 必须发送数组
- 角色仍未变：PUT 的 body 需含 username 与 roleRef
- 列表不刷新：失效键应为 ['settings','members']

## 产品改版后如何更新自动化

- 选择器见 pages/project_settings.py 与 MemberDialog.tsx
