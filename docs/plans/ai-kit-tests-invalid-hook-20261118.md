# ai-kit 组件测试挂了 9 条：Invalid hook call（2026-11-18）

## 现象

`python3 prd/tools/verify.py --no-e2e` 在第一关就停：

```
失败：ai-kit 单测（3.4s）
先修这一项再继续——后续检查建立在它通过之上。
```

`packages/ai-kit` 里 5 个文件 / **9 条用例**失败，错误都是：

```
Error: Invalid hook call. Hooks can only be called inside of the body of a function component.
```

涉及 `Pagination`、`Dropdown`、`Modal on a phone`、`ResourceList` 与 `shared list capabilities`——
**其中三条与 ResourceList 无关**，所以不是某一次组件改动的逻辑错误。

## 已排除

| 猜测 | 结果 |
| --- | --- |
| 我的空态改动引入 | 排除：`Dropdown`/`Modal`/`Pagination` 也挂，它们没被我改过 |
| 用了错的 vitest 配置 | 排除：`--config vitest.config.ts` 与包内 `test` 脚本结果一致 |
| 树里有两份 React | 部分成立但不充分：`kube-frontend` 用 **react 19.2.0**（catalog），`packages/ai-kit` 的 devDependencies 是 **react ^18.3.1**，且 `use-callback-ref`/`use-sidecar` 各自带嵌套 `react`；**但**在 ai-kit 的 vitest 配置里加 `resolve.dedupe: ['react','react-dom']` 后 9 条仍全部失败（已回退该改动） |

## 报错形态（缩小范围用）

不是断言失败，而是 **jsdom 里的未捕获异常**：

```
stderr | test/component-capabilities.test.tsx > Dropdown control > opens when the host says so
Error: Uncaught [Error: Invalid hook call. …]
    at reportException (.../jsdom/living/helpers/runtime-script-errors.js)
```

也就是说某个组件在渲染/副作用阶段抛了，而 vitest 把它记成用例失败。**`Dropdown`、`Modal`、`Pagination`、`ResourceList` 都受影响**，
共同点是它们都经由 Radix 的 popper/portal 组件。

## 根因（已定位并验证）

完整栈给出了答案：

```
at resolveDispatcher (.../node_modules/use-callback-ref/node_modules/react/cjs/react.development.js:1465:13)
```

`use-callback-ref`（Radix 的依赖）下面被装了一份**自己的 React**：

| 位置 | 版本 |
| --- | --- |
| `ai-kit/node_modules/react` | **18.3.1** |
| `ai-kit/node_modules/use-callback-ref/node_modules/react` | **16.14.0** |

它的 peer 范围是 `^16.8 || ^17 || ^18 || ^19`，pnpm 给这个 peer 解析到了 **16.14.0**，于是 Radix 内部的 hook
调用落到 React 16 的 dispatcher 上，与 18 的 renderer 不匹配 → `Invalid hook call`。

## 验证

把那份嵌套的 React 移开后再跑：

```
Test Files  21 passed (21)
Tests       226 passed (226)
```

**9 条全绿**。移开的目录已还原，工作区未留改动。

## 连带发现：`verify.py` 后面几关也有红灯

`verify.py` 在 ai-kit 停下，后面的关看不到。手工跑：

