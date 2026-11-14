# 节点用量 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/node-usage.md)

## 概述

节点九类指标排行：服务端排序/搜索/分页，按 node 身份合并；与概览 Top5 共享 NodeRankingPanel。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01

## 设计目标与非目标

目标：最忙的节点在首行；百分比可信；三个维度同屏。

非目标：趋势、下钻、节点运维操作。

## 关键约束

- `GET /kapis/monitoring.kubesphere.io/v1alpha3/nodes?metrics_filter=a$|b$&cluster=<id>&limit=-1`
- 指标值是 **0–1 的比例**，不是百分比。
- 一次请求取全部节点（`limit=-1`），前端排序与搜索。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-NODE_USAGE-01 — 换算在 mapper 里做一次

**为什么**：接口给 `0.061`。如果每个页面各自乘 100，漏一处就显示 `0.06%`——而 0.06% 看起来依然是一个合理的小数字，不会被发现。`nodeUsageApi` 在返回前乘 100，页面拿到的永远是百分比。

**被否方案**：页面里乘。见上，且无法保证新页面照做。

**何时重新考虑**：监控接口改为返回百分比时（届时删掉乘法并更新本决策）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-NODE_USAGE-02 — 默认按 CPU 降序

**为什么**：页面的问题是「哪台最忙」。按名称排列把回答这个问题变成读者的工作，而老 console 的排行页正是因此存在。

**被否方案**：按名称升序（与节点列表一致）。那是「找某台节点」，不是「找热点」。

**何时重新考虑**：节点数量增长到需要分组（可用区/角色）时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-NODE_USAGE-03 — 一次取全量，前端排序

**为什么**：节点是集群级资源，数量有限（本例 2 台），监控接口本身支持一次返回全部。为排序再发请求会引入第二个加载态与第二处失败面。

**被否方案**：服务端 `sortBy`。监控接口的 `sortBy` 作用于指标序列而不是我们合并后的行，用它会让排序结果与页面显示的列不一致。

**何时重新考虑**：节点数达到数百时。

## 系统现状

老 console 的节点用量排行在「集群监控」下，列为节点与各资源使用率，支持切换排序维度。本次迁移保留该语义；「最近检测时间」一类元数据略去——节点指标没有该字段。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/NodeUsagePage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/node-usage/`
- 区域注册：`areas/registry.ts`（cluster-management 增加 nodeUsage）
- 接口：`packages/api-client/src/cluster.ts` 的 `nodeUsageApi`
- 文案：`packages/locales/src/index.ts`（`cluster.nodeUsage.*`）

## 对外契约

`GET /kapis/monitoring.kubesphere.io/v1alpha3/nodes`，参数 `metrics_filter`（四个指标以 `$` 结尾并用 `|` 连接）、`cluster`、`limit=-1`。

## 不变量

1. 页面拿到的使用率是百分比（0–100），不是比例。
2. 默认排序是 CPU 降序。
3. 行数等于监控返回的节点数。
4. 指标缺失显示「未知」，不显示 0。

## 已知坑

- **比例 vs 百分比**：`0.06` 显示成 `0.06%` 不会被任何人发现——它看起来是正常的小数字。
- **`limit` 默认分页**：不带 `limit=-1` 时监控接口可能只回第一页，排行会漏节点。
- **多指标共用一次请求**：`metrics_filter` 用 `|` 连接、每个名字以 `$` 结尾；写成逗号会静默返回空结果。
- **容器组指标是计数不是比例**：`node_pod_running_count` 乘 100 会得到荒谬值。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01.yaml`
可观测点：`node-usage:surface`、`node-usage:{cpu,memory,disk,pods}:<node>`、`node-usage:search`。

## 后续改进

- 与「节点」页合并（同一资源的两种视角）。
- 点击节点跳到节点详情。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-04 — 复盘后恢复九种维度及下钻

**为什么**：原四项实现不足以承接旧概览 Top5；旧接口有 type=rank、sort_metric/sort_type，并非旧决策中推测的 sortBy。
本批保留直接进入 CPU 降序，概览链接携带 metric；共享 nodeRankingApi/NodeRankingPanel 完成九种指标和节点详情入口。

**被否方案**：保留原全量前端排序作为 Top5 等价替代；原决策的理由保留，但由本条覆盖。

**何时重新考虑**：接口提供新的聚合排序契约时。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01 — 当前排行契约覆盖旧四指标契约

type=rank，sort_metric 为九项白名单，sort_type 为 asc/desc，page/limit 控制分页，total_item 为总数。
resources_filter 对搜索转义；按 node 合并并遵循目标指标序列顺序；load1 原值、其他比率乘100、
GPUallocated 按数量排序而以 allocated/total 展示。元数据独立请求当前集群，名称链接详情。
关键实现：node-ranking.ts、NodeRankingPanel.tsx；旧 nodeUsageApi 保留兼容既有调用但不再用于该页面。
原文四项、全量前端排序及不下钻描述为历史决策，当前以本契约和 overview CON-06 为准。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01
