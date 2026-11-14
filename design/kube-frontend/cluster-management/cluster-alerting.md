# 集群级告警 · 技术方案（L3）

[需求](../../../prd/kube-frontend/cluster-management/cluster-alerting.md)

## 概述

两张集群作用域的告警页。消息页把聚合 API 的两个集合（`clusteralerts`、`globalalerts`）合并成一张表；策略页按所有权拆成两个页签（`clusterrulegroups`、`globalrulegroups`）。读模型复用项目级告警：策略行类型、映射与详情组件都来自 `pages/monitoring/` 与 `api-client` 的规则组实现。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01

## 设计目标与非目标

目标：一个集群页看全在响的告警；两个页签把「我能改的」与「安装器的」分开；消息按时间合并且能下钻。

非目标：集群级策略的创建/编辑/删除、内置策略的编辑/删除、消息删除/静默、策略详情页的告警消息页签；内置启停、reset 与消息详情字段的契约见 write 文档。

## 关键约束

- 告警消息只在 v2beta1 聚合接口：`/kapis/alerting.kubesphere.io/v2beta1/{clusteralerts,globalalerts}`；响应含 `items` 与 `totalItems`。
- 策略在 `/apis/alerting.kubesphere.io/v2beta1/{clusterrulegroups,globalrulegroups}`；K8s list 没有 `totalItems`，条数即数组长度。
- `/apis/.../v2beta1/alerts` 404；v1alpha2 的 `/kapis/.../alerts` 返回 200 空体，不能当作空数据来源。
- 两个消息集合各自分页；合并后的「下一页」需要从两边各取更多数据，因此按 `page × pageSize` 扩大窗口，单来源上限 500。
- 写入（内置启停）与详情白名单的约束、探测结果见 [cluster-alerting-write.md](./cluster-alerting-write.md)；本文只描述读列表、计数与去向下钻。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01 — 消息合并成一张表，来源做成列而不是两个页签

**为什么**：老 console 把消息也分成「自定义策略告警 / 内置策略告警」两个页签，读者要先知道规则归属才能找一条告警。集群级运维的问题是「现在在响什么」，来源是这条消息的一个属性，不是另一个页面；一列就能回答，还能按时间混排。总条数取两个集合的 `totalItems` 之和，与「全集群告警」的定义一致。

**被否方案**：照搬两个页签。会把同一时刻的告警拆到两屏，且默认页签（自定义，当前 0 条）看起来像「集群没有告警」。

**何时重新考虑**：某个来源的条数增长到需要独立检索或独立权限时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-02 — 策略按所有权分页签

**为什么**：`globalrulegroups` 是安装器写入的（本集群 18 个全部 `alerting.kubesphere.io/builtin: true`），`clusterrulegroups` 是管理员自己的集群级策略。两者的问题不同：前者主要是「平台在监控什么」，后者是「我加了什么」；页签把所有权摆在界面上，比在一列里标注更直接，也避免在 18 条内置策略中混入可编辑行。

**被否方案**：合并两集合，按 builtin 标签禁用行操作。行操作可见性会随数据变化，读者仍要逐行判断；页签先给出分类，再给出操作。

**何时重新考虑**：出现大量非内置的集群级策略、需要在一个列表里排序检索时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-03 — 复用项目级的规则组读模型与详情组件

**为什么**：`api-client` 已有 `toRuleGroupSummary` / `toRuleGroupDetail` / `ruleGroupsApi.get` 与 `RuleGroupBody`。集群页与项目页的差别只是作用域与入口：字段、状态语义、规则表都相同。新增 `ruleGroupsApi.listScope({scope})` 读取单集合，页面直接把 `RuleGroupBody` 放进弹窗；不复制一份映射，否则「规则数」「启用状态」的判定会在两页漂移。

**被否方案**：为集群页写一套 `ClusterPolicySummary` 映射。字段完全重复，且 `builtin`/enable 标签的读取逻辑要维护两份。

**何时重新考虑**：集群级策略出现项目级没有的字段（例如安装器版本）时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-04 — 合并消息的取数窗口与前端切页

**为什么**：两个集合各自分页，一次请求无法给出「全集群按时间排序的第 2 页」。页面在第 N 页时从两边各取 `N × pageSize` 条并按 `activeAt` 倒序合并，再切出第 N 页；`totalItems` 相加用来渲染总数与 `min(20,total)` 的首页。当前合计约 98 条，窗口足够。

**被否方案**：只取两边各一页再拼接。第 1 页会漏掉其中一边更早的条目，第 2 页无法保证顺序；或者先分页再合并在 UI 上表现为「翻页后行数变少」。

**何时重新考虑**：任一集合超过 500 条，或聚合 API 支持跨集合分页时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-05 — 消息页不做删除

**为什么**：告警消息由告警控制器的评估结果派生；在控制台删除一条正在触发的告警不会改变评估条件，它会在下一次评估后重新出现。老 console 的集群消息页也没有删除动作。项目级消息页保留删除是因为历史消息在那里被视为可清理的记录；集群页本期不提供，避免「删了又回来」被当成缺陷。

