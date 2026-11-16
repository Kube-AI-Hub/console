# 登录态互通 — 技术方案

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01`

## 概述

两个 UI 同源，共用一个 `kah_token`。新前端只需要「读写同一个键」，登录、登出与吊销逻辑不变。

## 关联需求

- `AC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01`

## 设计目标与非目标

- **目标**：一个 token 键、一个 cookie；旧键自动迁移。
- **非目标**：刷新令牌、SSO 协议。

## 关键约束

- 老控制台的 `src/utils/token.js` 已经在写 `kah_token` 与同名 cookie，新前端必须对齐而不是另立一套。
- 模型平台的同源代理从 cookie 取 JWT，cookie 缺失会让模型平台变成未登录。

## 方案决策

### DEC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01：键名取老控制台的，不再双写

- **备选**：读时回退 + 写时双写（否决）／只用一个键（选定）。
- **原因**：双写只是把问题推后——退出要清两个键，漏一个就是幽灵会话。
- **何时重新考虑**：如果两个 UI 将来不同源（独立域名），那就需要 SSO 而不是共享键。

### DEC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-02：旧键一次性迁移

- **原因**：不迁移的代价是把已登录读者登出，一次升级制造一个「为什么又要登录」的工单。
- **何时重新考虑**：迁移逻辑保留一个发布周期后可以删除。

### DEC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-03：同步 `kah_token` cookie

- **原因**：`injectConsoleJwt` 从 cookie 取 JWT；只写 `localStorage` 会让从新前端去模型平台的读者是未登录状态。
- **何时重新考虑**：如果模型平台改为从 `Authorization` 头取 token。

## 系统现状

### 数据流

`登录 → localStorage.kah_token + cookie.kah_token → 新前端 getToken → BFF Authorization 头 → ks-apiserver`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `kube-frontend/apps/console-next/src/api.ts` | 键名与 API client | 不做登录流程 |
| `kube-frontend/apps/console-next/src/shell/AuthProvider.tsx` | 读写 token、迁移、cookie 同步 | 不做授权判断 |
| `console/src/utils/token.js` | 老控制台的同一份 token | 不改 |

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 状态 | `console` | `kube-frontend/apps/console-next/src/api.ts` | `TOKEN_KEY = 'kah_token'` |
| 状态 | `console` | `kube-frontend/apps/console-next/src/shell/AuthProvider.tsx` | 迁移 + cookie 同步 |
| 测试 | `console` | `tests/ui/**` | 断言键名统一 |
| 接口 | `kube-server` | — | 不改 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `localStorage.kah_token` | 浏览器存储 | 控制台 JWT | 两个前端、E2E |
| `cookie.kah_token` | Cookie | 同源代理读取的 JWT | `server/proxy.js:injectConsoleJwt` |

## 不变量

- **INV-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01**：`localStorage` 中只存在一个 token 键。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01** | 老控制台的登录表单会把密码做 `mix()`，BFF 必须发明文 | 服务端回 `invalid_grant`，表现为「密码错」 | `kube-frontend/server/src/auth/session.ts:encodePassword` |
| **GOT-L3-KUBE-FRONTEND-INTEGRATION-SESSION-02** | 登录页在 React 水合前填表会被丢弃 | E2E 报「密码为空」，产品实际正常 | `tests/ui/pages/login.py:sign_in` |

## 测试与可观测

- **自动化**：`tests/ui/tests/kube-frontend/integration/test_TC_L3_KUBE_FRONTEND_INTEGRATION_SESSION_01.py`、`tests/kube-frontend/login`（3 个用例）。
- **手动验证**：老控制台登录 → 点「新版控制台」→ 工作台直接渲染；`localStorage` 只有一个键。
- **日志 / 指标**：BFF 登录失败会返回 `code`，页面按 code 显示文案。

## 后续改进

迁移逻辑（`migrateLegacyToken`）在下一个发布周期后可以删除。

## 验收用例

- L3：`TC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01`
