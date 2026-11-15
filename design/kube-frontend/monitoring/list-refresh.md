# 监控告警页族的列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/monitoring/list-refresh.md)

## 概述

`useListRefresh` 提供 schema 的 `refresh` 与 `onRefresh`，五个页面各自接入；集群告警策略页把两个查询聚合成一个刷新源。

## 关联需求

- AC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-01

## 设计目标与非目标

目标：五个页面都能主动重读，空态有出口。非目标：轮询、watch、跨页面统一刷新。

## 关键约束

- `useListRefresh` 接受 `ListRefreshSource`（`isFetching` + `refetch`），比 `UseQueryResult` 窄：多查询页面自己提供聚合源，不必为类型造一个假对象。
- `busy` 进入 schema，**因此 schema 的 useMemo 依赖必须包含 `isFetching`**；否则按钮会永久停留在忙碌状态（企业空间控制台那批就是这样被抓到的）。
- `ResourceList` 只在 `schema.refresh` 与 `onRefresh` 同时存在时渲染按钮。

## 方案决策

### DEC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-01 — 集群告警策略两个页签共用一个刷新源

**为什么**：两个页签共享一个 schema（列定义完全相同），分别做两个按钮会让「刷新」在同一张表的两个位置出现；聚合后点一次同时重读自定义与内置策略，`busy` 取两者并集。

### DEC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-02 — 自定义监控的空态块自带刷新

**为什么**：该页在无仪表板时不渲染列表（用自己的空态块替代表头），如果刷新只挂在列表上，空态就成了死路。空态块的按钮用独立的句柄 `project-custom-monitoring:empty:refresh`，便于自动化定位。

## 系统现状

老 console 的监控告警列表都带刷新；新 UI 此前没有（审计：54 个列表 0 个刷新按钮）。

## 仓库落点

- 页面：`monitoring/{MonitoringListPage,RuleGroupsPage,ProjectCustomMonitoringPage}.tsx`、`cluster/{ClusterAlertingMessagesPage,ClusterAlertingPoliciesPage}.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `alerts:refresh`、`alertingrules:refresh`、`project-custom-monitoring:empty:refresh`、`cluster-alerting-messages:refresh`、`cluster-alerting-policies:refresh` |
| 空态出口 | `empty-state:refresh`、`empty-state:clear` |

## 不变量

1. 刷新只重发当前查询（保留页码、搜索与筛选）。
2. 忙碌状态与实际请求一致。

## 已知坑

- 忘记把 `isFetching` 放进 schema 的依赖数组 → 按钮永久禁用。
- `dist` 需要重新构建才会反映到本地 5178。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/monitoring/TC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-01.yaml`

## 后续改进

- 与 R-27（实时刷新）一起评估轮询。

## 验收用例

- TC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-01
