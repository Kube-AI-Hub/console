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

## 同批审计的范围与结论

顺着同一类缺陷把 `apps/console-next/src` 与 `packages/api-client/src` 扫了一遍：

| 检查 | 结果 |
| --- | --- |
| `?? 0` 出现在展示路径（14 处） | 12 处是 `pagination.total`（分页器需要一个数，缺省 0 是合理的）；1 处 `NodesPage` 的 `healthRatioLabelSize` 只用于选字号，实际文本有 `stats.data ? … : '-'` 守卫；**1 处即本次修的 `DashboardPanelsPage`** |
| `catch { return [] / {} / null }` | 逐条看过：`annotationObject` 解析失败返回 `{}`、`appstore`/`devops` 的列表降级为空数组，调用方都把「空」当「没有」而不是「零」或「成功」——未发现把错误当成功的路径 |

| `api-client` 映射层的 `Number(x ?? 0)`（`gpu.ts` 六处显存/核心数、`alerting.ts`/`node-list.ts` 的 `total`） | 看过：类型上这些字段是 number，0 是中性值；**渲染处有守卫**——`GpuDetailPage`/`GpusPage` 都写 `memoryTotalMiB > 0 ? … : …`，缺值不会显示成「0 MiB」；`total` 只喂分页器 |

**这不是穷尽证明**，只是一次定向审计：结论是「这一类里当前只找到一处」，不是「不存在」。

复跑方式：

```bash
grep -rn "?? 0" --include=*.tsx --include=*.ts apps/console-next/src
grep -rn -A2 "catch {" --include=*.ts apps/console-next/src packages/api-client/src | grep -E "return \[\]|return \{\}|return null"
```

## 反思

| # | 规则 |
| --- | --- |
| 1 | `?? 0` 出现在**展示**路径上就是嫌疑：先问「缺的时候显示 0 会不会是撒谎」 |
| 2 | 守卫要看**两层**：集合为空、以及集合非空但元素为空 |
| 3 | 改完跑测试出现新失败时，**先 stash 对照**，别急着改自己的代码 |
