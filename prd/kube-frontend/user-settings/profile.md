# 基本信息（L3）

[子模块需求](./_index.md)

## 概述

基本信息页签显示当前账号的用户名与平台角色（都只读），并允许改邮箱。数据来自一次 `GET users/<当前用户名>`；保存时把同一个对象整份 `PUT` 回去，只把 `spec.email` 换成输入值。

## 用户故事

### US1 - 改自己的邮箱，不需要平台管理权限 (Priority: P1)

作为 **登录用户**，我希望 **在用户设置里改自己的邮箱并保存**，以便 **换邮箱后不必找管理员，也不必等审批**。

**Independent Test**：用 platform-regular 账号打开用户设置，把邮箱改成 `new-<时间戳>@example.com` 并保存；重新打开弹窗，核对输入框与 `GET users/<name>` 的 `spec.email` 都是新值；再用 kubectl 核对 `iam.kubesphere.io/platform-role` 注解仍在。

## 验收场景

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01** — 已知已登录，当打开「用户设置 → 基本信息」，则显示当前账号的用户名（只读）、平台角色（只读）与邮箱（可编辑），邮箱初值等于 `GET users/<当前用户>` 返回的 `spec.email`。
- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02** — 已知在基本信息页签，当邮箱为空或格式非法时点保存，则保存被拒绝并给出提示，且不发出写请求；当邮箱合法时保存，则整对象 PUT 成功，回读 `spec.email` 为新值，且 `iam.kubesphere.io/platform-role` 与 `kubesphere.io/description` 两个注解保持不变。

## 设计目标

让用户在一屏内看清「我是谁、我的角色是什么、我的邮箱是什么」，并让一次保存只改一个字段：其余字段原样带回，不因为改一次邮箱而丢掉角色。

## 约束与边界

- 邮箱的权威字段是 `spec.email`。用户列表行读的是 `annotations.email`，详情读 `spec.email`；本页取后者。
- 写必须是整对象 `PUT`：IAM users 端点对 `PATCH` 返回 405（实测）。PUT 前先 `GET` 取 `resourceVersion`，否则并发修改会被静默覆盖。
- 平台角色只读，来源是 `annotations[iam.kubesphere.io/platform-role]`（缺省回退 `iam.kubesphere.io/globalrole`）；两个注解都没有时显示 `-`。
- 权限边界：只写自己的对象。管理员改别人的邮箱走「访问控制 → 用户」的编辑弹窗，那里还多一个描述字段。
- 邮箱格式由服务端 webhook 校验，非法时返回 400，正文是 `admission webhook "users.iam.kubesphere.io" denied the request: invalid email address:<值>`；本页在发请求前先拒绝，避免把这段英文给用户看。

## UI 交互设计

- 三行字段：用户名、平台角色、邮箱。前两项是只读文本（契约里 `user-settings:username` / `user-settings:platform-role` 就是文本节点，用例按文本断言，不做输入框）。
- 只读项的说明文案：「登录账号，不能修改。」与「由平台管理员分配，不能自行修改。」；邮箱的说明沿用老 console 的 `USER_SETTING_EMAIL_DESC`：「邮箱地址可用于登录 Kube AI Hub Web 控制台。」
- 页内底部「保存」按钮 `user-settings:profile-save`。点击后先校验邮箱；不通过则错误行 `user-settings:profile-error` 显示提示，弹窗不关、不发请求。
- 保存成功：错误行消失，按钮旁出现「已保存。」（`user-settings:profile-saved`）；输入框保留新值，不重置回旧值，否则用户会以为没生效。
- 保存中按钮进入 loading 且不可重复点击。
- 邮箱与读取值不同时，页签上出现未保存提示点（文案「内容已修改但未保存」）；保存成功后提示点消失。

## 文案与校验

