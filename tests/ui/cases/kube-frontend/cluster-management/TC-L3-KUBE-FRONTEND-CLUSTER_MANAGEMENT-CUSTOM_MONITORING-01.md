# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01 自定义监控 · 仪表板列表、YAML 与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `custom-monitoring`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/custom-monitoring`
- **需求**: `prd/kube-frontend/cluster-management/custom-monitoring.md`

## 产品功能

集群自定义监控页列出全部 clusterdashboards（标题/面板数/可编辑/创建时间），支持查看-编辑 YAML 与删除；无数据时空态说明仪表板随监控组件下发。

### 关联需求

- `prd/kube-frontend/cluster-management/custom-monitoring.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/custom-monitoring.md`](../../../../prd/kube-frontend/cluster-management/custom-monitoring.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01** — 当打开集群自定义监控页，则列出全部 `clusterdashboards`，每行显示标题、面板数、是否可编辑与创建时间。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-02** — 当集群没有仪表板，则显示空态说明仪表板随监控组件下发、本控制台不提供面板编辑器。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-03** — 当选择行操作「删除」并确认，则该对象被删除且列表刷新。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-04** — 当选择行操作「查看 YAML」，则显示对象完整 YAML，可保存回集群。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/custom-monitoring.md`](../../../../design/kube-frontend/cluster-management/custom-monitoring.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/custom-monitoring.md`](../../../../prd/kube-frontend/cluster-management/custom-monitoring.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 知道集群里有哪些自定义仪表板并能改或删 (Priority: P2)

作为 **平台运维**，我希望 **看到集群里装了哪些自定义监控仪表板，并能查看其 YAML 或删除**，以便 **核对随监控组件下发的仪表板、导出一份做备份、或清掉不要的**。

**Independent Test**：打开集群自定义监控，列表显示仪表板标题与面板数；点行操作「查看 YAML」能看到对象完整 YAML 并可保存；「删除」能把仪表板删掉。

## 前置与配置

- 已登录平台管理
- monitoring.kubesphere.io/v1alpha2 可读

## 测试步骤

1. 打开集群自定义监控页
2. 核对列表列与「面板编辑器未迁移」说明
3. 若有仪表板：打开第一行 YAML 对话框，确认是合法 JSON/YAML 且含 spec.panels
4. 触发删除确认，确认对话框出现后取消（不实际删除）

## 期望结果

- 页面进入 ready 或 empty
- 说明文字常驻
- YAML 对话框显示对象内容
- 删除确认对话框出现且可取消

## 失败排查

- 进入 error：接口版本错（应为 v1alpha2，v1alpha3 全 404）
- 行数与 apiserver 不一致：裸 List 无分页，刷新即可

## 产品改版后如何更新自动化

- 列或行操作变化时同步页面与用例
