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
## 6. 复验（HEAD `c41fa2993`，独立 worktree 构建）

用 `git worktree` 从 HEAD 构建、单独起 5180 端口跑五段式基线（详见巡检工具文档第 21 节）：

```
OK   cluster  read: 72 visits, 72 ready, 0 empty, 0 error, 0 failed requests
OK   project  read: 34 visits, 34 ready, 0 empty, 0 error, 0 failed requests
FAIL identity read: 9 collections, 7 distinct, 1 identical, 1 suspect
       cluster alerts @ xc: host=200 member=503
OK   detail   read: 12 visits, 12 ok, 0 broken
OK   write    host / xc: 均 OK
```

**`xc` 的告警消息页仍然是 `ready`**——而身份检查同时指出成员的告警集合 503。
两者放在一起只有一种解释：**那个页面读的仍是 host 的数据**，说明上一轮的修复没有覆盖到它。

### 追加实测：项目级告警也一样

| 路径 | 结果 |
| --- | --- |
| `/kapis/alerting.kubesphere.io/v2beta1/namespaces/spaces/alerts`（host） | **200**（34 字节） |
| `/kapis/clusters/xc/alerting.kubesphere.io/v2beta1/namespaces/spaces/alerts` | **503** |

也就是说 `alerting-messages` 页走的项目级集合在成员集群上同样不可用；而页面仍显示 `ready`，
说明它拿到的数据来自 host。

### 更正：修复其实生效了，是巡检工具读错了页面

下一轮用**定点探针**（不复用巡检工具）复测同一页面，结论相反：

```
REQ /kapis/clusters/xc/alerting.kubesphere.io/v2beta1/clusteralerts?limit=20&page=1&sortBy=activeAt…
REQ /kapis/clusters/xc/alerting.kubesphere.io/v2beta1/globalalerts?limit=20&page=1&sortBy=activeAt…
state: error   rows= 0
```

页面**确实**请求成员集群的路径，并且因为成员返回 503 而进入 `error` —— **修复是生效的**。

同一页面在同一构建上的三种测法给出三种结果：

| 测法 | 结果 |
| --- | --- |
| 定点探针（直接 `goto` 后等 8–12 秒） | **error**，body 1263 字符 |
| 巡检工具 `--pages alerting-messages` | `ready`，rows 0 |
| 巡检工具同一 URL 打 `nodes` | `ready`，rows 0（而定点探针是 7 行） |

即：**巡检工具在该环境下读到的是一张空白页**，把「空白」当成了 `ready`。这是工具缺陷，不是产品缺陷。
上一轮据此写下的「修复没做到位」结论**已作废**。

### 工具缺陷（未修，已记录）

同一 URL、同一浏览器参数，`sweep()` 拿到的 `document.body.innerText` 只有 19 字符，而定点探针是 1263。
推测与「写入 token 与 SPA 启动的竞态」有关：输了竞态就停在登录页/空白页，而巡检仍按 `ready` 记账。

尝试过的修法（均未验证成功，已回滚，避免把未验证的改动留在仓库里）：

1. 状态稳定 6 秒再取值；
2. 要求「`ready` 且行数 > 0」或 `empty`/`error` 才算终态；
3. body 少于 100 字符时 reload 一次，仍空则记 `blank`。

**当前处置**：工具回滚到 HEAD 版本；多集群结论**以定点探针为准**，`--baseline` 的 `rows` 列暂不可信，
`state/errors` 列在空白页场景下也不可信。下一轮先修这个竞态（例如登录后等 `/api/session/me` 返回 200 再导航）。
