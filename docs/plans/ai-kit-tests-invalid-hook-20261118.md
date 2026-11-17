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

## 下一步（按顺序）

1. 用 `--reporter=verbose` + 单文件跑 `Dropdown` 那条，拿到**组件内部的完整调用栈**（现在的栈只到 jsdom 的 reportException）；
2. 检查 `@radix-ui/*` 的版本是否与 `react-dom@18.3.1` 匹配（Radix 的某些版本对 React 18/19 行为不同）；
3. 若确认是 Radix 版本问题，考虑升级 Radix 或把 ai-kit 的测试环境对齐 app（react 19 + 对应 Radix）；
4. 修好后跑 `verify.py --no-e2e` 应能越过第一关。

## 为什么现在不改

这是**依赖结构问题**，不是一行代码能修的；而且 ai-kit 的 React 版本选择涉及是否与 app 对齐（app 已用 19），
属于架构决策。先记录现象、已排除项与下一步。
