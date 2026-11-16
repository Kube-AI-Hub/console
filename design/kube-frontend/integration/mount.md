# 前缀挂载与反代 — 技术方案

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01`

## 概述

`/kube-frontend` 前缀在三处出现，每处职责不同：老控制台剥前缀后反代、BFF 接受带或不带前缀的请求、前端产物与请求都带前缀。

## 关联需求

- `AC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01`

## 设计目标与非目标

- **目标**：一个前缀常量、一处剥前缀实现；静态资源与客户端路由分流正确。
- **非目标**：多前缀、可配置重写规则。

## 关键约束

- 新前端进程在开发期不带前缀（`dev-static-server.mjs` 是 origin 根），生产期也必须保持这个形态，否则开发与生产的路径拼接会出现两套。
- 静态产物由 Vite 构建，文件名带内容哈希。

## 方案决策

### DEC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01：剥前缀只做一次，集中在一个函数

- **备选**：反代剥（选定）／新前端认识「挂载点」环境变量。
- **原因**：BFF 收到的路径与开发期完全一致，路径拼接只在前端一处（`APP_BASE`）。
- **被否方案**：让进程自己拼前缀——路径拼接会散到每一处，且开发/生产差异扩大。
- **何时重新考虑**：如果出现第二个挂载点（例如多租户各挂一份）。

### DEC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-02：静态分流按扩展名 + Accept

- **备选**：全部回落 `index.html`（否决）／按扩展名分流（选定）。
- **原因**：缺失的 chunk 返回 HTML，浏览器报 `Unexpected token '<'`，完全指不出真正原因。
- **何时重新考虑**：如果出现无扩展名的静态资源（例如 `robots.txt` 已覆盖，未来若有 `/.well-known/*` 需重新评估）。

### DEC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-03：缓存头按是否在 `assets/` 下区分

- **原因**：Vite 文件名带哈希，`assets/` 可 `immutable`；`index.html` 必须 `no-cache`，否则发版后读者继续用旧构建。

## 系统现状

### 数据流

`浏览器 → ks-console（剥前缀）→ kube-frontend BFF → 静态文件 / ks-apiserver`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `console/server/libs/portalMounts.js` | 前缀常量、判定、剥前缀 | 不做转发 |
| `console/server/proxy.js` | 反代与路径重写 | 不注入凭据 |
| `console/server/components/wsProxy.js` | WebSocket 升级转发 | 不解析帧 |
| `kube-frontend/server/src/static.ts` | 静态服务与 SPA 回落 | 不认识业务路由 |

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 反代 | `console` | `server/proxy.js`、`server/routes.js` | 新增 `kubeFrontendProxy` 与挂载 |
| 升级 | `console` | `server/components/wsProxy.js` | 新增前缀分支 |
| 静态 | `console` | `kube-frontend/server/src/static.ts` | 新增 |
| 构建 | `console` | `kube-frontend/apps/console-next/vite.config.ts`、`src/api.ts` | 加 `base` / `baseUrl` |
| 接口 | `kube-server` | — | 不改 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `/kube-frontend/*` | HTTP | 新前端的所有资源与接口 | 浏览器、探针 |
| 静态资源 `Cache-Control` | HTTP 头 | `assets/` 下为 `immutable`，其余 `no-cache` | 浏览器缓存 |

## 不变量

- **INV-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01**：带扩展名的路径永不返回 HTML。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01** | `resolveStaticPath` 必须先 `resolve(root)` 再比较 | 相对 `STATIC_DIR` 时所有资源 404，而文件明明在 | `server/src/static.ts:resolveStaticPath` |
| **GOT-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-02** | 块注释里写 `*/*` 会提前结束注释 | 构建报 `Unexpected "*"` | `server/src/static.ts` 的注释 |

## 测试与可观测

- **自动化**：`server/test/static.test.ts`（18 个用例）、`server/components/wsProxy.node-test.cjs`。
- **手动验证**：`/kube-frontend/assets/<hash>.js` → 200 immutable；`/kube-frontend/assets/nope.js` → 404。
- **日志 / 指标**：ks-console 访问日志里能看到 `/kube-frontend/*` 请求。

## 后续改进

前缀写死在两处常量里（`NEW_CONSOLE_PREFIX`、`APP_PREFIX`）。若将来挂载点变化，把它们收敛到构建期注入。

## 验收用例

- L3：`TC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01`
