# 登录 · 技术方案（L2）

> 本文承接 [`prd/kube-frontend/login.md`](../../prd/kube-frontend/login.md) 的全部 `AC-*`。

## 概述

登录需要一样浏览器不该持有的东西：OAuth client secret。BFF 因此在这里开三个口子（`/api/session/login`、`/api/session/me`、`/api/session/logout`），其余接口继续走透明代理。

## 关联需求

- `AC-L2-KUBE-FRONTEND-LOGIN-01`
- `AC-L2-KUBE-FRONTEND-LOGIN-02`
- `AC-L2-KUBE-FRONTEND-LOGIN-03`
- `AC-L2-KUBE-FRONTEND-LOGIN-04`
- `AC-L2-KUBE-FRONTEND-LOGIN-05`
- `AC-L2-KUBE-FRONTEND-LOGIN-06`
- `AC-L2-KUBE-FRONTEND-LOGIN-07`

## 设计目标与非目标

**目标**：凭据留在服务端；失败原因可区分；会话只有 token 一个来源。

**非目标**：第三方登录、注册、找回密码、token 续期。

## 关键约束

- 代理仍保持透明：写操作直打 `/api/v1/*`，读走 `/kapis/*`，登录不改变这一点。
- 登出必须先调 upstream 再删本地 token，否则集群侧的 token 仍然可用。

## 方案决策

### DEC-L2-KUBE-FRONTEND-LOGIN-01 — 只在 BFF 加三个会话接口

**为什么**：`/oauth/token` 的 `client_secret` 一旦下发到浏览器就是公开的。老 console 也是服务端注入凭据（`server/middlewares/injectOAuthCredentials.js`）。三个接口覆盖了全部涉及凭据的动作，其余仍然是透传。

**被否方案**：把 `client_secret` 塞进前端配置。任何人打开 DevTools 就能拿到，等于没有 client 认证。

**被否方案**：在 BFF 里做一整套 auth 服务（刷新、权限缓存、会话表）。BFF 要无状态，多了状态就必须处理多副本一致性与过期清理，而 ks-apiserver 已经是权威。

### DEC-L2-KUBE-FRONTEND-LOGIN-02 — 密码按原样提交，不迁移 `mix()` 混淆

**为什么**：老 console 前端把密码做了一次 `mix(salt, base64(pw))`，服务端再解回来。salt 是公开常量、变换完全可逆，不提供任何保密性；而它对含 `@` 的密码会算出非法密文，是线上已知故障。TLS 才是这一段真正的保护。

**被否方案**：保留 `mix()` 以「兼容老服务端」。实测本集群的 `/oauth/token` 接受明文并返回 200，老实现服务于一个并不存在的需求。

### DEC-L2-KUBE-FRONTEND-LOGIN-03 — 用户由 token 解出，不额外请求

**为什么**：token 里已经有 `sub`、`exp`，再存一份「当前用户」就会出现两个真相，一个页面用旧数据、另一个用新数据。`/api/session/me` 只在页面加载时调用一次，用途是识别「已被注销的 token」——这一点 JWT 自己看不出来。

**被否方案**：从 `/kapis/iam.kubesphere.io/v1alpha2/users/:name` 拉用户资料。多一次往返，且返回的是 KubeSphere 视角的用户对象，字段与登录态无关。

### DEC-L2-KUBE-FRONTEND-LOGIN-04 — 登录错误码保持细分

**为什么**：`ApiError.code` 是粗粒度的（401 一律 `unauthorized`），因为资源页只需要知道「没权限」。登录页必须区分错误密码与集群不可达——这两者都可能是 4xx，混在一起会把运维故障显示成「密码错误」。BFF 的细分码因此放在 `details.serverCode`，登录流程再取回。

## 模块边界

| 位置 | 内容 |
|---|---|
| `server/src/auth/session.ts` | 调用 `/oauth/token`、`/oauth/logout`，错误映射 |
| `server/src/auth/token.ts` | JWT 解出 `SessionUser`（展示用，不校验签名） |
| `server/src/index.ts` | `/api/session/*` 路由与请求体上限 |
| `packages/api-client/src/session.ts` | `login` / `me` / `logout` |
| `packages/api-client/src/token.ts` | 浏览器侧同款解码器 |
| `apps/console-next/src/shell/AuthProvider.tsx` | token 存储、跨标签同步、登出 |
| `apps/console-next/src/pages/login/LoginPage.tsx` | 表单 |
| `apps/console-next/src/routes/__root.tsx` | `beforeLoad` 鉴权闸门 |

## 不变量

- **INV-L2-KUBE-FRONTEND-LOGIN-01** — `client_secret` 不出现在任何前端产物里。
- **INV-L2-KUBE-FRONTEND-LOGIN-02** — 未通过 `beforeLoad` 鉴权闸门的路由不渲染 `AppShell`。
- **INV-L2-KUBE-FRONTEND-LOGIN-03** — `redirect` 只接受站内绝对路径。

## 已知坑

- **GOT-L2-KUBE-FRONTEND-LOGIN-01** — 本集群 JWT 的 `iss` 是 `kube-ai-hub`，**载荷里没有 `extra`**。老 console 的 `login()` 无条件读 `extra.email[0]` 与 `initialized`，套过来会让每个用户的邮箱都是 undefined、并且所有账号都被判为「已初始化」。解码器必须容忍 `extra` 缺失。
- **GOT-L2-KUBE-FRONTEND-LOGIN-02** — `/oauth/logout` 只接受 `GET`；`POST` / `DELETE` 返回 401，看起来像「token 无效」，实际是动词不对。
- **GOT-L2-KUBE-FRONTEND-LOGIN-03** — 登录成功后页面整页跳转，`Runtime.evaluate` 的执行上下文会被销毁；自动化里要把跳转当成成功信号而不是错误。
- **GOT-L2-KUBE-FRONTEND-LOGIN-04** — `@kube-ai-hub/api-client` 是带 DOM 类型的包，BFF 以 `lib: ["ES2022"]` 编译，不能 import 它；两侧的解码器由测试对齐，不由共享模块对齐。

## 测试

- `server/test/auth.test.ts`：代理链路、表单编码、错误码、`me`、登出动词、解码器。
- `packages/api-client/test/session.test.ts`：细分错误码的保留、解码器对 `extra` 缺失的处理。

## 验收用例

- `TC-L2-KUBE-FRONTEND-LOGIN-01`（US1）
- `TC-L2-KUBE-FRONTEND-LOGIN-02`（US2）
- `TC-L2-KUBE-FRONTEND-LOGIN-03`（US3）
