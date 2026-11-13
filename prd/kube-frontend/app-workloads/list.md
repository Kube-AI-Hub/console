# 工作负载列表（L3）

[子模块需求](./_index.md)

## 概述

八种应用负载共用一张列表：项目运维打开页签后先看名称与状态，必要时搜索或翻页，再对某一行做操作。列表不创建对象——创建表单尚未迁移。

## 用户故事

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01** — 已知项目内至少有一个部署，当打开部署列表，则出现表格且每行有可点击的名称。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02** — 已知列表有数据，当在搜索框输入对象名的一部分，则只剩匹配行。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03** — 已知项目内没有任何该类型对象，当打开该页，则显示空态标题与说明。

## 设计目标

落实应用负载的「状态只有一处定义」：列表与详情的状态取同一个派生函数。

## 约束与边界

- 服务端分页，每页 10 条；排序键为 `name` 与 `createTime`。
- 搜索按名称下发（kapis 的 `name` 参数），不做本地过滤。

## UI 交互设计

- 名称列两行：别名优先，副行是 `app` 标签；名称是链接。
- 状态用徽章；就绪列显示 `ready/total`。
- 行操作：编辑 YAML、删除；多选后出现批量删除。

## 文案与校验

- 表头：名称、状态、就绪、创建时间。
- 状态文案：运行中 / 更新中 / 已停止 / 终止中 / 等待中 / 已终止。

## 边界情况

- 空项目：显示空态，不渲染表头。
- 名称很长：截断，悬停看全称。
- 无副本概念的资源不显示就绪列。

## 明确不做

- 不做列显隐与列宽拖拽。
- 不在列表创建负载。

## 假设

- kapis 的 `totalItems` 是切片前总数。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01** — 展示名称、状态、就绪计数、创建时间。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02** — 支持搜索、排序、分页与多选批量删除。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01** — 数据到达前已有骨架，不出现空白页。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02** — 搜索与翻页各只发一次请求。
