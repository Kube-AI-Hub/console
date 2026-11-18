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
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04** - 已知容器组列表有数据，当打开容器组页，则除名称/状态/创建时间外还显示「所在节点」与「容器组 IP」两列，其值分别等于该容器组对象的 `spec.nodeName` 与 `status.podIP`（未调度时显示 -）。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05** — 已知容器组列表有数据，当在状态筛选里选「运行中」，则列表只显示状态为运行中的容器组，请求带 status=Running，总数与筛选一致；筛选项完整为「等待中 / 运行中 / 已完成 / 错误」四项；清空筛选后恢复全部。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06** — 已知容器组已调度，当打开容器组列表，则「所在节点」列显示节点名与节点 IP，且是链接到该集群的节点详情；未调度的容器组该列显示「-」且不是链接。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07** — 已知某容器组的容器处于等待或终止并带原因（如 CrashLoopBackOff），当打开容器组列表，则该行状态列在状态徽标之后显示该原因；没有原因的行只显示徽标。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08** — 已知集群作用域的容器组列表有数据，当在状态筛选里选「运行中」，则列表只显示状态为运行中的容器组（跨命名空间），请求带 status=Running，总数与筛选一致，筛选项完整为「等待中 / 运行中 / 已完成 / 错误」四项；「所在节点」列显示节点名与节点 IP 且是链接到该集群的节点详情，未调度的容器组该列显示「-」且不是链接；清空筛选后恢复全部。

## 设计目标

落实应用负载的「状态只有一处定义」：列表与详情的状态取同一个派生函数。

## 约束与边界

- 服务端分页，每页 10 条；排序键为 `name` 与 `createTime`。
- 搜索按名称下发（kapis 的 `name` 参数），不做本地过滤。
- 容器组的状态筛选走 kapis 的 `status=<Waiting|Running|Completed|Error>`，由服务端按 kubectl 式 `statusType` 过滤；同一端点**不支持** `fieldSelector=status.phase=…`（实测返回 0 条），未知查询键会被当成过滤器导致空表。
- 「所在节点」的节点 IP 取 `status.hostIP`（节点自身地址），不是容器组 IP；两者不同列，不互相替代。

## UI 交互设计

- 名称列两行：别名优先，副行是 `app` 标签；名称是链接。
- 状态用徽章；就绪列显示 `ready/total`。
- 行操作：编辑 YAML、删除；多选后出现批量删除。
- 容器组列表的工具栏在搜索框之前放一个状态筛选（单选下拉），默认「全部状态」，四项与旧 console 同序：等待中、运行中、已完成、错误。选中即重新请求，不本地过滤当前页。项目作用域（`pods`）与集群作用域（`clusters/<cluster>/pods`）两个列表用同一个控件形态与同一组选项。
- 「所在节点」列是链接：显示节点名，节点 IP 以次要色跟在名字后；未调度时该列是纯文本 `-`，不生成链接。
- 状态列两行：徽章在上，状态原因（如 `CrashLoopBackOff`）在下、小一号、次色；没有原因时只有徽章，不留空行。

## 文案与校验

- 表头：名称、状态、就绪、创建时间；容器组另有「所在节点」「容器组 IP」。
- 状态文案：运行中 / 更新中 / 已停止 / 终止中 / 等待中 / 已终止。
- 状态筛选项文案：等待中 / 运行中 / 已完成 / 错误；默认项「全部状态」。
- 状态原因按 API 原文显示（`CrashLoopBackOff`、`ContainerCreating`、`ImagePullBackOff` 等），不做本地化、不加前缀。

## 边界情况

- 空项目：显示空态，不渲染表头。
- 名称很长：截断，悬停看全称。
- 无副本概念的资源不显示就绪列。
- 筛选后没有匹配：显示「无匹配」空态（与真空态文案不同），筛选项仍可改回「全部状态」。
- 未调度的容器组：节点列 `-`，容器组 IP 列 `-`；状态徽标是等待中，原因（若有）另起一行。
- 集群作用域列表：行上多一列所属项目（容器组本身不带工作空间，详情链接要靠这一列）；状态筛选与节点列的行为与项目作用域完全一致，只是范围是整集群。
- 原因与阶段同名（`Running`、`Pending` 这类）时不显示原因——那是废话，只留徽标。
- 节点 IP 缺失（`status.hostIP` 为空）时只显示节点名，链接照旧。

## 明确不做

- 不用 `fieldSelector=status.phase=…` 做状态筛选：kapis 资源代理忽略它（实测返回 0 条），本批改用服务端支持的 `status=`；也不做「多选状态」与「自定义状态值」。
- 不在列表内做容器级原因聚合（列出每个容器的 reason），状态原因只取容器组自身的 kubectl 式原因。
- 不做列显隐与列宽拖拽。
- 不在列表创建负载。

## 假设

- kapis 的 `totalItems` 是切片前总数。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01** — 展示名称、状态、就绪计数、创建时间。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02** — 支持搜索、排序、分页与多选批量删除。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03** — 容器组列表提供四项状态筛选，选中值以 kapis 的 `status=` 下发，清空恢复全集。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04** — 容器组的「所在节点」列显示节点名与节点 IP 并链接到该集群的节点详情；未调度时显示 `-` 且不可点。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05** — 状态列在徽标之后显示容器组的状态原因，没有原因时只显示徽标。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06** — 集群作用域的容器组列表提供同一组四项状态筛选（服务端 `status=`，跨命名空间），节点列链接到该集群的节点详情，未调度显示 `-` 且不可点。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01** — 数据到达前已有骨架，不出现空白页。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02** — 搜索与翻页各只发一次请求。
