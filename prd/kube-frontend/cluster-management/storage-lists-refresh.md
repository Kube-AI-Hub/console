# 集群存储列表刷新（L3）

[子模块需求](./_index.md)

## 概述

集群作用域的存储列表是排障入口：存储类型决定新卷能不能供给，持久卷与声明回答「卷为什么没绑定」，快照与快照类回答「备份能不能做」。这些状态随集群变化，读者需要一个明确的重读入口；老 console 的每个列表都有刷新，新 UI 此前没有。

## 用户故事

### US1 - 主动重读集群存储状态 (Priority: P1)

作为 **集群管理员**，我希望 **在存储类型、持久卷、存储卷声明、卷快照、快照类这五个列表上直接刷新**，以便 **在创建卷或安装驱动后立刻确认状态，而不必退出页面再进来**。

**Independent Test**：打开集群持久卷列表点击「刷新」，列表重新发起请求；打开存储类型列表，刷新按钮存在且空闲时可用。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01** — 已知集群的存储类型、持久卷、存储卷声明、卷快照、快照类五个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求，刷新期间按钮处于忙碌状态并在返回后恢复；句柄分别为 `storageclasses:refresh`、`persistentvolumes:refresh`、`cluster-persistentvolumeclaims:refresh`、`cluster-volume-snapshots:refresh`、`cluster-snapshot-classes:refresh`。

## 设计目标

1. 五个页面共用一个实现（`useListRefresh`），句柄与文案一致。
2. 刷新是读者主动触发的重读，不引入定时轮询。

## 约束与边界

- 每个页面只刷新自己的查询；集群作用域的读取不含项目段。
- 空态出口由列表组件在存在刷新或搜索时渲染，`emptyLabels` 只覆盖默认文案。

## UI 交互设计

- 工具栏右侧「刷新」按钮；忙碌时显示旋转图标并禁用，返回后恢复。
- 空态给出「刷新」按钮。

## 文案与校验

- 文案取 `common.refresh`（中文「刷新」/英文 Refresh）；无表单，不做输入校验。

## 边界情况

- 集群未安装快照能力（无 VolumeSnapshot CRD / 无快照类）：页面显示空态说明，刷新仍可点。
- 查询失败时列表显示错误面板与重试，刷新按钮保持可用。

## 假设

- 五个页面的查询互不依赖。

## 明确不做

- 定时轮询与 watch 推送（能力矩阵 R-27）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01** — 集群存储五个列表的刷新与空态出口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01** — 点击刷新后列表重新请求并反映最新状态。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01
