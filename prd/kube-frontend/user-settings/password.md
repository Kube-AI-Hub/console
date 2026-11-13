# 密码设置（L3）

[子模块需求](./_index.md)

## 概述

密码设置页签是三个密码框（当前密码、新密码、确认密码）与一个「修改密码」按钮。提交走 `PUT users/<当前用户名>/password`；成功之后会话被显式结束，用户回到登录页，只能用新密码登录。

## 用户故事

### US1 - 改自己的密码，改完必须重新登录 (Priority: P1)

作为 **登录用户**，我希望 **用当前密码换一个新密码，并在改完后被登出**，以便 **在怀疑密码泄露时能自己止损，而不是等管理员重置**。

**Independent Test**：用一个可丢弃账号登录，改密成功后核对已回到 `/login`；用旧密码登录应失败，用新密码登录应成功。

## 验收场景

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01** — 已知在「密码设置」页签，当当前密码、新密码或确认密码为空，或新密码不满足规则（8–64 位且同时包含小写字母、大写字母、数字；长度上限由服务端按 UTF-8 字节计），或两次输入不一致时点「修改密码」，则保存被拒绝并给出对应提示，且不发出写请求。
- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02** — 已知在「密码设置」页签，当当前密码错误时提交，则弹窗保持打开并显示「当前密码不正确」；当当前密码正确时提交，则修改成功并自动退出登录回到登录页，此后旧密码登录失败、新密码登录成功。

## 设计目标

让「我改了密码」这件事在会话层面也是真的：服务端改完密码不会吊销已经签发的 token（实测同一 token 仍能通过 `/api/session/me`），所以退出必须由前端显式完成。

## 约束与边界

- 接口：`PUT /kapis/iam.kubesphere.io/v1alpha2/users/<当前用户名>/password`，正文 `{currentPassword, password}`；成功返回 200 `{"message":"success"}`。
- 规则：长度 8–64，且**同时**含小写字母、大写字母、数字。**上限的单位是字节（UTF-8），不是字符**——实测 90 个字符的密码被拒，正文为 `Too long: may not be more than 64 bytes`；一个 30 字的中文口令就是 90 字节。规则由服务端 admission 强制，客户端用同一条规则提前判断。
- 失败形态（实测）：当前密码错 → **400，纯文本正文** `incorrect old password`；密码不合规 → **422，正文是整条正则**（`should match '^(.*[a-z].*[A-Z].*[0-9].*)$|...'`）。两者都不能直接显示。
- 会话：改密成功后服务端不吊销 token（实测），所以成功路径必须结束会话（`POST /api/session/logout` + 清本地 token）再跳 `/login`。
- 权限边界：只改自己的密码。管理员重置他人密码走「访问控制 → 用户」。
- 与「基本信息」页签的边界：本页不写 `spec`，也不读邮箱；两个页签各自提交，互不携带对方的字段。

## UI 交互设计

- 三个密码框：当前密码（附「您必须输入当前密码才能修改密码。」）、新密码、确认密码；三个框下方常驻一行规则说明「密码需 8–64 位，且同时包含大写字母、小写字母与数字。」。
- 三个框都是密码输入框，`autocomplete` 分别为 `current-password`、`new-password`、`new-password`，让密码管理器分清「旧密码」与「新密码」（老 console 写的 `cur-password` 不是标准 token，浏览器会忽略）。
- 页内底部「修改密码」按钮 `user-settings:password-save`；错误行 `user-settings:password-error` 在按钮上方。
- 提交中按钮进入 loading；失败时保留三个框的内容，用户只需改错的那一个。
- 成功：错误行消失，出现「密码已修改，请用新密码重新登录。」（`user-settings:password-saved`），输入框与按钮随即禁用，约 1.2 秒后退出登录并跳 `/login`。
- 不显示密码强度条：老 console 有强度条，但强度条与平台规则（三个字符类 + 字节上限）不是同一件事，会出现「强度条满格却仍不满足规则」的矛盾；改为一行明确的规则说明。

## 文案与校验

