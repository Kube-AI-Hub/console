# 自定义监控仪表板 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/monitoring/custom-monitoring.md)

## 概述

`/kube-frontend/<ws>/clusters/<cluster>/projects/<namespace>/custom-monitoring`：项目作用域的仪表板列表（namespaced `Dashboard` CRD），以及查看/保存其 YAML。列表页与集群级自定义监控同构，本文只记录项目级部分。

## 关联需求

- AC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01

## 设计目标与非目标

目标：项目内一次看全仪表板（名称/面板数/可编辑/创建时间），并能打开 YAML；空态与错误态可区分。
非目标：面板编辑器、图表渲染、新建/删除仪表板、集群级列表（已在集群管理迁完）。

## 关键约束

- CRD 版本是 `monitoring.kubesphere.io/v1alpha2`；`v1alpha3` 在 kapis 与 apis 两个前缀下都返回 404（实测）。
- 集合是 **namespaced**：`/apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards`。
- 集合无分页参数，一次取全；对象数量少。
- API 客户端已提供 `projectDashboardsApi`（`packages/api-client/src/dashboards.ts`），本轮直接复用，不新增接口。
- 页面 URL 带 workspace/cluster，但读取只用 namespace：`projectDashboardsApi` 没有 cluster 段。

## 方案决策

### DEC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01 — 复用 `projectDashboardsApi`，不新写读取逻辑

**为什么**：`dashboards.ts` 已把两种作用域收在同一个工厂里（`clusterdashboards` 与 `dashboards`），列表/详情/保存/删除的形状已经完全一致；项目页只需要传 `namespace`。
**被否方案**：页面内直接拼 URL。会绕开同一份 `toDashboard` 映射（`spec.title`/`spec.panels`/`spec.editable`），两个作用域以后容易对字段解释不一致。
**何时重新考虑**：需要 cluster 段（成员集群）或多集群一次查询时，应在 api-client 里统一扩展，而不是在页面里加路径。

### DEC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-02 — 空态由页面显式渲染，带自己的 data-ai-id

**为什么**：任务要求空态可被自动化直接定位（`project-custom-monitoring:empty`）；`ResourceList` 的内置空态在表格内部，没有稳定句柄。显式空态块还能保证「没有对象」不渲染表头，读起来是一页空列表而不是一张坏表。
**被否方案**：只依赖 `ListSchema.empty`。能显示文案，但无法给空态一个独立的 `data-ai-id`。
**何时重新考虑**：列表组件给空态增加 `aiId` 后可以合并。

### DEC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-03 — YAML 复用共享 `YamlDialog`，允许保存整个对象

**为什么**：与集群级页同一套交互：查看、下载、上传、PUT 整个对象。仪表板是文档型对象，字段编辑需要面板级结构，YAML 是当前唯一能安全修改的入口。
**被否方案**：只读文本框。需要专门给 `YamlDialog` 加 readOnly 分支，而本轮的诉求是「复用集群页的查看方式」。
**何时重新考虑**：面板编辑器迁移后，YAML 应降级为高级入口。

## 系统现状

老 console `pages/projects/containers/CustomMonitoring`（`stores/dashboard`，module `dashboards`）：列 = 名称/创建时间，行操作 = 编辑信息、编辑 YAML、删除，主操作 = 新建。列表读 v1alpha3 的 kapis 路径，在本部署 404；新 UI 改用 v1alpha2（集群页已验证）。

## 仓库落点

- 页面：`apps/console-next/src/pages/monitoring/ProjectCustomMonitoringPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/custom-monitoring/{route,index}.tsx`
- 侧栏/区域：`areas/registry.ts` 的 project `monitoring` 区域已有 `custom-monitoring` 条目（titleKey `customMonitoring.title`）
- API：`packages/api-client/src/dashboards.ts` 的 `projectDashboardsApi`

## 对外契约

| 用途 | 路径 | 说明 |
| --- | --- | --- |
| 列表 | `/apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards` | 经 `projectDashboardsApi.list({namespace})` |
| 详情 | `/apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards/<name>` | YAML 对话框读取 |
| 保存 | 同上，PUT 整个对象 | `projectDashboardsApi.save` |
| 集群级（对照） | `/apis/monitoring.kubesphere.io/v1alpha2/clusterdashboards` | 已迁移页面使用 |

## 不变量

1. 行数 = `dashboards` 接口的 `items.length`。
2. 面板数 = `spec.panels` 数组长度；缺失为 0。
3. 空列表不渲染表头；错误不降级为空态。
4. YAML 保存保持对象名不变（对话框 `lockName`）。

## 已知坑

- **版本**：`v1alpha3` 的 dashboards 路径返回 404，写成 v1alpha3 会让整页报错；正确版本 v1alpha2。
- **cluster 段**：`projectDashboardsApi` 没有 cluster 参数，`/kapis/monitoring.../clusters/<id>/...` 与 `klusters` 两种写法都 404；当前部署只有 host 一个集群，因此页面按 host 读取。多成员集群的后续需要 api-client 统一扩展（DEC-01 的「何时重新考虑」）。
- **空响应体**：模块未安装时集合接口返回 200 空体，`dashboards.ts` 用 `response?.items ?? []` 兜底；页面必须走空态而不是错误面板。
- **可编辑徽标不是写权限**：`spec.editable` 是对象上的标记；真正的写权限由平台 RBAC 决定，YAML 保存失败时由对话框报错。
- 页面 URL 的 cluster 段只用于路由与面包屑，不参与读取（见上一条）。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/monitoring/TC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01.yaml`
可观测点：`project-custom-monitoring:surface`（`data-ai-state`）、`:table`、`:empty`、`:retry`、`tr[data-ai-row]`。

## 后续改进

- 成员集群的 cluster 段支持（api-client 统一扩展）。
- 新建/删除仪表板（模板 + 权限联动）。
- 面板渲染与编辑器。

## 验收用例

- TC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01
