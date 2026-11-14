# TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02 密码设置 · 当前密码错误留在弹窗，改成功后自动退出且旧密码失效

- **用例 ID**: `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `user-settings` `password`
- **入口**: `{BASE_URL}/kube-frontend`
- **需求**: `prd/kube-frontend/user-settings/password.md`

## 产品功能

['密码设置页签：当前密码错误时弹窗留在原地并说明原因；当前密码正确时修改成功，自动退出登录回到登录页，旧密码登录失败、新密码登录成功。']

### 关联需求

- `prd/kube-frontend/user-settings/password.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/user-settings/password.md`](../../../../prd/kube-frontend/user-settings/password.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02** — 已知在「密码设置」页签，当当前密码错误时提交，则弹窗保持打开并显示「当前密码不正确」；当当前密码正确时提交，则修改成功并自动退出登录回到登录页，此后旧密码登录失败、新密码登录成功。

### 关联设计

- 技术方案 [`design/kube-frontend/user-settings/password.md`](../../../../design/kube-frontend/user-settings/password.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/user-settings/password.md`](../../../../prd/kube-frontend/user-settings/password.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 改自己的密码，改完必须重新登录 (Priority: P1)

作为 **登录用户**，我希望 **用当前密码换一个更强的新密码，并在输入时就看到还缺哪一项**，以便 **在怀疑密码泄露时能自己止损，而不是等管理员重置**。

**Independent Test**：用一个可丢弃账号登录，先在「密码设置」里输入不含特殊字符的新密码，核对提示「密码需包含特殊字符。」且没有发出写请求；再输入合规密码，核对强度面板显示「强」；提交成功后核对已回到 `/login`，用旧密码登录失败、用新密码登录成功。

## 前置与配置

- 用管理员令牌通过 kapis 新建临时账号 tc-e2e-uset-<uuid>（platform-regular），用例结束在 finally 里删除
- 在独立 browser context 里用登录页真登录该临时账号（改密会结束会话，不能借用共享登录态）

## 测试步骤

1. 以临时账号登录，从账号菜单打开「用户设置」，切到「密码设置」
2. 当前密码填错、新密码合规，点「修改密码」
3. 当前密码改对，点「修改密码」
4. 等弹窗自动退出并跳到登录页
5. 用旧密码登录
6. 用新密码登录

## 期望结果

- 第一次显示 user-settings:password-error「当前密码不正确。」，弹窗仍在、没有成功提示
- 第二次显示 user-settings:password-saved「密码已修改，请用新密码重新登录。」
- 随后自动签出，地址变成 /login 并出现登录页
- 旧密码登录显示登录失败（login:error，data-ai-state 为 error）
- 新密码登录成功，离开登录页回到控制台

## 失败排查

- 改密成功却仍停在控制台：说明只跳了页面没清会话，旧 token 仍然可用（实测平台不主动作废）
- 旧密码还能登进去：改密请求可能打到了错误端点

## 产品改版后如何更新自动化

- 文案或退出登录时序变化时改 pages/user_settings.py 与 pages/login.py
