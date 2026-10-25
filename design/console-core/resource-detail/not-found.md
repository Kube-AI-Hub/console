# 资源不存在 · 技术方案（L3）

[子模块技术方案](./_index.md)

## 概述

详情请求返回 404 后的处理链：store 记 `notFound` 并结束加载 → 详情页骨架 `replace` 到列表 → 提示走 i18n 并去重。改动集中在三个共享文件加两个 locale 文件，26 个重写了 `fetchDetail` 的 store 与 55 个详情页都不需要逐个改。

## 关联需求

- `AC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01`
- `AC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02`

## 设计目标与非目标

- **目标**：404 只在共享层处理一次；提示可读、去重；回退到页面自己声明的列表且不污染历史；对存在的资源零影响。
- **非目标**：不做 403 / 500 / 超时的统一改造；不做独立 404 页；不改后端。

## 关键约束

- 详情页的 `render()` 在 `isLoading && !detail.name` 时提前返回 Loading，因此 **必须由 store 结束 `isLoading`**，骨架才有机会介入。
- `request.js` 只有在调用方**没有**传 `reject` 时才走 `window.onunhandledrejection`；两处都会看到同一个 404，必须去重。
- 26 个 store 重写了 `fetchDetail`（其中 `pod.js`、`node.js`、`pv.js`、`container.js`、`accessor.js`、`volumeSnapshotContent.js`、`storageclasscapabilities.js`、`network/topology.js`、`codeRepo.js`、`workload/revision.js`、`openpitrix/*`、`s2i/builder.js`、`devops/*` 等），逐个改会漏，且新增资源类型还会漏。

## 方案决策

### DEC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01 — 在 `BaseStore` 构造器里包一层 `fetchDetail`

`BaseStore` 的构造器记录子类原型上的 `fetchDetail`，用同名方法覆盖为「调用原实现 → 捕获 404 → 置 `notFound` / 结束加载」。子类自己的 `fetchDetail` 定义在原型上（实例字段 `fetchDetail = async ...` 也会被实例属性遮蔽，需在构造器里取 `this.fetchDetail`）。

- **备选 A**：逐个改 26 个 store。优点：每处语义清晰；缺点：漏改一个就还是原行为，新增资源类型必然漏。
- **备选 B**：改 `request.js` 的全局行为。优点：一处生效；缺点：列表、监控、日志等所有请求都会触发回退，误伤面太大。
- **选定**：A 的替代——共享包装。覆盖点只有一个，语义集中在 `BaseStore`。
- **原因**：详情请求最终都继承 `BaseStore`；包装后所有子类（含未来新增）自动获得行为，且不影响非详情请求。
- **被否方案**：在 `request.js` 里按 URL 正则判断是不是详情请求。URL 形态跨资源差异大（`/klusters/...`、`/apis/...`、`/kapis/...`），正则一定会漏。
- **何时重新考虑**：若将来所有详情统一走一个 `fetchResource(kind, name)` 入口，可去掉这层包装。

### DEC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02 — 回退目标取 `breadcrumbs[0].url`，丢掉项目作用域时按路由纠正

`DetailPage` 在 `notFound` 时用 `listUrlFor({ breadcrumbs, match })` 求目标：优先 `breadcrumbs[0].url`（经 `compile` 填参数），否则从 `match.path` 尾部逐个去掉参数段推导。

**但面包屑不总是带项目作用域**：Pod 详情走 `/clusters/:cluster/projects/:namespace/pods/:podName`，而它的 `listUrl` 在没有 workspace 参数时给的是集群级 `/clusters/:cluster/pods`（A100 实测）。因此当「当前路由有 `namespace`、面包屑地址不含 `/projects/<ns>`、路由推导结果含」时，改用推导结果。

