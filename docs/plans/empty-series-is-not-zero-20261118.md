# 一个空序列不等于读数 0（2026-11-18）

## 发现

`DashboardPanelsPage` 的单值面板这样取值：

```ts
const value = first?.points[first.points.length - 1]?.value ?? 0;
```

上面只有 `series.length === 0` 的守卫。但监控查询**可以返回一个存在却没有点的序列**（刚开区间的查询就会这样），
此时 `points[-1]` 是 undefined，`?? 0` 把「没有读数」渲染成了 **0**——一个集群从未上报过的测量值。

## 修法

```ts
const point = first?.points[first.points.length - 1];
{point ? formatSingle(point.value, panel) : '-'}
```

「没有序列」仍走原来的空态文案；「有序列但没有点」显示 `-`。两者都不是 0。

## 验证

- `tsc` 0；
- 这 3 条 overview 用例的失败**与本次改动无关**：把它们在**改动前**跑一遍同样失败（`overview completion` 2 条、
  `hardware and overview panels` 1 条，都是并行线正在改的页面，测试还没跟上）。用 `git stash` 对照确认过。

## 反思

| # | 规则 |
| --- | --- |
| 1 | `?? 0` 出现在**展示**路径上就是嫌疑：先问「缺的时候显示 0 会不会是撒谎」 |
| 2 | 守卫要看**两层**：集合为空、以及集合非空但元素为空 |
| 3 | 改完跑测试出现新失败时，**先 stash 对照**，别急着改自己的代码 |
