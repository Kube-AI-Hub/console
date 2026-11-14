# 项目概览资源用量 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/overview-usage.md)

## 概述

`ProjectOverviewPage` 新增「资源用量」卡：监控命名空间最新采样（CPU/内存/容器组/存储）+ 项目配额上限（ResourceQuota）。监控不可用与无采样分别呈现，不显示假 0。

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01

## 设计目标与非目标

目标：四项用量一屏可读，上限可选；三态（有数据/无采样/不可用）明确。
非目标：曲线、时间范围、自动刷新、应用资源计数、用量排行。

## 关键约束

- 项目监控读：`GET /kapis/monitoring.kubesphere.io/v1alpha3/namespaces/<ns>?metrics_filter=<m1>$|<m2>$…&start=<s>&end=<e>&step=60s&cluster=<c>` → 200，每指标一个 matrix（`data.result[].values`）。
- `/v1alpha3/namespace`（单数，query 传 namespace）实测 404；正确路径带 `namespaces/<ns>`。
- 指标名：`namespace_cpu_usage`（核）、`namespace_memory_usage_wo_cache`（字节）、`namespace_pod_count` / `namespace_pod_running_count`（个）有数据；`namespace_pvc_usage` / `namespace_storage_usage` 无序列。
- 配额与已用上限来自 `projectInfoApi`（已存在）：ResourceQuota `spec.hard` 与 `status.used`。
- 页面写作用域只允许改 pages/project，不扩展 `api-client`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01 — 页面内直连监控命名空间接口，不用 rangeMetricsApi

**为什么**：`rangeMetricsApi.cluster` 虽然接受 `scope: 'namespace'`，但拼出的路径是 `/v1alpha3/namespace`，本部署返回 **404**；正确路径是 `/v1alpha3/namespaces/<ns>`。页面直接用已验证路径发一个请求，读最新采样；这比修 api-client（并行改动中且不在本任务写作用域）更小、更可控。
**被否方案**：在 `packages/api-client/src/cluster.ts` 新增 `namespace()`。跨写作用域，且会与并行线的 api-client 改动冲突。
**何时重新考虑**：监控读取出现第二个消费者，或 api-client 的写入窗口空闲时，把路径与解析收进 `rangeMetricsApi`。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-02 — 三态由请求结果决定，缺失值用 `-`

**为什么**：`isError` 是「监控不可用」，请求成功但结果集为空是「没有采样」，两者对读者的含义不同（前者可重试，后者只能等采集）。单个指标缺失（如存储）只影响该项，显示 `-` 而不是 0——0 是一个会被当成事实的数字。
**被否方案**：所有缺失都按 0 渲染（虚构事实）；或整体空态（把部分可用数据也藏起来）。
**何时重新考虑**：产品要求「恒有数字」时，应先由后端补指标，而不是在前端补 0。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-03 — 时间窗口固定为最近 5 分钟、单次读取

**为什么**：卡片只展示「现在」，5 分钟 × 60s 步长足够覆盖一次抓取周期；窗口在挂载时解析一次，避免每次渲染改 query key 导致无限重取。需要趋势的读者去集群监控页（那里有窗口切换）。
**被否方案**：自动刷新（老 console 10s 刷新）。会为一个辅助卡片持续打监控接口，且与「进入页面看一次」的定位不符。
**何时重新考虑**：概览改为运维常驻大屏时。

## 系统现状

老 console `pages/projects/containers/Overview/ResourceUsage`：应用资源与物理资源两组，10s 自动刷新与多时间范围曲线。新 UI 概览此前无用量区块，PRD 曾把「用量排行」列为不做；本轮只补「当前用量」卡。

## 仓库落点

- 页面：`apps/console-next/src/pages/project/ProjectOverviewPage.tsx`（新增用量卡与 `USAGE_ITEMS` / `usageRow`）
- 路由/注册表：项目概览路由已存在，无需改动
- 无 api-client 改动

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 项目用量 | `/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/<ns>`（query: metrics_filter/start/end/step/cluster） | `results[].metric_name`、`results[].data.result[].values[][1]` |
| 配额上限 | `/api/v1/namespaces/<ns>/resourcequotas`（经 `projectInfoApi`） | `spec.hard`、`status.used` |

## 不变量

1. 有数据时：CPU/内存/容器组显示监控最新采样；缺失指标显示 `-`。
2. 监控请求失败 → `:unavailable`（含重试），不显示 0、不显示 `:empty`。
3. 监控 200 且无任何序列 → `:empty`。
4. 上限只来自配额；无配额时不显示 `/ -`。
5. 配额读取失败不影响用量卡（两查询独立）。

## 已知坑

- **路径单复数**：`/namespace` 404，`/namespaces/<ns>` 200。
- **`$|` 过滤器**：每个指标名以 `$` 结尾，多个用 `|` 连接；这是监控 API 的语法，不是正则。
- **matrix 取最新点**：`values` 是 `[时间戳, 字符串值]` 数组，需取最大时间戳并 parseFloat；空数组表示该指标无数据。
- **CPU 小数**：0.03 核是常见值，不能用 toFixed(1)（会变 0.0，读作 0）。
- **存储无指标**：不要捏造存储用量；回落配额 `status.used`，仍无则 `-`。
- **挂载时固定窗口**：把 `Date.now()` 放进 query key 会每次渲染重取；本实现用 `useState` 初始化一次。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/project-settings/TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01.yaml`
可观测点：`project-overview:usage`、`:usage:cpu|memory|storage|pods`、`:usage:empty`、`:usage:unavailable`、`:usage:retry`。用例先用 API 探测该命名空间是否有采样，再断言对应分支。

## 后续改进

- 曲线与时间范围（复用集群监控页的折线组件）。
- 用量排行与自动刷新。
- 把监控命名空间读取收进 api-client（DEC-01）。

## 验收用例

- TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01
