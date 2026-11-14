# 容器组事件 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/pod-events.md)

## 概述

按 Pod 读取核心 API 的 events 并倒序展示，只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01

## 设计目标与非目标

目标：一屏看到「这个 Pod 最近发生了什么」。非目标：全量事件检索、归档。

## 关键约束

- 数据源：`GET /api/v1/namespaces/<ns>/events?fieldSelector=involvedObject.name=<pod>,involvedObject.kind=Pod`。
- 只在容器组详情渲染。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01 — 用 fieldSelector 而不是全量拉取再过滤

**为什么**：事件是集群里最容易被淹没的对象；按 involvedObject 过滤让响应与「这一页要显示的东西」同规模。全量拉取再客户端过滤在繁忙命名空间上会拿到成百上千条无关事件。
**被否方案**：拉命名空间全部事件。数据量与页面无关。
**何时重新考虑**：需要跨对象事件视图时（那属于工具箱的事件检索）。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-02 — 倒序 + 保留重复次数

**为什么**：最近发生的事最要紧；而 `x2343` 的 BackOff 与发生一次的失败是两种问题，折叠掉次数会让人以为只失败过一次。
**被否方案**：正序（Kubernetes 默认顺序）或按次数排序。前者要翻到底，后者会埋掉刚发生的新错误。
**何时重新考虑**：事件量级大到需要分页时。

## 系统现状

老 console 把它放在容器组详情的「资源状态」页签内。本页作为详情页的一个区块迁移；不做页签，与其它详情页保持一致。

## 仓库落点

- 页面：`apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx`（`kind === 'pods'` 的事件区块）
- 接口：`packages/api-client/src/workloads.ts` 的 `podEventsApi`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 事件 | /api/v1/namespaces/&lt;ns&gt;/events?fieldSelector=involvedObject.name=&lt;pod&gt;,involvedObject.kind=Pod |

## 不变量

1. 条数等于过滤后的接口条数。
2. 倒序：最新在最前。
3. 事件读取失败不影响详情其它区块。

## 已知坑

- **事件没有统一的时间字段**：新对象用 `eventTime`，旧对象用 `lastTimestamp`/`firstTimestamp`，只读一个会得到空时间。
- **`count` 可能缺失**：按 1 处理，不要显示 `xnull`。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01.yaml`
可观测点：`pods-detail:events`、`pods-detail:event-list`。

## 后续改进

- 事件检索页（工具箱）。
- 与容器详情联动（只显示该容器相关事件需要额外过滤条件）。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01