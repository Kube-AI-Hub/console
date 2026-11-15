# 告警策略（L3）

[子模块需求](../../../prd/kube-frontend/monitoring/rules.md)

## 概述

一张 告警策略 页面，两种资源模型：3.3 的 `alertingrules` 与本集群实际使用的规则组（`globalrulegroups` / `clusterrulegroups` / 命名空间级 `rulegroups`）。

## 关联需求

- AC-L3-KUBE-FRONTEND-MONITORING-RULES-01
- AC-L3-KUBE-FRONTEND-MONITORING-RULES-02
- AC-L3-KUBE-FRONTEND-MONITORING-RULES-03
- AC-L3-KUBE-FRONTEND-MONITORING-RULES-04
- AC-L3-KUBE-FRONTEND-MONITORING-RULES-05
- AC-L3-KUBE-FRONTEND-MONITORING-RULES-06

## 设计目标与非目标

目标：读者不必知道集群是 3.3 还是 3.4；开关只动一个标签；规则内容完整可读。

非目标：跨命名空间聚合。项目级自定义策略的创建、编辑与删除已实现，字段契约与决策见 `alerts-write.md`；本文保留与本页读模型直接耦合的三条写决策（DEC-05/06/07）。

## 关键约束

- 读：`/apis/alerting.kubesphere.io/v2beta1/{globalrulegroups,clusterrulegroups}`；选定项目时追加 `/namespaces/<ns>/rulegroups`。
- 写：`alerting.kubesphere.io/enable` 标签，`application/merge-patch+json`。
- 三个来源各自分页，合并后必须在前端切页。

## 方案决策

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-01 — 用 API 组的资源清单探测模型，而不是版本号

**为什么**：本集群是 KubeSphere 3.4，但页面原来读的 `alertingrules` 资源**根本不存在**，于是列表恒为空，而队列里一度把原因写成「告警模块未安装」。`GET /apis/alerting.kubesphere.io/v2beta1` 的 `resources` 列表是「这个资源有没有」的唯一权威答案，一次请求即可。

**被否方案**：解析 `status.kubeSphereVersion` 字符串。版本号说明安装包版本，不说明装了哪些 CRD；同一个版本可以关掉告警模块。

**何时重新考虑**：平台提供统一的告警 API 抽象时。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-02 — 三种作用域合并成一个列表，前端分页

**为什么**：页面是「告警策略」，不是「全局策略」+「集群策略」+「项目策略」三页。三个来源各自分页，直接取第 2 页会得到 3 份「第 2 页」，而页面声称有 10 行。因此先合并、再本地切页。

**被否方案**：三个 tab。读者要先知道规则属于哪一层才能找到它，而规则名通常已经说明了。

**何时重新考虑**：某个来源的规则组数量增长到需要服务端分页（目前 18 + 0 + 0）。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-03 — 启用/停用只 patch enable 标签

**为什么**：规则体很长（`prometheus` 组 18 条，含大段 PromQL），整对象 PUT 会把另一个管理员正在编辑的内容覆盖。旧实现的 `alertingrules` 也是这么做的，这里保持一致。

**被否方案**：PUT 整对象。见上。

**何时重新考虑**：需要一次修改多个元数据字段且要求原子性时。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-04 — 内置规则组只提供启用/停用

**为什么**：本集群 18 个规则组全部带 `alerting.kubesphere.io/builtin: true`，由安装器写入。提供编辑入口会让控制台与安装器各存一份真值，下次升级时才发现分歧。

**被否方案**：照搬老 console 的策略编辑器。老 console 编辑的是 3.3 的自定义策略，本集群没有自定义规则组可验证。

**何时重新考虑**：出现用户创建的自定义规则组（`builtin` 非 true）时，再为其提供编辑。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-05 — 编辑器编辑整条规则列表

**为什么**：写入整体替换 `spec.rules`。只编辑一条规则的话，多规则策略提交就会删掉其余规则；
因此编辑器必须持有整条列表：增删规则、逐条编辑，最后一次性提交。草稿保存在本地，**半成品规则不落到集群**——
告警控制器会立刻开始评估它。

**被否方案**：多规则策略保持只读。安全，但把「项目里有一条多规则策略」变成了不可编辑的对象，
而这类策略恰恰是最需要调整的。

