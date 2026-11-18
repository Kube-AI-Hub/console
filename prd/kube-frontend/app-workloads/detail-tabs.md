# 详情页页签（L3）

[子模块需求](./_index.md)

## 概述

新 UI 把八种应用负载压在 `WorkloadDetailPage` 一个页面里。本功能点把页面从纵向长页改为页签：概览回答「它是什么」，关联容器组 / 修订版本 / 事件 / 元数据分别回答「它跑出了什么」，容器组的调度信息 / 监控 / 容器 / 环境变量分别回答「它落在哪、用量多少、里面跑什么、配置了什么」。页签只做视觉分层，数据获取与刷新仍在页面顶层完成。

老 console 的部署详情有 6 个页签、容器组详情 6 个页签（资源状态 / 调度信息 / 元数据 / 监控 / 环境变量 / 事件）；本轮控制器类为 概览 / 关联容器组 / 修订版本（仅部署）/ 事件 / 元数据，容器组补齐为 概览 / 调度信息 / 监控 / 容器 / 环境变量 / 事件 / 元数据——容器组的四个页签是恢复旧页场景，不是新增交互。

## 用户故事

### US1 - 按页签查看详情且切换不重新加载 (Priority: P1)

作为 **项目运维**，我希望 **详情页把概览、关联容器组、修订版本、事件和元数据分到页签里，并默认停在概览**，以便 **不必在一条长页里滚动，切换页签时也不用等数据重新请求**。

**Independent Test**：打开一个部署详情，核对五个页签并逐个切换；再打开一个容器组详情，核对四个页签并从「容器」进入容器详情。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01** — 已知一个部署详情，当打开它，则页签为「概览 / 关联容器组 / 修订版本 / 事件 / 元数据」，默认选中「概览」；点「事件」显示该对象的事件区块，点「元数据」显示标签与注解；已知一个容器组详情，则页签包含「概览 / 容器 / 事件 / 元数据」（完整集合见 AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02），点「容器」后容器行可点进容器详情页；切换页签不重新请求数据。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02** — 已知一个容器组详情，当打开它，则页签为「概览 / 调度信息 / 监控 / 容器 / 环境变量 / 事件 / 元数据」；点「调度信息」显示调度结果区块：已调度时显示「已调度到节点 <node>」与该容器组 PodScheduled 条件的时间，未调度时显示「调度未成功」。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03** — 已知容器组注解里含 GPU 分配，当打开「调度信息」页签，则显示 GPU 分配区块，每个设备一行：设备 uuid 是链接、指向该设备的 GPU 详情页（集群 GPU 列表的单卡页），并在有值时显示厂商、显存、算力百分比；注解里没有 GPU 分配时不显示该区块。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04** — 已知容器组带 status.conditions，当打开「调度信息」页签，则「状态信息」区块显示当前状态，以及 PodScheduled / Initialized / ContainersReady / Ready 四项条件各自的满足与否与明细（状态值、原因、消息、更新时间）；对象里没有的条件不显示。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05** — 已知容器组声明了环境变量，当打开「环境变量」页签，则按容器分卡片（init 容器在前、首个默认展开），每张卡片列出变量名与值；valueFrom 引用 ConfigMap 或 Secret 的显示被引用键的实际值（Secret 解码后）；变量名含 password 或 secret 的值显示「******」；没有环境变量时显示「没有环境变量。」。

## 设计目标

- 页签集合同一处推导（`tabsFor(kind)`），八个资源共用一套规则。
- 页签只切面板：所有查询留在页面顶层，切换页签不发请求、不重置列表。
- 既有 `data-ai-id` 原样保留在对应页签内，已有自动化继续可达。

## 约束与边界

- 页签触发器用 `@kube-ai-hub/ui` 的 `Button` 加 `role="tab"`：页面禁止裸 `<button>`，而 ui 包尚未导出 Tabs。
- 页签不写入 URL：切换页签不改变地址、不产生历史记录。
- 页签集合只由资源类型决定，不随数据加载状态增删。
- 既有区块（如 `deployments-detail:pods`、`pods-detail:events`）只换位置、不改 id。
- 容器组页签的数据来源：调度结果与状态条件读容器组对象的 `spec.nodeName` / `status.conditions`；GPU 分配读注解；环境变量读 `spec.containers[].env` 并按 `valueFrom` 引用补读 ConfigMap / Secret。

## UI 交互设计

页签栏在标题与操作之下。触发器为 Button，`role="tab"` + `aria-selected`，选中态用主题强调色下划线；每组页签是一个 `role="tablist"`。面板 `role="tabpanel"`，只渲染当前选中的那个。

