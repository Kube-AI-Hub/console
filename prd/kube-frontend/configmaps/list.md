# 配置字典列表（L3）

## 概述

配置字典页的主表格：列、排序、分页、行的可辨识信息。搜索与删除有各自的文档。

## 用户故事

### US1 - 作为项目成员，按创建时间看最近的配置

**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

### US2 - 作为项目成员，看清每条配置包含哪些键

**Independent Test**：列表「键」列显示该 ConfigMap 的全部键名，以逗号分隔；无键时显示 `-`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — Given 项目内有多条 ConfigMap，When 打开列表，Then 默认按创建时间倒序，每行显示名称、键、创建时间。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02** — Given 列表已加载，When 点击「名称」列头，Then 请求以 `sortBy=name&order=asc` 重新发起，列头显示升序标记，且当前页回到第 1 页。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03** — Given 列表已加载，When 点击分页切换到第 2 页，Then 请求带 `page=2`，已选项被清空，列表显示第 2 页数据。

## 设计目标

- 排序与分页是**服务端**行为，切换时保留搜索条件。
- 列定义是数据：新增一种资源只需新增列数组。

## 约束与边界

- 排序字段限定 `name` 与 `createdAt`；其他值由 BFF 以 400 拒绝，避免上游静默忽略导致箭头指错方向。
- 分页大小固定 10，不提供选择器：老控制台也只有一档，多一档就多一组没被验证的组合。

## UI 交互设计

- 列头可排序的用按钮包裹，带 `aria-sort`，箭头标记仅为装饰（`aria-hidden`）。
- 小屏（`sm` 以下）隐藏「键」列，`md` 以下隐藏「创建时间」列；详情页仍可见这些信息。
- 行有 `data-ai-row`，值为资源名，供智能体定位单行。

## 文案与校验

- 表头：名称、键、创建时间、操作。
- 描述缺失显示 `-`，与老控制台一致。

## 边界情况

- 总数为 0 时不渲染表头，改为空态。
- 创建时间为空字符串时显示 `-`，不抛 `Invalid Date`。
- 请求进行中切换排序，后到的响应覆盖先到的（TanStack Query 按 key 丢弃过期结果）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — 列表必须展示名称、键、创建时间三列。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02** — 名称与创建时间两列必须可排序，并在列头反映当前方向。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03** — 翻页必须请求新页数据并清空已选项。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — 与 `kubectl get configmaps -o wide` 的名称集合一致。

## 明确不做

- 不做列宽拖拽与列显隐设置。
- 不做虚拟滚动：首期分页 10 条，长列表不在本期。

## 假设

- 上游 `ascending=false` 表示倒序。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03`