**何时重新考虑**：需要一个支持导入/导出 YAML 的高级规则编辑器时。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-06 — 创建前必须选定项目

**为什么**：规则组是命名空间级资源，「全部项目」视图下没有可写的命名空间。创建按钮只在该视图里有项目时出现，而不是点了再报错。

**被否方案**：创建对话框里再选项目。多一步选择，且容易与列表的筛选冲突。

**何时重新考虑**：需要一个跨项目的批量创建工具时。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-07 — 提交前在客户端校验「至少一条规则」

**为什么**：API **接受空规则列表**，创建出的策略什么也不评估——这是最安静的一种失败。
同时校验告警名与表达式必填、同一策略内告警名唯一（重名会让触发时无法区分是哪条规则）。

**被否方案**：交给服务端报错。服务端不会报错，它只是创建一个空策略。

**何时重新考虑**：告警 API 增加 schema 校验时。

### DES-L3-KUBE-FRONTEND-MONITORING-RULES-05 — 详情是独立路由页，`scope` 用搜索参数携带

**是什么**：列表行「详情」导航到 `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/alertingrules/:name?scope=global|cluster|project`；页面按 `name`+`scope` 调 `ruleGroupsApi.get` 读单对象，再分三段渲染：基本信息、规则（含每条规则状态）、告警消息时间线。

**为什么**：项目列表把 global/cluster/project 三个集合合并成一张表，同一个 name 可能同时存在于两个集合；`scope` 必须由行数据带过去，否则详情会读错对象。详情页承载两个独立数据源（规则对象 + 过滤后的告警消息），各自有 loading/empty/error，弹窗里再套一个带分页的列表会把页面状态压进对话框。

**被否方案**：继续用弹窗（迁移前实现）——消息历史需要自己的分页、空态与失败重试，弹窗会变成一个没有 URL 的页面；用路径段 `/alertingrules/global/:name`——路径会与项目级同名策略冲突且需要复制三份路由。

**何时重新考虑**：创建/编辑也需要可收藏的 URL（导入 YAML、模板选择）时，把编辑也路由化。

### DES-L3-KUBE-FRONTEND-MONITORING-RULES-06 — 每条规则的状态由该策略的活动告警推导

**是什么**：`spec.rules[i].alert` 与活动告警的 `labels.alertname` 匹配：有活动告警且 state=firing → 告警中，state=pending → 待触发；没有匹配 → 正常。活动告警一次读最多 100 条，超过时页面提示「只读入了前 N 条（共 M 条）」。

**为什么**：规则组对象只有 `spec.rules`，没有 3.3 `alertingrules` 的 `status.rulesStatus`。读者要看的是「这条规则现在响不响」，而聚合告警集合正是这个事实的唯一来源；没有匹配时显示「正常」而非 `-`，因为「评估过且未触发」是一个事实，`-` 会把未知和正常混为一谈。

**被否方案**：照抄 `status.rulesStatus`——本资源没有该字段（编造状态比不显示更糟）；不显示状态——旧 console 的规则列表有状态与计数，删掉是能力回退。

**何时重新考虑**：Whizard 为规则组提供 `status.rules` 评估状态时，改用服务端字段并保留告警推导作为交叉校验。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-08 — 详情不用弹窗（承接 DES-05）

**为什么**：见 DES-05。弹窗无 URL、无历史、无法从告警消息反链；详情页可分享、可后退、可分区加载。

**被否方案**：抽屉（Drawer）——抽屉在长规则表 + 分页消息时仍是一个滚动容器，且没有路由。

**何时重新考虑**：只作为列表的快速预览（不替代详情页）。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-09 — 告警消息区服务端过滤，不拉全量再前端过滤

**为什么**：聚合端点支持 `label_filters=rule_group=<name>` 且返回过滤后的 `totalItems`（实测 `globalalerts` 44 → 30）。若先取一页再前端过滤，读者看到「没有告警」其实只是告警不在第 1 页；先全量拉取再过滤会在告警多时把整页拖慢，也让总数不可信。

**被否方案**：前端过滤已取回的行；一次性 `limit=-1` 全量拉取后前端分页。

**何时重新考虑**：端点取消 `label_filters` 支持时，改为按 `rule_group` 的 `fieldSelector` 或专门子资源。

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-10 — 规则表达式不截断，作为「阈值」呈现

