# 配置字典列表（L3）

## 概述

配置字典页的主表格：列、排序、分页、行的可辨识信息。搜索与删除有各自的文档。

## 用户故事

### US1 - 作为项目成员，按创建时间看最近的配置

**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

### US3 - 作为项目成员，只看某个项目的配置

**Independent Test**：在项目筛选器中选择目标项目，列表只剩该项目的对象；切回「全部项目」恢复跨项目结果。

### US2 - 作为项目成员，看清每条配置包含哪些键

**Independent Test**：列表「键」列以逗号（无空格）分隔显示键名，最多 50 个字符，超出部分以 `...` 结尾；完整键名在悬停提示与详情页可见；无键时显示 `-`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — Given 项目内有多条 ConfigMap，When 打开列表，Then 默认按创建时间倒序，每行显示名称（含别名，第二行为描述）、项目、键、创建时间；键列在窄屏下隐藏，项目列只在宽屏显示。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-05** — Given 某条 ConfigMap 的键名拼接后超过 50 个字符，When 查看列表，Then 键列只显示前 50 个字符并以 `...` 结尾，鼠标悬停时展示完整键名；拼接不超过 50 个字符时原样显示且不带省略号。
- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04** — Given 列表已加载，When 在项目筛选器中选择某个项目，Then 请求切换到该项目的命名空间并回到第 1 页；When 选择「全部项目」，Then 请求不带命名空间段，返回跨项目结果。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-06** — Given 某条 ConfigMap 有别名，When 查看列表，Then 名称列第一行显示别名（无别名时显示名称），第二行显示描述或 `-`；创建时间显示为 `YYYY-MM-DD HH:mm:ss`。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02** — Given 列表已加载，When 点击「名称」列头，Then 请求以 `sortBy=name&order=asc` 重新发起，列头显示升序标记，且当前页回到第 1 页。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03** — Given 列表已加载，When 点击分页切换到第 2 页，Then 请求带 `page=2`，已选项被清空，列表显示第 2 页数据。

## 设计目标

- 排序与分页是**服务端**行为，切换时保留搜索条件。
- 列定义是数据：新增一种资源只需新增列数组。

## 约束与边界

- 排序字段沿用旧 console 的拼写：`name` 与 `createTime`。
- 分页沿用旧 console 的调用方式：`page` 与 `limit`，总数取响应里的 `totalItems`（`total_count` 兜底）。
- 项目筛选驱动的是请求的命名空间，而不是新增一个查询参数：Kapis 没有「按多个命名空间过滤」的参数，跨项目读取只能走没有命名空间段的集合端点。
- 分页大小固定 10，不提供选择器：老控制台也只有一档，多一档就多一组没被验证的组合。
- 键名以 `,` 连接（无空格），与老 console 的 `Object.keys(data).join(',')` 一致；有空格会在 50 字符预算里白占位置。
- 键列按字符截断到 50 个字符，**不换行**：一个自动生成的 ConfigMap 可能带几十个键，换行会让单行撑满半屏、整张表高度跳动；截断保证每行等高，完整内容交给悬停提示与详情页。

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
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04`
