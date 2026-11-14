# TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01 密码设置 · 必填、规则（含特殊字符）与一致性在本地拦下且不发请求

- **用例 ID**: `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `user-settings` `password`
- **入口**: `{BASE_URL}/kube-frontend`
- **需求**: `prd/kube-frontend/user-settings/password.md`

## 产品功能

['密码设置页签在提交前就挡住这些问题：三项必填、新密码不满足平台规则（至少 8 个字符且不超过 64 字节，同时含小写字母、大写字母、数字与特殊字符——下限按字符、上限按字节）、两次输入不一致；被挡下时不发写请求。']

### 关联需求

- `prd/kube-frontend/user-settings/password.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/user-settings/password.md`](../../../../prd/kube-frontend/user-settings/password.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01** — 已知在「密码设置」页签，当当前密码、新密码或确认密码为空，或新密码不满足规则（至少 8 个字符且不超过 64 字节、同时包含小写字母、大写字母与数字），或两次输入不一致时点「修改密码」，则保存被拒绝并给出对应提示，且不发出写请求。
- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03** — 已知在「密码设置」页签，当新密码满足长度、小写、大写、数字与两次一致，但不含规则里列出的任何一个特殊字符时点「修改密码」，则保存被拒绝并显示「密码需包含特殊字符。」，且不发出写请求。

### 关联设计

- 技术方案 [`design/kube-frontend/user-settings/password.md`](../../../../design/kube-frontend/user-settings/password.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/user-settings/password.md`](../../../../prd/kube-frontend/user-settings/password.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 改自己的密码，改完必须重新登录 (Priority: P1)

作为 **登录用户**，我希望 **用当前密码换一个更强的新密码，并在输入时就看到还缺哪一项**，以便 **在怀疑密码泄露时能自己止损，而不是等管理员重置**。

**Independent Test**：用一个可丢弃账号登录，先在「密码设置」里输入不含特殊字符的新密码，核对提示「密码需包含特殊字符。」且没有发出写请求；再输入合规密码，核对强度面板显示「强」；提交成功后核对已回到 `/login`，用旧密码登录失败、用新密码登录成功。

## 前置与配置

- 用管理员令牌通过 kapis 新建临时账号 tc-e2e-uset-<uuid>（platform-regular），用例结束在 finally 里删除
- 在独立 browser context 里用登录页真登录该临时账号

## 测试步骤

1. 以临时账号登录，从账号菜单打开「用户设置」，切到「密码设置」
2. 不填任何字段直接点「修改密码」
3. 三项都填，新密码用 abcdefgh1（缺大写）再点一次
4. 新密码改成 Abc1（太短）再点一次
5. 新密码换成 30 个汉字（字符数没超、字节数 90 超限）再点一次
6. 新密码换成 Abcdefg1（8 位、大小写与数字齐全，无特殊字符）再点一次
7. 新密码与确认密码填成两个不同的合规值（都带特殊字符）再点一次
8. 统计整个过程的写请求

## 期望结果

- 第一次显示「请填写当前密码、新密码与确认密码。」
- 缺大写时显示「密码需包含大写字母。」
- 太短时显示「密码至少 8 位。」
- 30 个汉字时显示「密码不能超过 64 字节。」（上限按 UTF-8 字节计，不按字符数）
- 缺特殊字符时显示「密码需包含特殊字符。」
- 不一致时显示「两次输入的密码必须一致。」
- 六次都没有发往 users/<name> 或 /password 的写请求
- 弹窗始终留在原地（没有签出、没有跳转）

## 失败排查

- 出现 422 说明前端没挡住，服务端拒绝的正文是整条准入正则，不适合直接展示
- 提示文案对不上：密码规则与措辞的唯一来源是 api-client 的 passwordProblem 与 locales

## 产品改版后如何更新自动化

- 规则或文案变化时改用例里的常量与 pages/user_settings.py