| key | 中文 | 英文 | 用途 |
| --- | --- | --- | --- |
| `userSettings.password.current` | 当前密码 | Current password | 字段名 |
| `userSettings.password.currentHint` | 您必须输入当前密码才能修改密码。 | The current password is required to set a new one. | 当前密码说明 |
| `userSettings.password.new` | 新密码 | New password | 字段名 |
| `userSettings.password.confirm` | 确认密码 | Confirm password | 字段名 |
| `userSettings.password.rule` | 密码需 8–64 位，且同时包含大写字母、小写字母与数字。 | 8–64 characters, with an upper-case letter, a lower-case letter and a digit. | 规则说明 |
| `userSettings.password.required` | 请填写当前密码、新密码与确认密码。 | Fill in the current password, the new password and the confirmation. | 必填提示 |
| `userSettings.password.mismatch` | 两次输入的密码必须一致。 | The two passwords must match. | 不一致提示 |
| `userSettings.password.error.current` | 当前密码不正确。 | The current password is not correct. | 400 的界面文案 |
| `userSettings.password.success` | 密码已修改，请用新密码重新登录。 | Password changed. Sign in again with the new one. | 成功提示 |
| `userSettings.password.save` | 修改密码 | Change password | 按钮 |
| `platform.users.field.passwordShort` | 密码至少 8 位。 | The password needs at least 8 characters. | 长度不足 |
| `platform.users.field.passwordLong` | 密码不能超过 64 字节。 | The password must not exceed 64 bytes. | 超长（按字节） |
| `platform.users.field.passwordLower` | 密码需包含小写字母。 | The password needs a lower-case letter. | 缺小写 |
| `platform.users.field.passwordUpper` | 密码需包含大写字母。 | The password needs an upper-case letter. | 缺大写 |
| `platform.users.field.passwordDigit` | 密码需包含数字。 | The password needs a digit. | 缺数字 |

校验规则（按顺序判断，第一条命中即停；判定函数只有一份，创建用户弹窗与这里共用）：

1. 三项任一为空 → `userSettings.password.required`。
2. 新密码不足 8 位 → `platform.users.field.passwordShort`。
3. 新密码超过 64 **字节**（UTF-8）→ `platform.users.field.passwordLong`。
4. 缺小写字母 / 大写字母 / 数字 → 对应的 `platform.users.field.password*`。
5. 确认密码 ≠ 新密码 → `userSettings.password.mismatch`。
6. 以上都通过 → 发请求。

## 边界情况

- **当前密码错误**：显示「当前密码不正确」，弹窗不关、输入保留，可改正后重试。
- **服务端 422（规则不符）**：显示规则提示，不显示正则原文。
- **新密码是 30 个汉字**：90 字节，超过 64 字节上限，前端就拦住并提示「密码不能超过 64 字节。」，不发请求。
- **新旧密码相同**：客户端不拦，交给服务端判定；若服务端拒绝，按失败提示处理。
- **网络中断 / 5xx**：显示失败提示，弹窗保持打开，输入保留。
- **改密成功但跳转前断网**：本地 token 已清除，刷新即回到登录页。
- **会话已过期（401）**：按失败提示处理；刷新页面后回到登录页。

## 功能需求

- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01**：系统必须在三项任一为空、新密码不合规（含超过 64 字节）或两次不一致时阻止提交，且不发出写请求。
- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02**：系统必须把 400（当前密码错）与 422（规则不符）分别映射为「当前密码不正确。」与规则说明，不显示服务端原文。
- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03**：系统必须在改密成功后结束当前会话（调用退出登录并清除本地 token）再跳转登录页。

## 成功标准

- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01** — 校验失败的各类情形各产生 0 次写请求。
- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02** — 改密成功后 `localStorage` 里的 token 被移除，且 `POST /api/session/logout` 已被调用一次。

## 明确不做

- **两次输入不一致时也提交、让服务端判断**：服务端只收一个 `password`，它无法发现「用户打错了一次」，只能在客户端拦。
- **显示密码强度条**：强度条与平台的字符类规则不是同一件事，两者矛盾时用户会先信强度条。
- **改密后保持登录**：服务端不吊销旧 token（实测），保持登录等于让「改密」没有安全收益。
- **在基本信息页签顺带改密码**：老 console 用一个 onOk 按「data 里有没有 currentPassword/password」分流两种写入，判据与页签无关；新实现按页签拆成两个动作。
- **要求特殊字符**：老 console 的 `PASSWORD_DESC` 文案写着要特殊字符，但 `PATTERN_PASSWORD` 与服务端 admission 都不要求；新 UI 以规则为准，不要求、也不提示特殊字符。
- **管理员重置他人密码**：属于「访问控制 → 用户」。

## 假设

- 平台 admission 对密码的规则就是 8–64 字节 + 小写 + 大写 + 数字；客户端规则与之保持一致。
- 退出登录接口 `POST /api/session/logout` 可用；即使它失败，清掉本地 token 也足以让当前浏览器退出。

## 验收用例

- `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01`
- `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02`
