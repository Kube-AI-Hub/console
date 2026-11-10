# 登录（L2）

## 概述

新前端的登录页与登出入口。凭据由 ks-apiserver 的 OAuth password grant 校验，token 存在浏览器 `localStorage` 的 `kubesphere-token`（与老 console 同一个键，会话可互通）。

## 用户故事

### US1 - 作为平台用户，用自己的账号登录后回到原来要去的页面

**Independent Test**：未登录状态下打开配置字典深链接，被带到 `/login?redirect=...`；输入正确账号密码后，落在原来的配置字典页而不是首页。

### US2 - 作为输错密码的用户，知道错在哪里而不是「登录失败」

**Independent Test**：输入错误密码提交，表单内出现「用户名或密码不正确」，密码框被清空，用户名保留；集群不可达时提示的是连不上集群而不是密码错误。

### US3 - 作为离开的用户，退出后 token 在集群侧也失效

**Independent Test**：点击右上角账号菜单的「退出登录」，回到登录页；用退出前的 token 直接请求 kapis 返回 401。

## 验收场景

- **AC-L2-KUBE-FRONTEND-LOGIN-01** — Given 未登录，When 访问任意受保护路由，Then 跳转到 `/login` 且 `redirect` 携带原路径与查询串；登录成功后跳回该路径。
- **AC-L2-KUBE-FRONTEND-LOGIN-02** — Given 登录页，When 用户名或密码为空提交，Then 对应输入框下方给出提示，且不发起请求。
- **AC-L2-KUBE-FRONTEND-LOGIN-03** — Given 密码错误，When 提交，Then 表单内显示「用户名或密码不正确」，密码被清空，未写入 token。
- **AC-L2-KUBE-FRONTEND-LOGIN-04** — Given 已登录，When 点击账号菜单的「退出登录」，Then 回到登录页，token 从 `localStorage` 移除，且 upstream 收到 token 注销。
- **AC-L2-KUBE-FRONTEND-LOGIN-05** — Given `localStorage` 里有一个已被集群注销的 token，When 打开任意页面，Then 不渲染控制台外壳，直接回到登录页。
- **AC-L2-KUBE-FRONTEND-LOGIN-06** — Given 已登录，When 访问 `/login?redirect=//evil.com`，Then 不跳往站外，落在站内入口。
- **AC-L2-KUBE-FRONTEND-LOGIN-07** — Given 账号是预注册状态（`initialized=false`），When 登录成功，Then 停留在登录页并说明「该账号尚未设置密码」，不进入控制台。

## 设计目标

- 浏览器**不持有** OAuth client secret：`/oauth/token` 由 BFF 代为调用。
- 登录失败可区分：错误密码、撞限流、集群不可达、client 配置错误各有各的文案。
- 会话以 token 为唯一来源：用户信息由 token 解出，不额外维护一份「当前用户」。

## 约束与边界

- 密码**按原样**提交。老 console 的 `mix(salt, base64(pw))` 混淆不迁移：salt 是公开的、变换可逆，不增加任何保密性，反而让含 `@` 的密码无法登录。
- 预注册账号没有密码确认页（新前端尚未迁移 `/password/confirm`），因此只能停在登录页提示，不能放行。
- 不迁移第三方登录（LDAP / OIDC / GitHub）：它们依赖 `oauthServers` 配置与跳转回调，属于独立的一块。
- token 的 `iss` 为 `kube-ai-hub` 时载荷不含 `extra`，解出的用户只有 `name` 与 `expiresAt`，没有邮箱。

## 明确不做

- 「记住我」「自动续期」：token 有效期由 ks-apiserver 决定，前端不自造刷新机制。
- 注册与找回密码。

## 假设

- ks-apiserver 提供 `POST /oauth/token`（password grant）与 `GET /oauth/logout`。
- `GET /oauth/logout` 是唯一被接受的动词（POST / DELETE 返回 401），且返回 200 后该 token 立即失效。
