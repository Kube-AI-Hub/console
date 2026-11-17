# 成员集群的「事件」Tab：core 组没有成员形态（2026-11-17）

## 1. 怎么发现的

新增的 `--tabs` 巡检（点开详情页每个 Tab，记录 body 长度与失败请求）在 `xc` 上报了两条失败：

```
FAIL xc nodes/hw-4090d-50  容器组  body=428 errors=1
FAIL xc nodes/hw-4090d-50  事件    body=428 errors=1
```

## 2. 根因一：容器组的路径（已修）

`packages/api-client/src/node-resources.ts` 自己拼了 `/api/v1/clusters/<c>/…` —— core 组的成员形态不存在
（第 69 轮实测 404）。改用 `corePath` 后走 kapis 代理：

```
FAIL → OK   xc nodes/hw-4090d-50 容器组 body=470 errors=0
```

## 3. 根因二：`events` 根本没有 kapis 代理（已修）

容器组修好后，事件 Tab 仍 404：

```
404 /kapis/clusters/xc/resources.kubesphere.io/v1alpha3/events?fieldSelector=…
```

继续实测，发现 **kapis 代理根本不提供 `events`**——连 host 上都是 404：

| 路径 | 结果 |
| --- | --- |
| `/kapis/resources.kubesphere.io/v1alpha3/events` | **404** |
| `/api/v1/events`（host） | 200 |
| `/api/v1/clusters/xc/events` | 404 |
| **`/apis/clusters/xc/events.k8s.io/v1/events`** | **200** |
| **`/apis/events.k8s.io/v1/events`**（host） | **200** |

即：事件要用 **`events.k8s.io/v1`** 组，它在两个集群上都有成员形态。

### 换组必须换字段选择器

`events.k8s.io/v1` 的选择器是 `regarding.*`，不是 core 组的 `involvedObject.*`。
**发旧名字不会报错，只会匹配不到任何事件**——比报错更难发现，所以测试里也断言了选择器名字。

## 4. 改动

| 文件 | 改动 |
| --- | --- |
| `api-client/src/node-resources.ts` | pods 用 `corePath`；events 改 `clusterScoped('/apis/events.k8s.io/v1', …)` + `regarding.*` |
| `api-client/src/workloads.ts` | `objectEventsApi.list` 增加 `cluster`，同样改 `events.k8s.io` + `regarding.*` |
| 调用方 | `WorkloadDetailPage`、`storage/queries`、`InstalledAppDetailPage` 传入当前集群 |
| 测试 | `node-resources.test.ts` 两条断言改为新路径与新选择器（旧断言固化的是错误路径） |

## 5. 验证

```
OK   xc deployments/… 事件    body=309 errors=0
OK   xc nodes/… 事件          body=469 errors=0   ← 修复前 errors=1
OK   xc nodes/… 容器组        body=470 errors=0   ← 修复前 errors=1
api-client 37 文件 / 392 passed；tsc 相关文件 0 错误；vite build ✓
```

## 6. 未解决

`xc deployments/… 关联容器组` 的 body 只有 292（阈值 300），且没有表格行、也没有空态文案。
该请求没有失败，可能是「该部署在 xc 上确实没有匹配的容器组」+「空态没渲染」。**本轮未定性**，下一轮补。

## 7. 反思

| # | 规则 |
| --- | --- |
| 1 | **Tab 是独立的读取**：列表/详情页全绿不代表 Tab 全绿，必须逐个点开 |
| 2 | **换 API 组必须换选择器名字**：`involvedObject.*` → `regarding.*`，否则静默返回空 |
| 3 | **代理不支持某资源时，去找支持它的组**，不要停在「不可用」 |
