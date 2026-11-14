# 用户设置（L2）

[子模块需求](../../../prd/kube-frontend/user-settings/_index.md)

**技术方案 ID**：`DES-L2-KUBE-FRONTEND-USER_SETTINGS`

## 概述

一个弹窗、两个页签、三条请求：读自己的 User、PUT 邮箱、PUT 密码。读取复用 `userDetailApi`，写入是 `userSettingsApi` 的两个方法；失败时弹窗停在原地，成功改密则结束会话再跳登录页。

## 关联需求

- `AC-FULL-KUBE-FRONTEND-USER_SETTINGS-01`

## 设计目标与非目标

- **目标**：壳层只做三件事——取当前用户名、切换页签、改密成功后结束会话；两个页签的字段与写入规则各自独立，互不携带对方的字段。
- **非目标**：不做语言、头像、两步验证、登录历史；不提供改他人账号的入口；不把弹窗变成路由。

## 关键约束

- 对象只有一个：当前登录账号的 User。用户名一律取自会话（`/api/session/me`），不从地址栏或组件参数取，避免「能改谁」变成可传参的事。
- 两条写的鉴权口径不同：邮箱写靠 RBAC（对自己对象，platform-regular 实测可行），密码写靠「知道当前密码」。因此密码写不能用管理员的重置接口兜底。
- 邮箱写是整对象 PUT（端点对 PATCH 回 405），密码写是独立子资源（`PUT /users/<name>/password`）。
- 密码规则**前端比服务端严**：服务端 admission 只要求 8–64 字节 + 小写 + 大写 + 数字，特殊字符只有前端强制（迁移自老 console 的 `PASSWORD_DESC`）。因此密码页是这条规则唯一的执行点，直连 API 不受约束（GOT-L2-05）。

## 方案决策

### DEC-L2-KUBE-FRONTEND-USER_SETTINGS-01：弹窗，不是独立页面

- **备选**：① `/settings/profile` 独立页面（老 console 的「设置」路由思路）；② 从账号菜单打开的弹窗。
- **选定**：②
- **原因**：改邮箱与改密码都是一次性小任务，用户完成后要回到原来的工作。独立页面要占一条路由与一个菜单项，还会把用户从当前页面带走——正在填的表单、正在看的日志都会丢。老 console 也是弹窗，肌肉记忆一致。
- **被否方案**：①。代价是每条入口都要一次导航，收益只是一块更大的画布，而这里只有四个字段。
- **何时重新考虑**：设置项增加到需要分组与说明（例如加了两步验证、会话管理、API token），弹窗装不下时。

### DEC-L2-KUBE-FRONTEND-USER_SETTINGS-02：改密成功后主动结束会话

- **备选**：① 只跳 `/login`（老 console 的做法）；② 调用退出登录（`POST /api/session/logout` + 清本地 token）再跳。
- **选定**：②
- **原因**：实测改密之后同一个 token 请求 `/api/session/me` 仍返回 200——服务端不吊销会话。只跳 `/login` 时浏览器里的 token 依然有效，用户以为「已经退出」，实际旧会话还能用。
- **被否方案**：①。它把「退出」交给一次导航，而导航不会清除凭据。
- **何时重新考虑**：服务端在改密时吊销该用户的会话（那时前端只需要清本地状态）。

### DEC-L2-KUBE-FRONTEND-USER_SETTINGS-03：两个页签各自提交，不复用单一 onOk

- **备选**：① 老 console 的做法——一个 `onOk`，按「data 里有没有 `currentPassword` 与 `password`」分流两种写入；② 每个页签自己的按钮与提交函数。
- **选定**：②
- **原因**：①的判据与页签无关，只跟字段在不在有关：字段增删、表单默认值变化都可能让「改密」走成整对象 PUT。②把「写哪个资源」固定在代码位置上，读代码即可确定。
- **被否方案**：①。它在老 console 里能跑，是因为密码页签的表单字段恰好只有那三个；一旦有人给密码页加一个字段，分支就会静默走错。
- **何时重新考虑**：服务端把两个写合并成一个接口时，这条分流自然消失。

### DEC-L2-KUBE-FRONTEND-USER_SETTINGS-04：关闭即丢弃，用页签提示点代替二次确认

- **备选**：① 关闭时弹「有未保存修改，确定关闭？」；② 页签上显示未保存提示点，关闭直接丢弃。
- **选定**：②
- **原因**：两页最多四个字段，重填成本低于一次确认弹窗的打断。提示点让用户在切走之前就看到「还没保存」，比事后拦截更早。
- **被否方案**：①。老 console 也没有确认框，只在页签上打点；加确认框会让「关闭」这个动作在有无改动时表现不同，用例也多一条分支。
- **何时重新考虑**：出现长表单（例如以后加了多行配置）时。

### DEC-L2-KUBE-FRONTEND-USER_SETTINGS-05：结构复用设计系统，不在页内手写

