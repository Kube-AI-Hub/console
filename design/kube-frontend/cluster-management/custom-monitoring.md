# 自定义监控仪表板（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/custom-monitoring.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-04

## 概述

集群级 `clusterdashboards` 的列表、YAML 读写与删除。

## 系统现状

老 console 的 `/clusters/:cluster/custom-monitoring` 是仪表板列表 + Grafana 风格面板编辑器
（点击行名打开 `custom.monitoring.edit`，只读模式即"查看"）。

迁移计划此前把它登记为「不做：仪表板接口各路径均 404」。**这条错在版本号**：探的是
`v1alpha3`，而对象在 **`v1alpha2`**——`/apis/monitoring.kubesphere.io/v1alpha2/clusterdashboards`
返回 200，本集群有 1 个（NVIDIA DCGM）。

## 仓库落点

- `packages/api-client/src/dashboards.ts`（`clusterDashboardsApi` / `projectDashboardsApi`）
- `apps/console-next/src/pages/cluster/ClusterCustomMonitoringPage.tsx`
- `routes/kube-frontend.clusters.$cluster/custom-monitoring/{route,index}.tsx`

## 对外契约

| 动作 | 请求 |
| --- | --- |
| 列表 | `GET /apis/monitoring.kubesphere.io/v1alpha2/clusterdashboards`（裸 List，无分页） |
| 读取 | `GET …/clusterdashboards/<name>` |
| 保存 | `PUT …/clusterdashboards/<name>`（整对象） |
| 删除 | `DELETE …/clusterdashboards/<name>` |

对象形状：`spec.title`、`spec.description`、`spec.panels[]`（每个面板含 `targets[].expr` 的 PromQL）。

## 设计目标与非目标

目标：列表、YAML 读写、删除。非目标：面板编辑器与图表渲染。

## 关键约束

- YAML 保存用 PUT 整对象：仪表板以文档形态编辑，merge patch 会让已删除的面板留在对象里。
- 页面顶部常驻一行「面板编辑器未迁移」的说明——读者看不到图表时必须知道为什么。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01 — 先交付列表与 YAML，不硬塞图表

**为什么**：面板渲染要执行每个面板的 PromQL 并画对应图形，等价于自建一个 Grafana 渲染器；
把它做一半（只画折线、忽略 `type`/`yaxis`/图例）会让仪表板"看起来能用但显示失真"，
比明说未迁移更糟。

**被否方案**：只渲染 `graph` 类型面板。代价是其余类型静默失踪，用户会以为仪表板坏了。

**何时重新考虑**：确定要自建图表引擎时（与集群监控的趋势图合并做）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-02 — 复用 YamlDialog 做编辑

**为什么**：既有组件已支持下载/上传/名称锁定与解析校验；仪表板的 YAML 编辑不需要额外交互。

## 不变量

1. 列表在 `spec.title` 缺失时退回对象名。
2. `spec.panels` 非数组时面板数为 0，不抛错。

## 已知坑

- **版本号**：`v1alpha3` 的同类路径全是 404，容易得出"接口不存在"的错误结论。
- 裸 List 没有 `totalItems`，不能按分页组件处理。

## 测试与可观测

`test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CUSTOM_MONITORING_01.py`：列表、面板数、YAML 对话框、删除确认。

## 后续改进

- 面板渲染（与集群监控图表合并）。
- 项目级 `dashboards` 页。
- 面板编辑器。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01`
