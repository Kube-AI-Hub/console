# TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01 基本信息 · 用户名与平台角色只读，邮箱初值等于接口值

- **用例 ID**: `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `user-settings` `profile`
- **入口**: `{BASE_URL}/kube-frontend`
- **需求**: `prd/kube-frontend/user-settings/profile.md`

## 产品功能

['基本信息页签把当前登录账号显示成三个字段：用户名与平台角色只读，邮箱可编辑且初值等于 GET users/<当前用户> 的 spec.email。']

### 关联需求

- `prd/kube-frontend/user-settings/profile.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/user-settings/profile.md`](../../../../prd/kube-frontend/user-settings/profile.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01** — 已知已登录，当打开「用户设置 → 基本信息」，则显示当前账号的用户名（只读）、平台角色（只读）与邮箱（可编辑），邮箱初值等于 `GET users/<当前用户>` 返回的 `spec.email`。

### 关联设计

- 技术方案 [`design/kube-frontend/user-settings/profile.md`](../../../../design/kube-frontend/user-settings/profile.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/user-settings/profile.md`](../../../../prd/kube-frontend/user-settings/profile.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 改自己的邮箱，不需要平台管理权限 (Priority: P1)

作为 **登录用户**，我希望 **在用户设置里改自己的邮箱并保存**，以便 **换邮箱后不必找管理员，也不必等审批**。

**Independent Test**：用 platform-regular 账号打开用户设置，把邮箱改成 `new-<时间戳>@example.com` 并保存；重新打开弹窗，核对输入框与 `GET users/<name>` 的 `spec.email` 都是新值；再用 kubectl 核对 `iam.kubesphere.io/platform-role` 注解仍在。

## 前置与配置

- 已登录（共享登录态，本用例只读）

## 测试步骤

1. 用接口读当前登录账号对象，取出 spec.email 与平台角色注解
2. 打开 {BASE_URL}/kube-frontend，从账号菜单打开「用户设置」
3. 在「基本信息」页签读取用户名、平台角色与邮箱输入框的值
4. 尝试判断三个字段是否可编辑

## 期望结果

- 用户名等于当前登录账号名
- 平台角色等于账号注解（iam.kubesphere.io/platform-role 优先，缺省取 globalrole）
- 邮箱输入框初值等于 spec.email
- 用户名与平台角色是文本、不可编辑；邮箱是输入框、可编辑

## 失败排查

- 邮箱初值为空但接口有值：看弹窗是不是拿会话 token 里的快照填表，而不是读接口
- 平台角色显示为空：账号可能既没有 platform-role 也没有 globalrole 注解

## 产品改版后如何更新自动化

- 字段增减时改 pages/user_settings.py
