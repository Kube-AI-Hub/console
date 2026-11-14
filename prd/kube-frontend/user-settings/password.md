# 密码设置（L3）

[子模块需求](./_index.md)

## 概述

密码设置页签是三个密码框（当前密码、新密码、确认密码）、一块随输入更新的密码强度面板、一行随输入更新的确认密码比对提示，与一个「修改密码」按钮。新密码框上方常驻一条规则说明，提交前在客户端按这条规则（8–64 个字符且不超过 64 字节 + 小写 + 大写 + 数字 + 特殊字符）判一遍，不通过不发请求；通过后走 `PUT users/<当前用户名>/password`，成功即结束会话并回到登录页。

## 用户故事

### US1 - 改自己的密码，改完必须重新登录 (Priority: P1)

作为 **登录用户**，我希望 **用当前密码换一个更强的新密码，并在输入时就看到还缺哪一项、两次输入是否一致**，以便 **在怀疑密码泄露时能自己止损，而不是等管理员重置**。

**Independent Test**：用一个可丢弃账号登录，先在「密码设置」里输入不含特殊字符的新密码，核对提示「密码需包含特殊字符。」且没有发出写请求；再输入合规密码，核对强度面板显示「强」；提交成功后核对已回到 `/login`，用旧密码登录失败、用新密码登录成功。

## 验收场景

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01** — 已知在「密码设置」页签，当当前密码、新密码或确认密码为空，或新密码不满足规则（至少 8 个字符且不超过 64 字节、同时包含小写字母、大写字母与数字），或两次输入不一致时点「修改密码」，则保存被拒绝并给出对应提示，且不发出写请求。
- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02** — 已知在「密码设置」页签，当当前密码错误时提交，则弹窗保持打开并显示「当前密码不正确」；当当前密码正确时提交，则修改成功并自动退出登录回到登录页，此后旧密码登录失败、新密码登录成功。
- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03** — 已知在「密码设置」页签，当新密码满足长度、小写、大写、数字与两次一致，但不含规则里列出的任何一个特殊字符时点「修改密码」，则保存被拒绝并显示「密码需包含特殊字符。」，且不发出写请求。
- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04** — 已知在「密码设置」页签，当新密码非空时，则新密码框下方显示密码强度面板：四条检查项（大写与小写字母、数字、特殊字符、8–64 位）的勾选状态随输入实时变化，强度按规则给出「弱 / 中 / 强」三档，且每档都带文字标签而不只靠颜色；新密码清空时面板不渲染。
- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05** — 已知在「密码设置」页签，当在确认密码框里输入的过程中（不点保存），则两次输入不一致时立刻显示「两次输入的密码必须一致。」，改成一致后提示立刻变为「两次输入的密码一致。」，清空确认密码后提示消失；修改新密码时提示立刻重算。

## 设计目标

1. **文案即规则**：界面上写的每一条要求，提交时都真的会拦下来。老 console 的 `PASSWORD_DESC` 承诺了特殊字符，校验却用一条不要求特殊字符的正则——文案在说谎；本轮让文案成为规则。
2. **输入时就能看出还缺哪一项**：强度面板把四条要求逐条勾出来，用户不必提交四次才知道差什么。
3. **两次输入打错要在输入时就发现**：确认密码与提交是同一条判据，但结果实时显示在框下方——等到点「修改密码」才说不一致，等于让用户重打一遍。
4. **改密之后会话必须真的结束**：服务端不吊销已签发的 token（实测），退出由前端显式完成。

## 约束与边界

- 接口：`PUT /kapis/iam.kubesphere.io/v1alpha2/users/<当前用户名>/password`，正文 `{currentPassword, password}`；成功返回 200 `{"message":"success"}`。
- **前端强制的完整规则**（用户设置与创建用户两处共用同一份判定）：
  1. 长度：至少 8 个**字符**，且不超过 64 **字节**（UTF-8）。两个单位各管一端——4 个汉字只有 4 个字符但已占 12 字节，会被字符下限拦；64 个汉字是 192 字节，会被字节上限拦（服务端对超长回 `Too long: may not be more than 64 bytes`）；
  2. 至少一个小写字母；
  3. 至少一个大写字母；
  4. 至少一个数字；
  5. 至少一个特殊字符，集合与界面文案逐字一致：~ ! @ # $ % ^ & * ( ) - _ = + \ | [ ] { } ; : ' " , < . > / ?，以及空格。
