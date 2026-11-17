# 集群级告警（L3）

[子模块需求](./_index.md)

## 概述

集群作用域的两张告警页，对应老 console「集群 → 监控告警」下的**告警消息**与**告警策略**：

- **告警消息**：把 `clusteralerts`（自定义集群策略触发）与 `globalalerts`（内置全局策略触发）合并成一张表，用「来源」列区分；每页 20 条。
- **告警策略**：两个页签。**自定义策略** 读 `clusterrulegroups`；**内置策略** 读 `globalrulegroups`。内置策略由安装器维护，页面展示其状态与详情。

字段来自实测的 v2beta1 聚合响应：消息行的标题是 `annotations.summary`、正文是 `annotations.message`（或 `annotations.description`）、状态是 `state`、级别是 `labels.severity`、所属策略是 `labels.rule_group`、规则类型是 `labels.rule_type`、触发时间是 `activeAt`；策略行的字段沿用项目级告警策略的规则组模型（名称、描述、启用状态、规则数、创建时间）。

启停写入与消息下钻的字段契约、探测结论与决策见 [cluster-alerting-write.md](./cluster-alerting-write.md)。

## 用户故事

### US1 - 在集群视角看全告警，而不必逐个项目点进去 (Priority: P1)

作为 **集群管理员**，我希望 **在一个集群页面上看到当前所有在响的告警，并区分哪些来自自定义策略、哪些来自平台内置策略**，以便 **判断这次告警是不是平台自带规则发出的，以及自定义策略是否已经生效**。

**Independent Test**：打开集群告警消息页，首屏行数等于 `min(20, clusteralerts.totalItems + globalalerts.totalItems)`，「来源」列同时能出现自定义与内置；打开集群告警策略页，自定义页签行数等于 `clusterrulegroups` 条数、内置页签行数等于 `globalrulegroups` 条数。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01** — 已知在 host 集群（`globalrulegroups` 有 18 个内置策略、`clusterrulegroups` 当前为空），当打开集群告警策略页，则默认「自定义策略」页签，行数等于 `clusterrulegroups` 的 API 条数；切到「内置策略」页签后行数等于 `globalrulegroups` 的 API 条数（页大小为 50，覆盖当前计数）；当打开集群告警消息页，则列出 `clusteralerts` 与 `globalalerts` 合并后的消息，首屏行数等于 `min(20, clusteralerts.totalItems + globalalerts.totalItems)`，并显示消息、状态、级别、所属策略、来源与触发时间。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-02** — 已知集群告警消息页有消息，当在「状态」筛选里选「告警中」或「待触发」，则两个集合的请求都带上 `state` 参数，列表只显示该状态的消息、首屏行数等于该状态下的条数；当在「级别」筛选里选「严重/错误/提示」，则请求带上 `label_filters=severity=<值>`，列表只剩该级别；两个筛选可叠加，切换筛选时回到第 1 页；点「全部状态/全部级别」回到未过滤。筛选在**服务端**执行——集合是分页的，只在前端过滤等于只过滤碰巧取到的那一页。

## 设计目标

1. 集群页只回答两个问题：现在在响什么（消息）、有哪些策略（分类计数）。
2. 两页复用项目级告警的读模型与详情组件，不新增一套字段映射。
3. 本页负责列表与详情展示；内置策略启停与消息下钻的写/读契约、探测结论见 [cluster-alerting-write.md](./cluster-alerting-write.md)。

## 约束与边界

- 告警消息只能读 v2beta1 聚合接口：`/kapis/alerting.kubesphere.io/v2beta1/clusteralerts` 与 `.../globalalerts`，响应为 `{items,totalItems}`，字段见概述。
- 告警策略读 `/apis/alerting.kubesphere.io/v2beta1/clusterrulegroups` 与 `.../globalrulegroups`（K8s list，没有 `totalItems`，条数即数组长度）。
- `/apis/alerting.kubesphere.io/v2beta1/alerts` 不存在（实测 404）；v1alpha2 的 `/kapis/.../alerts` 在本集群返回 200 空体 `{}`——空体不是「没有告警」，是读错了 API 组。
- 消息页两个来源各自分页，页面先把两边的首页取回、按 `activeAt` 倒序合并再切页；单来源最多取 500 条，超过该窗口的分页不再可达（当前合计约 98 条）。
- 集群级自定义策略的写入（创建/编辑/YAML/删除/批量启停）与详情页、列表状态列/筛选见 [cluster-alerting-write.md](./cluster-alerting-write.md)；本文件只描述读列表与消息筛选的读模型。
- 内置策略启停写 `alerting.kubesphere.io/enable` 标签；消息详情的 labels/annotations 只渲染白名单键。两条约束的探测证据、请求体与键清单见 [cluster-alerting-write.md](./cluster-alerting-write.md)。

## UI 交互设计

