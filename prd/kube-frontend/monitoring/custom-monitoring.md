# 自定义监控仪表板（L3）

[子模块需求](./_index.md)

## 概述

项目控制台的 **自定义监控** 页：`/kube-frontend/<ws>/clusters/<cluster>/projects/<namespace>/custom-monitoring`。它列出该项目可见的仪表板（`monitoring.kubesphere.io/v1alpha2` 的 namespaced `Dashboard` CRD），回答「这个项目里有哪些自定义监控面板、各有多少个面板、能不能改」。

本文只覆盖**项目级**部分；集群级同名页面读 `clusterdashboards`，其技术方案在 `design/kube-frontend/cluster-management/custom-monitoring.md` 与对应 PRD。两页共用同一套对象形状与 YAML 对话框。

## 用户故事

### US1 - 项目管理员查看本项目的仪表板 (Priority: P1)

作为 **项目管理员**，我希望 **在项目内看到全部自定义监控仪表板，并能打开其中一个看它的 YAML**，以便 **确认面板定义属于哪个项目、是否需要修正**。

**Independent Test**：打开 `…/projects/<ns>/custom-monitoring`，核对行数等于 `GET /apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards` 的条数；没有对象时显示空态而不是错误面板。

## 验收场景

- **AC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01** — 已知项目 `<ns>` 有 N 个自定义监控仪表板（N 可能为 0），当打开该项目的自定义监控页，则列出 N 行，每行显示名称（标题为主、描述为辅）、面板数、是否可编辑与创建时间；N 为 0 时显示明确的空态文案（「还没有自定义监控仪表板」）；接口失败时显示错误面板与重试，而不是空态。

## 设计目标

1. 项目内一眼看全：仪表板的标题、面板数、可编辑性与创建时间同表呈现。
2. 与集群页同构：同一套列、同一个 YAML 对话框；差别只在数据作用域。
3. 明确空态：项目没有仪表板是正常状态，不渲染表头、不报错。

## 约束与边界

- 只读列表 + 查看/编辑 YAML；**不迁移面板编辑器与图表渲染**（老 console 的 Grafana 式弹窗是独立组件套件）。
- 一次取全：该集合没有分页参数，仪表板数量很少；老 console 同样一次读完。
- 数据源路径是 `/apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards`，**不是 v1alpha3**（探测见「明确不做」）。
- 多集群：API 客户端当前没有 cluster 段，页面读到的是 host 集群命名空间下的对象（本部署只有 host 一个集群）。

## UI 交互设计

- 页面头：标题「自定义监控」、描述「项目内的自定义监控仪表板；每个仪表板是一组 PromQL 面板。」
- 表：名称（标题 + 描述）/ 面板数 / 可编辑（徽标 是·否）/ 创建时间。
- 行操作：查看 YAML。点击打开共享 `YamlDialog`，可下载/上传并保存（PUT 整个对象），与集群页一致。
- `data-ai-id`：`project-custom-monitoring:surface`（状态容器）、`project-custom-monitoring:table`（列表）、`project-custom-monitoring:empty`（空态）、`project-custom-monitoring:retry`（错误重试）。

## 文案与校验

- 标题 `customMonitoring.title`；项目级描述 `customMonitoring.projectDescription`；列名 名称 `cluster.column.name`、面板数 `customMonitoring.panels`、可编辑 `customMonitoring.editable`、创建时间 `cluster.column.createdAt`。
- 空态：标题 `customMonitoring.empty`，说明 `customMonitoring.emptyDescription`。
- YAML 名称锁定：对话框以对象名锁定 `metadata.name`，改名会被拒绝（与集群页相同的校验）。

## 边界情况

- 仪表板数量为 0：渲染空态块，不渲染表头。
- `spec.panels` 缺失：面板数显示 0（对象合法但为空）。
- `spec.title` 缺失：名称回落为对象名；描述缺失时次行显示对象名。
- 读取返回 200 但响应体为空：按空列表处理（模块未安装的常见形态）。
- 保存失败：对话框保持打开，错误由全局提示呈现（与集群页一致）。

## 明确不做

- 面板编辑器与图表渲染：老 console 的 Grafana 式编辑器（拖拽、缩放、逐面板 PromQL）是独立组件套件，另立。
- 新建/删除仪表板：本轮页面只读列表 + YAML；写路径需要模板/配额联动，另立。
- 集群级仪表板：在集群管理 › 自定义监控（已迁移）。
- 接口版本探测证据：`GET /kapis/monitoring.kubesphere.io/v1alpha3/namespaces/<ns>/dashboards` → **404 Page Not Found**；`GET /kapis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards` → 200（`items: []`）；`GET /apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards` → 200（`DashboardList`，本部署全部命名空间 0 个对象）；`GET /apis/monitoring.kubesphere.io/v1alpha2/clusterdashboards` → 200（host 上 1 个 NVIDIA DCGM 仪表板）。因此数据源取 v1alpha2 的 namespaced 路径。

## 假设

- 项目可见的仪表板就是该 namespace 下的 `dashboards` 对象（CRD 作用域即 namespace，无额外 RBAC 过滤）。
- 仪表板数量在几十个以内，一次取全后无需分页。

## 功能需求

- **FR-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01** — 项目级列表显示名称/面板数/可编辑/创建时间，并支持查看 YAML。
- **FR-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-02** — 空列表显示空态而不是错误面板；接口失败显示错误面板与重试。

## 成功标准

- **SC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01** — 行数与 namespaced dashboards 接口一致；空态文案可见；页面状态可从 `data-ai-state` 判定。

## 验收用例

- `TC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01`