- **前端比服务端严**：服务端 admission 只要求 8–64 字节 + 小写 + 大写 + 数字，**不要求特殊字符**。第 5 条只有前端强制，因此直连 API 仍然可以设置不含特殊字符的密码（见「边界情况」）。
- 特殊字符是封闭列表：emoji、中文标点（，。！）都不算；集合外的字符不能用来满足第 5 条。
- 强度三档（弱/中/强）只是上面规则的呈现，不引入熵估算、不做密码泄露比对。
- 失败形态（实测）：当前密码错 → **400，纯文本正文** `incorrect old password`；密码不合规 → **422，正文是整条正则**（`should match '^(.*[a-z].*[A-Z].*[0-9].*)$|...'`）。两者都不能直接显示。
- 会话：改密成功后服务端不吊销 token（实测），所以成功路径必须结束会话（`POST /api/session/logout` + 清本地 token）再跳 `/login`。
- 权限边界：只改自己的密码。管理员重置他人密码走「访问控制 → 用户」。
- 与「基本信息」页签的边界：本页不写 `spec`，也不读邮箱；两个页签各自提交，互不携带对方的字段。

## UI 交互设计

- 三个密码框：当前密码（附「您必须输入当前密码才能修改密码。」）、新密码、确认密码。
- 三个框都是密码输入框，`autocomplete` 分别为 `current-password`、`new-password`、`new-password`，让密码管理器分清「旧密码」与「新密码」。
- **新密码框上方**常驻一块规则说明（`user-settings:password-rule`，老 console `PASSWORD_DESC` 的迁移文案，逐字见「文案与校验」）。它在任何输入状态下都可见——规则不藏在错误提示里，也不是提示气泡。
- **新密码框下方**是强度面板（`user-settings:password-strength`），仅当新密码非空时渲染，面板内从上到下：
  1. 「密码强度」+ 进度条 + **文字标签**（弱 / 中 / 强）；进度条宽度对应 33% / 66% / 100%，颜色只是辅助，色觉障碍用户靠文字标签也能读出档位；
  2. 「您的密码必须：」+ 四条检查项（包含大写与小写字母 / 包含数字 / 包含特殊字符 / 8–64 位），满足打勾、未满足留空；
  3. 「避免使用弱密码或其它账户的密码。」。
- 三档判定：违反上面五条规则中的任意一条 → 弱（含义是「还过不了校验」，不是「短」）；五条全满足且长度 ≥12 个字符 → 强；其余 → 中。三档都可达。
- 新密码清空时面板不渲染（空输入没有「强度」可言，留着只会占位）。
- **确认密码框下方**是一行实时比对提示（`user-settings:confirm-hint`，属性 `data-match=true|false`），随输入更新，不需要点保存：
  - 确认密码为空 → 不渲染该节点（还没输，没有「一致与否」可报）；
  - 非空且与新密码不一致 → 红色「两次输入的密码必须一致。」（`data-match=false`）；
  - 非空且一致 → 绿色「两次输入的密码一致。」（`data-match=true`）。
  改新密码时提示立刻重算：提示由两个输入框的状态派生，不是只挂在确认密码的 change 上。
- 面板的机器可读句柄：根节点 `user-settings:password-strength`（属性 `data-strength=weak|medium|strong`）、进度条 `user-settings:password-strength-bar`、四条检查项 `user-settings:password-check-case` / `-digit` / `-special` / `-length`（属性 `data-met=true|false`）。
- 页内底部「修改密码」按钮 `user-settings:password-save`；错误行 `user-settings:password-error` 在按钮上方。
- 提交中按钮进入 loading；失败时保留三个框的内容，用户只需改错的那一个。
- 成功：错误行消失，出现「密码已修改，请用新密码重新登录。」（`user-settings:password-saved`），输入框与按钮随即禁用，约 1.2 秒后退出登录并跳 `/login`。

## 文案与校验

