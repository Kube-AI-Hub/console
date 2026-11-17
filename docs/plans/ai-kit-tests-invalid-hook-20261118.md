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

三者都改不动**已装好的嵌套副本**——它由 node 直接解析，Vite 的配置管不到。

## 为什么现在不改

这是**依赖结构问题**，不是一行代码能修的；而且 ai-kit 的 React 版本选择涉及是否与 app 对齐（app 已用 19），
属于架构决策。先记录现象、已排除项与下一步。
