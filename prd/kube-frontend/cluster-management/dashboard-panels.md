# 仪表板面板渲染（L3）

[子模块需求](./_index.md)

## 概述

集群自定义监控的仪表板对象里存着 `spec.panels[]`：`row` 是分区标题，`singlestat` 是一个数值，`graph` 是一组时间序列，每个面板的 `targets[].expr` 是 PromQL 表达式。老 console 点开仪表板就能看到这些面板。新 UI 此前只能列出仪表板、看 YAML，**看不到任何数据**——一个仪表板页只能证明对象存在。

## 用户故事

### US1 - 打开仪表板就看到面板数据 (Priority: P1)

作为 **集群运维**，我希望 **点开自定义监控仪表板就能看到它声明的每个面板的当前值或趋势**，以便 **不必把 PromQL 抄到别处执行才能知道集群状态**。

**Independent Test**：用一个只含 `sum(up)` 面板的仪表板打开面板页，`singlestat` 显示数值、`graph` 画出曲线；把表达式改成不存在的指标，则该面板显示「查询失败/没有数据」而不是空白。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01** — 已知某集群仪表板的 `spec.panels` 含 `row`、`singlestat`、`graph` 三种面板，当从自定义监控列表点进该仪表板，则按顺序渲染：`row` 渲染为分区标题（不查询数据），`singlestat` 执行一次即时查询并以 `decimals` 决定小数位（`format` 含 bytes 时按 B/KiB/MiB/GiB 显示），`graph` 对每个 `targets[].expr` 执行范围查询并绘制曲线；切换时间窗（1h/6h/24h/7d）以新的起止与步长重取；某面板表达式无数据时显示「当前时间窗内没有数据」，查询失败时显示该面板自己的错误说明（**不影响其它面板**）；没有面板的仪表板显示「该仪表板还没有面板」；页面注明面板为只读渲染。

## 设计目标

1. 一个面板坏掉不能拖垮整页——错误按面板隔离。
2. 只读：不提供面板编辑，明确写在页面上。

## 约束与边界

- 表达式由 **host 集群的 Prometheus** 求值（经 apiserver service proxy）。成员集群的仪表板需要该集群的 Thanos，本单元不做。
- 监控 API 的 `metrics_filter` 只接受**指标名**，不接受表达式；任意 PromQL 只能走 service proxy（`/api/v1/namespaces/kubesphere-monitoring-system/services/http:prometheus-k8s:9090/proxy`，实测 200）。
- 一个 `graph` 面板的多条序列按时间点求和后绘制一条线，并注明序列数。

## UI 交互设计

- 顶部：返回链接、仪表板标题、只读说明、时间窗切换。
- 面板按 `spec.panels` 顺序排列；`row` 是标题，其余是卡片（标题 + 类型 + 内容）。

## 文案与校验

| key | 中文 |
| --- | --- |
| `customMonitoring.panelsReadOnly` | 面板为只读渲染；编辑面板不在本次迁移范围。 |
| `customMonitoring.panelsEmpty` | 该仪表板还没有面板，可通过 YAML 编辑添加。 |
| `customMonitoring.panelNoExpression` | 该面板没有 PromQL 表达式。 |
| `customMonitoring.panelQueryFailed` | 查询失败：表达式可能无效或指标不存在。 |
| `customMonitoring.panelNoData` | 当前时间窗内没有数据。 |
| `customMonitoring.panelSeriesNote` | {count} 条序列按时间点求和后绘制。 |

- 无输入表单，不做输入校验。

## 边界情况

- 面板类型未知（既不是 row/singlestat）：按 `graph` 处理，因为它有 `targets`。
- `NaN` 采样点丢弃（比画成 0 更诚实）。
- 仪表板不存在：显示错误面板与重试。

## 假设

- 仪表板对象里 `panels` 是数组，`targets[].expr` 是字符串。

## 明确不做

- 面板编辑/拖拽布局（老 console 的 Grafana 编辑器）。
- 模板变量（`spec.templatings`）替换：本单元不解析变量，含 `$var` 的表达式会原样求值并多半返回空。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01** — 按面板类型渲染 row/singlestat/graph，错误与空态按面板隔离。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01** — 面板数值/曲线与 Prometheus 直接查询一致；坏表达式只影响该面板。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01
