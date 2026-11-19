# 列表交互标准（L3）

[子模块需求](./_index.md)

## 概述

全站列表页共用 `ResourceList`。共享组件只提供能力，是否接线在每一页：固定首列、刷新可见、清除全部条件、字段筛选挂在列头，这四件事各页此前做得不一致——节点列表四件齐备，其余四十多个列表大多只有搜索与刷新。本功能点把这四项定为列表标准，并把它做成机械守卫，避免下一次重构又把某一页的接线丢掉。

## 用户故事

### US1 - 在任何一个列表里都不丢方向 (Priority: P1)

作为 **运维**，我希望 **横向滚动表格时行名始终可见、刷新时能看到正在更新、筛选后有一个按钮清空全部条件**，以便 **不必记住自己在看哪一行、也不必逐列找回筛选入口**。

**Independent Test**：在部署列表横向滚动，名称列固定不动；点刷新出现「更新中…」且行不消失；用状态列筛选后工具栏出现「清除全部条件」，点击后列表恢复全集。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01** — 已知列表列宽超过容器（或视口收窄），当横向滚动，则身份列（名称 / 用户名 / 消息标题）保持贴住起始边，操作列保持贴住结束边，中间列从其下方滚过；固定列有不透明背景，滚动内容不穿透。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02** — 已知列表已有数据，当点击刷新或改变筛选触发重取，则表格保留现有行并显示居中的「更新中…」遮罩与 `aria-busy="true"`，请求结束后遮罩消失；首次加载仍用骨架行，两者不混用。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03** — 已知列表支持字段筛选，当用某一列的筛选器选定值，则列表按该值重新请求并回到第 1 页，列头筛选图标显示为激活态；工具栏出现「清除全部条件」，点击后清空搜索与全部字段筛选并恢复全集，该按钮随之消失；筛选后无结果时显示「没有匹配的结果」而不是「暂无数据」。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-04** — 已知列表有可选字段（就绪数、镜像、端口、NTP 偏移、GPU/显存用量等），则列头提供可键盘聚焦的说明按钮，悬浮/聚焦显示该字段的单位与口径；点击该按钮不触发排序。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-05** — 已知数据尚未到达（首次加载、翻页、改排序），则列表显示骨架行而不是空白或遮罩；已知已有行、正在重取（点刷新、改筛选），则行保留不动并显示居中「更新中…」遮罩与 `aria-busy="true"`，请求结束后遮罩消失；两种画面不会同时出现，遮罩外观与图表页同款。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-06** — 已知图表区域尚未有数据，则显示与图表同高的骨架（轴刻度条 + 脉冲带 + 基线），**不**显示空坐标轴、也不把骨架叠在图表上方；已知图表已有曲线、读者点刷新，则曲线保留并加半透明遮罩；页面定时自动刷新时**不出现**遮罩。自动轮询的页面若不遮罩，读者只能看到曲线平滑过渡。

## 设计目标

- 四项行为在共享层实现，页面只声明数据；页面不能只接一半。
- 标准可被静态检查：漏接一项应让契约套件失败，而不是靠人逐页看。
- 不改变任何一页的默认列集合与排序（默认值属于用户可见契约）。

## 约束与边界

- 固定列必须声明显式 `width`：`ResourceList` 会忽略没有宽度的 pin（宽度随内容变化会让固定看起来像故障）。
- 固定首列与可隐藏互斥：pin 列不进入「显示列」菜单。
- 固定尾列由 `ResourceList` 在声明 `rowActions` 时自动追加，页面不需要也不应该自己加。
- 「清除全部条件」只在有筛选条件时出现，位置固定在刷新按钮之后、批量动作之前，避免它出现时推动搜索框。
- 刷新遮罩只在「有行 + 正在重取」时出现；首次加载用骨架行。
- 加载/刷新的画面只有共享层一份实现：页面里不出现 `backdrop-blur-[1px]`、`animate-pulse rounded-ai-md bg-ai-surface-2` 或写死的「更新中…」。
- 列头说明按钮是真实控件（`<button>` + tooltip），不是 `title` 属性。

## UI 交互设计

- 工具栏顺序：字段筛选（非列字段，如项目范围）→ 搜索 → 显示列（图标按钮，hover 显示说明）→ 刷新 → 清除全部条件 → 右对齐的批量动作与主操作。
- 字段筛选挂在列头：单选项选中后立即关闭浮层；多选保持打开。
- 固定首列背景比普通行更突出，固定尾列只比普通行略突出；表头与相邻表头同色。
- 列头说明按钮 24px 盒子（触控下限），悬浮与聚焦都显示。

## 文案与校验

- 「显示列」「恢复默认列」「刷新」「清除全部条件」「清除{列名}」复用既有文案键。
- 筛选后空态：「没有匹配的结果」+「清空搜索与筛选」；真空态：「暂无数据」+ 页面自定义标题与说明。
- 列头说明按字段写清单位与口径（例如「已用 / 总量；已分配是调度器口径」）。

## 边界情况

- 表格宽度小于容器：`w-max min-w-full` 让窄表仍铺满容器，不出现半张表。
- 视口收窄到 `hideBelow` 断点：被折叠的列不参与固定与筛选，固定列仍可见。
- 只有一列可隐藏、或全部列都不可隐藏：列选择器只剩「恢复默认列」，不隐藏标识列。
- 刷新过程中切换筛选：以最后一次请求的结果为准，遮罩随查询结束消失。
- 存储的列选择包含已不存在的列 key：忽略未知 key，不影响固定列。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01** — 所有列表页的身份列 `pin: 'start'` 且带显式宽度；行操作列由共享层自动 `pin: 'end'`。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02** — 刷新入口统一由 `useListRefresh` 提供，同时给出 `refresh`、`onRefresh` 与 `refreshing`，页面不得只接其中一部分。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03** — 字段筛选使用 `ListFilter.column` 挂在对应列头；工具栏只保留跨字段控件（项目范围、搜索）。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-04** — 「清除全部条件」文案由 `useListRefresh(...).filterLabels` 注入，所有带筛选的列表都具备该入口。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-05** — 可排序表头三态循环（升序 → 降序 → 回到页面默认排序），服务端列表必须传排序键。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-06** — 列表与图表的加载/刷新画面只来自共享层：`ResourceList` 的 `loading` / `refreshing`、`ChartPanel` 的 `state` + `manualRefresh`、`RefreshVeil` 与 `ChartSkeleton`；页面不自行实现遮罩或整块骨架。用法正文见 [`packages/ai-kit/README.md`](../../../packages/ai-kit/README.md#加载态与刷新态)。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01** — 契约套件对「缺固定列 / 缺宽度 / 缺刷新反馈 / 缺清除全部条件」四类漏接各有一条失败断言，且当前全站列表均通过。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02** — 未做任何筛选时，各页表头与列顺序与接线前一致。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03** — 任取一列表与一图表页，慢网下首屏骨架与图表/表格的容器高度相等（差值 0），且刷新遮罩的外观与句柄一致。

## 明确不做

- 不做列宽拖拽与列顺序拖拽。
- 不做多字段同时排序（同一时刻只有一个排序键）。
- 不把面板型表格（节点排行、GPU 分配面板）当作列表页套用工具栏与固定列规则：它们嵌在卡片里，没有独立的行身份与工具栏。
- 不为「显示列」引入服务端持久化，选择只存 localStorage。

## 假设

- `ResourceList` 的 `pin` / `hint` / `refreshing` / `ListFilter.column` 接口保持稳定。
- 各列表页的身份列 key 稳定（`name` / `username` / `summary` / `nodeName`）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02`
