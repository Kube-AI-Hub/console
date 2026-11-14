# 详情页页签（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/detail-tabs.md)

## 概述

空降在共用详情组件 `WorkloadDetailPage` 上的页签层：`tabsFor(kind)` 推导页签集合，页签栏用 ui 包的 Button + ARIA role，六个面板按选中项渲染。数据获取全部留在页面顶层，页签只决定渲染哪一块。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01

## 设计目标与非目标

目标：把部署详情的五个页签、容器组详情的四个页签做进共用组件；切换页签不重新加载数据；既有 `data-ai-id` 保持可达。

非目标：不做页签深链（不写入 URL）；不为页签单独取数；不新增日志/终端页签。

## 关键约束

- 页面禁止裸 `<button>`；`@kube-ai-hub/ui` 当前没有导出 Tabs，触发器只能用该包的 `Button` 加 `role="tab"`。
- 所有查询（详情、容器组、修订版本、事件、自动伸缩、任务执行记录）必须留在页面顶层；挪进页签面板会导致切走即销毁查询、切回重新请求。
- 既有区块 id 不变：`<kind>-detail:pods`、`<kind>-detail:revisions`、`<kind>-detail:events`、`<kind>-detail:event-list` 等仍在对应页签内。
- 事件按 `involvedObject.name` + `involvedObject.kind` 过滤；容器组不是唯一有事件的资源。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01 — 页签集合由资源类型推导，数据留在页面顶层

**为什么**：老 console 的部署详情有 6 个页签、容器组详情 6 个页签，而新页面的八个资源共用 `WorkloadDetailPage`。若把「哪些页签」写进 JSX，就会出现八处分支；改为 `tabsFor(kind)` 返回数组，页面只渲染数组，新增资源时只改一个函数。

数据必须留在页面顶层：React Query 的缓存挂在调用它的组件上。如果把 `useWorkloadPods` 之类挪进页签面板，切走再切回就会重新请求，还会重置 15 秒刷新的计时。页签面板只决定「渲染哪一块」，不决定「取什么数据」。

**被否方案**：每个页签一个自带查询的子组件。读数正确，但每次切页签都发一次请求，且容器组列表会在切走时停止刷新——与「切页签不重新加载」的验收点直接冲突。

**何时重新考虑**：某个页签的数据量或刷新频率明显独立于页面（例如事件需要分页或实时流）时，再把它拆成独立子资源，并显式声明自己的缓存策略。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02 — 页签触发器用 Button + ARIA role，而不是等待新组件

**为什么**：`@kube-ai-hub/ui` 的 Tabs 只在 ai-kit 内部存在（`primitives/Navigation.tsx`），没有从 ui 包导出；页面契约又禁止裸 `<button>`。用 ui 包的 `Button` 加 `role="tab"` / `aria-selected`，并让面板带 `role="tabpanel"`，既满足契约，也保留键盘与读屏语义。

**被否方案**：从 `@kube-ai-hub/ai-kit` 直接 import Tabs。绕过了「页面只 import ui 包」的分层，且 Navigation.tsx 的样式与 ui 包的按钮密度不一致。

**何时重新考虑**：ui 包开始导出 `Tabs` / `TabsContent` 时，只换触发器与容器，页签集合与面板不变。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03 — 只有选中页签的面板挂载

**为什么**：六个面板全量渲染会把所有区块塞进 DOM：容器组表每 15 秒刷新，事件列表可能很长，隐藏面板也照样参与重渲染。只挂选中面板让「切页签」成为一次正常的卸载/挂载，数据仍在 React Query 缓存里，因此不会重新请求。

**代价（已知坑）**：非选中页签里的既有区块在 DOM 中不存在，直接找区块的旧用例会失败。本轮已同步更新用到容器组、修订版本、事件区块的四条用例（PODS_BLOCK / REVISIONS / POD_EVENTS / SERVICE_PODS），先点页签再断言。