| 关 | 结果 |
| --- | --- |
| 架构契约（config/*.test.ts） | 20 文件 / 1579 passed ✓ |
| api-client 单测 | 50 文件 / 477 passed ✓ |
| **ai-kit 单测** | **9 失败**（本节根因） |
| **console-next 单测** | **3 失败**，2 文件：`GPU pages`、`ConfigMaps list`（两条），错误是 jsdom 的
  `textRange(...).getClientRects is not a function`（130 处），且失败用例里 **body 是空的**——页面根本没渲染 |

console-next 那三条与 ai-kit 的根因不同：`Range.getClientRects` 是 jsdom 的缺口（实测 `Range.prototype.getClientRects` 为 `undefined`），
floating-ui 在定位时通过它测量文本范围。

**已补桩并验证有效**：在 `apps/console-next/test/setup.ts` 加 `Range.prototype.getClientRects/getBoundingClientRect` 之后，
`getClientRects is not a function` 从 **130 处降到 0**。三条用例仍然失败，但**原因已经换了一个**——不再是 jsdom 缺口。

再查那三条：单独跑其中一条时失败形态变了——不是超时，而是

```
AssertionError: expected undefined to be truthy     ← test/configmaps-page.test.tsx:143
```

打印页面实际发出的请求：

```
http://localhost:3000/kube-frontend/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/configmaps?page=1&limit=10
http://localhost:3000/kube-frontend/kapis/resources.kubesphere.io/v1alpha3/namespaces?page=1&limit=50
```

**两处期望已过期**：

1. 测试里的 `KAPIS` 常量是 `/kapis/resources…/configmaps`，而重构后请求带 `/kube-frontend` 前缀，
   `pathname` 对不上 → `find` 返回 undefined；
2. 用例还断言 `sortBy=createTime&ascending=false`，但页面这次**没有发**排序参数（默认排序可能不再上送）。

所以它不是「挂起」，是**重构后没跟上的断言**。属并行线批次（`5ba075d9c`、`698fb0bc6`）。

## 第 2 条：我上一轮的结论是错的（输出被截断）

上一轮说「页面没发排序参数」——**错**。当时打印用了 `.slice(0, 120)`，而完整 URL 是 121 字符，
`&sortBy=createTime&ascending=false` 正好被切掉。补打完整 URL：

```
…/configmaps?page=1&limit=10&sortBy=createTime&ascending=false
```

排序参数**一直都有**。真正的失败原因只有一个：用例里的 `KAPIS` 常量少了 `/kube-frontend` 前缀，
`pathname` 永远对不上，`find` 返回 undefined。修掉常量后该用例通过。

## 第 3 条：它抓到的是我的 bug

`shows the empty state when nothing matches` 期望「暂无配置字典」，实际显示「没有匹配的结果」。
查下来是**我给 `ResourceList` 加的判断有误**：

```ts
const narrowed = Boolean(searchValue) || Object.values(filters ?? {}).some(v => v !== '' && v !== undefined);
```

很多页面的 `filters` 放的是**作用域**（路由里的项目），不是读者收窄。项目 default 下一个 ConfigMap 都没有时，
它被误判成「收窄了」。已改为只按搜索框判断，并加 `schema.narrowed` 供按筛选收窄的页面声明。

## 附录：当时的代码链

顺着代码看：`controller.ts` 里 `sortBy` 的初始值是 **`'createTime'`**（`useState<ConfigMapSortKey>('createTime')`），
`useConfigMaps` 原样透传，`configmaps.ts` 的 `list` 也确实会写 `sortBy`/`ascending`：

```ts
...(params.sortBy ? { sortBy: params.sortBy } : {}),
...(params.order ? { ascending: params.order === 'asc' } : {}),
```

**但实测请求里这两个参数都没有**。也就是说：要么某处把 `sortBy` 丢了，要么 `order` 为空时排序整体没上送。
如果属实，这是**产品侧的默认排序没有发给服务端**——测试的期望反而是对的。

**已把传输层排除**：给 api-client 补了两条单测（有排序时写 `sortBy`/`ascending`、无排序时不写），
`test/configmaps.test.ts` **10 条全过**——说明 `list` 收到 `sortBy` 一定会写进 query。

所以丢失点在**调用方**（页面/控制器把 `sortBy` 传到 `useConfigMaps` 这一段），不在 api 层。
下一步只需在 `useConfigMaps` 调用处确认参数的实际值。

> 注意：console-next 的 `vitest.config.ts` 里已经写着「ai-kit 自带的 pnpm 装了一份 React 18，消费 `dist` 会触发 Invalid hook call，
> 所以这里 alias 到源码」——说明团队知道这个重复，只是 ai-kit **自己的**测试没有同样的保护。

## 正确的修法（需安装步骤，未在本轮执行）

在 `packages/ai-kit/package.json` 里钉住这个 peer：

```json
"pnpm": { "overrides": { "react": "18.3.1", "react-dom": "18.3.1" } }
```

然后 `pnpm install`。本轮试到安装阶段时，pnpm 提示要**删掉并重装整个 node_modules**——那会打断并行线正在用的环境，
所以没有执行；override 也已回退，避免留下与 lockfile 不一致的声明。

## 未尝试/已排除的其他修法

| 尝试 | 结果 |
| --- | --- |
| `resolve.dedupe: ['react','react-dom']` | 无效（已回退） |
| `resolve.alias` 指向 ai-kit 的 react | 无效（已回退） |
| `test.server.deps.inline` 内联 use-callback-ref / @radix-ui | 无效（已回退） |
| `test.alias`（vitest 测试期别名） | 无效（已回退） |
| `resolve.alias` + `test.deps.inline`（vitest 2 的写法） | 无效（已回退） |

**五次配置层尝试全部无效**。结论：那份嵌套 React 是 **node 自己解析的**，Vite/vitest 的解析配置改不到它。
要修只能动依赖树——`pnpm.overrides` + 重装，或删掉 `use-callback-ref/node_modules/react`。
**别再试第六种配置写法。**

## 已修（2026-11-18 13:25）

`scripts/fix-nested-react.sh`：把那份嵌套的 `react` 移到 `/tmp` 备份，跑测试，失败就自动放回去。

```
moving …/use-callback-ref/node_modules/react aside to /tmp/ai-kit-nested-react-backup-1794979156
running ai-kit tests
OK: ai-kit tests pass
exit=0
```

```
Test Files  21 passed (21)
Tests       226 passed (226)
```

Storybook 6106 仍返回 200。备份目录保留在 `/tmp`，需要还原时 `mv` 回去即可；
下次 `pnpm install` 会重新生成那份副本，所以**长期修法仍是 `pnpm.overrides` + 重装**，脚本只是当下的外科手术。

三者都改不动**已装好的嵌套副本**——它由 node 直接解析，Vite 的配置管不到。

## 为什么现在不改

这是**依赖结构问题**，不是一行代码能修的；而且 ai-kit 的 React 版本选择涉及是否与 app 对齐（app 已用 19），
属于架构决策。先记录现象、已排除项与下一步。

---

## 附一：`verify.py --continue`（2026-11-18）

## 问题

`verify.py` 的设计是**遇到第一个失败就停**（fail-fast，理由是「后续检查建立在前一项通过之上」）。
但排查时这条规则让我多跑了一轮：

```
第一次跑：失败 ai-kit，停
手工跑后面几关：发现 console-next 也失败
```

**两个失败项，花了两轮才知道。**

## 改法

加 `--continue`：跑完所有环节，末尾汇总失败项。默认行为不变。

```bash
python3 prd/tools/verify.py --no-e2e --continue
```

```
通过：文档门禁（260.5s）
通过：一致性核对（0.0s）
通过：缺口清单单测（0.0s）
通过：缺口清单（0.0s）
通过：架构契约（6.9s）
通过：api-client 单测（2.0s）
失败：ai-kit 单测（3.2s）
失败：console-next 单测（12.1s）
失败的环节（2）：ai-kit 单测、console-next 单测
EXIT=1
```

## 实现要点

`CONTINUE_ON_FAILURE` 必须在**解析参数之后、第一次 `run()` 之前**赋值——
我第一版写在了末尾（`if args.no_e2e` 之前），结果只跑完 ai-kit 就退了，看起来像没生效。
**改开关要先确认它被读到的时机。**

## 反思

| # | 规则 |
| --- | --- |
| 1 | **fail-fast 适合「修」，不适合「查」**：两种场景要两种模式 |
| 2 | 默认行为不变，新能力用参数开——不会打断别人已有的习惯 |
| 3 | 开关没生效时，先看它的作用域与赋值时机，而不是怀疑判断逻辑 |

---

> **2026-11-18 13:20 更新**：console-next 一度回到全绿（222 条），随后并行线新增 overview 用例并把该页改到
> 「等待集群加入」的整页状态，**现在有 3 条 overview 用例失败**（`node-overview-panels` 1 条、
> `overview-completion` 2 条）。用 `git stash` 对照过：**与我此前的改动无关**，是他们正在改的页面与测试尚未同步。
> 当前全量：235 条中 232 通过。

## 附二：console-next 从 3 红到全绿（2026-11-18）

`verify.py --continue` 一次列出两项红灯后，逐个查清 console-next 的三条失败，**现在 38 文件 / 222 条全过**。

## 三条失败，三种原因

| 用例 | 真因 | 修法 |
| --- | --- | --- |
| `requests the kapis collection with paging and sort` | `KAPIS` 常量少了 `/kube-frontend` 前缀 | 补前缀 |
| `shows the empty state when nothing matches` | **我的 bug**：`ResourceList` 把作用域筛选当成读者收窄 | 改为只按搜索框判断 + `schema.narrowed` |
| `keeps global statistics while filtering` | 断言 `url.search === ''` 过严：`/stats` 带 `?cluster=host` 是作用域不是筛选 | 改为断言没有 `type`/`uuid`/`page`/`limit` |

第四条 `cluster list controls > pods` 单独跑 12/12 通过、全量跑超时——**并行负载下的 5 秒上限**，
已在 `vitest.config.ts` 把 `testTimeout` 提到 15 秒（与 setup 里 5 秒 `asyncUtilTimeout` 同一理由）。

## 两个我自己犯的错（都写进了记录）

1. 用 `.slice(0, 120)` 打印请求，把 `&sortBy=createTime&ascending=false` 切掉了，据此断言「页面没发排序」——错；
2. 把「作用域筛选」当「读者收窄」，项目内空列表因此显示「没有匹配的结果」——错，被测试抓到。

## 结果

```
Test Files  38 passed (38)
Tests       222 passed (222)
```

`verify.py` 现在只剩 ai-kit 一关红灯（嵌套 React 16，需重装依赖）。
