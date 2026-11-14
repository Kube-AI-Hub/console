# 资源事件查询 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-events.md)

## 概述

集群级事件浏览：类型过滤 + 窗口内关键字过滤，倒序展示，只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01

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