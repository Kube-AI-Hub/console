# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03 用户详情 · 管理员重置密码

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `user-detail`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/user-detail.md`

## 产品功能

非保护账号可在详情重置密码；请求体只有新密码；新密码可登录、旧密码不可；admin 无入口。

### 关联需求

- `prd/kube-frontend/access-control/user-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/user-detail.md`](../../../../prd/kube-frontend/access-control/user-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03** — 已知一个非预置、非当前登录用户，当在详情点「重置密码」并填写符合规则且两次一致的新密码后保存，则 `PUT /users/<名>/password` 的请求体只有 `{ password }`（没有 `currentPassword`），随后用新密码可以登录、用旧密码不能；弱口令或两次不一致时不发请求并提示；保存失败时弹窗保持打开且已填内容仍在；`admin`、`sonarqube` 与当前登录用户的详情不出现「重置密码」。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/user-detail.md`](../../../../design/kube-frontend/access-control/user-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/user-detail.md`](../../../../prd/kube-frontend/access-control/user-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 为他人重置密码 (Priority: P1)

作为 **平台管理员**，我希望 **在用户详情为普通账号设置新密码，且不必知道当前密码**，以便 **用户忘记密码时能重新登录，而不去改预置账号或自己的账号**。

**Independent Test**：创建临时用户，用详情「重置密码」设成新值，用新密码能登录、旧密码不能；`admin` 详情没有该按钮。

## 前置与配置

- 已登录平台管理
- 用例自行创建临时用户（tc-e2e- 前缀），失败也删除

## 测试步骤

1. 用 API 创建临时用户
2. 打开其详情，点重置密码，填写符合规则且两次一致的新密码并保存
3. 用新密码登录 BFF，用旧密码登录应失败
4. 打开 admin 详情，确认没有重置按钮

## 期望结果

- 保存后弹窗关闭
- 新密码登录 200，旧密码登录非 2xx
- admin 详情没有 user-detail:reset

## 失败排查

- 400 incorrect old password：请求体带了 currentPassword
- admin 也有按钮：保护函数未把 preset 算进去

## 产品改版后如何更新自动化

- 选择器见 UserDetailPage.tsx 与 UserResetPasswordDialog.tsx
- 截图不要包含已填写的密码
