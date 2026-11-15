# 资源事件查询 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-events.md)

## 概述

集群级事件浏览：类型过滤 + 窗口内关键字过滤，倒序展示，只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-02

## 设计目标与非目标

目标：不知道对象时也能定位问题。非目标：历史全文检索（需要 ES 后端）。

## 关键约束

- `GET /api/v1/events?limit=200&fieldSelector=type=Warning`（无 namespace 段）。
- 关键字过滤是客户端窗口过滤，页面必须说明窗口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01 — 明说「最近 200 条」

**为什么**：事件是不可枚举的历史（apiserver 会过期），任何诚实实现都只能给一个窗口。不说清楚，读者会把「没搜到」理解成「没发生过」——这是运维里最贵的误读。
**被否方案**：假装分页全量（翻到第 5 页仍是同一个窗口，翻页按钮等于装饰）。
**何时重新考虑**：接入 ES 的事件检索后端时（届时窗口变成可配置的时间范围）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-02 — 类型走服务端过滤，关键字走客户端

**为什么**：`fieldSelector` 支持 `type`，服务端过滤能少拉一半数据；消息全文没有服务端过滤能力，只能在窗口内匹配。两者混用时页面把各自的边界写在说明里。
**被否方案**：全客户端过滤。窗口会被无关类型挤满，Warning 可能一条都看不到。
**何时重新考虑**：需要按 time range 查询时（`fieldSelector` 不支持，需监控/ES）。

## 系统现状

老 console 在集群工具箱里以弹窗提供事件检索。本页把它变为可直达的页面，并保留窗口语义。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterEventsPage.tsx`
- 路由：`routes/kube-frontend.clusters.$cluster/events/`
- 接口：`packages/api-client/src/workloads.ts` 的 `clusterEventsApi`
- 区域注册：`areas/registry.ts`（监控告警分组）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 事件 | /api/v1/events?limit=200（可加 fieldSelector=type=…） |

## 不变量

1. 倒序：最新在最前。
2. 行数等于接口返回条数。
3. 窗口满时显示说明。

## 已知坑

- **不要用 `ResourceList` 承载这个列表**：那个组件以「行有唯一 key + 总数可分页」为前提，而事件既没有唯一名也没有总数（apiserver 只给窗口）。第一版套上去之后，切换类型过滤出现了行数反而变多、内容仍是旧数据的问题；改成普通 `<ul>` + 显式窗口说明后语义才自洽。
- **类型过滤走服务端**：`fieldSelector=type=Warning` 少拉一半数据；关键字只能在已加载窗口内匹配。
- **时间字段三选一**：`lastTimestamp` → `eventTime` → `firstTimestamp`，只读一个会得到空时间。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01.yaml`
可观测点：`cluster-events:surface`、`:search`、`:filter:type`、`:window`。

## 后续改进

- 时间范围过滤（需要后端支持）。
- 与对象详情联动（从事件跳到对象）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01

## 事件检索的数据源（2026-11-15 修订）

原实现读核心组 `/api/v1/events` 并只取最近 200 条，页面自己声明「不是全部历史」。这个限制**不是产品选择，而是选错了接口**：

| 能力 | `/api/v1/events` | `/kapis/tenant.kubesphere.io/v1alpha2/events` |
| --- | --- | --- |
| 总数 | 无 | `query.total` / `histogram.total` |
| 服务端过滤 | 无 | `message_search` 等 6 个参数 |
| 时间分布 | 无 | `operation=histogram` 返回桶 |
| 分页 | 只能 `limit` 截断 | `from` / `size` |

因此改为租户接口。要点：

1. **柱状图与列表共用 `filters`**：两次请求带同一组过滤键，否则柱高描述的是另一批记录。
2. **窗口只算一次**：`start/end` 放在 `useState` 里而不是查询键里，避免每次重渲染都刷新区间并无限重取。
3. **翻页保留上一页数据**（`keepPreviousData`），否则每次翻页整表闪成骨架。
4. **柱状图失败只降级该卡片**：统计接口挂掉时列表仍可用——查事件的人多半正在处理故障，不能让一个装饰性图表挡住事实。


## 时间段选择与实时刷新

老 console 的事件检索有两个此前的实现没有的交互：点直方图的柱可以「钻进」该时间段，以及一个「开始实时事件」的控制。

**时间段选择**：点柱 → `selected = { start: bucketTime, end: bucketTime + 30m }`，列表请求带上 `start_time`/`end_time`（实测该参数生效：全量 228379 条 → 选中桶后 30 条）。再次点同一柱或「清除」取消。

**与老 console 的差异（有意）**：老 console 会把直方图本身也钻进选中区间；30 分钟的区间再按更细步长画出来只有一两个柱，读起来像渲染错误而不是缩放。这里直方图固定 12 小时、只高亮选中的柱，列表按区间收窄——信息量一样，视觉上不会自相矛盾。

**实时刷新**：开关打开后每 5 秒同时推进直方图窗口与列表（回到第 1 页），两个查询共用一个 `revision` 计数进 key，避免「柱状图冻结、列表前进」的错位。定时器在关闭与卸载时清理；该组件里 `window` 是局部变量（时间窗对象），因此用 `globalThis.setInterval`。
