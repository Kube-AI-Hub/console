# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-05 自定义监控：创建仪表板与编辑信息

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `custom-monitoring`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/custom-monitoring`
- **需求**: `prd/kube-frontend/cluster-management/custom-monitoring.md`

## 产品功能

集群自定义监控页可创建空仪表板，并可编辑标题/描述/可编辑性而不触碰面板。

### 关联需求

- `prd/kube-frontend/cluster-management/custom-monitoring.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/custom-monitoring.md`](../../../../prd/kube-frontend/cluster-management/custom-monitoring.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-05** — 已知集群自定义监控页，当点主操作「创建仪表板」，则弹窗要求显示名称（必填）、对象名（可留空，由显示名称生成；只允许小写字母/数字/连字符）、描述与「允许其他编辑者修改面板」勾选；提交后发出 `POST /apis/monitoring.kubesphere.io/v1alpha2/clusterdashboards`（`spec.panels` 为空数组），成功后列表出现该行；当选择行操作「编辑信息」，则对象名锁定、其余字段可改，提交以 merge patch 只写 `spec.title/description/editable`（**不动 `spec.panels`**），成功后列表标题更新；名称为空或格式非法时在本地拒绝且不发请求。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/custom-monitoring.md`](../../../../design/kube-frontend/cluster-management/custom-monitoring.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/custom-monitoring.md`](../../../../prd/kube-frontend/cluster-management/custom-monitoring.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 知道集群里有哪些自定义仪表板并能改或删 (Priority: P2)

作为 **平台运维**，我希望 **看到集群里装了哪些自定义监控仪表板，并能查看其 YAML 或删除**，以便 **核对随监控组件下发的仪表板、导出一份做备份、或清掉不要的**。

**Independent Test**：打开集群自定义监控，列表显示仪表板标题与面板数；点行操作「查看 YAML」能看到对象完整 YAML 并可保存；「删除」能把仪表板删掉。

## 前置与配置

- 已登录且有集群监控写权限
- monitoring.kubesphere.io/v1alpha2 的 clusterdashboards 可写

## 测试步骤

1. 点「创建仪表板」，填显示名称后提交
2. 确认新行出现，且对象 spec.panels 为空数组
3. 对该行执行「编辑信息」，确认对象名锁定，改标题后提交
4. 回读对象，确认 spec.title 已更新且 spec.panels 未被改动
5. 清理创建的对象

## 期望结果

- 面板编辑器不在迁移范围，创建出的仪表板从空面板开始

## 失败排查

- 编辑后面板消失：用了整对象 PUT 而不是 merge patch
- 中文标题下对象名为空却提交成功：缺少本地校验

## 产品改版后如何更新自动化

- 选择器：custom-monitoring:create / dashboard-info:surface / :title / :name / :description / :editable / :submit / custom-monitoring:edit