| key | 中文 | 英文 | 用途 |
| --- | --- | --- | --- |
| `userSettings.password.current` | 当前密码 | Current password | 字段名 |
| `userSettings.password.currentHint` | 您必须输入当前密码才能修改密码。 | The current password is required to set a new one. | 当前密码说明 |
| `userSettings.password.new` | 新密码 | New password | 字段名 |
| `userSettings.password.confirm` | 确认密码 | Confirm password | 字段名 |
| `userSettings.password.rule` | 密码必须包含至少一个数字、一个小写字母、一个大写字母和一个特殊字符（…），长度为 8 到 64 个字符，且不超过 64 字节。 | The password must contain at least one number, one lower-case letter, one upper-case letter and one special character (…), and be 8 to 64 characters long, within 64 bytes. | 常驻规则说明（`PASSWORD_DESC` 迁移，逐字见下表） |
| `userSettings.password.must` | 您的密码必须： | Your password must: | 强度面板里清单的标题 |
| `userSettings.password.check.case` | 包含大写与小写字母 | An upper-case and a lower-case letter | 检查项 1 |
| `userSettings.password.check.digit` | 包含数字 | A digit | 检查项 2 |
| `userSettings.password.check.special` | 包含特殊字符 | A special character | 检查项 3 |
| `userSettings.password.check.length` | 8–64 位 | 8–64 characters | 检查项 4 |
| `userSettings.password.strength` | 密码强度 | Password strength | 进度条标签 |
| `userSettings.password.strengthWeak` | 弱 | Weak | 档位文字标签 |
| `userSettings.password.strengthMedium` | 中 | Medium | 档位文字标签 |
| `userSettings.password.strengthStrong` | 强 | Strong | 档位文字标签 |
| `userSettings.password.strengthHint` | 避免使用弱密码或其它账户的密码。 | Avoid weak passwords, and passwords used by other accounts. | 面板底部说明 |
| `userSettings.password.mismatch` | 两次输入的密码必须一致。 | The two passwords must match. | 确认密码实时提示（不一致，红色） |
| `userSettings.password.match` | 两次输入的密码一致。 | The two passwords match. | 确认密码实时提示（一致，绿色） |
| `userSettings.password.required` | 请填写当前密码、新密码与确认密码。 | Fill in the current password, the new password and the confirmation. | 必填提示 |
| `userSettings.password.error.current` | 当前密码不正确。 | The current password is not correct. | 400 的界面文案 |
| `userSettings.password.success` | 密码已修改，请用新密码重新登录。 | Password changed. Sign in again with the new one. | 成功提示 |
| `userSettings.password.save` | 修改密码 | Change password | 按钮 |
| `platform.users.field.passwordShort` | 密码至少 8 位。 | The password needs at least 8 characters. | 长度不足 |
| `platform.users.field.passwordLong` | 密码不能超过 64 字节。 | The password must not exceed 64 bytes. | 超长（按字节） |
| `platform.users.field.passwordLetter` | 密码需包含字母。 | The password needs a letter. | 没有字母 |
| `platform.users.field.passwordLower` | 密码需包含小写字母。 | The password needs a lower-case letter. | 缺小写 |
| `platform.users.field.passwordUpper` | 密码需包含大写字母。 | The password needs an upper-case letter. | 缺大写 |
| `platform.users.field.passwordDigit` | 密码需包含数字。 | The password needs a digit. | 缺数字 |
| `platform.users.field.passwordSpecial` | 密码需包含特殊字符（…）。 | The password needs a special character (…). | 缺特殊字符 |

规则说明的逐字文案（`PASSWORD_DESC` 迁移；前半句逐字沿用老文案，只把长度那句补上字节上限；特殊字符集合必须与判定逐字一致）：

```text
密码必须包含至少一个数字、一个小写字母、一个大写字母和一个特殊字符（~!@#$%^&*()-_=+\|[{}];:'",<.>/? 或空格），长度为 8 到 64 个字符，且不超过 64 字节。
The password must contain at least one number, one lower-case letter, one upper-case letter and one special character (~!@#$%^&*()-_=+\|[{}];:'",<.>/? or a space), and be 8 to 64 characters long, within 64 bytes.
```

校验规则（按顺序判断，第一条命中即停；判定函数只有一份，创建用户弹窗与这里共用）：

1. 三项任一为空 → `userSettings.password.required`。
2. 新密码不足 8 个字符 → `platform.users.field.passwordShort`。
3. 新密码超过 64 **字节**（UTF-8）→ `platform.users.field.passwordLong`。
4. 没有任何字母 → `platform.users.field.passwordLetter`。
5. 缺小写字母 → `platform.users.field.passwordLower`。
6. 缺大写字母 → `platform.users.field.passwordUpper`。
7. 缺数字 → `platform.users.field.passwordDigit`。
8. 缺特殊字符 → `platform.users.field.passwordSpecial`。
9. 确认密码 ≠ 新密码 → 拒绝提交；此时同一条提示已经在确认密码框下方显示，错误行不再重复渲染同一条文案。
10. 以上都通过 → 发请求。

## 边界情况