**被否方案**：复用项目级删除端点（v1alpha2 `alerts` 的 delete）。该组在本集群返回空体，删除目标不明确。

**何时重新考虑**：告警 API 提供明确的静默/删除语义时。

## 系统现状

老 console 的集群告警直接复用项目容器：`projects/containers/Alerting/{Messages,Policies}`，用 `klusters/<cluster>` 前缀与「有无 namespace」切换作用域。消息页与策略页各有两个页签；策略页列名称、策略状态、规则状态、耗时与最近检测时间，内置页签可启停与恢复默认。本实现保留消息字段与策略字段语义，改为：消息合并 + 来源列；策略两页签。内置启停、reset 与消息下钻的实测与决策见 write 文档。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterAlertingMessagesPage.tsx`、`ClusterAlertingPoliciesPage.tsx`、`alertingHelpers.ts`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/{alerting-messages,alerting-policies}/`
- 接口：`packages/api-client/src/alerting.ts` 的 `clusterAlertMessagesApi`、`toClusterAlertSummary`、`ruleGroupsApi.listScope`
- 复用：`pages/monitoring/RuleGroupsPage.tsx` 导出的 `RuleGroupBody`
- 区域注册：`areas/registry.ts`（`nav.groupMonitoring`，Lead 预置）

## 对外契约

| 用途 | 路径 | 方法 | 实测 |
| --- | --- | --- | --- |
| 自定义集群消息 | /kapis/alerting.kubesphere.io/v2beta1/clusteralerts | GET | 200，`{items,totalItems}`；host 当前 totalItems=0 |
| 内置全局消息 | /kapis/alerting.kubesphere.io/v2beta1/globalalerts | GET | 200，`{items,totalItems}`；host 约 96–98 条 |
| 自定义策略 | /apis/alerting.kubesphere.io/v2beta1/clusterrulegroups | GET | 200，`{items}`；host 当前 0 条 |
| 内置策略 | /apis/alerting.kubesphere.io/v2beta1/globalrulegroups | GET | 200，`{items}`；host 18 条，均 builtin |
| 策略详情 | 同上 + /<name> | GET | 200 |
| 告警消息（错误来源） | /apis/alerting.kubesphere.io/v2beta1/alerts | GET | 404 |
| 告警消息（旧组） | /kapis/alerting.kubesphere.io/v1alpha2/alerts | GET | 200 空体 `{}`，不可用 |

消息字段映射（实测一条 `globalalerts`）：

| 列 | 来源 |
| --- | --- |
| 消息标题 | annotations.summary |
| 消息正文 | annotations.message（缺省 annotations.description） |
| 状态 | state（`firing` / `pending`） |
| 级别 | labels.severity（`critical` / `warning` / `info`） |
| 所属策略 | labels.rule_group |
| 来源 | 所读集合（clusteralerts → custom，globalalerts → builtin） |
| 触发时间 | activeAt |

列表只渲染这些列；下钻详情的字段与 labels/annotations 白名单见 write 文档。

## 不变量

1. 策略页签计数 = 对应集合的数组长度；两页签各自独立，一个为空不影响另一个。
2. 消息首屏行数 = `min(20, clusteralerts.totalItems + globalalerts.totalItems)`。
3. 页面句柄固定：`cluster-alerting-messages:surface`、`cluster-alerting-policies:surface`、`cluster-alerting-policies:tab:{custom,builtin}`。
4. 来源取自所读集合，不取 `labels.rule_type`。

## 已知坑

- **v1alpha2 空体不是空数据**：`/kapis/alerting.kubesphere.io/v1alpha2/alerts` 返回 200 `{}`，项目级告警页当前读的就是它；集群页必须用 v2beta1 的 `clusteralerts`/`globalalerts`，否则页面永远为空。
- **`/apis` 下没有 alerts 资源**：列表请求会 404，别把「资源不存在」当成「告警模块未安装」。
- **`labels.rule_type` 不可作来源判据**：实测全局告警的该标签也可为 `custom`。
- **消息没有对象名**：告警名会重复，行 key 用来源 + 序号 + alertname 组装。
- **合并分页**：只取一边一页会导致第 1 页顺序错误、第 2 页缺行；必须按请求页扩大两边窗口再合并。
- **内置策略没有 totalItems**：K8s list 的条数即数组长度；不要照抄消息页的 totalItems。

## 测试与可观测

- E2E：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01.yaml` 覆盖两页与计数；消息页按 `min(20,total)` 比对。启停与下钻的用例见 write 文档。
- 可观测点：两个 surface、两个页签句柄、`data-ai-row`、错误面板重试句柄。
- 失败时先看：是否走了 v1alpha2 路径（空体）、页大小是否覆盖计数、页签切换后是否等待了 active query。

## 后续改进

- 集群级自定义策略的创建/编辑/删除（复用项目级写通道，需要集群作用域对话框）。
- 内置策略的编辑/删除（reset 已迁移，见 write 文档）。
- 告警消息按策略名过滤、按级别过滤（服务端检索参数待探测）。
- 策略详情下钻到该策略触发的告警消息。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01
