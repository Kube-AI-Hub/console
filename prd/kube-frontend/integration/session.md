# 登录态互通（L3）

## 概述

两个 UI 同源同端口，共用一个 `kah_token`：在老控制台登录后进入新前端不需要再登录，反之亦然。token 同时写入 `kah_token` cookie，供模型平台的同源代理读取。

## 用户故事

### US1 - 作为平台用户，进新前端不用再登录一次

**Independent Test**：在老控制台登录，点「新版控制台」，新前端直接显示工作台（有账号菜单），不出现登录表单。

## 验收场景

- **AC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01** — Given 已登录老控制台，When 打开 `/kube-frontend/`，Then 不出现登录页，`localStorage` 里只有 `kah_token` 一个 token 键，`document.cookie` 含 `kah_token`。

## 设计目标

- **一个键**：不保留第二个 token 键。两套键并存会让「谁登录了」出现两个答案。
- **旧键迁移**：读到旧的 `kubesphere-token` 时搬到 `kah_token` 并删掉旧键，已登录读者不被登出。
- **cookie 同步**：老控制台写 `kah_token` cookie 是因为模型平台的 `injectConsoleJwt` 从 cookie 取 JWT；新前端登录/退出必须同样写/清。

## 约束与边界

- 登出先调 upstream `/oauth/logout` 再清本地，否则集群侧 token 仍可用。
- 跨标签页：监听 `storage` 事件，另一个标签页登录/退出立即生效。
- 不改老控制台的 token 读写逻辑（它已经在用 `kah_token`）。

## UI 交互设计

无独立界面。表现是「进入新前端没有登录页」「退出后两边都失效」。

## 文案与校验

登录失败文案仍由 BFF 的 `code` 决定（`invalid_credentials` 等），与本次改动无关。

## 边界情况

- 只有旧键 `kubesphere-token`：迁移一次，保留会话。
- 两个键都有且不同：以 `kah_token` 为准，旧键删除。
- cookie 写入失败（隐私模式）：本地会话仍可用一个页面加载周期。
- token 被吊销：新前端 `/api/session/me` 401 → 清 token → 跳 `/kube-frontend/login`。

## 功能需求

- **FR-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01** — 新前端必须只读写 `kah_token`，并同步同名 cookie。

## 成功标准

- **SC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01** — `localStorage` 里不残留第二个 token 键。

## 明确不做

- 不做刷新令牌或单点登录协议：`kah_token` 已足够。

## 假设

- 两个 UI 在同一个 origin 下（同协议、同主机、同端口），`localStorage` 与 cookie 天然共享。

## 验收用例

- `TC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01`