- **当前密码错误**：显示「当前密码不正确」，弹窗不关、输入保留，可改正后重试。
- **服务端 422（规则不符）**：显示规则提示，不显示正则原文。
- **4 个汉字**：只有 4 个字符（12 字节），被字符下限拦下，提示「密码至少 8 位。」——只按字节算会误放行。
- **30 个汉字**：90 字节，超过 64 字节上限，提示「密码不能超过 64 字节。」——只按字符算会误放行。
- **只用 emoji 当特殊字符**：emoji 不在集合里，提示「密码需包含特殊字符（…）。」；中文标点同理不算。
- **空格**：空格属于特殊字符集合，可以用它满足第 5 条；密码不做 trim，首尾空格会成为密码的一部分——用户需要自己确认没有误输。
- **直连 API 绕过**：平台 admission 不要求特殊字符，用 `PUT users/<name>/password` 直接提交不含特殊字符的密码会成功。本页是这条规则唯一的执行点，不构成集群级保证。
- **确认密码只输了一半**：立刻按「不一致」处理（红字），不做「等输完再说」的猜测——用户随时可以改。
- **先填确认密码、后改新密码**：提示立刻跟着新密码重算，不会停留在上一次的结论。
- **确认密码为空但新密码非空**：不显示比对提示（提交时仍会被必填拦下，提示走错误行）。
- **不一致时点「修改密码」**：提交被拦，但不重复渲染同一条文案——框下方的红字已经说明了原因。
- **新旧密码相同**：客户端不拦，交给服务端判定；若服务端拒绝，按失败提示处理。
- **网络中断 / 5xx**：显示失败提示，弹窗保持打开，输入保留。
- **改密成功但跳转前断网**：本地 token 已清除，刷新即回到登录页。
- **会话已过期（401）**：按失败提示处理；刷新页面后回到登录页。

## 功能需求

- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01**：系统必须在三项任一为空、新密码不合规（长度至少 8 个字符且不超过 64 字节、小写、大写、数字、特殊字符五条中任一不满足）或两次不一致时阻止提交，且不发出写请求。
- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02**：系统必须把 400（当前密码错）与 422（规则不符）分别映射为「当前密码不正确。」与规则说明，不显示服务端原文。
- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03**：系统必须在改密成功后结束当前会话（调用退出登录并清除本地 token）再跳转登录页。
- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04**：系统必须在新密码非空时显示强度面板，四条检查项的勾选状态与强度档位必须由提交时的同一份判定得出，且每档都带文字标签。
- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05**：系统必须在确认密码非空时实时显示它与新密码是否一致（一致为绿色「两次输入的密码一致。」，不一致为红色「两次输入的密码必须一致。」），并在新密码或确认密码任一变化后立即重算；确认为空时不显示该提示。

## 成功标准

- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01** — 校验失败的各类情形（含缺特殊字符）各产生 0 次写请求。
- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02** — 改密成功后 `localStorage` 里的 token 被移除，且 `POST /api/session/logout` 已被调用一次。
- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03** — 面板的 `data-strength` 与四条 `data-met` 在四个样本上与本页规则一致：五条全满足且 ≥12 个字符 → `strong`；全满足且 ≤11 个字符 → `medium`；缺特殊字符 → `weak`；清空 → 不渲染。
- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04** — 三个档位在界面上都出现文字标签（弱 / 中 / 强），去掉颜色后仍可区分。
- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05** — 从输入确认密码到提交，比对提示无需任何点击就随每次按键更新；改新密码后提示在一个输入事件内变为新结论（不停留在旧结论）。

## 明确不做

- **两次输入不一致时也提交、让服务端判断**：服务端只收一个 `password`，它无法发现「用户打错了一次」，只能在客户端拦。
- **只照抄服务端规则（不要求特殊字符）**：服务端确实不要求，但界面文案承诺了特殊字符；照抄等于继续让文案说谎，本轮明确反过来——文案是规则。
- **只提示不拦截（把特殊字符写成建议）**：提示而不拦，用户会在提交后才发现，等于把规则的执行点推到服务端，而服务端并不执行它。
- **引入 zxcvbn 之类的熵估算或泄露口令库**：三档强度只呈现本页规则；熵估算要带词典与额外体积，还会与「文案即规则」的判定产生第二套口径。
- **改密后保持登录**：服务端不吊销旧 token（实测），保持登录等于让「改密」没有安全收益。
- **在基本信息页签顺带改密码**：老 console 用一个 onOk 按「data 里有没有 currentPassword/password」分流两种写入，判据与页签无关；新实现按页签拆成两个动作。
- **管理员重置他人密码**：属于「访问控制 → 用户」。

## 假设

- 服务端 admission 的规则是 8–64 字节 + 小写 + 大写 + 数字，不要求特殊字符；前端规则是它的超集，所以前端放行的密码服务端一定接受。
- 直连 API 的创建/改密路径不受本页约束，本页不承担「集群里不存在弱口令」的承诺。
- 退出登录接口 `POST /api/session/logout` 可用；即使它失败，清掉本地 token 也足以让当前浏览器退出。

## 验收用例

- `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01` — 覆盖 AC-01（必填、规则、两次不一致）、AC-03（缺特殊字符）与 AC-05（确认密码实时比对）
- `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02` — 覆盖 AC-02（当前密码错与成功改密）
- `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03` — 覆盖 AC-04（强度面板：四条检查项、三档、文字标签）

AC-03（缺特殊字符被拒）与 AC-05（确认密码实时比对）都由 TC-01 承接：它们与 AC-01 是同一个动作（表单内的本地校验），拆成多条用例只会重复同一段登录与建号开销，覆盖不增加。