- 部署 / 有状态副本集 / 守护进程集 / 服务：概览、关联容器组、事件、元数据；部署额外有修订版本。
- 任务 / 应用路由：没有「关联容器组」页签（它们没有选择器），因此为 概览 / 事件 / 元数据。
- 定时任务：**运行记录（默认）** / 概览 / 事件 / 元数据——这个页存在就是为了回答「昨晚那次跑成功了吗」，概览里的调度表达式回答不了（见 [详情](./detail.md) 的 DETAIL-08）。
- 容器组：概览、调度信息、监控、容器、环境变量、事件、元数据。
  - 「调度信息」= 调度结果（节点与 PodScheduled 时间）+ GPU 分配（有注解才显示）+ 状态信息（四项条件）。
  - 「监控」= 容器组自身 CPU / 内存趋势，三档窗口（见[详情监控](./detail-monitor.md)）。
  - 「环境变量」= 按容器分卡片，`valueFrom` 解析成实际值。
- 页签内容依赖的数据只在页面顶层取一次：调度信息与状态信息直接读已取到的容器组对象（`status.conditions`、`spec.nodeName`、注解），不额外请求；环境变量的 `valueFrom` 解析会按引用读 ConfigMap / Secret（见「环境变量」页签的契约）。

页签句柄：触发器 `data-ai-id="workload-detail:tab-trigger:<key>"`，面板 `data-ai-id="workload-detail:tab:<key>"`。

## 文案与校验

- 页签名：概览、调度信息、监控、容器、环境变量、修订版本、事件、元数据。
- 调度结果：「调度结果」；已调度「已调度到节点 {name}」+ 调度时间；未调度「调度未成功」；时间缺失显示 `-`。
- GPU 分配：「GPU 分配」；每行「厂商 {v}」「显存 {n} MiB」「算力 {p}%」，缺哪项不显示哪项。
- 状态信息：「状态信息」+「当前状态」；四项条件名 PodScheduled / Initialized / ContainersReady / Ready，满足「已满足」、不满足「未满足」，明细「原因：…」「消息：…」「更新时间：…」。
- 环境变量：「环境变量」；卡片标题「初始化容器 {name}」/「容器 {name}」；掩码「******」；空态「没有环境变量。」；读取失败「引用 {来源}（读取失败）」。
- 元数据页签内区块标题：标签、注解；空态分别为「没有标签。」「没有注解。」。
- 事件页签标题：「事件 (N)」；无事件时「没有记录到事件。」。
- 文案取自 `@kube-ai-hub/locales`：`workloads.detail.tab.*`、`metadata.*`。

## 边界情况

- 页签面板只在选中时渲染，因此非选中页签内的既有区块对 DOM 不可见；自动化必须先点页签。（容器详情页的「监控」面板例外：首次打开后保持挂载、切走只隐藏，避免切回时重新取数。）
- 调度信息：容器组对象里没有 `PodScheduled` 条件时，调度时间显示 `-`；`spec.nodeName` 为空时显示「调度未成功」，即使条件还没写。
- GPU 分配：没有 `*devices-allocated` 注解就不渲染该区块；注解里字段不足四段的设备段被忽略（不是设备，是别的写法）。
- 状态信息：对象里没有的条件不造行；条件有 `status` 但没有 `reason` / `message` 时只显示满足与否与更新时间。
- 环境变量：`valueFrom` 引用的对象读不到（不存在 / 无权限）时显示引用来源而不是空串；变量名含 password / secret 时值显示 `******`（大小写不敏感）。
- 环境变量：没有任何变量时显示「没有环境变量。」；某个容器没有变量时该卡片内显示同一文案，卡片本身仍在。
- 没有容器组：不出现「关联容器组」页签（kind 不支持时本就不出现）。
- 没有容器或修订版本数据时，页签仍存在（kind 支持），面板内不渲染空表。
- 事件接口失败：面板显示「事件不可用。」而不是整页失败。
- 从列表进入详情时默认回到「概览」，不保留上一次会话的页签。

## 明确不做

- 不把页签选择写入 URL，不提供页签深链。
- 不为每个页签单独发请求或单独轮询（环境变量的 `valueFrom` 解析是唯一例外：它读被引用的 ConfigMap / Secret，且只在页面顶层做一次）。
- 不为容器组新增「日志 / 终端」页签：容器级日志与终端在容器详情页，容器组页签不重复提供。
- 不做「按容器展开的 GPU 明细」：GPU 分配按设备一行，容器归属见注解原文。

## 假设

- 页签的内容对同一个对象一次取全，单个页签的数据量不需要分页。
- 页签集合按资源类型静态确定，无需用户配置。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01** — 详情页按资源类型渲染页签，默认「概览」；页签用 Button + ARIA role 实现。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02** — 所有查询在页面顶层执行；切换页签只切换面板，不重新加载数据。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03** — 每个页签面板带稳定 `data-ai-id`，既有区块 id 在页签内保持不变。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04** — 容器组详情提供 调度信息 / 监控 / 容器 / 环境变量 页签；调度信息含调度结果、GPU 分配与状态信息三块，数据全部来自已取的容器组对象。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05** — 环境变量页签按容器分卡片（init 在前、首个展开），`valueFrom` 解析为实际值，password/secret 掩码。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01** — 部署详情五个页签全部可见且默认概览；切换页签不产生新的详情/列表请求。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05`
