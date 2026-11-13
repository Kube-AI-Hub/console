# 基本信息（L3）

[子模块需求](../../../prd/kube-frontend/user-settings/profile.md)

**技术方案 ID**：`DES-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE`

## 概述

读一次自己的 User 对象 → 三行字段（用户名、平台角色只读，邮箱可编辑）→ 保存时把同一个对象整份 PUT 回去，只换 `spec.email`。写入成功后失效用户列表与用户详情的缓存，让别处的邮箱跟着刷新。

## 关联需求

- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01`
- `AC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02`

## 设计目标与非目标

- **目标**：一次保存只改一个字段；校验在客户端完成，服务端只当最后一道；平台角色与描述在任何路径下都不被改写。
- **非目标**：不做用户管理（改他人、分配角色、删除）、不做邮箱查重、不做单字段局部更新。

## 关键约束

- IAM users 端点对 `PATCH` 返回 **405**（实测），写邮箱只有整对象 `PUT` 一条路；`PUT` 前必须拿到当前的 `resourceVersion`，过期回 409。
- `spec.email` 是邮箱的权威字段。列表行读的是 `annotations.email`，两条读路径不同源。
- platform-regular 用户改自己的对象实测成功，不需要平台角色——这是「个人设置」成立的前提。
- 邮箱格式由服务端 admission webhook 校验，非法时回 400，正文含 webhook 名与非法值。

## 方案决策

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01：整对象 PUT，只替换 spec.email

- **备选**：① merge patch（`application/merge-patch+json`）；② JSON Patch（`application/json-patch+json`，老 console 的 `jsonPatch` 就是这么写的）；③ 先 GET 再整对象 PUT。
- **选定**：③
- **原因**：kapis 的 users 端点对 PATCH 回 405（实测，老 console 的 `setPlatformRole` 也留下同一结论）。②走的是 `apis/` 代理路径，与 kapis 不是同一条路——换路径等于换鉴权与错误形态，为一个字段的写入不值得。③的代价是多一次 GET，收益是拿到 `resourceVersion`，并发修改时能被 409 挡住而不是静默覆盖。
- **被否方案**：①（405）；②（换代理路径，且 JSON Patch 的失败形态与其它 IAM 写不一致）。
- **何时重新考虑**：端点开始接受 merge patch，或平台提供「改自己邮箱」的专用接口。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02：邮箱在客户端先校验，规则与平台用户编辑弹窗共用

- **备选**：① 只靠服务端 webhook；② 客户端正则先拦，服务端兜底。
- **选定**：②
- **原因**：服务端非法邮箱回 400，正文是 `admission webhook "users.iam.kubesphere.io" denied the request: invalid email address:<值>`——英文、带 webhook 名、还回显用户输入，不能直接给读者看。老 console 的邮箱输入框**没有任何校验**，所以每次写错都把这句原文摆出来。②与「访问控制 → 用户」编辑弹窗用同一条正则（`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`），两处对同一个服务端约束给同一句话。
- **被否方案**：①（错误文案不可控）；引入完整 RFC 5322 解析（比 webhook 更严，会挡住服务端接受的地址，属于自己造规则）。
- **何时重新考虑**：平台提供邮箱校验接口，或 webhook 的错误正文改成可本地化的 code。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-03：平台角色只读展示，不给修改入口

- **备选**：① 与邮箱一起可编辑；② 只读展示。
- **选定**：②
- **原因**：角色是管理员授予的权限边界，放在个人设置里可改等于自助提权；写它还需要 `iam.kubesphere.io/platform-role` 注解的写权限，platform-regular 没有。展示它是为了让用户回答「我现在是什么身份」，这也是它出现在 AC 里的原因。
- **被否方案**：①（越权，且与「访问控制 → 用户」的编辑弹窗形成两个入口，口径必然漂移）。
- **何时重新考虑**：平台引入「申请角色」的审批流，且接口区分「申请」与「授予」。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-04：初值来自对象，不来自会话 token

- **备选**：① 用 `/api/session/me` 里的邮箱；② 打开弹窗时读 `GET users/<name>`。
- **选定**：②
- **原因**：会话里的邮箱是登录那一刻的快照，改完再打开会显示旧值（用户会以为没保存）；会话里也根本没有平台角色。老 console 同样在弹窗挂载时 `fetchDetail` 取整份对象。
- **被否方案**：①（改完再打开显示旧值；且拿不到平台角色，得再发一次请求）。
- **何时重新考虑**：`/api/session/me` 改成每次请求都从对象读取。

## 系统现状

老 console 的基本信息页（`src/components/Modals/UserSetting/BaseInfo/index.jsx`）有三个字段：用户名（disabled `Input`，占位 `username`）、邮箱（`spec.email`，**无格式校验**，说明文案 `USER_SETTING_EMAIL_DESC`）、语言（`spec.lang` 下拉）。保存由 `src/actions/user.js` 的 `'user.setting'` 统一处理：`store.update()` → `PUT users/<name>`，请求体是弹窗挂载时克隆的整份 `_originData`，再补上 `metadata.resourceVersion`。

新实现保留前两个字段，新增平台角色只读展示，并补上邮箱校验；语言字段按「明确不做」去掉。

### 数据流

`账号菜单 → UserSettingsDialog（打开即 GET users/<name>）→ 表单 → userSettingsApi.updateProfile（先 GET 取 resourceVersion，再整对象 PUT）→ 失效 ['user-settings','profile',name]、['platform','users']、['user-detail',name]`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `kube-frontend/apps/console-next/src/shell/UserSettingsDialog.tsx` | 表单状态、邮箱校验、调用 `updateProfile`、失效相关 query | 不拼 HTTP、不读 `resourceVersion` |
| `kube-frontend/packages/api-client/src/access.ts` 的 `userSettingsApi.updateProfile` | 先读后写：整对象 PUT，只替换 `spec.email` | 不校验邮箱、不决定提示文案 |
| `kube-frontend/packages/api-client/src/access.ts` 的 `userDetailApi.get` | 读对象；邮箱优先 `spec.email`，回退注解 | 不写 |
| `kube-frontend/apps/console-next/src/components/resource/ResourceErrorPanel.tsx` 的 `errorMessage` | 把 `ApiError` 变成一句话 | 不区分 400 的具体原因 |

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 组件 | `console` | `kube-frontend/apps/console-next/src/shell/UserSettingsDialog.tsx` | 基本信息页签：三行字段、邮箱校验、保存与「已保存。」 |
| 状态 | `console` | 同文件，react-query key `['user-settings','profile',name]` | 读取账号；成功后失效 `['platform','users']` 与 `['user-detail',name]` |
| 接口 | `console` | `kube-frontend/packages/api-client/src/access.ts` 的 `userSettingsApi.updateProfile` | 先 GET 取 `resourceVersion`，再整对象 PUT 只换 `spec.email` |
| 文案 | `console` | `kube-frontend/packages/locales/src/index.ts` 的 `userSettings.*` | 字段名、说明、错误与成功提示（中英各一份） |
| 接口（服务端） | `kube-server` | `pkg/kapis/iam`（ks-apiserver）与 users admission webhook | 不改 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `GET /kapis/iam.kubesphere.io/v1alpha2/users/<name>` | HTTP | 返回 User 对象；本页读 `metadata.name`、`spec.email`、platform-role 注解 | 本页、用户编辑弹窗（`userDetailApi`） |
| `PUT /kapis/iam.kubesphere.io/v1alpha2/users/<name>` | HTTP 整对象 | 请求体是读取对象的完整副本，仅 `spec.email` 被替换 | 本页 |
| `spec.email` | 字段 | 邮箱的权威值 | 本页、用户编辑弹窗 |
| `annotations[iam.kubesphere.io/platform-role]` | 注解 | 平台角色；缺失时回退 `iam.kubesphere.io/globalrole` | 本页只读展示、用户列表 |
| `annotations[kubesphere.io/description]` | 注解 | 用户描述；本功能必须原样带回 | 用户编辑弹窗 |
| `user-settings:username`、`:platform-role`、`:email`、`:profile-save`、`:profile-error`、`:profile-saved`、`:retry` | DOM `data-ai-id` | 用例与 agent 的定位句柄 | `tests/ui`、agent |

## 不变量

- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01**：PUT 请求体必须包含读取到的完整对象（尤其 `metadata.annotations` 与 `metadata.resourceVersion`），只允许 `spec.email` 变化。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02**：校验不通过时写请求数为 0。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-03**：保存成功以回读为准——失效 query 后重新 GET，界面不靠本地状态宣告成功。
- **INV-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-04**：`iam.kubesphere.io/platform-role` 与 `kubesphere.io/description` 在保存前后完全一致。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01** | IAM users 端点对 `PATCH` 回 405。 | 写 PATCH 后 `codeForStatus` 把 405 落到 `http_error`，界面只显示「Bad Request」，看不出是端点不支持。 | `userSettingsApi.updateProfile`（`access.ts`） |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02** | `PUT` 是替换语义：请求体里没有 `platform-role` 注解，服务端就把它清掉，并且照样返回 200。 | 用户改一次邮箱，管理员权限被静默删掉；没有任何报错，只有下一次操作才开始 403。 | `userSettingsApi.updateProfile` 里的 `...current` 展开 |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-03** | 邮箱非法时服务端 400 的正文是 admission webhook 原文：`admission webhook "users.iam.kubesphere.io" denied the request: invalid email address:<值>`。 | 直接显示 `error.message` 会把英文运维文本和用户输入一起摆到界面上。 | 本页校验先拦；`UserSettingsDialog.tsx` 的 `emailProblem` |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-04** | 用户列表的邮箱列读 `annotations.email`（`toUserSummary`），而三条写路径（创建用户、管理员编辑、用户设置）都只写 `spec.email`。 | 改完邮箱后列表那一列不会变（新建账号那里本来就是 `-`），会被当成保存失败或列表 bug，进而去改本页代码。 | `access.ts` 的 `toUserSummary`（读注解）与三个写方法 |
| **GOT-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-05** | `errorMessage()` 对 409 这类非权限、非 404、非可重试的错误直接返回 `error.message`，也就是服务端原文。 | 并发冲突时用户看到的是 kube Status 的英文长句（`Operation cannot be fulfilled on users...`）。 | `ResourceErrorPanel.tsx` 的 `errorMessage`；本页 409 分支 |

## 测试与可观测

- **自动化**：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01` 覆盖只读项与邮箱初值（AC-01）；`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02` 覆盖空值/非法值不发请求、合法值保存后回读 `spec.email` 且两个注解不变（AC-02）。
- **手动验证**：用 platform-regular 账号改邮箱，然后 `kubectl get users.iam.kubesphere.io <name> -o yaml` 核对 `spec.email`、`iam.kubesphere.io/platform-role`、`kubesphere.io/description` 与 `metadata.resourceVersion`。
- **日志 / 指标**：网络面板里 PUT 的请求体应包含完整对象；保存成功后会看到一次 `GET users/<name>`（query 失效导致重取）。

## 后续改进

- 端点支持 merge patch 后，改邮箱可退化为单字段写，省一次 GET，也去掉「整对象丢字段」的风险。
- 若平台确认 `annotations.email` 是列表的唯一来源，本功能应同时写该注解（或在读取侧统一改读 `spec.email`），消除列表与详情不同源。

## 验收用例

- L3：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01`
- L3：`TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02`