- 告警消息：表格列「消息（标题 + 正文）」「状态」「级别」「所属策略」「来源」「触发时间」；点击消息标题（或行操作「详情」）打开下钻弹窗；无删除。
- 下钻弹窗：先属性（名称、摘要、消息、状态、级别、所属策略、规则类型、来源、监控目标、触发时间、当前值），再「标签摘要」「注解摘要」两段白名单键值；不展示原始对象。
- 告警策略：页签「自定义策略 / 内置策略」，页签上带计数；列「名称（别名/对象名/副行描述）」「策略状态」「规则状态」「耗时」「最近检查」「规则数」「创建时间」；工具条有搜索、策略状态与规则状态筛选、显示列与刷新，分页档位 10/20/50/100。行操作「详情」（进入独立详情页）+「启用 / 停用」（互斥显示）；自定义行还有「编辑」「编辑 YAML」「删除」，内置可恢复行有「恢复初始配置」。内置页签顶部显示「内置策略由平台安装；启用/停用写入规则组的 enable 标签」提示。
- 页面句柄：`cluster-alerting-messages:surface`、`cluster-alerting-messages:open`、`cluster-alerting-messages:detail`、`cluster-alerting-messages:detail:labels`、`cluster-alerting-messages:detail:annotations`、`cluster-alerting-policies:surface`、`cluster-alerting-policies:tab:custom`、`cluster-alerting-policies:tab:builtin`、`cluster-alerting-policies:enable`、`cluster-alerting-policies:disable`。

## 文案与校验

- 页签：自定义策略 / 内置策略。
- 空态：暂无集群告警消息（规则组当前没有触发中的告警）；暂无告警策略（该分类下没有策略）。
- 内置策略状态与类型沿用「已启用 / 已停用」「内置 / 全局」文案。
- 消息状态：告警中 / 待触发 / 已恢复；级别：严重 / 警告 / 提示。
- 详情字段：规则类型 / 当前值 / 标签摘要 / 注解摘要；键值缺失显示 `-`，空摘要段显示 `-`。
- 内置页签提示：内置策略由平台安装；启用/停用写入规则组的 enable 标签，与老 console 一致。

## 边界情况

- 两个消息来源都为空：显示空态，不显示错误面板。
- 只有一个来源有数据（当前 `clusteralerts` 为 0、`globalalerts` 非空）：合并列表照常显示有数据的一侧。
- 告警消息在两次取数之间被新建/恢复：`totalItems` 变化，首屏仍取 20 条；行数是 `min(20, total)`，不假设固定值。
- 策略某一页签为空：该页签显示空态，另一个页签不受影响。
- 读接口失败：显示错误面板与重试，不把失败渲染成空态。
- 消息没有 labels/annotations（或白名单键都为空）：详情仍打开，摘要段显示 `-`，不报错。
- 内置策略启停返回 403/409/422：对话框/列表不动，页面顶部显示归一后的错误（MutationAlert），状态徽章保持原值并允许重试。
- 启停后列表刷新前读到旧值：以 query invalidate 后的回读为准；徽章最终与标签一致。

## 明确不做

- **模板规则构建器**：见 [cluster-alerting-write.md](./cluster-alerting-write.md) 的明确不做；列表只展示名称、状态、规则数与时间。
- **内置策略的编辑 / 删除**：编辑/删除仍属安装器。启用/停用与 reset 的契约见 write 文档（reset 基于 `alerting.kubesphere.io/initial-configuration` 注解）。
- **详情展示原始对象 / 审计字段**：详情只渲染白名单 labels 与 annotations；不提供 YAML、事件或审计日志视图。
- **告警消息删除 / 静默 / 通知配置**：消息生命周期归告警控制器，控制台删掉也会被重新评估出来。
- **告警消息按策略下钻到详情页**：详情已有弹窗；策略详情页的「告警规则 / 告警消息」双页签未迁移。
- **告警消息的 X 轴过滤之外的高级检索**：本期只有分页回看，不做服务端关键字检索（v2beta1 聚合接口的检索参数未探测到可靠语义）。

## 假设

- 集群已安装告警模块，v2beta1 的 `clusteralerts` / `globalalerts` / `clusterrulegroups` / `globalrulegroups` 均可读。
- 消息来源由所读集合决定（`clusteralerts` → 自定义，`globalalerts` → 内置），不依赖 `labels.rule_type`（实测该标签在全局告警上也可能写 `custom`，不可作为来源判据）。
- `globalrulegroups` 的条数在页大小 50 以内，页签计数与首屏行数一致。
- 内置策略的 enable 标签就是平台的启停开关；消息的 labels/annotations 字段名由告警控制器决定，可能随版本增减。细节见 write 文档。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01** — 集群告警消息页合并两个来源，显示消息、状态、级别、所属策略、来源、触发时间，首屏行数为 `min(20,total)`。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-02** — 集群告警策略页提供自定义/内置两个页签，页签带计数，行数与对应集合条数一致。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-03** — 策略详情弹窗复用项目级的规则组详情。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-04** — 读取失败显示错误面板与重试；空集合显示空态。


## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01** — 策略两页签行数与 API 计数一致（当前 0 / 18）；消息页首屏行数与合并后的 `min(20,total)` 一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01`
