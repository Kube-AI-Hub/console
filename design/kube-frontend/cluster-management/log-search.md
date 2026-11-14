# 容器日志查询 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/log-search.md)

## 概述

集群日志检索页：时间窗口 + 项目/容器组/容器/关键字过滤 + 服务端分页。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01

## 设计目标与非目标

目标：按项目与关键字检索最近窗口的日志。非目标：导出、直方图、实时跟随（需要额外接口）。

## 关键约束

- `GET /kapis/tenant.kubesphere.io/v1alpha2/logs?start_time&end_time&from&size&namespaces&pods&containers&log_query&sort=time&ascending=false`。
- 时间参数是**秒**（老 console 用 `Date.now()/1000`）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01 — 过滤键用老 console 的复数形式

**为什么**：实测只有复数键生效：`namespaces=` 能把 9 万条收窄到 2 千条，`pods=`/`containers=` 有效，而 `namespace=`/`pod=` 被忽略。老 console 的搜索框正是把 `namespace_query` 归一成 `namespaces`。
**被否方案**：按 REST 习惯用单数键。请求成功但过滤无效——最坏的一种失败。
**何时重新考虑**：后端接受单数别名时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-02 — 时间窗口用预设，不做自由区间

**为什么**：工具箱回答的是「最近一小时发生了什么」。自由区间要引入日期选择器与校验，收益与复杂度不成比例；需要更早的数据时应去日志平台。
**被否方案**：自绘时间选择器。
**何时重新考虑**：出现「按工单时间段取证」的需求时。

## 系统现状

老 console：集群工具箱 → 容器日志查询弹窗，含直方图、实时跟随、导出。本页迁移检索与分页，直方图/跟随/导出登记为明确不做。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterLogsPage.tsx`
- 路由：`routes/kube-frontend.clusters.$cluster/logs/`
- 接口：`packages/api-client/src/search.ts` 的 `logSearchApi`
- 注册：`areas/registry.ts`（监控告警分组）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 检索 | GET /kapis/tenant.kubesphere.io/v1alpha2/logs（start_time/end_time 为秒） |

## 不变量

1. 首页条数 = min(50, total)。
2. 分页用 `from/size`。
3. 过滤键为复数形式。

## 已知坑

- **时间单位**：秒，不是毫秒；传毫秒会得到空结果而不是报错。
- **total 随时间增长**：断言的容错要用「首页条数 = 50 且行数一致」，不要硬编码总数。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01.yaml`
可观测点：`cluster-logs:surface`、`:list`、`:total`、`:page`、`:window`。

## 后续改进

- 导出、直方图、实时跟随。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01