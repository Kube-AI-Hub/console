# 列表空态出口（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/empty-state-exit.md)

## 概述

ai-kit 的 ResourceList 在 Table 的无数据位渲染 Empty（标题 + 说明）；本功能点给它追加 action：清空搜索与筛选、刷新。两个动作是否出现只取决于宿主是否传了对应回调，句柄由 ai-kit 固定（empty-state:clear / empty-state:refresh）。三个列表页补上 onRefresh 与文案。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01

## 设计目标与非目标

目标：空态自带出口（一次点击回到有数据）；能力缺失时不出现死按钮；不改现有空态标题/说明结构。

非目标：错误态动作、全局重置、空态引导插画。

## 关键约束

- ai-kit 无 i18n：按钮文案由页面经 labels.emptyClear / labels.emptyRefresh 或 schema.refresh.label 传入，ai-kit 保留中文兜底（与 Empty 的「暂无数据」同一惯例）。
- 按钮只在回调存在时渲染：清空要求 onSearchChange || onFiltersChange；刷新要求 onRefresh。
- 清空组合与工具栏「清除筛选」一致：onSearchChange('') + onFiltersChange({})。
- 不改空态判定（rows 空且非 loading、errorContent 为空时由 Table 渲染 Empty）。
- 不改正常/加载/错误态。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01 — 出口放在 Empty 的 action 槽，而不是页面各自包一层空态

**为什么**：空态由 Table 组件按 rows/loading 自动决定何时出现；页面无法在同一个位置插按钮而不重写表格空态逻辑。Empty 已有 action 槽，ResourceList 又已经握着 onSearchChange/onFiltersChange/onRefresh，一处实现即可让所有接线的列表获得出口；句柄也就能保持固定（empty-state:*），不随页面命名漂移。

**被否方案**：每个页面自己判断 rows.length===0 再渲染一块自定义空态。会与 Table 的空态重复/打架，且每页都要复制判定与按钮。

**何时重新考虑**：空态需要按资源类型给不同的引导（例如创建向导）时，扩展 Empty 的 action 由页面传入。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-02 — 按能力出现，而不是总是两个按钮

**为什么**：没有 onRefresh 的页面渲染刷新按钮就是死按钮；没有搜索/筛选的列表渲染清空按钮同样无意义。能力判断在 ResourceList 内联，页面只需传回调。

**被否方案**：固定两个按钮、用 disabled 表达不可用。空态本来就没有可用操作，再摆两个灰按钮增加噪音。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-03 — 文案走宿主的 labels，ai-kit 只做兜底

**为什么**：保持 ai-kit 无 i18n 的边界；三个页面用现有 locale（table.clearSearchAndFilters / common.refresh）传入。兜底值让未接线的页面在没有 label 时仍可读，与 Empty 默认「暂无数据」一致。

## 系统现状

老 console 空列表有刷新/清除筛选；新 UI 的 ResourceList 空态只有标题+说明。ResourceList 已受控持有 search/filters 与 onRefresh，只差在 Empty 上追加 action。

## 仓库落点

- packages/ai-kit/src/schema/ResourceList.tsx（Empty action + labels.emptyClear/emptyRefresh 类型）
- kube-frontend/apps/console-next/src/pages/app-workloads/WorkloadListPage.tsx（新增 schema.refresh + onRefresh，labels 文案）
- pages/cluster/ClusterWorkloadsPage.tsx、pages/cluster/ClusterPodsPage.tsx（labels 文案；onRefresh 已有）
- 文案：kube-frontend/packages/locales/src/index.ts 的 table.clearSearchAndFilters

## 对外契约

- data-ai-id=empty-state:clear：清空搜索与筛选；data-ai-id=empty-state:refresh：刷新。
- 出现条件：空态 + 对应回调存在；两者独立。
- 清空调用 onSearchChange('') 与 onFiltersChange({})（存在才调）；刷新调用 onRefresh。

## 不变量

- 正常/加载/错误态渲染不变。
- 空态标题与说明保持 schema.empty 的文案，action 追加在其下。
- 未接回调的列表空态不出现按钮。

## 已知坑

- 空态由 Table 渲染，若未来 Table 改成外部受控空态，action 需要跟着搬。
- labels 缺失时走中文兜底，英文界面会看到中文——页面必须传文案（本次三个页面都传）。
- 清空按钮会同时清 filters 与 search；页面若只用其中一个回调，另一个不会被动。
- 刷新按钮不应自行再调 onSearchChange，否则会清掉读者输入的关键字。

## 测试与可观测

E2E：TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01。容器组列表输入不存在关键字 → 空态 → 断言 empty-state:clear / empty-state:refresh → 点清空 → 搜索框为空且列表恢复 ready → 再搜空 → 点刷新并 expect_response 捕获列表请求。

## 后续改进

- 空态出口覆盖更多列表页（详情页依赖的列表、集群级其它资源）。
- 错误态与空态的出口统一成一组动作组件。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01