- **备选**：① 页内自写页签条、字段 label/hint/error 包装、只读信息行与强度面板（迁移第一版即如此）；② 组合 ai-kit 的 `Tabs` / `FormField` / `DescriptionList` / `PasswordStrengthMeter`，页内只保留状态与校验。
- **选定**：②
- **原因**：第一版把四种结构各写了一遍——页签是原生 `<button role="tab">`，没有方向键导航；四个字段各写一次 label + 输入 + 说明；只读两行写成一个私有 `ReadOnlyField`；强度面板把展示与规则换算混在同一个应用组件里。这些结构在其它页面也要用（字段包装已有 17 个文件各写一遍，只读信息行有 24 个文件依赖应用内 `DefinitionRow`），留在页内等于把「用户设置长什么样」复制到下一处。上收之后：页签拿到 Radix 的键盘与 aria 语义；字段的说明/错误行由一处渲染；只读信息行与 24 个详情页共用同一实现；强度面板的展示可被创建用户弹窗复用。
- **被否方案**：①。它让「页面正确」与「组件可复用」变成两件事：页签的无障碍缺陷、只读行的颜色漂移都只能逐页修，而每页的修法还会不一样。
- **何时重新考虑**：设计系统需要为「设置类页面」提供更强的容器抽象（例如分组导航、设置页布局）时；本轮只上收结构，不把页面布局固化进库。

## 页面与技术结构

| 组件 / 模块 | 路径 | 职责 | 不做什么 |
| --- | --- | --- | --- |
| `UserSettingsDialog` | `kube-frontend/apps/console-next/src/shell/UserSettingsDialog.tsx` | 弹窗壳层、两个页签、读取账号、两次写、改密成功后回调；页签/字段/只读行分别是 ai-kit 的 `Tabs` / `FormField` / `DescriptionList` | 不决定退出后的跳转（由 shell 的 `leave` 做）；不自己实现页签与字段结构 |
| `UserMenu` | `kube-frontend/apps/console-next/src/shell/AppShell.tsx` | 账号菜单项 `shell:user-settings`、挂载弹窗、提供 `leave` | 不做表单校验 |
| `userSettingsApi` | `kube-frontend/packages/api-client/src/access.ts` | `updateProfile` / `changePassword` | 不读账号（读用 `userDetailApi`） |
| `passwordProblem` / `passwordChecks` / `passwordProblemMessage` | `access.ts` / `kube-frontend/apps/console-next/src/lib/password.ts` | 规则判定（第一条不满足 / 每条是否满足）与文案映射 | 不发请求 |
| `PasswordStrength` | `kube-frontend/apps/console-next/src/components/password/PasswordStrength.tsx` | 包装层：把 `passwordChecks` 的结果与 `t()` 文案换算成 ai-kit `PasswordStrengthMeter` 的 props | 不写正则、不判提交、不自己渲染面板 |
| `PasswordStrengthMeter` | `packages/ai-kit/src/primitives/PasswordStrength.tsx` | 纯展示：进度条、弱/中/强文字标签、四条检查项、`data-strength` / `data-met` / `data-ai-id` | 不判规则、不内置文案（库不内置 i18n） |
| `DescriptionList` / `DescriptionItem` | `packages/ai-kit/src/primitives/DescriptionList.tsx` | 只读 label/value(/hint) 行：`<dl>/<dt>/<dd>`、空值 `-`、`aiId` 句柄 | 不管布局（调用方给 `<dl>` 网格或直接用 `DescriptionList`） |
| `signOut` | `kube-frontend/apps/console-next/src/shell/AuthProvider.tsx` | `POST /api/session/logout` + 清本地 token | 不做页面跳转（调用方跳） |
| 文案 | `kube-frontend/packages/locales/src/index.ts` | `userSettings.*` | 不写规则逻辑 |

弹窗不改地址栏；打开与关闭前后路由相同。

## 状态与数据归属

| 状态 | 落在哪 | 刷新后 |
| --- | --- | --- |
| 当前页签 | 组件状态（默认 `profile`，每次打开重置） | 不在 |
| 邮箱输入、三个密码框 | 组件状态（关闭即清空，不写 `localStorage`） | 不在 |
| 强度档位与四条勾选 | 派生值（由新密码即时算出，不单独存） | 不在 |
| 账号数据（用户名、平台角色、邮箱初值） | react-query `['user-settings','profile',name]` | 重新请求 |
| 邮箱保存成功后的列表/详情缓存 | 失效 `['platform','users']`、`['user-detail',name]` | 重新请求 |
| 会话 token | `localStorage`（`AuthProvider` 管） | 在（除非已 signOut） |

## 关键契约与依赖

| 契约 / 依赖 | 形式 | 风险点 |
| --- | --- | --- |
| `GET /kapis/iam.kubesphere.io/v1alpha2/users/<name>` | HTTP | 401/403 时表单没有初值，保存按钮不能出现 |
| `PUT /kapis/iam.kubesphere.io/v1alpha2/users/<name>` | HTTP 整对象 | 丢注解会静默降权；`resourceVersion` 过期回 409 |
| `PUT /kapis/iam.kubesphere.io/v1alpha2/users/<name>/password` | HTTP | 400 是纯文本、422 是整条正则；成功后会话仍有效 |
| `POST /api/session/logout` | HTTP | 失败也要清本地 token，否则退出不彻底 |
| `data-ai-id` 集合 | DOM 属性 | 改名会让用例与 agent 同时失配（契约固定，不要改） |