| key | 中文 | 英文 | 用途 |
| --- | --- | --- | --- |
| `userSettings.username` | 用户名 | Username | 字段名 |
| `userSettings.usernameHint` | 登录账号，不能修改。 | The sign-in name, which cannot be changed. | 只读说明 |
| `userSettings.email` | 邮箱 | Email | 字段名 |
| `userSettings.emailHint` | 邮箱地址可用于登录 Kube AI Hub Web 控制台。 | The address can be used to sign in to the web console. | 输入框说明（老 console 的 `USER_SETTING_EMAIL_DESC`） |
| `userSettings.platformRole` | 平台角色 | Platform role | 字段名 |
| `userSettings.platformRoleHint` | 由平台管理员分配，不能自行修改。 | Assigned by a platform administrator; it cannot be changed here. | 只读说明 |
| `userSettings.profile.saved` | 已保存。 | Saved. | 成功提示 |
| `userSettings.profile.error.email` | 请输入合法的邮箱地址。 | Enter a valid email address. | 校验失败 |
| `userSettings.profile.loadFailed` | 无法读取账号信息。 | Could not read the account. | 读取失败 |
| `userSettings.tab.dirty` | 内容已修改但未保存 | Unsaved changes | 页签提示点的 title / aria-label |

校验规则：

- 空值（含只有空格）：拒绝，显示 `userSettings.profile.error.email`。
- 格式：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`，与「访问控制 → 用户」编辑弹窗是同一条规则——两处对着同一个服务端约束，不该给两种口径。
- 通过后提交 `email.trim()`，前后空格不进请求体。

## 边界情况

- **读取失败**：显示「无法读取账号信息。」与具体原因，并提供重试；此时基本信息页签没有保存按钮（没有初值就无从判断用户改了什么）。
- **并发修改（409）**：PUT 带回的 `resourceVersion` 过期时服务端回 409，页面显示保存失败、弹窗保持打开；重新打开弹窗会重新读取对象，再改即可。不做自动重试——重试会覆盖别人刚改的内容。
- **服务端仍拒绝邮箱（400）**：前端正则与 webhook 规则不完全等价，此时显示保存失败而不是 webhook 原文。
- **平台角色为空**：显示 `-`。
- **邮箱含大写字母、加号或子域**：正则接受，原样提交，不做小写化（服务端不要求）。
- **未改动直接点保存**：允许，会发出一次与原值相同的 PUT；结果仍是「已保存。」。
- **会话过期（401）**：读取失败提示；刷新页面后回到登录页。

## 功能需求

- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01**：系统必须在基本信息页签显示用户名与平台角色（只读）以及邮箱（可编辑），邮箱初值取自 `spec.email`。
- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02**：系统必须在邮箱为空或格式非法时阻止提交，且不发出任何写请求。
- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-03**：系统必须以整对象 PUT 写入邮箱，且不得改变 `iam.kubesphere.io/platform-role` 与 `kubesphere.io/description` 注解。

## 成功标准

- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01** — 合法邮箱保存后，`GET users/<name>` 的 `spec.email` 等于提交值，且两个注解与保存前完全一致。
- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02** — 非法邮箱点保存时，写请求数为 0。

## 明确不做

- **改用户名**：`metadata.name` 是对象主键，改名等于重建对象，平台的角色绑定与登录记录都挂在旧名字上。
- **改平台角色**：角色分配是管理员权限下的操作，在「访问控制 → 用户」里做；放进个人设置等于让用户给自己提权。
- **改描述（`kubesphere.io/description`）**：老 console 的用户设置弹窗没有这个字段；管理员在用户编辑弹窗里改，那里与创建用户的字段一致。
- **保存前查重邮箱**：没有可用的查重接口，老 console 的设置弹窗也不查；服务端拒绝时按失败提示处理。
- **只写 `spec.email` 的局部更新**：端点不支持 PATCH（405），没有第二条路。

## 假设

- 当前用户能读自己的 User 对象（`GET users/<name>` 返回 200）。
- 平台 webhook 对邮箱只做格式校验，本页正则足以提前拦住绝大多数非法输入。

## 验收用例

- `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01`
- `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02`
