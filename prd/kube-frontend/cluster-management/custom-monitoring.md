# 自定义监控仪表板（L3）

[子模块需求](./_index.md)

## 概述

集群级自定义监控仪表板（`clusterdashboards.monitoring.kubesphere.io`）：列表（标题、描述、面板数、可编辑、创建时间），行操作「查看/编辑 YAML」与「删除」。

## 用户故事

### US1 - 知道集群里有哪些自定义仪表板并能改或删 (Priority: P2)

作为 **平台运维**，我希望 **看到集群里装了哪些自定义监控仪表板，并能查看其 YAML 或删除**，以便 **核对随监控组件下发的仪表板、导出一份做备份、或清掉不要的**。

**Independent Test**：打开集群自定义监控，列表显示仪表板标题与面板数；点行操作「查看 YAML」能看到对象完整 YAML 并可保存；「删除」能把仪表板删掉。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01** — 当打开集群自定义监控页，则列出全部 `clusterdashboards`，每行显示标题、面板数、是否可编辑与创建时间。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-02** — 当集群没有仪表板，则显示空态说明仪表板随监控组件下发、本控制台不提供面板编辑器。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-03** — 当选择行操作「删除」并确认，则该对象被删除且列表刷新。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-04** — 当选择行操作「查看 YAML」，则显示对象完整 YAML，可保存回集群。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-05** — 已知集群自定义监控页，当点主操作「创建仪表板」，则弹窗要求显示名称（必填）、对象名（可留空，由显示名称生成；只允许小写字母/数字/连字符）、描述与「允许其他编辑者修改面板」勾选；提交后发出 `POST /apis/monitoring.kubesphere.io/v1alpha2/clusterdashboards`（`spec.panels` 为空数组），成功后列表出现该行；当选择行操作「编辑信息」，则对象名锁定、其余字段可改，提交以 merge patch 只写 `spec.title/description/editable`（**不动 `spec.panels`**），成功后列表标题更新；名称为空或格式非法时在本地拒绝且不发请求。

## 设计目标

把「有哪些仪表板、内容是什么、怎么删」变得可操作；对尚未迁移的面板渲染明确说明。

## 约束与边界

- **面板编辑器与图表渲染未迁移**：老 console 用 Grafana 风格的拖拽编辑器（`stores/monitoring/custom/CustomMonitoringModal`），是可独立立项的组件套件。页面顶部有常驻说明，不假装能画图。
- 仪表板读取的 API 版本是 **v1alpha2**（见设计文档「已知坑」）。

## UI 交互设计

列表：名称（标题 + 对象名两行）、面板数、可编辑徽标、创建时间；行操作：查看/编辑 YAML、删除。

## 文案与校验

顶部说明与空态文案都要点明「面板编辑器未迁移」，避免读者以为图表该出现却没出现。

## 边界情况

- `spec.title` 缺失：退回显示对象名。
- `spec.panels` 缺失或非数组：面板数显示 0，不报错。
- YAML 保存失败：错误在对话框内显示（沿用 `YamlDialog` 的既有行为）。

## 明确不做

- 面板编辑（增删面板、改 PromQL、拖拽布局）。
- 仪表板图表渲染。
- 项目级自定义监控（`dashboards`，同一套结构，待下一轮）。

## 假设

- `clusterdashboards` 在 `monitoring.kubesphere.io/v1alpha2` 下可读写。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01** — 列出集群仪表板并显示面板数。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-02** — 支持删除与 YAML 读写。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01** — 用例覆盖列表、空态、YAML 打开与删除确认。
