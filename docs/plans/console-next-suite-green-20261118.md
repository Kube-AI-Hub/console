# console-next 单测从 3 红到全绿（2026-11-18）

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
