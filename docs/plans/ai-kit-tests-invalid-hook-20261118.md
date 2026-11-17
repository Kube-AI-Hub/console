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

## 下一步（按顺序）

1. 看 `@testing-library/react@16` 与 `react-dom` 的配对：TLR 16 需要 React 18+，但若 `react-dom` 与 `react` 来自不同实例，render 出来的树用的就是另一个 hooks dispatcher；
2. 在 `test/setup.ts` 里打印 `require.resolve('react')` 与 `require.resolve('react-dom')` 的实际路径，确认是否同一处；
3. 若确认两份，考虑把 ai-kit 纳入 `kube-frontend` 的 workspace（共享 catalog 的 react 19），或在 ai-kit 里显式 alias 到单一实例；
4. 修好后跑 `verify.py --no-e2e` 应能越过第一关。

## 为什么现在不改

这是**依赖结构问题**，不是一行代码能修的；而且 ai-kit 的 React 版本选择涉及是否与 app 对齐（app 已用 19），
属于架构决策。先记录现象、已排除项与下一步。
