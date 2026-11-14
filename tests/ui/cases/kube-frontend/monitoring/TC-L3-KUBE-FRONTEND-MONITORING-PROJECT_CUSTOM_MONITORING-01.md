# TC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01 项目自定义监控 · 仪表板列表与空态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `project-custom-monitoring`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/custom-monitoring`
- **需求**: `prd/kube-frontend/monitoring/custom-monitoring.md`

## 产品功能

项目作用域的自定义监控仪表板列表：名称、面板数、可编辑、创建时间；没有仪表板时显示明确空态。

### 关联需求

- `prd/kube-frontend/monitoring/custom-monitoring.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/custom-monitoring.md`](../../../../prd/kube-frontend/monitoring/custom-monitoring.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01** — 已知项目 `<ns>` 有 N 个自定义监控仪表板（N 可能为 0），当打开该项目的自定义监控页，则列出 N 行，每行显示名称（标题为主、描述为辅）、面板数、是否可编辑与创建时间；N 为 0 时显示明确的空态文案（「还没有自定义监控仪表板」）；接口失败时显示错误面板与重试，而不是空态。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/custom-monitoring.md`](../../../../design/kube-frontend/monitoring/custom-monitoring.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/custom-monitoring.md`](../../../../prd/kube-frontend/monitoring/custom-monitoring.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 项目管理员查看本项目的仪表板 (Priority: P1)

作为 **项目管理员**，我希望 **在项目内看到全部自定义监控仪表板，并能打开其中一个看它的 YAML**，以便 **确认面板定义属于哪个项目、是否需要修正**。

**Independent Test**：打开 `…/projects/<ns>/custom-monitoring`，核对行数等于 `GET /apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards` 的条数；没有对象时显示空态而不是错误面板。

## 前置与配置

- 已登录，且至少存在一个项目（带 kubesphere.io/workspace 标签的命名空间）
- host 集群的 monitoring.kubesphere.io/v1alpha2 dashboards 集合可读（可能为空）

## 测试步骤

1. 用 API 读集群列表，取 host（或第一个集群）
2. 用 API 读命名空间列表，取第一个带 kubesphere.io/workspace 标签的项目
3. 读 /apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards 得到期望行数 N
4. 打开该项目的 /custom-monitoring 页
5. 等待 surface 离开 loading，读 data-ai-state
6. 核对表头四列与行数；N 为 0 时核对空态块与文案

## 期望结果

- surface 可见，data-ai-state 为 ready（有数据）或 empty（无数据）
- 有数据时表头含 名称 / 面板数 / 可编辑 / 创建时间，行数等于 N
- 无数据时 data-ai-id 为 project-custom-monitoring:empty 的块可见，文案含「还没有自定义监控仪表板」，且不渲染表头

## 失败排查

- 整页错误：接口版本写成了 v1alpha3（本部署返回 404），应为 v1alpha2
- 行数恒为 0 但接口有对象：页面读的是 clusterdashboards 而不是 namespaced dashboards
- URL 404：路由目录 custom-monitoring 未建或 createFileRoute 路径少了 /projects/$namespace 段

## 产品改版后如何更新自动化

- 选择器：project-custom-monitoring:surface / :table / :empty；页面 pages/monitoring/ProjectCustomMonitoringPage.tsx
