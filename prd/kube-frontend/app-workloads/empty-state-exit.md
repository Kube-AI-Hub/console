# 列表空态出口（L3）

[子模块需求](./_index.md)

## 概述

老 console 的空列表会给出「刷新」「清除筛选」两个出口；新 UI 的空态只有标题和说明，读者在搜索到 0 条或筛选后无结果时被卡住——搜索框还在，但页面上没有任何一步能回到有数据的状态。ai-kit 的 ResourceList 已经掌握 search/filters 的受控回调，本功能点只在空态里补两个动作按钮，并把三个列表页的回调接好。

## 用户故事

### US1 - 空列表时能一键回到有数据的状态 (Priority: P1)

作为 **项目运维**，我希望 **列表因为搜索或筛选变空时，空态上直接有「清空搜索与筛选」和「刷新」两个动作**，以便 **不用自己猜是搜索词的问题、也不用反复点导航重进页面**。

**Independent Test**：在容器列表输入不存在的关键字，空态出现两个按钮；点「清空搜索与筛选」后搜索框清空、列表恢复；再次搜索为空后点「刷新」，触发一次列表请求。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01** — 已知打开容器组列表，当输入不存在的关键字使列表变空，则空态显示 data-ai-id=empty-state:clear 的「清空搜索与筛选」与 data-ai-id=empty-state:refresh 的「刷新」；当点「清空搜索与筛选」，则搜索框清空且列表恢复为有数据的就绪状态；已知再次输入关键字使列表变空，当点「刷新」，则触发一次列表请求（网络层可观测）；已知列表没有搜索/筛选能力或页面没有传回调，则空态只显示原有标题与说明，不出现无法工作的按钮。

## 设计目标

- 空态自带出口，读者不需要知道「搜索框在哪里」或「怎么刷新」。
- 只在能力存在时出现：清空按钮要求页面提供 onSearchChange/onFiltersChange；刷新按钮要求页面提供 onRefresh。
- 不改现有空态文案结构：标题与说明保持原样，按钮作为 action 追加在下方。
- 句柄由 ai-kit 固定，页面不需要自己传 id。

## 约束与边界

- 按钮文案由页面通过 ResourceList 的 labels/refresh 传入（ai-kit 没有 i18n）；未传时使用中文兜底。
- 空态判定沿用 Table 既有逻辑：rows 为空且非 loading（errorContent 为 null 时）。
- 清空动作一次性调用 onSearchChange('') 与 onFiltersChange({})，与工具栏「清除筛选」使用同一组合。
- 刷新动作直接调用页面给的 onRefresh，不额外发请求。
- 不改变列表正常态、加载态与错误态的渲染。

## UI 交互设计

空态（标题 + 说明）下方出现一行两个按钮：

- 「清空搜索与筛选」：secondary 按钮，data-ai-id=empty-state:clear。
- 「刷新」：secondary 按钮，data-ai-id=empty-state:refresh。
- 两个按钮按能力独立出现：只有搜索/筛选回调时只有清空；只有 onRefresh 时只有刷新；都没有时保持原空态。

## 文案与校验

- 清空按钮文案：清空搜索与筛选（locale table.clearSearchAndFilters）。
- 刷新按钮文案：刷新（复用页面已有的 common.refresh 或 ResourceList 的 refresh.label）。
- ai-kit 兜底文案：清空搜索与筛选 / 刷新（页面未传 label 时）。

## 边界情况

- 列表本来就没有数据（不是搜索导致）：清空按钮存在但点击无副作用；刷新仍然可用。
- 搜索框为空但筛选生效：清空会同时清掉筛选与搜索，回到初始列表。
- 刷新期间列表仍为空但 loading：按既有逻辑显示加载态，不显示空态按钮。
- 页面未接线 onRefresh：不渲染刷新按钮，避免死按钮。
- 空态请求失败：错误态优先（errorContent），不显示空态按钮。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01** — ResourceList 在空态且存在 search/filters 回调时渲染「清空搜索与筛选」，在 onRefresh 存在时渲染「刷新」。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-02** — 两个按钮使用固定 data-ai-id：empty-state:clear / empty-state:refresh。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-03** — 工作负载列表、集群级工作负载、集群级容器组三个页面接好回调与文案。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01** — 空态到恢复有数据不超过一次点击（清空）或一次点击（刷新）。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-02** — 未接回调的列表空态不出现按钮，既有空态渲染不变。

## 明确不做

- 不做「重置所有列表条件」的全局动作（分页/排序不属于空态出口）。
- 不做空态的自定义插画/引导流程。
- 不为错误态提供同样按钮（已有重试入口）。

## 假设

- 空列表的原因主要是搜索词或筛选生效；清空即可回到初始列表。
- 页面的 onRefresh 会重新发起列表请求。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01
