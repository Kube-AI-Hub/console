# 扩展资源列表刷新（L3）

[子模块需求](./_index.md)

## 概述

集群级「自定义资源」包含两层列表：CRD 列表（有哪些扩展类型）和某个 CRD 下的实例列表。CRD 由运维安装、实例由控制器创建，两者都在变化；读者需要一个明确的重读入口，老 console 的对应列表也有刷新。

## 用户故事

### US1 - 主动重读扩展资源 (Priority: P1)

作为 **集群管理员**，我希望 **在 CRD 列表与实例列表上直接刷新**，以便 **在安装一个 CRD 或等控制器建出实例后立刻看到结果，而不必退出页面再进来**。

**Independent Test**：打开自定义资源列表点击「刷新」，列表重新发起请求；进入某个 CRD 的实例列表，刷新入口同样存在且可用。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01** — 已知集群有若干 CRD，当打开自定义资源列表，则「刷新」入口存在且空闲时可用，点击后重新发起请求；当打开某个 CRD 的实例列表，则同样有刷新入口，点击后重新发起该实例查询；句柄分别为 `custom-resources:refresh`、`custom-resource:refresh`。

## 设计目标

1. 两层列表共用 `useListRefresh`，句柄与文案一致。
2. 刷新保留排序与页码。

## 约束与边界

- 实例列表按 CRD 的 apiPath 取数；刷新只重发当前 CRD 的查询。
- CRD 列表为空时显示空态说明，刷新仍可点。

## UI 交互设计

- 工具栏右侧「刷新」按钮；忙碌时禁用，返回后恢复。
- 空态给出「刷新」按钮。

## 文案与校验

- 文案取 `common.refresh`；无表单，不做输入校验。

## 边界情况

- 某个 CRD 的实例接口不可用（403/404）：实例页显示错误面板与重试，刷新按钮保持可用。
- 慢请求：按钮保持忙碌且禁用。

## 假设

- 两层列表的查询互不依赖。

## 明确不做

- 定时轮询与 watch 推送（R-27）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01** — CRD 列表与实例列表的刷新与空态出口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01** — 点击刷新后对应列表重新请求。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01
