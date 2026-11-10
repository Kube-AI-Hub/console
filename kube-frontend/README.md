# kube-frontend

Console 的新前端。React 19 + Vite + TanStack Router/Query + Tailwind 4，UI 底座是 [`@kube-ai-hub/ai-kit`](../packages/ai-kit)。

## 为什么另起一套

`console` 的上游是 **AGPL-3.0**。AGPL 的触发条件是"通过网络提供服务"，控制台是 SaaS，意味着每改一行都在扩大传染面。唯一干净的做法是重写，并通过进程边界（BFF）与原后端通信。

方案正文：[`doc/12_frontend_stack_unification.md`](../../doc/12_frontend_stack_unification.md)。

## 协议边界

- 本目录以 [Apache License 2.0](./LICENSE) 授权，**不包含任何 `console/src` 的代码**。
- 不复用 `console` 的 `withList` HOC、`ListPage`、`Table` 等组件，也不复制其源码后改写；业务逻辑以需求文档为规格重新实现。
- 与老 console 的通信只发生在 HTTP 层：新前端 → BFF → `ks-apiserver`。老 console 继续独立提供服务，本项目不改它一行。

## 结构

```
kube-frontend/
├── pnpm-workspace.yaml   catalog：共享依赖版本的唯一真相
├── tsconfig.base.json    strict 全量开启，不做按文件豁免
├── apps/console-next/    应用壳（文件路由、Query、Tailwind）
├── packages/             共享包，职责边界由 config/ 的测试锁住
├── server/               BFF：鉴权、聚合、错误归一
└── config/               架构约束测试
```

### 共享包

沿用 bisheng 前端的划分：应用只放业务与页面，可复用的东西沉到 `packages/`。

| 包 | 职责 |
|---|---|
| `@kube-ai-hub/ui` | ai-kit 之上的薄封装。**纯展示层**：不引状态库、不发请求、不调 i18n、不引路由 |
| `@kube-ai-hub/api-client` | 类型化 API 客户端，只调 BFF |
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
- 弹层在小屏变为底部 sheet
- 导航在 `sm` 以下折叠为抽屉

## 开发

```bash
pnpm install
pnpm dev        # 应用，默认 5174
pnpm bff        # BFF，默认 8080
pnpm typecheck
pnpm test
```

### 对着真实接口跑

`scripts/dev-stack.sh` 把 BFF 和静态站点一起拉起来，BFF 按 `/kapis/*`、`/api/v1/*`、`/apis/*`
前缀透传给 `ks-apiserver`，不做字段映射：

```bash
KS_API_URL=http://ks-apiserver KS_API_MODE=kapis ./scripts/dev-stack.sh start
./scripts/dev-stack.sh smoke     # list/create/read/patch/put/delete 全链路
./scripts/dev-stack.sh stop
```

`KS_API_MODE=kapis` 直连 `ks-apiserver`；`kube` 模式改用本机 `kubectl proxy`（无鉴权，
分页排序由 BFF 模拟），适合没有 token 时快速看页面。kapis 模式在浏览器
`localStorage` 里放一个 JWT 到 `kubesphere-token`。

登录本身由前端自己完成，不再需要手工塞 JWT：打开 `/login` 输入账号密码即可。凭据由 BFF
代为提交给 `/oauth/token`（`client_secret` 不下发到浏览器），默认用 `kubesphere` 客户端，
可用 `KS_OAUTH_CLIENT_ID` / `KS_OAUTH_CLIENT_SECRET` 覆盖（本集群是 `kube-ai-hub`）。

注意读和写走的是不同的门：读走 `/kapis/resources.kubesphere.io/v1alpha3/...`，
写（POST/PUT/PATCH/DELETE）走 `/api/v1/...`。kapis 的 resources 端点只注册了 GET，
写过去会拿到 405。