**为什么**：PromQL 规则没有独立阈值字段，比较条件就在表达式里；截断会藏掉比较符与阈值，而那正是读者打开详情的理由。列名写明「表达式（含阈值）」，让读者知道阈值不在别处。

**被否方案**：另外解析表达式提取阈值——PromQL 不是正则能安全解析的，解析失败时给出的阈值比不给更危险。

**何时重新考虑**：平台支持结构化阈值（模板规则）并在本页展示时。

## 系统现状

老 console 的告警策略页面向 3.3 的 `AlertingRule`，字段为名称、状态、规则数、最近检测时间。本次迁移保留这些字段语义，并把「最近检测时间」换成「创建时间」——规则组对象没有 `status.lastEvaluation`（那是 alertingrules 的字段），编造一个时间比不显示更糟。

## 仓库落点

- 页面：`apps/console-next/src/pages/monitoring/RuleGroupsPage.tsx`（列表、行操作、`RuleGroupBody` 共享块）、`RuleGroupDetailPage.tsx`（详情页）、`AlertMessagesTimeline.tsx`（消息时间线）、`permissions.ts`（SSAR 门控）、`alertLabels.ts`（状态/级别/作用域文案）；模型分支在 `MonitoringListPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/alertingrules/$name.tsx`（`validateSearch` 校验 `scope`）
- 接口：`packages/api-client/src/alerting.ts`（`ruleGroupsApi` / `alertingModel` / `alertMessagesApi` / `toRuleGroupSummary` / `toRuleGroupDetail`）
- 查询：`apps/console-next/src/pages/monitoring/queries.ts`（`useAlertingModel` / `useAlertMessages`）
- 文案：`packages/locales/src/index.ts`（`monitoring.ruleGroups.*`）

## 对外契约

| 用途 | 路径 | 方法 |
| --- | --- | --- |
| 规则组列表（全局/集群） | /apis/alerting.kubesphere.io/v2beta1/{globalrulegroups,clusterrulegroups} | GET |
| 规则组列表（项目） | /apis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/rulegroups | GET |
| 单个规则组 | 同上 + /<name> | GET |
| 启用/停用 | 同上 + /<name>，body 只含 metadata.labels | PATCH (merge-patch+json) |
| 模型探测 | /apis/alerting.kubesphere.io/v2beta1 | GET |
| 创建 / 编辑 / 删除项目级策略 | /apis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/rulegroups[/<name>] | POST / PUT / DELETE（详见 `alerts-write.md`） |
| 策略的活动告警（详情消息区） | /kapis/alerting.kubesphere.io/v2beta1/{globalalerts,clusteralerts,namespaces/<ns>/alerts}?label_filters=rule_group=<name> | GET |

### CON-L3-KUBE-FRONTEND-MONITORING-RULES-01 — 详情路由契约

`GET /kube-frontend/:workspace/clusters/:cluster/projects/:namespace/alertingrules/:name?scope=global|cluster|project`；`scope` 缺失或非法时按 `project` 处理。页面按 scope 读 `/apis/alerting.kubesphere.io/v2beta1/{globalrulegroups|clusterrulegroups|namespaces/<ns>/rulegroups}/<name>`。该 URL 可分享、可刷新；`scope` 变更意味着换了一个对象，不是同一对象的过滤。

### CON-L3-KUBE-FRONTEND-MONITORING-RULES-02 — 按策略读活动告警

`GET /kapis/alerting.kubesphere.io/v2beta1/{globalalerts|clusteralerts|namespaces/<ns>/alerts}?label_filters=rule_group=<name>&page=1&limit=10&sortBy=activeAt&ascending=false` → `{items: [{activeAt, annotations, labels, state, value}], totalItems}`。`totalItems` 是过滤后的总数，分页以它为准；行键由页面合成（`scope:index:alertname`），不依赖不存在的对象名。

## 不变量

1. 规则数 = `spec.rules` 长度。
2. 开关只改 `alerting.kubesphere.io/enable`，不改 `spec`。
3. 没有该标签的规则组视为启用（与旧模型一致：没被关掉就是开着的）。
4. 「全部项目」不列出项目级规则组，并在界面上说明。
5. 策略状态筛选作用于合并后的全集：先过滤再切页，分页总数等于过滤后的集合大小。

