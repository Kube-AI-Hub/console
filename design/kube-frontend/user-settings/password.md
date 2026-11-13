# 密码设置（L3）

[子模块需求](../../../prd/kube-frontend/user-settings/password.md)

**技术方案 ID**：`DES-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD`

## 概述

三个密码框在客户端判完规则后，走 `PUT users/<name>/password`；成功后弹窗回调 `onSignedOut`，由 shell 结束会话并跳登录页。规则判定只有一份实现（`passwordProblem`），文案映射也只有一份（`lib/password.ts`），创建用户弹窗与本弹窗共用。

## 关联需求

- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01`
- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02`

## 设计目标与非目标

- **目标**：把「密码合不合规」的判定收敛到一处，让界面永远先说出人能读的规则；把「改完密码之后会话还活着」这件事在客户端补上。
- **非目标**：不做密码强度评估、不做密码历史、不做他人密码重置、不在服务端规则变化时自动同步。

## 关键约束

- 服务端规则（CRD admission 强制）：**8–64 字节**，且同时含小写字母、大写字母、数字。上限单位是**字节**（UTF-8），不是字符——实测 90 个字符的密码被拒，正文 `Too long: may not be more than 64 bytes`；30 个汉字就是 90 字节。
- 失败形态（实测）：当前密码错 → **400，纯文本** `incorrect old password`；规则不符 → **422，正文是整条 admission 正则**（`should match '^(.*[a-z].*[A-Z].*[0-9].*)$|...'`）。两者都不是给人看的文本。
- 改密成功后服务端**不吊销**会话：同一 token 请求 `/api/session/me` 仍 200（实测）。
- `PUT users/<name>/password` 的授权靠「知道当前密码」，不靠角色绑定；这是控制台里唯一这样的写。

## 方案决策

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01：密码规则只在 passwordProblem() 一处实现，两个弹窗共用

- **备选**：① 每个表单各写一份校验；② api-client 里一个判定函数（`passwordProblem`）+ 一个文案映射（`passwordProblemMessage`），所有设置密码的表单共用。
- **选定**：②
- **原因**：此前创建用户弹窗只校验「≥8 位 + 有字母 + 有数字」，会放过服务端一定拒绝的密码（没有大写字母的 `abcdefgh1`、超过 64 字节的长口令），用户拿到的是 422 的整条正则。规则有两份实现就一定会分叉，而分叉的代价由用户承担。判定放 api-client（纯函数、无 React 依赖），文案映射放应用侧的 `lib/password.ts`（要拿 `t`），职责刚好分开。
- **被否方案**：①（已经分叉过一次）；把判定与文案都放进 locales（规则逻辑进翻译文件，改规则要改文案表）。
- **何时重新考虑**：平台把规则作为配置下发（那时判定应读服务端下发的规则，而不是硬编码）。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02：长度上限按 UTF-8 字节判，不按字符数

- **备选**：① `password.length > 64` 判字符数；② `new TextEncoder().encode(password).length > 64` 判字节。
- **选定**：②
- **原因**：服务端按字节判。①对纯 ASCII 与②等价，但一个 30 字的中文口令是 90 字节——①放行、服务端拒绝，用户看到的又是一条 422 正则。判定必须与服务端的度量单位一致。
- **被否方案**：①（对多字节字符必然误放行）；只判字符数并把上限调小（会在英文口令上误杀）。
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

## 系统现状

老 console 的密码页（`src/components/Modals/UserSetting/PasswordSetting/index.jsx`）三个 `InputPassword`：当前密码（必填 + 说明 `ENTER_CURRENT_PASSWORD_DESC`）、新密码（必填 + `PATTERN_PASSWORD` + `withStrength` 强度条）、确认密码（必填 + 与 `state.password` 比较）；中间一条 `Alert type=warning` 显示 `PASSWORD_DESC`。保存由 `src/actions/user.js` 的 `'user.setting'` 处理：`if (currentPassword && password)` → `store.modifyPassword` → `PUT <detail>/password` → `setTimeout(1000)` → `location.href = '/login'`，**没有调用 logout 接口**。

新实现去掉强度条与那条 warning 文案（它要求特殊字符，见 GOT-05），改为一行常驻的规则说明；成功后走 `signOut()` 而不是裸跳转。

### 数据流

