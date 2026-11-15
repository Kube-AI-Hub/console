# 仪表板面板渲染 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/dashboard-panels.md)

## 概述

`pages/cluster/DashboardPanelsPage.tsx` + `packages/api-client/src/promql.ts`。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01

## 设计目标与非目标

目标：把仪表板声明的面板渲染成数值与曲线。非目标：面板编辑、模板变量。

## 关键约束

- **求值通道**：监控 API 的 `metrics_filter` 只认指标名（recording rules），任意 PromQL 没有 kapis 路由（实测 `/kapis/monitoring.kubesphere.io/v1alpha3/query` 404）。apiserver 的 service proxy 可用：`/api/v1/namespaces/kubesphere-monitoring-system/services/http:prometheus-k8s:9090/proxy/api/v1/query?query=sum(up)` → 200。
- **host 集群限定**：该 proxy 指向 host 的 Prometheus；成员集群需要各自的 Thanos，代码注释与 PRD 都写明。
- `Date.now()` 不能进 query key：窗口在 `useState` 里解析一次。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01 — 每个面板独立查询、独立报错

**为什么**：一个仪表板里常有十几条表达式，其中一条写错（指标被删、标签变了）很常见。整页共用一个查询会把「一个面板坏了」变成「仪表板打不开」，而这正是读者最需要看到其它面板的时候。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-02 — 多序列求和绘制

**为什么**：迁移后的图表组件画一条线。求和是单面板最常见的语义，并且页面把「N 条序列」写出来，读者不会误以为是单条序列。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-03 — 只读

**为什么**：老 console 的面板编辑器是完整的 Grafana 编辑器（拖拽、缩放、变量），迁移它属于另一个量级的工作。只读渲染让仪表板立刻有用，编辑仍可走 YAML。

## 系统现状

老 console 的 `stores/monitoring/custom/` 定义三种面板（`singlestat`/`row`/`graph`）与模板；新 UI 此前只有列表与 YAML。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/DashboardPanelsPage.tsx`
- 路由：`routes/…/custom-monitoring/$name.tsx`
- 契约：`packages/api-client/src/promql.ts`（`instant` / `range`）

## 对外契约

| 用途 | 路径 / 句柄 |
| --- | --- |
| 即时查询 | GET `…/proxy/api/v1/query?query=` |
| 范围查询 | GET `…/proxy/api/v1/query_range?query=&start=&end=&step=` |
| 面板 | `dashboard-panels:panel:<index>`、`:value`、`:chart`、`:empty`、`:error` |

## 不变量

1. 面板错误不影响其它面板。
2. `row` 不发查询。

## 已知坑

- 该部署的 `DCGM_FI_*` 指标不存在（实测 0 序列），所以示例仪表板的面板都显示「没有数据」——这是正确渲染，不是缺陷；用例因此自建一个 `sum(up)` 仪表板来验证。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01.yaml`

## 后续改进

- 模板变量替换；成员集群 Thanos；面板编辑。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01