- **为什么**：列表入口由每个页面自己声明，天然带集群 / 命名空间；但从地址栏猜会把 `.../pods/<name>/resource-status` 猜成 `.../pods/<name>`（父详情），不是列表。两条规则合起来才能既尊重页面声明、又不丢项目上下文。
- **被否方案**：只信面包屑。Pod / 部署等页面在项目作用域下会退回集群级列表，过滤条件丢失。
- **被否方案**：只按路由推导。PV 详情（`/clusters/:cluster/pv/:name`）的列表实际是 `/clusters/:cluster/volumes/PV`，推导会给出不存在的路由。
- **被否方案**：统一回退到 `/404`。用户还要再点一次，且丢上下文。
- **被否方案**：`history.goBack()`。用户可能是直链打开的，后退会离开控制台。
- **何时重新考虑**：若引入「每个资源类型的默认列表路由」注册表，可去掉对 `breadcrumbs` 的依赖。

### DEC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-03 — 用 `replace` 而不是 `push`

- **为什么**：失效地址进历史后，用户点后退又回 404，来回弹两次提示。
- **被否方案**：`push` + 一条「已返回列表」提示。历史里仍留着坏地址。
- **何时重新考虑**：若产品希望「后退能回到刚才的失效链接」以便复制排查，再改回 `push`。

### DEC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-04 — 提示在 store 侧发，全局只兜底，且做时间窗去重

`notifyResourceNotFound(name)` 用 `Notify.warning`，模块级时间戳做 1 秒去重；`core/index.js` 的 `onunhandledrejection` 先判 `isNotFound` 再调同一个函数。

- **为什么**：store 传了 `reject` 就不会抛到全局；没传 `reject` 的 store（如 `openpitrix/application.js`）会抛到全局。两条路径必须共用一份文案与去重。
- **被否方案**：只在全局提示。store 传了 `reject` 的页面就完全没有提示。
- **被否方案**：只在 store 提示。漏掉未传 `reject` 的 store。
- **何时重新考虑**：若统一给所有详情请求传 `reject`，可去掉全局分支。

### DEC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-05 — 只认 404，不按 message 文案匹配业务错误

`isNotFound` 判 `status === 404`、`reason` ∈ {`NotFound`, `Not Found`}，或 `message` 以 `not found` 结尾且同时有 404 语义。

- **为什么**：k8s 的 404 在不同路径下 `reason` 大小写与空格不一致（`NotFound` / `Not Found`）；而 500 的 message 里也可能出现 `not found`（如 `storageclass not found`），只按文案判会误回退。
- **被否方案**：`message.includes('not found')`。会把 `create job failed: storageclass not found` 这类写操作失败也当成详情不存在。
- **何时重新考虑**：后端统一给出 `code: 404` 字段后，可只判 `status`。

## 系统现状

### 数据流

`详情页 fetchData → store.fetchDetail → request.get（无 reject 时抛全局） → 404 → BaseStore 包装置 notFound + isLoading=false → DetailPage replace(listUrl) + notify`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `src/utils/notFound.js`（新增） | `isNotFound` / `notifyResourceNotFound` / `listUrlFor` | 不发请求 |
| `src/stores/base.js` | 包装 `fetchDetail`，维护 `notFound` | 不决定回退地址 |
| `src/core/containers/Base/Detail/index.jsx` | `notFound` 时 `replace` | 不解析资源字段 |
| `src/core/index.js` | `onunhandledrejection` 的 404 分支 | 不替代 store 正常路径 |
| `locales/{en,zh}/l10n-console-resourceDetail.js`（新增） | 两条文案 | 不放资源专属文案 |

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 工具 | `console` | `src/utils/notFound.js` | 新增三个函数 |
| 状态 | `console` | `src/stores/base.js` | 加 `notFound` observable；构造器包装 `fetchDetail` |
| 骨架 | `console` | `src/core/containers/Base/Detail/index.jsx` | `componentDidMount` / `componentDidUpdate` 触发回退 |
| 全局 | `console` | `src/core/index.js` | 404 分支 + 去重提示 |
| 文案 | `console` | `locales/en/l10n-console-resourceDetail.js`、`locales/zh/l10n-console-resourceDetail.js` | 新增两条 key |
| 接口 | `kube-server` | — | 不改 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `isNotFound(error)` | JS 函数 | 判 404，兼容 `NotFound` / `Not Found` | store、全局处理、骨架 |
| `notifyResourceNotFound(name)` | JS 函数 | 发一条去重后的 warning 提示 | store、全局处理 |
| `listUrlFor({ breadcrumbs, match })` | JS 函数 | 求回退地址 | 详情页骨架 |
| `store.notFound` | mobx observable | 该详情是否 404 | 详情页骨架 |

