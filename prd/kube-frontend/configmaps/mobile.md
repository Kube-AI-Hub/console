# 移动端适配（L3）

## 概述

窄屏不是「能把页面挤进去」，而是主要任务仍能完成：查到目标、执行操作、看到结果。

## 用户故事

### US1 - 作为在手机上巡检的用户，打开列表不左右拖

**Independent Test**：375px 宽打开列表，页面无横向滚动，表格只显示名称与操作列。

### US2 - 作为在手机上的用户，通过抽屉进入模块

**Independent Test**：点击页头左侧按钮打开抽屉，选择「配置字典」后抽屉关闭且页面跳转。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01** — Given 视口宽 375px，When 打开配置字典列表，Then `document.documentElement.scrollWidth` 不大于视口宽，侧栏替换为抽屉，切换按钮命中区域不小于 44×44px。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02** — Given 视口宽 375px 且列表已加载，When 查看表格，Then「键」与「创建时间」列不显示，名称与操作列可见且操作按钮高度不小于 44px。

## 设计目标

- 断点决策集中在框架层：侧栏/抽屉由应用壳决定，页面只负责列折叠。
- 触控目标下限写进组件，不分散到每个页面。

## 约束与边界

- 断点沿用 ai-kit 的 `sm`（640px）与 `md`（768px）。
- 不在窄屏隐藏主操作：折叠的只应是辅助信息列。

## UI 交互设计

| 元素 | 窄屏行为 |
|---|---|
| 侧栏 | 替换为左侧抽屉，由 44px 按钮触发 |
| 工具条 | 搜索框占满一行，按钮换行到下一行 |
| 表格 | 隐藏「键」「创建时间」，保留名称与操作 |
| 表格容器 | 自身横向滚动，`overscroll-x-contain` 防止触发浏览器返回手势 |
| 弹层 | `sm` 以下贴底为 sheet，以上居中（详情与确认均适用） |

## 文案与校验

- 抽屉按钮带 `aria-label="展开或收起导航"`。

## 边界情况

- 平板（768px）：侧栏显示，表格显示「键」列、隐藏「创建时间」列。
- 旋转屏幕：布局按断点重算，抽屉打开状态保留。
- 搜索框聚焦时弹出键盘：输入框最小高度 44px，避免被键盘顶出可视区。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01** — 375px 下不得出现横向滚动。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02** — 窄屏下触控目标不小于 44×44px。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01** — 375 / 768 / 1280 三档截图通过评审。

## 明确不做

- 不做原生手势（左滑删除）。
- 不做平板专用双栏布局。

## 假设

- 目标浏览器支持 `dvh` 单位；不支持时回落到 `vh`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02`