**被否方案**：全部挂载再用 `hidden` 藏起来。DOM 体积与重渲染代价都更高，而且 `to_be_visible` 仍然为假，旧用例一样要改。

**何时重新考虑**：页签数量或面板重量增长到「初始化一个页签明显卡顿」时，再考虑懒加载面板内容。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04 — 事件读取抽成 `objectEventsApi`，容器组复用

**为什么**：控制器页签的「事件」是对象自身的事件（部署的滚动更新、调度失败都会记在 Deployment 上），不是它某个 Pod 的事件。Kubernetes 没有按对象取事件的端点，只能用 `involvedObject.name` + `involvedObject.kind` 过滤命名空间事件集合。把这段映射抽成 `objectEventsApi`，`podEventsApi` 变为 `kind='Pod'` 的薄封装，两条路径共用同一套字段归一化与排序。

**被否方案**：控制器事件聚合它所有 Pod 的事件。要按 Pod 逐个请求（N 次），而且答的是「Pod 怎么了」而不是「这个部署怎么了」。

**何时重新考虑**：事件接口支持按对象或按 UID 查询时，改为单次精确请求。

## 系统现状

老 console 每个资源各有一份 Detail 目录，结构相同、字段不同；部署详情在旧 console 里已有 概览 / 容器组 / 修订版本 / 事件 / 元数据 等页签。新 UI 此前把所有区块纵向堆在共用详情页里，本功能点补上页签层但不改数据层。

## 仓库落点

- `apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx`：`tabsFor`、`TAB_LABEL_KEYS`、页签栏与六个面板
- `packages/api-client/src/workloads.ts`：`objectEventsApi`（`podEventsApi` 复用）
- `packages/locales/src/index.ts`：`workloads.detail.tab.*` 与 `metadata.*` 键（共享文件，由 Lead 补齐）

## 对外契约

- 页签触发器：`data-ai-id="workload-detail:tab-trigger:{overview|pods|revisions|containers|events|metadata}"`
- 页签面板：`data-ai-id="workload-detail:tab:{...}"`，只渲染选中项
- 既有区块 id 不变：`<kind>-detail:pods`、`<kind>-detail:revisions`、`<kind>-detail:events`、`<kind>-detail:event-list`、`<kind>-detail:containers`、`<kind>-detail:labels`、`<kind>-detail:annotations`

## 不变量

- 页签集合只由 kind 决定，与数据是否加载完成无关（避免页签在加载完成后跳出来）。
- 切换页签不发起新请求、不重置查询缓存；同一份数据在页签间共享。
- 每个页签面板带稳定 `data-ai-id`，且至少包含一个既有区块或空态文案。
- 默认页签恒为「概览」。

## 已知坑

- 非选中页签不渲染面板：直接找 `deployments-detail:pods` 等区块的旧用例必须先点页签。
- 页签文案的 locale 键由 Lead 在共享 locale 文件补齐（`workloads.detail.tab.*`、`metadata.*`）；新增页签时必须先加键，否则 t() 会显示裸键。
- `activeTab` 是本地状态：路由参数变化（切换到另一个同类对象）不会重置它，页面在面板渲染前会做一次「是否属于当前页签集合」的回退。

## 测试与可观测

- E2E：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01`（部署五页签、事件/元数据面板、容器组四页签、容器行进入容器详情）。
- 回归：`tests/ui/tests/kube-frontend/app-workloads/` 下既有用例（已同步四条页签相关定位）。
- 页签句柄同时是 agent 的观测点：点触发器 → 断言面板可见，不需要等待网络。

## 后续改进

- 从 `@kube-ai-hub/ui` 导出 Tabs/TabsContent，替换手写触发器。
- 页签可深链（`?tab=events` 或路由子段），刷新/分享后仍停在同页签。
- 面板内数据明显独立时，按 DEC-...-DETAIL_TABS-01 的「何时重新考虑」拆成独立子资源。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01`