## 不变量

- **INV-L2-KUBE-FRONTEND-USER_SETTINGS-01**：弹窗只操作当前登录账号的对象；用户名取自会话，任何路径都不得从 URL 或参数取要改的用户名。
- **INV-L2-KUBE-FRONTEND-USER_SETTINGS-02**：关闭弹窗不发出任何写请求，两个页签的未保存内容一起丢弃。
- **INV-L2-KUBE-FRONTEND-USER_SETTINGS-03**：改密成功必须先结束会话（`logout` + 清 token），再跳 `/login`；不允许只跳转。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L2-KUBE-FRONTEND-USER_SETTINGS-01** | 改密不吊销旧 token：实测改密后同一 token 请求 `/api/session/me` 仍 200。 | 只跳 `/login` 等于没退出，旧会话继续可用——「我改了密码」反而给人虚假的安全感。 | `UserSettingsDialog.tsx` 的 `change.onSuccess` → `onSignedOut`；`AuthProvider.tsx` 的 `signOut` |
| **GOT-L2-KUBE-FRONTEND-USER_SETTINGS-02** | 老 console 用「data 里有没有 `currentPassword`/`password`」区分改密与改邮箱，判据与页签无关。 | 照抄这个分支，字段一变动就会把改密请求发成整对象 PUT，或者反过来。 | `src/actions/user.js` 的 `'user.setting'`（老实现，仅作对照）；新实现按页签拆函数 |
| **GOT-L2-KUBE-FRONTEND-USER_SETTINGS-03** | 老 console 的语言下拉写 `spec.lang` 并 `location.reload()`；新 UI 的语言在 `localStorage['kube-frontend-locale']`，切换不刷新。 | 两个入口各写一处，互相覆盖：在这里选中文，顶栏还是英文。 | `kube-frontend/apps/console-next/src/i18n.tsx` |
| **GOT-L2-KUBE-FRONTEND-USER_SETTINGS-04** | 用户名与平台角色是只读**文本**，不是 disabled 输入框。 | 用例按 `input` 断言会失败；做成 disabled 输入框还会诱导用户去点一个永远点不动的控件。 | `UserSettingsDialog.tsx` 用 `DescriptionList` 渲染这两行；`data-ai-id` 落在**值节点**上而不是 `<dd>` 上——`<dd>` 里还有说明文字，用例的 `to_have_text` 会比整段文本 |
| **GOT-L2-KUBE-FRONTEND-USER_SETTINGS-05** | 密码规则是前端规则，不是平台规则：服务端不要求特殊字符。 | 有人会以为服务端也拦特殊字符（于是直连 API 的弱口令被当成「不可能」），或者把前端这条要求写进平台文档当成集群级约束。 | `access.ts` 的 `passwordProblem`；服务端 `pkg/kapis/iam` 未改 |

## 测试与可观测

- **自动化**：L2 用例走「打开 → 默认页签 → 切页签 → 关闭」，断言写请求为 0 且仍在原页面；两个页签的校验与写入由各自的 L3 用例覆盖。
- **手动验证**：用 platform-regular 账号登录 → 账号菜单 → 用户设置；改邮箱后用 kubectl 看 `spec.email` 与两个注解；改密后用旧密码登录应失败。
- **日志 / 指标**：打开弹窗一次 `GET users/<name>`；改邮箱或改密各一次 `PUT`；改密成功后再一次 `POST /api/session/logout`。读取失败时 `data-ai-state=error`，可据此区分没加载完与加载失败。

## 明确不做

- **独立页面路由**：低频小改动，代价是一条路由、一个菜单项和一次离开当前页面。
- **未保存的二次确认**：四个字段的重填成本低于一次打断；提示点已经够早。
- **页签级「取消」按钮**：关闭即丢弃，不需要第二套放弃语义。
- **把语言开关搬进弹窗**：会让语言有两个写入口（见 GOT-L2-KUBE-FRONTEND-USER_SETTINGS-03）。

## 后续改进

- 端点支持 merge patch 后，改邮箱可以退化为单字段写，省一次 GET。
- 服务端在改密时吊销会话后，前端的 signOut 可以只清本地状态。
- 若设置项增加到弹窗装不下，再按 DEC-L2-KUBE-FRONTEND-USER_SETTINGS-01 的触发条件改成页面。
- 其余仍手写字段包装的 16 个页面逐步改用 `FormField`，清单与优先级见 `docs/plans/user-settings-component-analysis.md` §7。

## 功能点

| 功能点 | 需求 | 技术方案 |
| --- | --- | --- |
| 基本信息 | `prd/kube-frontend/user-settings/profile.md` | `design/kube-frontend/user-settings/profile.md` |
| 密码设置 | `prd/kube-frontend/user-settings/password.md` | `design/kube-frontend/user-settings/password.md` |

## 验收用例

- L2 核心路径：`TC-FULL-KUBE-FRONTEND-USER_SETTINGS-01`
