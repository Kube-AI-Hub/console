# 告警列表：成员集群上读到的是主集群的数据（2026-11-17）

## 1. 发现

`alertMessagesApi` 与 `clusterAlertMessagesApi` 的集合路径都写死成
`/kapis/alerting.kubesphere.io/v2beta1/<collection>`——**没有集群段**。
于是在 `xc` 的「告警消息」页上，读者看到的是 **host 的告警**。

这类缺陷比 404 更危险：页面 `ready`、有数据、看起来一切正常，只是**数据不属于当前集群**。
巡检的 `state/rows/errors` 三项都发现不了它。

## 2. 实测

| 路径 | 结果 |
| --- | --- |
| `/kapis/alerting.kubesphere.io/v2beta1/globalalerts`（host） | 200，71 条 |
| `/kapis/clusters/xc/alerting.kubesphere.io/v2beta1/globalalerts` | **503**（连续三次） |
| `/kapis/clusters/xc/alerting.kubesphere.io/v2beta1/clusteralerts` | **503** |
| `/kapis/clusters/xc/alerting.kubesphere.io/v2beta1/rulegroups` | **200**（61 条） |

即：成员集群的**规则**可用，**告警**的聚合接口不可用（`xc` 上没有跑告警组件）。

## 3. 修复：把集群段补上，让成员集群自己回答

`alertCollectionPath` / `fetchSource` 改用 `clusterScoped`，`cluster` 一路透传到调用方
（`monitoring/queries.ts` 两处、`ClusterAlertingMessagesPage`）。

修完的行为：

- `host`：不变（200，71 条）；
- `xc`：请求打到成员集群 → **503 → 页面显示「加载失败」**。

**这是正确的**：`xc` 确实没有这个能力，如实报错远好过悄悄展示 host 的数据。
（与之前 core 写操作的处理一致：不能实现的操作用「拒绝 + 说明」，不要打到默认集群。）

验证：api-client **37 文件 / 384 passed**；`tsc` 在 alerting/monitoring 相关文件上 **0 错误**；`vite build` ✓。

## 4. 未完成的 UI 复验

本轮两套本地栈的列表页仍在渲染阶段抛错（并行线改共享组件中），**无法在 UI 上确认**
「`xc` 告警页显示加载失败而不是 host 数据」。下一轮基线复跑时一并确认。

## 5. 反思

| # | 规则 |
| --- | --- |
| 1 | **巡检要能发现「读到了另一个集群的数据」**，而不只是 404/error | 本轮三项指标全绿，缺陷靠读代码 + 直接比对接口才发现 |
| 2 | **成员集群缺能力时，报错优于回退到主集群** | 503 是事实，host 的 71 条是假象 |
| 3 | 同类问题要一次查完：`accessReview`、`alertMessages`、`clusterAlerts` 三处都是「参数里有 cluster 但路径没用」 |