### INV-L3-KUBE-FRONTEND-MONITORING-RULES-01

规则表的行数恒等于 `spec.rules` 长度；空规则列表只渲染「该规则组没有规则」，不渲染空表头。

### INV-L3-KUBE-FRONTEND-MONITORING-RULES-02

告警消息区的「共 N 条」恒等于同次过滤请求的 `totalItems`；行数等于 `min(N, 10)`；页数为 `max(1, ceil(N/10))`。

### INV-L3-KUBE-FRONTEND-MONITORING-RULES-03

规则状态只可能是「告警中 / 待触发 / 正常」三词之一；无匹配告警时不得显示 0 或空。

### GOT-L3-KUBE-FRONTEND-MONITORING-RULES-01

以为 `ruleCount` 就是规则行数、或把活动告警条数当规则数：前者读 `spec.rules.length`，后者按 `labels.alertname` 去重。

### GOT-L3-KUBE-FRONTEND-MONITORING-RULES-02

期望详情第一帧就有数据：详情与消息是两次请求，规则状态列在活动告警返回前显示「正常」——这是 fail-open 的展示，不是数据错；测试应等 `alertingrules:detail` 的 `data-ai-state=ready` 再断言。

### GOT-L3-KUBE-FRONTEND-MONITORING-RULES-03

在 3.3 模型（`alertingrules`）上断言详情页：该模型没有 `scope` 与聚合告警集合，页面走旧分支（弹窗）。详情页测试只对 `rulegroups` 模型成立，用例以 API 组探测结果决定是否 skip。

## 已知坑

- **资源名不等于功能名**：3.4 没有 `alertingrules`。按名字读会得到 200 空体，看起来像「模块未安装」——这是本项目把队列里一项功能误判为环境阻塞的直接原因。
- **`status.lastEvaluation` 不存在**：规则组没有该字段，照抄旧列会显示 `-`，改显示创建时间并在此记录。
- **severity 在规则体顶层**，不在 `labels` 里（个别规则两处都有，读取时先顶层后 labels）。
- **合并分页**：不做前端切页时，第 2 页会因为三个来源各自返回第 2 页而看起来「丢了行」。
- **PATCH 到 kapis 不行**：这些资源只在 `/apis/` 下可写。
- **告警集合只能是 `/kapis`**：`GET /apis/alerting.kubesphere.io/v2beta1/alerts` 返回 404；项目消息与策略消息都必须走 `/kapis/alerting.kubesphere.io/v2beta1` 下的聚合集合（2026-11-15 实测）。
- **一条规则可对应多条告警**：指标规则按 pod/container 展开，同一 `alertname` 会有多条记录。规则状态按 `alertname` 归并，不能把告警条数当规则数。
- **活动告警数量会变**：实测同一过滤条件在数分钟内从 17 条变到 30 条。用例不能写死总数或首条内容，必须以同次响应或页面自身总数对账。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/monitoring/TC-L3-KUBE-FRONTEND-MONITORING-RULES-0{1..6}.yaml`
可观测点：列表 `alertingrules:surface` / `:search`；详情 `alertingrules:detail`（`data-ai-state`）、`:detail:attributes`、`:detail:rule-table`、`:detail:messages`（`data-ai-state`、`:messages:total`、`:messages:empty`、`:messages:error`、`:messages:retry`、`:messages:prev`、`:messages:next`）、`:detail:edit` / `:detail:delete` / `:detail:toggle` / `:detail:back`；行菜单 `monitoring-alerts:detail`。

## 后续改进

- 编辑 YAML / 导入导出策略（见 `alerts-write.md` 的后续改进）。
- 告警消息行到具体工作负载/节点的下钻链接（需要 labels→资源路由映射，当前只显示 `namespace/resource` 文本）。
- 规则级状态在活动告警超过 100 条时的完整读取（服务端分页或按规则查询）。

## 验收用例

- TC-L3-KUBE-FRONTEND-MONITORING-RULES-01
- TC-L3-KUBE-FRONTEND-MONITORING-RULES-02
- TC-L3-KUBE-FRONTEND-MONITORING-RULES-03
- TC-L3-KUBE-FRONTEND-MONITORING-RULES-04
