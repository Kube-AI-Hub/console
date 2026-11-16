# 前缀挂载与反代（L3）

## 概述

新前端作为一个独立 Deployment 运行，由老控制台把 `/kube-frontend/*` 反代过去。这个功能点是整条链路的地基：前缀不剥掉，新前端的 BFF 就认不出 `/api/session/*`；静态资源与客户端路由不区分，缺失的 JS 会拿到 HTML 外壳。

## 用户故事

### US1 - 作为平台用户，直接粘贴新前端的深链接也能打开

**Independent Test**：在地址栏输入 `{地址}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps` 回车，看到配置字典列表（或空态），不是老控制台页面、不是 404。

## 验收场景

- **AC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01** — Given 新前端已挂载，When 请求 `/kube-frontend/assets/<hashed>.js`、`/kube-frontend/<客户端路由>`、`/kube-frontend/assets/<missing>.js`，Then 依次得到 200+`immutable`、SPA 外壳、404。

## 设计目标

- **前缀只在一处剥**：老控制台剥一次，新前端进程永远收到不带前缀的路径；同时新前端自己也能接受带前缀的请求（直接 `curl` Pod 时）。
- **静态与路由分开**：带扩展名的路径只查文件，查不到就 404；不带扩展名的导航请求才回落到 `index.html`。

## 约束与边界

- 反代目标来自配置 `server.newConsole.target`，未配置时不挂载。
- WebSocket 升级走同一条路径：`/kube-frontend/api/v1/.../exec` 剥前缀后交给新前端的 BFF。
- 反代不注入凭据：新前端自己带 `Authorization`（HTTP）或 token 子协议（WebSocket）。

## UI 交互设计

无直接界面。表现是「深链接能打开」「刷新不会 404」「资源加载不串味」。

## 文案与校验

404 的响应体是 JSON `{code: 'not_found'}`，不是 HTML——一个脚本标签收到 HTML 只会报语法错误。

## 边界情况

- 请求路径是 `/kube-frontend`（无尾斜杠）：同样落到 SPA 外壳，由前端路由处理。
- 请求路径以 `/kube-frontendish` 开头：**不是**前缀，不能被剥。
- `Accept: application/json` 的路由请求：404，而不是外壳。
- `Accept: */*`（curl、探针）：返回外壳，否则命令行检查会把正常部署当成 404。

## 功能需求

- **FR-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01** — 必须剥掉 `/kube-frontend` 前缀再转发；带扩展名的路径不得回落到外壳。

## 成功标准

- **SC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01** — 缺失的静态资源返回 404 而不是 HTML。

## 明确不做

- 不做多前缀或路径重写规则的可配置化：只有 `/kube-frontend` 一个前缀。

## 假设

- 反代与静态服务在同一个 Pod 内（新前端一个容器同时提供两者）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01`
