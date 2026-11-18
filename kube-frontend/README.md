# kube-frontend

Console 的新前端。React 19 + Vite + TanStack Router/Query + Tailwind 4，UI 底座是 [`@kube-ai-hub/ai-kit`](../packages/ai-kit)。

## 为什么另起一套

`console` 的上游是 **AGPL-3.0**。AGPL 的触发条件是"通过网络提供服务"，控制台是 SaaS，意味着每改一行都在扩大传染面。唯一干净的做法是重写，并通过 HTTP 边界与原后端通信。

方案正文：[`doc/12_frontend_stack_unification.md`](../../doc/12_frontend_stack_unification.md)。

## 协议边界

- 本目录以 [Apache License 2.0](./LICENSE) 授权，**不包含任何 `console/src` 的代码**。
- 不复用 `console` 的 `withList` HOC、`ListPage`、`Table` 等组件，也不复制其源码后改写；业务逻辑以需求文档为规格重新实现。
- 与老 console 的通信只发生在 HTTP 层：新前端 → ks-console → `ks-apiserver`。老 console 继续独立提供服务，本项目不复制它的源码。

## 与老 console 并存

两个 UI 部署在**同一个地址**上，新前端只占 `/kube-frontend` 前缀（裸 `/` 与 `/login` 属于老 console）：

| 路径 | 归属 |
| --- | --- |
| `/`、`/login` | 老 console |
| `/kube-frontend/`、`/kube-frontend/login` | 本应用 |
| `/kube-frontend/{kapis,apis,api/v1}/*` | ks-apiserver（由 ks-console 转发） |
| `/kube-frontend/api/*` | 本应用的部署配置（ks-console 提供） |

老 console 按配置（`server.newConsole`）把 `/kube-frontend/*` 反代到本应用的 Deployment 并剥掉前缀，同时在顶部导航显示「新版控制台」入口。两边的登录态共用 `localStorage.kah_token` 与同名 cookie。

前缀的连带要求：`vite.config.ts` 的 `base`、`src/api.ts` 的 `APP_BASE`、终端 WebSocket 的 `basePath`，以及所有路由（含登录页）。老 console 侧的反代、入口与登录回跳见 `console/docs/plans/kube-frontend-integration-20261117.md`。

## 结构

```
kube-frontend/
├── pnpm-workspace.yaml   catalog：共享依赖版本的唯一真相
├── tsconfig.base.json    strict 全量开启，不做按文件豁免
├── apps/console-next/    应用壳（文件路由、Query、Tailwind）
├── packages/             共享包，职责边界由 config/ 的测试锁住
├── scripts/              本地静态站与部署脚本
└── config/               架构约束测试
```

### 共享包

沿用 bisheng 前端的划分：应用只放业务与页面，可复用的东西沉到 `packages/`。

| 包 | 职责 |
|---|---|
| `@kube-ai-hub/ui` | ai-kit 之上的薄封装。**纯展示层**：不引状态库、不发请求、不调 i18n、不引路由 |
| `@kube-ai-hub/api-client` | 类型化 API 客户端，只调 ks-apiserver |
| `@kube-ai-hub/locales` | 文案的唯一来源 |
| `@kube-ai-hub/ai-surface` | 让界面可被智能体操作：稳定选择器、状态机、机读清单 |

`@kube-ai-hub/ui` 的四条铁律是硬约束，`config/package-boundaries.test.ts` 会扫描源码，违反即测试失败。

## AI Native

两条线都要，缺一不可：

**1. 界面可被智能体操作**

- 可交互元素带稳定 `data-ai-id`，不随文案变化
- 页面状态通过 `data-ai-state` 暴露（`loading` / `ready` / `empty` / `error`），agent 可以轮询判定，不用猜
- 操作结果统一为 `{ status: 'success' | 'error' | 'pending', ... }`，agent 读取即可

**2. 面向 AI 的开发流程**

- 架构约束用测试锁住，不靠评审记忆
- 文档走 SDD 三棵树（`prd/` / `design/` / `tests/`），门禁 `check_docs.py`

## 移动端

断点与触控目标在框架层约定，不靠每个页面自觉：

- 触控目标 ≥ 44×44px
- 表格小屏折叠次要列（`hideBelow`），在自身容器内横向滚动
- 弹层始终居中（窄于 `sm` 的画布也是居中，不改贴底 sheet）
- 导航在 `sm` 以下折叠为抽屉

## 开发

```bash
pnpm install
pnpm dev        # 应用，默认 5174
pnpm typecheck
pnpm test
```

### 对着真实接口跑

本应用没有自己的服务端：构建产物由 ks-console 托管，接口由 ks-console 直连 ks-apiserver。
`vite.config.ts` 的 proxy 指向 `KA_BACKEND`（默认 `https://ka.watering.ai`），路径**原样转发**
（含 `/kube-frontend` 前缀），因为前缀分流正是部署端在做的判断。

```bash
pnpm dev          # 源码 + HMR，5174
pnpm build
pnpm preview      # dist 构建产物，5178
```

打开 `http://localhost:5178/kube-frontend/login` 用账号密码登录即可——凭据由 ks-apiserver
自己校验，`client_secret` 不出现在浏览器可触达的链路上。`preview` 对不存在的 `.js` 会回退到
`index.html`，部署端返回 404，所以最终验收仍以部署环境为准。

### 挂载路径

这个应用与老 console 共用同一个源，所有路由、资源与接口都在 `/kube-frontend` 前缀下（`vite.config.ts`
的 `base`、`src/api.ts` 的 `baseUrl`），裸 `/` 与 `/login` 属于老 console。ks-console 就是这个前缀的
主人：它把 `/kube-frontend/{kapis,apis,api/v1}` 转给 ks-apiserver，其余路径交给本应用的构建产物。

注意读和写走的是不同的门：读走 `/kapis/resources.kubesphere.io/v1alpha3/...`，
写（POST/PUT/PATCH/DELETE）走 `/api/v1/...`。kapis 的 resources 端点只注册了 GET，
写过去会拿到 405。
