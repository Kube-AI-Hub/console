# 密码设置（L3）

[子模块需求](../../../prd/kube-frontend/user-settings/password.md)

**技术方案 ID**：`DES-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD`

## 概述

三个密码框在客户端判完规则后，走 `PUT users/<name>/password`；成功后弹窗回调 `onSignedOut`，由 shell 结束会话并跳登录页。判定分两层但只有一份来源：`passwordProblem` 给出「第一条不满足的规则」，`passwordChecks` 给出「每一条是否满足」（强度面板用），两者共用同一个特殊字符正则与同一套长度口径。文案映射在 `lib/password.ts`，创建用户弹窗与本弹窗共用；强度面板拆成两层——应用侧 `PasswordStrength` 只做「`passwordChecks` 结果 + `t()` 文案 → props」的换算，面板的渲染、进度条与无障碍语义在 ai-kit 的 `PasswordStrengthMeter`。

## 关联需求

- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01`
- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02`
- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03`
- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04`
- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05`

## 设计目标与非目标

- **目标**：让界面上的每一条密码要求都成为真的拦截（文案即规则）；把「还缺哪一项」在输入时就告诉用户；把「改完密码之后会话还活着」在客户端补上。
- **非目标**：不做熵估算或泄露口令比对，不做密码历史与复用限制，不做他人密码重置，不在服务端规则变化时自动同步。

## 关键约束

- 服务端规则（CRD admission 强制）：**8–64 字节**，且同时含小写字母、大写字母、数字。上限单位是**字节**（UTF-8），不是字符——实测 90 个字符的密码被拒，正文 `Too long: may not be more than 64 bytes`；30 个汉字就是 90 字节。
- 前端规则是服务端规则的**超集**：长度口径改为「至少 8 个**字符**、且不超过 64 **字节**」，再加上「至少一个特殊字符」。下限按字符、上限按字节，两个单位各守一端：4 个汉字只有 4 个字符（12 字节）却过不了字符下限；64 个汉字是 192 字节却过不了字节上限。
- 特殊字符集合是封闭列表，与界面文案逐字一致（`PASSWORD_SPECIAL` 与 `platform.users.field.passwordSpecial`、`userSettings.password.rule` 必须是同一组字符，含空格）；emoji、中文标点都不算。
- 失败形态（实测）：当前密码错 → **400，纯文本** `incorrect old password`；规则不符 → **422，正文是整条 admission 正则**（`should match '^(.*[a-z].*[A-Z].*[0-9].*)$|...'`）。两者都不是给人看的文本。
- 改密成功后服务端**不吊销**会话：同一 token 请求 `/api/session/me` 仍 200（实测）。
- 强度三档只是规则的呈现：违反任一规则 → 弱；五条全满足且长度 ≥12 个字符 → 强；其余 → 中。它不引入第二套判定。
- `PUT users/<name>/password` 的授权靠「知道当前密码」，不靠角色绑定；这是控制台里唯一这样的写。
- 确认密码的比对是**派生状态**：由「新密码」「确认密码」两个 state 直接算出，不额外存一份「是否一致」；因此任一侧变化都会重算，提交时用的是同一个比较。

## 方案决策

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01：密码规则只在 api-client 一处实现，两个弹窗共用

- **备选**：① 每个表单各写一份校验；② api-client 里两个纯函数（`passwordProblem` 判「第一条不满足」，`passwordChecks` 判「每一条是否满足」）+ 应用侧一份文案映射（`passwordProblemMessage`），所有设置密码的表单共用。
- **选定**：②
- **原因**：此前创建用户弹窗只校验「≥8 位 + 有字母 + 有数字」，会放过服务端一定拒绝的密码（没有大写字母的 `abcdefgh1`、超过 64 字节的长口令），用户拿到的是 422 的整条正则。规则有两份实现就一定会分叉，而分叉的代价由用户承担。判定放 api-client（纯函数、无 React 依赖），文案映射放应用侧的 `lib/password.ts`（要拿 `t`），职责刚好分开。本轮加的特殊字符与强度面板也走这两处，没有第三份判定。
- **被否方案**：①（已经分叉过一次）；把判定与文案都放进 locales（规则逻辑进翻译文件，改规则要改文案表）；让强度面板自己算一遍（面板说「强」而提交被拒，是同一类分叉的另一种形态）。
- **何时重新考虑**：平台把规则作为配置下发（那时判定应读服务端下发的规则，而不是硬编码）。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02：长度下限按字符、上限按字节

- **备选**：① 全按字符（8–64 个字符）；② 全按字节（8–64 字节）；③ 下限按字符、上限按字节。
- **选定**：③
- **原因**：两个单位在两端都会咬人。①的上限对多字节口令失效：64 个汉字是 192 字节，前端放行、服务端以 `Too long: may not be more than 64 bytes` 拒绝。②的下限对多字节口令形同虚设：8 个字节大约只是 2–3 个汉字，「至少 8 字节」拦不住任何人。③让下限守住「至少 8 个字符」的直觉，上限守住服务端的字节口径。
- **被否方案**：①（上限漏判，用户看到 422 正则）；②（下限失效）；只判字节并把下限调到 24 字节之类（会把英文口令误杀，且门槛无法用一句话解释给用户）。
- **何时重新考虑**：CRD 改成按 rune/字符计数，或规则由服务端下发。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03：改密成功后主动结束会话

- **备选**：① 只跳 `/login`（老 console：`setTimeout(1000)` 后 `location.href = '/login'`，全程没有调用 logout）；② 调用 `signOut()`（`POST /api/session/logout` + 清本地 token）再跳。
- **选定**：②
- **原因**：实测改密不吊销 token，同一 token 请求 `/api/session/me` 仍 200。①只是把用户带到一个登录页，浏览器里的凭据还在——「我改了密码」于是没有安全收益。②与顶栏「退出登录」走同一条路径，控制台只有一种离开方式。
- **被否方案**：①（等于没退出）。
- **何时重新考虑**：服务端在改密时吊销该用户全部会话（那时前端只需清本地状态）。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04：400/422 用请求上下文映射文案，不显示正文

- **备选**：① 直接显示 `error.message`；② 按状态码与接口上下文映射成固定句子。
- **选定**：②
- **原因**：400 的正文是纯文本 `incorrect old password`（英文），422 的正文是整条 admission 正则。两者都没有可操作信息，却都很难看。改密接口的 400 只有一种含义（当前密码错），所以 `status === 400` 就足以判定；422 归到规则句。
- **被否方案**：①（把运维文本当用户文案）；按 message 做字符串匹配来识别错误（正文措辞会随上游版本变）。
- **何时重新考虑**：BFF 为这两个错误定义稳定 `code`（那时改按 code 分支，不再看状态码）。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05：前端比服务端严——把 PASSWORD_DESC 从「提示」升格为「规则」

- **备选**：① 只照抄服务端规则（8–64 字节 + 小写 + 大写 + 数字，不要求特殊字符）；② 保留 `PASSWORD_DESC` 文案但不校验特殊字符（老 console 的做法）；③ 前端强制特殊字符，让文案即规则。
- **选定**：③
- **原因**：老 console 的 `PASSWORD_DESC` 写着「必须包含…一个特殊字符」，校验却用 `PATTERN_PASSWORD`（`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[^]{8,64}$/`）——特殊字符只存在于文案里，从未被检查。文案与规则不一致比规则宽松更糟：用户按文案打了特殊字符，却在别处发现不打也行；或者反过来，以为自己漏了什么。③让界面写下的每一条都真的会拦，代价是前端比服务端严（见 GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-06）。
- **被否方案**：①（继续让文案说谎，且等于把已经写进产品的要求撤掉）；②（本轮用户明确要求「前端要校验」）；把文案改成与服务端一致、删掉特殊字符要求（会降低口令复杂度，与用户诉求相反）。
- **何时重新考虑**：平台 admission 自己加上特殊字符要求（那时前端可以退回跟随服务端，前后端规则重新合一）；或安全口径要求引入更强的规则（那时统一改 `passwordProblem` 一处）。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-06：强度面板内联常驻，三档带文字标签，不复用老 console 的分数算法

- **备选**：① 老 console 的浮层下拉：输入时弹出 `PASSWORD_MUST` 三条 checklist + 分数进度条，失焦即收；② 新密码框下方的常驻内联面板，四条检查项 + 三档进度条 + 文字标签。
- **选定**：②
- **原因**：①的浮层会盖住正在输入的框，且失焦就消失——用户点「修改密码」时它已经收起，看不到自己差在哪；它的分数算法（大小写齐 +4、数字 +2、长度 6–12 +2、≥12 +4，不满足旧正则直接归零）与现在的五条规则也不同源，会出现「条满了但提交被拒」。②把面板固定在输入框下方，勾选状态直接来自 `passwordChecks`，与提交判定同一份来源。三档必须带文字标签（弱/中/强）：只靠红黄绿对色觉障碍不可用，而这一屏恰好是安全性最敏感的一屏；进度条本身标了 `aria-hidden`，档位由文字标签与 `data-strength` 承载。
- **被否方案**：①（浮层遮挡与收起时机都与提交按钮冲突；分数算法与规则不同源）；只用颜色分档（不可访问）；把 checklist 做成提交后的错误列表（等于把「还缺什么」推到失败之后）。
- **何时重新考虑**：规则条目增加到面板放不下（那时考虑分组或折叠）。
- **已收口（2026-11）**：面板的渲染与无障碍语义已上收到 ai-kit 的 `PasswordStrengthMeter`（纯展示，规则仍由本页判定），「设计系统提供带无障碍语义的强度组件」这一条已满足；下次改动只改应用侧档位换算或库内展示，两侧不再各自实现。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-07：强度档位的口径——「弱」表示过不了校验，不是「短」

- **备选**：① 沿用老 console 的 0–10 分打分，再按分数切档；② 以规则为界：违反任一规则 → 弱，全满足后只用长度区分中/强。
- **选定**：②
- **原因**：①会造出「分数很高但提交被拒」的状态（旧打分不看特殊字符），而面板的全部价值就是「面板说能过，就真能过」。②把档位与判定绑死：弱 = 还过不了校验；五条全满足后，唯一还值得奖励的是长度，于是 ≥12 个字符给强、≤11 个字符给中——三档都可达，不会退化成「只有强和弱」。
- **被否方案**：①（与判定不同源，且分母 10 分对用户没有意义）；只做两档（合规/不合规）——那样面板只是重复错误提示，无法鼓励更长的口令。
- **何时重新考虑**：规则条目变化导致「全满足」不再唯一决定可达性（例如引入可选加强项）。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-08：确认密码在输入时比对，提示是框下方的派生状态

- **备选**：① 只在提交时比对（错误进统一错误行）；② 沿用老 console 的字段级校验：validator 挂在确认密码的 `Form.Item` 上，由表单在 change 时触发；③ 提示做成确认密码框下方的派生状态，任一侧变化即重算。
- **选定**：③
- **原因**：老 console 其实**本来就是边输入边校验**——`packages/kube-design/src/components/Form/Item.jsx` 的 `handleValueChange` 在每次输入后调用 `this.validate({ [name]: value })`（`validate` 是 200ms debounce、`firstFields: true`），validator 读新密码的 state 比对，不一致就报 `PASSWORD_NOT_SAME_DESC`。所以「输入时比对」不是新增要求，而是要保住的行为。②的问题是**重算时机绑在字段上**：只有确认密码自己的 change 会触发 validate，用户回头改新密码时那条错误会滞留到下一次提交；而且它属于表单错误体系，和提交拦截共用一处渲染，没法单独断言「当前是红还是绿」。③把比较写成派生状态，两个输入框任一变化都重算，且有一个可被用例直接读取的节点（`data-match`）。
- **被否方案**：①（用户点保存才知道打错，等于让他在最后一个字段上重打一遍）；②（错误滞留 + 无法区分「未比较」与「比较过且不一致」）；用 debounce 跟随输入（这里的比较是两次字符串相等，没有需要防抖的开销，延迟只会让提示看起来卡顿）。
- **何时重新考虑**：规则变复杂到需要异步判定（例如后端校验密码是否与历史密码重复），那时才需要防抖与中间态。

## 系统现状

老 console 的密码页（`src/components/Modals/UserSetting/PasswordSetting/index.jsx`）三个 `InputPassword`：当前密码（必填 + 说明 `ENTER_CURRENT_PASSWORD_DESC`）、新密码（必填 + `PATTERN_PASSWORD` + `withStrength` 强度条）、确认密码（必填 + 与 `state.password` 比较）；中间一条 `Alert type=warning` 显示 `PASSWORD_DESC`。强度条实现在 `src/components/Inputs/InputPassword/index.jsx`：输入时弹出浮层，含 `PASSWORD_MUST`「您的密码必须：」三条 checklist、`PASSWORD_STRENGTH`「密码强度」进度条（<6 分红 33%、6–8 分黄 66%、≥8 分绿 100%）、`PASSWORD_STRENGTH_DESC`「避免使用弱密码其他账户的密码。」；分数算法见 DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-06。保存由 `src/actions/user.js` 的 `'user.setting'` 处理：`if (currentPassword && password)` → `store.modifyPassword` → `PUT <detail>/password` → `setTimeout(1000)` → `location.href = '/login'`，**没有调用 logout 接口**。确认密码的 validator 挂在该 `Form.Item` 的 rules 上，而 `packages/kube-design/src/components/Form/Item.jsx` 的 `handleValueChange` 在每次输入后调用 `this.validate({ [name]: value })`（`validate` 是 200ms 的 debounce，`firstFields: true`）——所以老 console 本来就是边输入边校验，只是重校验只发生在**该字段自己**的 change 上（DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-08）。

上一轮的新实现去掉了强度条与那条 warning 文案；本轮把两者都迁回来，并改变它们的性质：`PASSWORD_DESC` 从「只是一句提示」变成「会被执行的规则」，且长度口径从「8 到 64 个字符」补成「8 到 64 个字符，且不超过 64 字节」（老文案只写字数，中文口令会撞服务端的字节上限）；强度条从浮层变成常驻内联面板（DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05、-06、-07）。

### 数据流

输入：`新密码输入 → passwordChecks（四条布尔）→ PasswordStrength（data-met / data-strength / 文字标签）`；`新密码 + 确认密码 → 相等比较 → user-settings:confirm-hint（data-match / 文案）`
提交：`密码页签 → passwordProblem（第一条不满足）→ passwordProblemMessage（文案）→ userSettingsApi.changePassword（PUT /users/<name>/password）→ 成功 → onSignedOut → signOut（POST /api/session/logout + 清 token）→ /login`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `kube-frontend/packages/api-client/src/access.ts` 的 `passwordProblem` | 返回第一条不满足的规则码：`too-short/too-long/no-letter/no-lower/no-upper/no-digit/no-special/null` | 不产生文案、不发请求 |
| 同文件的 `passwordChecks` | 返回四条布尔（`length/letterCase/digit/special`），供强度面板逐条勾选 | 不决定档位、不判提交 |
| 同文件的 `PASSWORD_SPECIAL` | 特殊字符集合，唯一来源 | 不单独对外暴露 |
| `kube-frontend/apps/console-next/src/lib/password.ts` 的 `passwordProblemMessage` | 把规则码映射成 i18n 句子（含 `no-special`） | 不判定规则 |
| `kube-frontend/apps/console-next/src/components/password/PasswordStrength.tsx` | 包装层：档位判定（`!complete → weak`，`length ≥ 12 → strong`）、四条检查项的 label 与 `data-ai-id` 前缀换算，然后渲染 ai-kit `PasswordStrengthMeter` | 不写正则、不判提交、不发请求、不自己渲染面板 |
| `packages/ai-kit/src/primitives/PasswordStrength.tsx` | `PasswordStrengthMeter`：纯展示的进度条、三档文字标签、四条检查项与 `data-strength` / `data-met` / `data-ai-id` 句柄 | 不判规则、不内置文案 |
| `kube-frontend/apps/console-next/src/shell/UserSettingsDialog.tsx` | 三个输入框、规则说明块、校验顺序、确认密码的实时比对提示（`user-settings:confirm-hint`）、400 的文案映射、成功后回调 | 不拼 HTTP、不自己做 logout、不自己算规则 |
| `kube-frontend/apps/console-next/src/shell/AuthProvider.tsx` 的 `signOut` | `POST /api/session/logout` + 清 `localStorage` 里的 token | 不跳转（调用方跳） |
| `access.ts` 的 `userSettingsApi.changePassword` | `PUT users/<name>/password` | 不映射错误 |

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 组件 | `console` | `kube-frontend/apps/console-next/src/shell/UserSettingsDialog.tsx` | 密码页签：三个输入框、新密码框上方的规则说明（`user-settings:password-rule`）、确认密码框下方的实时比对提示（`user-settings:confirm-hint`）、校验顺序、400 映射、成功后 `onSignedOut` |
| 组件 | `console` | `kube-frontend/apps/console-next/src/components/password/PasswordStrength.tsx` | 包装层：档位判定与句柄前缀换算 |
| 组件 | `console` | `packages/ai-kit/src/primitives/PasswordStrength.tsx` | 面板本体：`user-settings:password-strength`（`data-strength`）、`-strength-bar`、四个 `-check-*`（`data-met`）、三档文字标签 |
| 工具 | `console` | `kube-frontend/apps/console-next/src/lib/password.ts` | `passwordProblemMessage`：规则码 → 句子，补 `no-special` |
| 接口 | `console` | `kube-frontend/packages/api-client/src/access.ts` | `passwordProblem` 加 `no-special`；新增 `passwordChecks` 与 `PASSWORD_SPECIAL`；`userSettingsApi.changePassword` 不变 |
| 会话 | `console` | `kube-frontend/apps/console-next/src/shell/AuthProvider.tsx` | `signOut`：logout + 清 token（不变） |
| 文案 | `console` | `kube-frontend/packages/locales/src/index.ts` | `userSettings.password.rule` 换成 `PASSWORD_DESC` 迁移文案；新增 `must` / `check.*` / `strength` / `strengthWeak` / `strengthMedium` / `strengthStrong` / `strengthHint` / `match`；`platform.users.field.passwordSpecial` |
| 接口（服务端） | `kube-server` | `pkg/kapis/iam`（ks-apiserver）与 users admission webhook | 不改：特殊字符规则只在前端 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `PUT /kapis/iam.kubesphere.io/v1alpha2/users/<name>/password` | HTTP | 正文 `{currentPassword, password}`；成功 200 `{"message":"success"}` | 本页 |
| 400 + 纯文本 `incorrect old password` | HTTP 错误 | 唯一含义是当前密码错 | 本页（映射为「当前密码不正确。」） |
| 422 + 纯文本 | HTTP 错误 | 正文是 `Too long: may not be more than 64 bytes` 或整条 `should match '...'` 正则 | 本页（映射为规则句） |
| `passwordProblem(password): string \| null` | 函数 | `too-short` / `too-long` / `no-letter` / `no-lower` / `no-upper` / `no-digit` / `no-special` / `null` | 用户设置弹窗、创建用户弹窗 |
| `passwordChecks(password): PasswordChecks` | 函数 | `{ length, letterCase, digit, special }`，全部为布尔；`length` = ≥8 字符且 ≤64 字节 | 强度面板（两个弹窗共用） |
| `user-settings:password-rule` | DOM `data-ai-id` | 新密码框上方的常驻规则说明（`PASSWORD_DESC` 迁移文案） | 用例与 agent |
| `user-settings:password-strength` | DOM `data-ai-id` | 面板根，`data-strength=weak\|medium\|strong`；新密码为空时不渲染 | 用例与 agent |
| `user-settings:password-strength-bar` | DOM `data-ai-id` | 进度条，宽度 33% / 66% / 100%（装饰，`aria-hidden`） | 用例与 agent |
| `user-settings:password-check-case`、`-digit`、`-special`、`-length` | DOM `data-ai-id` | 四条检查项，`data-met=true\|false` | 用例与 agent |
| `user-settings:confirm-hint` | DOM `data-ai-id` | 确认密码框下方的实时比对提示，`data-match=true\|false`；一致为「两次输入的密码一致。」，不一致为「两次输入的密码必须一致。」；确认密码为空时不渲染 | 用例与 agent |
| `user-settings:current-password`、`:new-password`、`:confirm-password`、`:password-save`、`:password-error`、`:password-saved` | DOM `data-ai-id` | 原有句柄，不变 | `tests/ui`、agent |

## 不变量

- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01**：前端规则固定为五条——至少 8 个字符且不超过 64 字节、至少一个小写、至少一个大写、至少一个数字、至少一个特殊字符；界面文案必须把五条都写出来，且特殊字符集合与 `PASSWORD_SPECIAL` 逐字一致。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02**：三项任一为空、五条规则任一不满足、两次不一致时，写请求数为 0。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03**：改密成功后必须调用 `signOut`（logout + 清 token）再跳转；不允许只导航。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04**：失败时弹窗保持打开且不清空输入，用户只需改错的那一个框。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05**：强度面板的勾选与档位只能由 `passwordChecks` 推出，不允许在组件里另写一套正则；面板显示「强」的密码必须能通过提交校验，显示「弱」的密码必须被拒。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-06**：新密码为空时面板不渲染；非空时四条检查项与档位文字标签必须同时可见，颜色不是唯一信号。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-07**：确认密码的实时提示与提交拦截必须同源——都读同一对「新密码 / 确认密码」state、用同一个相等比较；不允许提示一套、提交另一套。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01** | 改密不吊销会话：实测改密后同一 token 请求 `/api/session/me` 仍 200。 | 只跳 `/login` 时旧 token 仍可用，「改了密码」却没有退出任何设备。 | `UserSettingsDialog.tsx` 的 `change.onSuccess` → `onSignedOut`；`AuthProvider.tsx` 的 `signOut` |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02** | 400 的正文是纯文本 `incorrect old password`，而 `codeForStatus(400)` 不在映射表里，`code` 落到 `http_error`。 | 想按 `code` 区分「当前密码错」与「邮箱非法」永远命中不了（两者都是 400/`http_error`）；只能按 `status === 400` + 接口上下文判。 | `UserSettingsDialog.tsx` 的 `serverError`；`client.ts` 的 `codeForStatus` |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03** | 422 的正文是整条 admission 正则，且 `code` 是 `invalid`；当前实现只改写了 400，422 会落到 `errorMessage` 并原样显示正文。 | 撞上 422（规则变更、或客户端判定漏了某条）时，界面上会出现一整条正则。 | `UserSettingsDialog.tsx` 的 `serverError`（需要补 422 分支） |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04** | 长度是两个单位：下限按字符、上限按字节。4 个汉字 = 4 字符 / 12 字节（过不了下限），30 个汉字 = 30 字符 / 90 字节（过不了上限）。 | 只用字符数判上限会放行 64 个汉字（192 字节），服务端回 422 正则；只用字节判下限会让「至少 8 位」变成 2–3 个汉字。 | `access.ts` 的 `passwordProblem` 与 `passwordChecks`（`TextEncoder` 计字节） |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05** | 老 console 的 `PASSWORD_DESC` 要求特殊字符，`PATTERN_PASSWORD` 却不要求——文案与规则不一致，而且这句文案当时只是提示、从不参与校验。 | 把「文案已经写了」当成「规则已经生效」，于是以为特殊字符被强制过；或反过来把这条要求当成历史遗留随手删掉，回到文案说谎的状态。 | 老实现 `PasswordSetting/index.jsx`（仅作对照）；本轮由 `passwordProblem` 的 `no-special` 真正执行（DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05） |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-06** | 平台 admission 不要求特殊字符：直连 `PUT users/<name>/password`（或直接改 User 对象）设置不含特殊字符的密码会成功。 | 以为「前端拦住了」等于「集群里没有弱口令」。前端是这条规则唯一的执行点，任何绕过 UI 的路径都不受约束。 | `access.ts` 的 `passwordProblem` 只在客户端生效；服务端 `pkg/kapis/iam` 未改 |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-07** | 特殊字符是封闭列表：emoji 与中文标点（，。！）不在 `PASSWORD_SPECIAL` 里，不能用来满足第 5 条；空格在集合里。 | 用户以为「加个表情」就够了，提交被拒却看不出原因；反过来若放宽成正则，文案里列的集合就与判定再次分叉。 | `access.ts` 的 `PASSWORD_SPECIAL`；文案 `platform.users.field.passwordSpecial` 与 `userSettings.password.rule` 必须同步 |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-08** | 老 console 的确认密码校验只在该字段自己的 change 上重跑（`Form.Item` 的 `handleValueChange` → `validate`），不是随新密码重算。 | 回头改新密码后，框下方的「不一致」会滞留到下一次提交——用户看到红字却不知道它已经过期，或看到绿字而提交仍被拒。 | `UserSettingsDialog.tsx` 的 `confirm-hint`（派生状态，不是字段级 validator） |

## 测试与可观测

- **自动化**：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01` 覆盖必填、太短、缺大写、超 64 字节、缺特殊字符、两次不一致六种拒绝且写请求为 0（AC-01 与 AC-03），并覆盖确认密码的实时比对三态与改新密码后的重算（AC-05）；`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02` 覆盖当前密码错（弹窗保持打开、显示「当前密码不正确」）与成功路径（回到登录页、旧密码登录失败、新密码登录成功）（AC-02）；`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03` 覆盖面板显隐、四条 `data-met` 随输入变化、三档 `data-strength` 与文字标签（AC-04）。
- **手动验证**：用可丢弃账号改密；输入 `Abcd1234`（无特殊字符）看「密码需包含特殊字符。」；输入 `Abcd@1234` 看面板勾选与「中」；输入 `Abcd@12345678`（≥12 字符）看「强」；成功后在控制台确认 token 已移除，再用旧密码登录应失败。
- **日志 / 指标**：网络面板确认校验失败时没有 `PUT .../password`；成功时能看到一次 `POST /api/session/logout`。

## 后续改进

- 平台 admission 加上特殊字符要求后，前端规则可退回跟随服务端，`no-special` 仍保留但不再由前端独有（见 DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05 的重新考虑条件）。
- 服务端在改密时吊销会话后，前端的 `signOut` 可退化为只清本地状态。
- BFF 为 400/422 定义稳定 `code` 后，错误映射从「看状态码 + 接口上下文」改为「看 code」。
- 规则若再变化（新增条目、改长度口径、改特殊字符集合），只改 `passwordProblem` / `passwordChecks` / `PASSWORD_SPECIAL` 三处同文件常量与对应文案，两个弹窗与强度面板同时生效。

## 验收用例

- L3：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01`（AC-01 + AC-03 + AC-05）
- L3：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02`（AC-02）
- L3：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03`（AC-04）