`密码页签 → passwordProblem（判定）→ passwordProblemMessage（文案）→ userSettingsApi.changePassword（PUT /users/<name>/password）→ 成功 → onSignedOut → signOut（POST /api/session/logout + 清 token）→ /login`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `kube-frontend/packages/api-client/src/access.ts` 的 `passwordProblem` | 纯函数判定，返回 `too-short/too-long/no-letter/no-lower/no-upper/no-digit/null` | 不产生文案、不发请求 |
| `kube-frontend/apps/console-next/src/lib/password.ts` 的 `passwordProblemMessage` | 把判定结果映射成 i18n 句子 | 不判定规则 |
| `kube-frontend/apps/console-next/src/shell/UserSettingsDialog.tsx` | 三个输入框、校验顺序、400 的文案映射、成功后回调 | 不拼 HTTP、不自己做 logout |
| `kube-frontend/apps/console-next/src/shell/AuthProvider.tsx` 的 `signOut` | `POST /api/session/logout` + 清 `localStorage` 里的 token | 不跳转（调用方跳） |
| `access.ts` 的 `userSettingsApi.changePassword` | `PUT users/<name>/password` | 不映射错误 |

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 组件 | `console` | `kube-frontend/apps/console-next/src/shell/UserSettingsDialog.tsx` | 密码页签：三个输入框、校验顺序、400 映射、成功后 `onSignedOut` |
| 工具 | `console` | `kube-frontend/apps/console-next/src/lib/password.ts` | `passwordProblemMessage`：判定结果 → 句子（创建用户弹窗共用） |
| 接口 | `console` | `kube-frontend/packages/api-client/src/access.ts` | `passwordProblem`（含 `too-long`，按 UTF-8 字节）与 `userSettingsApi.changePassword` |
| 会话 | `console` | `kube-frontend/apps/console-next/src/shell/AuthProvider.tsx` | `signOut`：logout + 清 token |
| 文案 | `console` | `kube-frontend/packages/locales/src/index.ts` | `userSettings.password.*`、`platform.users.field.password*` |
| 接口（服务端） | `kube-server` | `pkg/kapis/iam`（ks-apiserver）与 users admission webhook | 不改：规则与密码子资源都是现成的 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `PUT /kapis/iam.kubesphere.io/v1alpha2/users/<name>/password` | HTTP | 正文 `{currentPassword, password}`；成功 200 `{"message":"success"}` | 本页 |
| 400 + 纯文本 `incorrect old password` | HTTP 错误 | 唯一含义是当前密码错 | 本页（映射为「当前密码不正确。」） |
| 422 + 纯文本 | HTTP 错误 | 正文是 `Too long: may not be more than 64 bytes` 或整条 `should match '...'` 正则 | 本页（映射为规则句） |
| `passwordProblem(password): string \| null` | 函数 | `too-short` / `too-long` / `no-letter` / `no-lower` / `no-upper` / `no-digit` / `null` | 用户设置弹窗、创建用户弹窗 |
| `user-settings:current-password`、`:new-password`、`:confirm-password`、`:password-save`、`:password-error`、`:password-saved` | DOM `data-ai-id` | 用例与 agent 的定位句柄 | `tests/ui`、agent |

## 不变量

- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01**：客户端规则与服务端一致——8–64 **字节**，且同时含小写、大写、数字；文案不得要求特殊字符。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02**：三项任一为空、规则不符、两次不一致时，写请求数为 0。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03**：改密成功后必须调用 `signOut`（logout + 清 token）再跳转；不允许只导航。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04**：失败时弹窗保持打开且不清空输入，用户只需改错的那一个框。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01** | 改密不吊销会话：实测改密后同一 token 请求 `/api/session/me` 仍 200。 | 只跳 `/login` 时旧 token 仍可用，「改了密码」却没有退出任何设备。 | `UserSettingsDialog.tsx` 的 `change.onSuccess` → `onSignedOut`；`AuthProvider.tsx` 的 `signOut` |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02** | 400 的正文是纯文本 `incorrect old password`，而 `codeForStatus(400)` 不在映射表里，`code` 落到 `http_error`。 | 想按 `code` 区分「当前密码错」与「邮箱非法」永远命中不了（两者都是 400/`http_error`）；只能按 `status === 400` + 接口上下文判。 | `UserSettingsDialog.tsx` 的 `serverError`；`client.ts` 的 `codeForStatus` |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03** | 422 的正文是整条 admission 正则，且 `code` 是 `invalid`；当前实现只改写了 400，422 会落到 `errorMessage` 并原样显示正文。 | 撞上 422（规则变更、或客户端判定漏了某条）时，界面上会出现一整条正则。 | `UserSettingsDialog.tsx` 的 `serverError`（需要补 422 分支） |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-04** | 长度上限的单位是**字节**：30 个汉字 = 90 字节，会被服务端以 `Too long: may not be more than 64 bytes` 拒绝。 | 按字符数判就会放行，用户拿到的是 422 正则而不是「密码不能超过 64 字节」。 | `access.ts` 的 `passwordProblem`（`TextEncoder` 计字节） |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05** | 老 console 的 `PASSWORD_DESC` 文案要求「至少一个特殊字符」，但 `PATTERN_PASSWORD`（`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[^]{8,64}$/`）与服务端 admission 都不要求特殊字符。 | 照抄那句文案会告诉用户一条不存在的规则；用户也可能反过来以为「没加特殊字符所以保存失败」，去排查一个不是原因的原因。 | 老实现 `src/components/Modals/UserSetting/PasswordSetting/index.jsx`（仅作对照）；新文案 `userSettings.password.rule` |

## 测试与可观测

- **自动化**：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01` 覆盖必填、规则不符、两次不一致三类拒绝且写请求为 0（AC-01）；`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02` 覆盖当前密码错（弹窗保持打开、显示「当前密码不正确」）与成功路径（回到登录页、旧密码登录失败、新密码登录成功）（AC-02）。
- **手动验证**：用可丢弃账号改密；成功后在浏览器控制台看 `localStorage` 里 token 已被移除；再用旧密码登录应失败、新密码应成功。
- **日志 / 指标**：网络面板确认校验失败时没有 `PUT .../password`；成功时能看到一次 `POST /api/session/logout`。

## 后续改进

- 服务端在改密时吊销会话后，前端的 `signOut` 可退化为只清本地状态。
- BFF 为 400/422 定义稳定 `code` 后，错误映射从「看状态码 + 接口上下文」改为「看 code」。
- 规则若变化（例如要求特殊字符或改按字符计数），只改 `passwordProblem` 一处即可，两个弹窗同时生效。

## 验收用例

- L3：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01`
- L3：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02`
