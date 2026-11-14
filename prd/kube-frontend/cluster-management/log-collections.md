# 集群日志收集（L3）

[子模块需求](./_index.md)

## 概述

日志能否落库由四个对象决定：收集器（FluentBit）、它的配置、输入（tail 哪些源）与输出（写到哪）。本页只读地摊开这四件事。

收集器 CR 在本集群的 `status` 是空对象（实测），所以「是否真的在跑」由收集器自有的 Pod 回答——这也是运维用 kubectl 看的那一眼。

输出（接收器）按日志组件写在对象上的 `logging.kubesphere.io/component` 标签分成三类：容器日志 / 事件 / 审计。页面用三个页签展示这三类收集项，点名称打开只读详情（属性、匹配与过滤摘要、YAML），与老 console 的三页签 + 详情页对应。

## 用户故事

### US1 - 确认日志真的在收集 (Priority: P1)

作为 **集群管理员**，我希望 **看到收集器是否在运行、有哪些输入与输出**，以便 **排查「日志查不到」是采集没起来还是输出没配上**。

**Independent Test**：打开日志收集页，核对就绪 Pod 数等于 `app.kubernetes.io/name=fluent-bit` 的 Pod 中 Running 数；输入/输出条数等于 CR 条数。

### US2 - 按分类找到接收器并看懂它的匹配规则 (Priority: P2)

作为 **集群管理员**，我希望 **按容器日志 / 事件 / 审计分类查看接收器，并点开某个看到它的匹配规则与原始 YAML**，以便 **判断「这类日志到底写去哪、哪些源被匹配」而不必去翻 CR**。

**Independent Test**：打开日志收集页，依次切到三个页签，每个页签都渲染收集项表头（或该分类的空态）；点第一个收集项名称，详情里能看到属性、匹配规则与只读 YAML。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01** — 已知集群部署了日志收集，当打开集群日志收集页，则收集器显示名称、命名空间、配置、镜像与「就绪 Pod x/y」；输入区逐条列出名称与插件/标签；输出区逐条列出名称、插件、目标地址与 match；三区条数分别等于 fluentbits / inputs / outputs 的 CR 条数；未部署时显示空态。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02** — 已知日志组件为三类日志配置了接收器，当打开集群日志收集页并切换页签，则「容器日志 / 事件 / 审计」三个页签都可见且可切换；每个页签渲染该分类的收集项（名称、状态、匹配规则摘要、类型、创建时间）与采集输入，没有该分类对象时给出明确空态；点第一个收集项名称打开只读详情，显示属性、匹配与过滤摘要以及该对象的只读 YAML；全程不出现任何写操作。

## 设计目标

1. 一屏回答「采集是否在跑、收什么、写哪」。
2. 只读：改管道需要专门的编辑流程与校验，不在本页。
3. 三类日志分开看：页签与日志组件写入的 `component` 标签一一对应，不在前端重新猜分类。
4. 详情要能解释匹配：属性之外给出 match/matchRegex 与该分类的采集输入，外加原文 YAML。

## 约束与边界

- 读 `/apis/logging.kubesphere.io/v1alpha2/{fluentbits,inputs,outputs}`（kapis 下无对应聚合，实测 404）。
- 收集器 Pod 读核心 API（按标签）。

## UI 交互设计

- 页签前是共享的收集器区块（含就绪 Pod 徽标），三个页签共用它。
- 页签：容器日志 / 事件 / 审计；每个页签内先列该分类的**收集项**（名称、状态、匹配规则、类型、创建时间），再列该分类的**采集输入**（名称、插件、标签、来源）。
- 收集项名称可点，打开只读详情弹窗：属性（分类、类型、状态、命名空间、创建时间、地址、索引前缀）、匹配与过滤（match/matchRegex + 该分类输入）、只读 YAML（`<pre>`，不是编辑器）。
- 页签与详情的可观测句柄：`cluster-log-collections:tab:{logging,events,auditing}`、`:row:<name>`、`:yaml`。

## 文案与校验

- 空态：没有部署日志收集器 / 没有配置日志输入 / 没有配置日志输出 / 该分类没有收集项。
- 状态未知：未知；接收器状态取 `logging.kubesphere.io/enabled` 标签（已启用 / 已停用）。
- 详情标题为收集项名称，副标题「收集项详情」；YAML 只读展示原始 CR。

## 边界情况

- 收集器 `status` 为空：不显示伪状态，改用 Pod 就绪数。
- Pod 读不到：徽标显示「未知」，其余区块照常。
- 某个分类没有任何输出：该页签仍渲染表头，并显示「该分类没有收集项」空态，而不是一片空白。
- 某个分类没有输入：在采集输入区写明「该分类没有配置采集输入」，详情里的来源输入同样给出说明。
- 对象缺少 `component` 标签：按容器日志分类展示，不让它消失在页签之外。
- 匹配规则是正则（`matchRegex`）：详情与列表都标注「正则匹配」，不把正则冒充成普通的 tag 匹配。

## 明确不做

- 修改收集器/输入/输出：需要专门的编辑与校验流程。
- 日志全文检索：属工具箱，单独规划。

## 假设

- 日志组件由 `logging.kubesphere.io` 的 CR 描述，且核心 API 可读其 Pod。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01** — 展示收集器与其就绪 Pod 数。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02** — 展示输入与输出清单。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-03** — 按 `component` 标签把输出与输入分到三个页签，每类独立空态。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-04** — 收集项只读详情：属性、匹配/过滤摘要与原始 YAML。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01** — 三区条数与 CR 一致；就绪 Pod 数与 Running 数一致。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02** — 三个页签可切换；每类收集项条数等于该分类标签的输出 CR 条数；详情 YAML 与对象原文一致且只读。