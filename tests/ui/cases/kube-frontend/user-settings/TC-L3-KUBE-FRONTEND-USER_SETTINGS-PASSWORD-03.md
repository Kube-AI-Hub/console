# TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03 密码设置 · 强度面板：四条 checklist、三档强度与进度条

- **用例 ID**: `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `user-settings` `password`
- **入口**: `{BASE_URL}/kube-frontend`
- **需求**: `prd/kube-frontend/user-settings/password.md`

## 产品功能

['新密码框下方常驻一块强度面板：四条 checklist 随输入打勾，强度分弱/中/强三档，除颜色外还有文字标签与进度条（33% / 66% / 100%）。']

### 关联需求

- `prd/kube-frontend/user-settings/password.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/user-settings/password.md`](../../../../prd/kube-frontend/user-settings/password.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04** — 已知在「密码设置」页签，当新密码非空时，则新密码框下方显示密码强度面板：四条检查项（大写与小写字母、数字、特殊字符、8–64 位）的勾选状态随输入实时变化，强度按规则给出「弱 / 中 / 强」三档，且每档都带文字标签而不只靠颜色；新密码清空时面板不渲染。

### 关联设计

- 技术方案 [`design/kube-frontend/user-settings/password.md`](../../../../design/kube-frontend/user-settings/password.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/user-settings/password.md`](../../../../prd/kube-frontend/user-settings/password.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 改自己的密码，改完必须重新登录 (Priority: P1)

作为 **登录用户**，我希望 **用当前密码换一个更强的新密码，并在输入时就看到还缺哪一项**，以便 **在怀疑密码泄露时能自己止损，而不是等管理员重置**。

**Independent Test**：用一个可丢弃账号登录，先在「密码设置」里输入不含特殊字符的新密码，核对提示「密码需包含特殊字符。」且没有发出写请求；再输入合规密码，核对强度面板显示「强」；提交成功后核对已回到 `/login`，用旧密码登录失败、用新密码登录成功。

## 前置与配置

- 已登录（共享登录态即可：本用例只输入不提交，不写账号）

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend，从账号菜单打开「用户设置」，切到「密码设置」
2. 先看新密码框上方的常驻规则说明
3. 先不输入新密码，看强度面板是否存在
4. 新密码输入 abc
5. 换成 Abcdefg1!（四条规则全满足、9 位）
6. 换成 Abcdefgh123!（四条规则全满足、12 位）
7. 换成 Abcdefgh1234（去掉特殊字符）
8. 清空新密码
9. 每一步读取 data-strength、四条 checklist 的 data-met 与进度条宽度

## 期望结果

- 新密码框上方常驻 user-settings:password-rule 规则说明，且文案里写明「特殊字符」
- 新密码为空时页面没有 user-settings:password-strength 节点
- abc 时 data-strength=weak，四条 checklist 的 data-met 全为 false，进度条 33%
- Abcdefg1! 时四条 checklist 的 data-met 全为 true，data-strength=medium，进度条 66%
- Abcdefgh123! 时 data-strength=strong，进度条 100%
- Abcdefgh1234 时 special 的 data-met 翻回 false、length 仍为 true，强度回到 weak
- 三档各有对应文字标签（弱 / 中 / 强），不是只靠颜色
- 清空后强度面板消失

## 失败排查

- 强度只有颜色变化：data-strength 有值但面板里找不到「弱/中/强」文字
- 进度条宽度对不上：实现可能把宽度写在类名里，页面对象先读内联 style，没有就按像素量占轨道的比例
- 面板不出现：检查是不是仍按老 console 的浮层实现，只在 focus 时弹出

## 产品改版后如何更新自动化

- 句柄或三档判定变化时改 pages/user_settings.py
