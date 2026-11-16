# 与老控制台同源集成 — 技术方案

[上级模块技术方案](../_index.md)

**技术方案 ID**：`DES-L2-KUBE-FRONTEND-INTEGRATION`

## 概述

新前端以独立 Deployment 运行，老控制台按配置把 `/kube-frontend/*` 反代过去。两个进程之间只有 HTTP：老控制台不知道新前端的路由，新前端不知道老控制台的存在。

## 关联需求

- `AC-FULL-KUBE-FRONTEND-INTEGRATION-01`

## 设计目标与非目标

- **目标**：一个地址、一个登录态、可一键关闭。
- **非目标**：统一外壳、SSO 协议、把两个前端打进同一个镜像。

## 关键约束

- 老控制台是 AGPL、新前端是 Apache-2.0：只能 HTTP 通信，不共享代码或构建产物。
- 新前端的所有请求（含 `/api/session/*`）都在前缀下；老控制台的裸 `/kapis` 代理只服务它自己。

## 页面与技术结构

| 组件 / 模块 | 路径 | 职责 | 不做什么 |
| --- | --- | --- | --- |
| 前缀与剥前缀 | `console/server/libs/portalMounts.js` | 常量、判定、重写 | 不转发 |
| 反代 | `console/server/proxy.js` | `/kube-frontend/*` → 新前端 Service | 不注入凭据 |
| 挂载点 | `console/server/routes.js` | 在 catch-all 之前挂载 | 不渲染页面 |
| 升级 | `console/server/components/wsProxy.js` | 终端 WebSocket 转发 | 不解析帧 |
| 新前端进程 | `kube-frontend/server/src/index.ts` | 静态 + BFF | 不认识老控制台 |
| 部署 | `console/deploy/kube-frontend.yaml` | Deployment + Service | 不含配置开关 |

## 状态与数据归属

| 状态 | 位置 | 刷新后 |
| --- | --- | --- |
| 是否挂载 | `ks-console-config` 的 `local_config.yaml`（服务端） | 保持 |
| 登录 token | 浏览器 `localStorage.kah_token` + cookie | 保持 |
| 当前路由 | 地址栏，带 `/kube-frontend` 前缀 | 保持 |
| 反代目标 | `server.newConsole.target` | 保持 |

## 关键契约与依赖

| 契约 / 依赖 | 形式 | 风险点 |
| --- | --- | --- |
| `/kube-frontend/*` | HTTP 反代 | 前缀不剥会让 BFF 认不出 `/api/session/*` |
| `kah_token` | 浏览器存储 + cookie | 两个键并存会出现幽灵会话 |
| `newConsole.enabled` | 服务端配置 | 与入口可见性必须同源 |

## 不变量

- **INV-L2-KUBE-FRONTEND-INTEGRATION-01**：裸 `/` 与 `/login` 永远由老控制台响应。
- **INV-L2-KUBE-FRONTEND-INTEGRATION-02**：入口可见 ⟺ 前缀已挂载。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L2-KUBE-FRONTEND-INTEGRATION-01** | 老控制台的 `.all('{/*path}')` 会吞掉任何未注册路径 | `/kube-frontend/*` 渲染成老控制台的壳，看起来「新前端没生效」 | `server/routes.js` 的挂载顺序 |
| **GOT-L2-KUBE-FRONTEND-INTEGRATION-02** | `ka.watering.ai` 的 `/` 由 csghub-portal 接管，不是 console | 以为 console 在 ingress 后面，验证时找不到入口 | 本次只保证 NodePort 30880 |

## 测试与可观测

- **自动化**：`pnpm --filter @kube-ai-hub/bff test`（71）、`node --test server/components/wsProxy.node-test.cjs`（4）、`pytest tests/kube-frontend/{login,workbench,configmaps,integration}`。
- **手动验证**：`http://10.1.37.18:30880/` 与 `/kube-frontend/` 各自渲染；顶部入口可点。
- **日志 / 指标**：ks-console 访问日志；新前端 BFF 启动时打印 upstream 与 static 目录。

## 明确不做

- 不做统一外壳。
- 不把新前端并入 ks-console 镜像。
- 不为新前端单独分配端口或域名。

## 后续改进

迁移完成后（老控制台不再需要）这套反代与入口可以整体删除，届时新前端直接占用 `/`。

## 功能点

| 功能点 | 需求 | 技术方案 | 用例 |
|---|---|---|---|
| 前缀挂载与反代 | [`mount.md`](../../../prd/kube-frontend/integration/mount.md) | [`mount.md`](./mount.md) | `TC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01` |
| 老控制台顶部入口 | [`entry.md`](../../../prd/kube-frontend/integration/entry.md) | [`entry.md`](./entry.md) | `TC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01` |
| 登录态互通 | [`session.md`](../../../prd/kube-frontend/integration/session.md) | [`session.md`](./session.md) | `TC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01` |

## 验收用例

- L2：`TC-FULL-KUBE-FRONTEND-INTEGRATION-01`
- L3：`TC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01`、`TC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01`、`TC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01`