## 不变量

- **INV-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01**：404 之后 `isLoading === false`，页面不再显示 Loading。
- **INV-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02**：同一次 404 在 1 秒窗口内最多产生一条提示。
- **INV-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-03**：`notFound` 为真时地址栏最终停在该详情页的列表入口，历史中不新增失效地址。
- **INV-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-04**：资源存在时 `notFound` 保持 `false`，不触发提示与回退。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01** | 详情页 `render()` 的 `isLoading && !detail.name` 会提前返回 Loading，`DetailPage` 不挂载 | 只在骨架加逻辑完全无效 | `src/stores/base.js` 的 404 分支先置 `isLoading = false` |
| **GOT-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02** | `request.js` 只在调用方未传 `reject` 时抛到全局；传了则静默 reject | 只做全局分支会漏掉一大半页面；只做 store 分支会漏掉未传 `reject` 的 store | 两处共用 `notifyResourceNotFound` 去重 |
| **GOT-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-03** | 部分 store 用实例字段 `fetchDetail = async ...` 定义（`openpitrix/*`、`s2i/builder.js`、`devops/codeQuality.js`） | 只在原型上包装会被实例字段遮蔽，包装不生效 | 构造器里取 `this.fetchDetail` 再覆盖 |
| **GOT-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-04** | `breadcrumbs[0].url` 可能含 `:cluster` / `:namespace` 占位符，也可能**丢掉项目作用域**（Pod 详情在无 workspace 参数时给 `/clusters/:cluster/pods`） | 不 compile 会跳到字面量 `:cluster` 路径；只信面包屑会退回集群级列表，项目过滤丢失 | `listUrlFor` 先 compile，再在「当前路由有 namespace 而面包屑没有」时改用路由推导 |
| **GOT-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-05** | `ContainerDetail` 的列表入口是父 Pod 详情，不是容器列表 | 回退到 Pod 详情后若 Pod 也没了，会再触发一次回退 | 由 Pod 详情的 store 自行处理，容器页只回退一层 |
| **GOT-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-06** | 提示文案里的资源名可能含引号或 `<` | 用 `t()` 的字符串插值渲染纯文本，不要用 `t.html` | `notifyResourceNotFound` |
| **GOT-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-07** | `Notify.warning` 默认 6 秒自动消失，且最多同时 3 条 | 连续打开失效链接时旧提示会挤掉新提示，看起来像没提示 | 去重窗口内直接跳过 |

## 测试与可观测

- **自动化**：`TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01`（不存在 → 中文提示 + 回退）、`-02`（存在 → 无提示无跳转）。
- **手动验证**：`/clusters/default/projects/agent-platform/pods/<不存在>/resource-status`；再开一个真实 Pod 对照。
- **日志 / 指标**：浏览器控制台不应出现未捕获的 404 rejection；后端无新增日志。

## 后续改进

- 把「资源不存在」做成骨架内的空态（带返回按钮），替代 toast + 自动跳转，给用户选择权。
- 给 `notFound` 增加资源类型，提示里显示「Pod / 部署 / 节点」而非通用「资源」。

## 验收用例

- L3：`TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01`
- L3：`TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02`
