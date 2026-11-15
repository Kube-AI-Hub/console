# 其余独立列表页刷新（L3）

[子模块需求](./_index.md)

## 概述

本批收尾六个此前没有刷新入口的独立列表页：集群 DevOps 工程、JuiceFS 存储卷、集群自定义监控仪表板、项目灰度发布、镜像构建器、项目服务账号。它们各自持有查询，读者需要一个明确的重读入口；老 console 的对应列表都有刷新。

## 用户故事

### US1 - 主动重读这六类列表 (Priority: P1)

作为 **集群或项目运维**，我希望 **在这六个列表上直接刷新**，以便 **在触发构建、安装驱动或创建发布后立刻确认结果，而不必退出页面再进来**。

**Independent Test**：打开项目镜像构建器列表点击「刷新」，列表重新发起请求；其余五页同样有刷新入口且空闲时可用。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01** — 已知集群 DevOps 工程、JuiceFS 存储卷、集群自定义监控、项目灰度发布、镜像构建器、项目服务账号六个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求；句柄分别为 `devops:refresh`、`cluster-juicefs:refresh`、`custom-monitoring:refresh`、`grayrelease:refresh`、`image-builder:refresh`、`serviceaccounts:refresh`。JuiceFS 页的刷新位于「卷」页签内（该页签持有列表）。

## 设计目标

1. 六页共用 `useListRefresh`，句柄与文案一致。
2. 分页/筛选状态在刷新后保留。

## 约束与边界

- JuiceFS 页有三个页签（卷/用量/性能），只有「卷」页签持有列表，刷新因此只在该页签出现。
- 灰度发布与镜像构建器按项目作用域取数，刷新只重发当前查询。

## UI 交互设计

- 工具栏右侧「刷新」按钮；忙碌时禁用，返回后恢复。
- 空态给出「刷新」按钮。

## 文案与校验

- 文案取 `common.refresh`；无表单，不做输入校验。

## 边界情况

- 组件未安装（DevOps / 镜像构建器 / JuiceFS / 监控）：页面显示空态或错误面板，刷新仍可点。
- 慢请求：按钮保持忙碌且禁用。

## 假设

- 六个页面的查询互不依赖。

## 明确不做

- 定时轮询与 watch 推送（R-27）。
- 面板型列表（NodeRankingPanel / NodeResourcesPanel / ResourceMonitorPage）——行数据由父页传入，刷新需在父页接入，另立单元。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01** — 六个独立列表页的刷新与空态出口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01** — 点击刷新后列表重新请求并反映最新状态。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01
