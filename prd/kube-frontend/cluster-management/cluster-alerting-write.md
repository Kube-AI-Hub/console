# 集群告警策略写入与消息下钻（L3）

[子模块需求](./_index.md) · 读列表与计数见 [cluster-alerting.md](./cluster-alerting.md)

## 概述

集群级告警策略的完整读写能力：

- **两个页签的列表**：自定义策略（`clusterrulegroups`）与内置策略（`globalrulegroups`）。列表显示名称/别名/描述、策略状态、规则状态（未触发/验证中/已触发/已禁用的计数）、耗时、最近检查、规则数与创建时间；提供名称/描述搜索、策略状态与规则状态筛选、名称/创建时间排序、10/20/50/100 档位分页、显示列与刷新。
- **自定义集群策略的写能力**：创建（基本信息 + 规则）、编辑（描述/别名/检查间隔/规则）、编辑 YAML、启用/停用、批量启用/停用、删除。写通道是 `/apis/alerting.kubesphere.io/v2beta1/clusterrulegroups`（cluster-scoped），与项目级规则组共用同一份规则模型与编辑组件。
- **内置策略启停与 reset**：`globalrulegroups` 由安装器安装，但其启停开关是规则组的 `alerting.kubesphere.io/enable` 标签——老 console 的 `enable.alerting.rule` 就是 PATCH 这个标签。探测确认该资源接受同样的 merge-patch，因此内置页签提供启用/停用；带 `alerting.kubesphere.io/initial-configuration` 注解的策略还可以「恢复初始配置」（确认后只把注解里的 `spec` merge-patch 回对象）。内置策略的编辑/YAML/删除不提供。
- **策略详情**：列表行进入独立详情页，显示属性（别名、策略状态、作用域、类型、规则数、检查间隔、耗时、最近检查、创建时间、创建者）、规则表（每条规则的状态/严重度/持续/说明/表达式/最近检查，可「查看指标数据」）与告警消息时间线（按 `rule_group` 服务端过滤、分页）。
- **消息下钻**：集群告警消息行可点击标题打开详情弹窗，显示 summary/message、state、severity、rule_group、rule_type、activeAt、当前值，以及 labels/annotations 的白名单摘要；不展示原始对象 JSON 与审计级字段。

## 用户故事

### US2 - 下钻一条告警，并停用平台内置策略 (Priority: P1)

作为 **集群管理员**，我希望 **点开一条告警看到它的状态、级别、所属策略、规则类型与关键标签/注解**，并能 **停用某条由平台内置策略发出的告警，或把它恢复成安装时的规则配置**，以便 **在确认误报来源后立即止血、在改坏规则后回到已知状态，而不是等平台升级或改 YAML**。

**Independent Test**：打开集群告警消息页，点第一条消息的标题，详情弹窗出现且 summary/state/severity/rule_group/rule_type/labels/annotations 各有一项非空；打开集群告警策略页内置页签，首行行操作菜单里有「启用」或「停用」，有初始配置注释的行还有「恢复初始配置」。

### US3 - 管理自定义集群告警策略 (Priority: P1)

作为 **集群管理员**，我希望 **在集群视角直接创建、修改、启停和删除自己的告警策略，并读到每条策略与每条规则的当前状态、耗时和最近检查时间**，以便 **不必为集群级告警改 YAML 或切到项目作用域，也能判断一条策略是否真的在运行、哪条规则在触发**。

**Independent Test**：打开集群告警策略页，自定义页签行数与 `clusterrulegroups` 一致且每行有规则状态/耗时/最近检查；创建一条临时策略后列表出现该行、详情显示其规则与状态；编辑、停用（确认）、启用、编辑 YAML、删除依次成功并回读生效；测试结束删除临时对象。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01** — 已知在 host 集群，当打开集群告警策略页并切到「内置策略」页签，则每行行操作菜单提供「详情」与「启用/停用」（实测 `PATCH /apis/alerting.kubesphere.io/v2beta1/globalrulegroups/<name>` 的 merge-patch 在 dryRun 与真实写入下均返回 200，`alerting.kubesphere.io/enable` 标签写入后回读为 `false`、恢复后为 `true`；写的是与老 console 相同的标签），但不提供编辑/删除；当打开集群告警消息页并点击首行消息标题，则弹出详情，显示 summary/message、state、severity、rule_group、rule_type、activeAt、当前值，以及 labels/annotations 的白名单摘要，且这些字段至少各有一项非空；详情不展示原始对象 JSON 与审计级字段。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02** — 已知在 host 集群，当内置策略带有 `alerting.kubesphere.io/initial-configuration` 注解，则其行操作菜单提供「恢复初始配置」：确认弹窗说明会覆盖当前规则；确认后页面把注解中的 `spec` 写回对象（`PATCH .../<name>`，merge-patch；实测注解 JSON 含完整对象，dryRun 与真实写入均返回 200，回读 `spec` 与注解里的 `spec` 完全一致，随后可恢复原状），刷新列表并显示成功提示，失败显示归一后的原因；没有该注解的内置行不出现该操作；reset 不改变启用/停用状态。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03** — 已知在 host 集群且当前账号可写 `clusterrulegroups`，当在自定义页签创建一条名称为唯一临时名的策略（别名、检查间隔、描述与至少一条规则）后，则列表出现该行（主名显示别名、次行显示对象名与描述），详情页显示别名/检查间隔/规则，且规则行有状态与「查看指标数据」入口；随后编辑别名/描述/规则并保存、停用（出现确认弹窗，确认后状态变为已停用）、再启用、编辑 YAML 保存、删除并确认，则每次操作后回读的对象与页面一致，删除后列表中不再有该行；失败时对话框保留输入并显示原因。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-04** — 已知在 host 集群，当打开集群告警策略页，则两个页签的每一行都显示策略状态与规则状态（未触发/验证中/已触发/已禁用的计数，计数来自聚合 kapis 的 `status.rulesStats`；状态缺失时显示 `-` 而不是 0）、耗时（`status.evaluationTime`，秒，三位小数）与最近检查（`status.lastEvaluation`）；名称/描述搜索、策略状态筛选、规则状态筛选（客户端，作用于已取回的全集）与 10/20/50/100 档位分页同时可用，切换筛选后回到第 1 页；点击行「详情」进入独立详情页，属性含耗时与最近检查，规则表按索引对齐 `status.rulesStatus`，告警消息区块显示该策略的消息或明确空态，返回链接回到告警策略列表。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-05** — 已知在 host 集群，当选中两条或更多可写策略并执行「启用」或「停用」，则对每条可写对象逐条写入 enable 标签（不可写或状态已一致的跳过），完成后显示成功数与失败对象；停用前出现一次确认弹窗；任何一条失败都不把其余成功的行改回原状，列表以 refetch 回读为准。

## 设计目标

1. 内置策略的启停只 patch enable 标签，不调用 receiver 接口。
2. 内置策略的 reset 只写 `spec`（来自 initial-configuration 注解），不改 enable 标签；写前必须确认。
3. 消息详情在行内打开，字段来自列表已经持有的数据；labels/annotations 只渲染白名单键。
4. 自定义集群策略与项目级策略使用同一套规则模型和编辑组件；差异只在资源集合（cluster-scoped vs namespaced）。
5. 规则状态与耗时只能来自聚合 kapis 路径；读不到时显示 `-`，不能以 0 代替。
6. 写操作按对象逐条执行并回读，不乐观修改本地副本。

## 约束与边界

- 内置策略启停写 `alerting.kubesphere.io/enable` 标签（`application/merge-patch+json`），与项目级规则组、老 console 共用同一个键；探测：`?dryRun=All` 返回 200，真实写入返回 200，GET 回读 `false`，恢复后回读 `true`，5 秒内未被协调器改写。
- reset 依据 `alerting.kubesphere.io/initial-configuration` 注解：其值是安装时的完整对象 JSON（实测含 apiVersion/kind/metadata/spec，metadata.labels 含 builtin 与 enable）。reset 只把其中的 `spec` merge-patch 回对象，不写 metadata；探测 dryRun 200、真实写入 200、回读 spec 与注解 spec 一致，随后用 PUT 恢复原 spec 与 labels 成功。
- 不提供内置策略的编辑/删除；reset 不恢复 enable 标签（避免静默重新启用一个已停用的策略）。
- 启停失败（403/409/422）在页面顶部显示归一后的错误，列表保持原状态，可重试。
- 消息详情只渲染固定字段与白名单 labels（alertname、severity、rule_group、rule_type、rule_level、namespace、pod、container、node、workload、instance、resource、group、version、verb）/ annotations（summary、message、description、runbook_url）；其余键与原始 item 不进入 DOM。
- 消息详情不请求新接口：列表响应已带全字段；详情弹窗只用当前行。

## UI 交互设计

- 内置页签顶部提示：「内置策略由平台安装；启用/停用写入规则组的 enable 标签，与老 console 一致。」
- 两个页签的行操作：详情、启用/停用（互斥显示）；带 initial-configuration 注解的内置行额外显示「恢复初始配置」；不出现编辑/删除。
- 「恢复初始配置」用确认弹窗：标题「恢复初始配置」，正文说明会用安装时配置覆盖当前规则并丢弃后续改动、启用/停用状态保持不变；确认按钮写前不发请求，成功后关闭弹窗、refetch 列表并在页头显示成功提示；失败在弹窗内就地显示原因。
- 消息表格的消息标题是按钮；点击打开「详情」弹窗，行操作「详情」保留。弹窗分三段：属性、标签摘要、注解摘要。
- 告警策略列表（两页签共用）：列「名称（别名/对象名/描述）」「策略状态」「规则状态」「耗时」「最近检查」「规则数」「创建时间」；工具条有搜索、两个筛选、显示列与刷新；分页默认 10，档位 10/20/50/100。
- 行操作：详情（进入独立详情页）；启用/停用（互斥显示，停用前确认）；自定义行额外有「编辑」「编辑 YAML」「删除」；内置可恢复行有「恢复初始配置」。自定义页签工具条有「创建策略」，无权限时改为说明文案。
- 批量：可写行可勾选；批量启用/停用逐条写入，停用前确认；完成后显示成功数与失败对象。
- 策略详情页：返回链接回列表；头部显示别名/名称、策略状态、作用域、类型与编辑/YAML/停用/删除操作；属性区含耗时与最近检查；规则表含状态、告警名称（下方「查看指标数据」）、严重度、持续、说明、表达式、最近检查；告警消息区块按策略名服务端过滤并分页；规则表内可搜索并分页（每页 10 条）。
- 查看指标数据：近 1 小时、60s 步长的表达式曲线弹窗；无数据、失败与加载分别呈现；带比较的告警表达式只返回超过阈值的时间点，空图不代表没有采样。
- 「创建/编辑」对话框字段：名称（编辑时只读）、别名、检查间隔（数字 + 秒/分/时，可留空）、描述、规则列表（告警名称/表达式/持续/严重度/说明/消息，至少一条）；提交前校验名称、至少一条规则、告警名称与表达式必填、同一策略内告警名称不重复。
- 页面句柄：`cluster-alerting-messages:open`、`cluster-alerting-messages:detail`、`:detail:labels`、`:detail:annotations`、`cluster-alerting-policies:enable`、`:disable`、`:reset`、`:reset-confirm`、`:reset-error`、`:reset-success`、`:create`、`:edit`、`:yaml`、`:delete`、`:bulk-enable`、`:bulk-disable`、`:filter:enable`、`:filter:rule-state`、`:search`、`:columns`、`:tab:custom`、`:tab:builtin`、`:builtin-hint`、`alertingrules:detail:rule-metric:<规则名>`、`alertingrules:detail:disable-confirm`、`alertingrules:metric`。

## 文案与校验

- 详情字段：摘要 / 消息 / 状态 / 级别 / 告警策略 / 规则类型 / 当前值 / 标签摘要 / 注解摘要；缺失值显示 `-`。
- 内置提示文案见 UI 交互设计。
- 停用有二次确认（列表与详情一致）；启用无确认；reset 有确认弹窗。失败时错误文案都由 `errorMessage` 归一。
- 规则状态：未触发 / 验证中 / 已触发 / 已禁用；策略状态：已启用 / 已停用；耗时单位「秒」，保留三位小数；最近检查为本地时间。
- 列表空态：该分类下没有策略；搜索/筛选无匹配与「没有策略」分别显示。
- 创建/编辑错误：名称非法、没有规则、告警名称为空、表达式为空、告警名称重复，均在对话框内就地显示；提交失败保留输入并显示归一原因。
- 批量结果：已处理 {ok} 条 / 已处理 {ok} 条，失败：{failed}。
- reset 弹窗文案：将用安装时的初始配置覆盖「{name}」的规则，并丢弃此后的规则改动；启用/停用状态保持不变。成功提示：已恢复「{name}」的初始配置。

## 边界情况

- 内置策略启停返回 403/409/422：显示错误、徽章保持原值、允许重试。
- 启停后列表刷新前读到旧值：以 query invalidate 后的回读为准。
- 消息没有 labels/annotations 或白名单键都为空：详情仍打开，摘要段显示 `-`，不报错。
- 消息在打开详情后被控制器移除：弹窗只读当前行快照，不重新请求；关闭后列表刷新自然消失。
- 并发修改同一策略：PUT 不用于启停；PATCH 只改标签，冲突面最小。
- 没有 initial-configuration 注解、注解不是合法 JSON、或缺少 `spec`：不显示 reset 入口；若注解在打开菜单后被移除，api-client 返回 422 语义错误，弹窗内显示原因、对象保持不变。
- 聚合 kapis 未返回 `status`（未安装规则 API 或读到 raw 路径）：规则状态与耗时显示 `-`，筛选「规则状态」不会把该行算进任何状态；不得显示 0。
- 自定义策略刚创建、尚未被规则 API 评估：耗时/最近检查/规则状态可能暂无，显示 `-`；稍后刷新或下次评估后出现。
- 名称在创建后不可修改；编辑 YAML 时名称锁定，改名被拒绝。
- 删除或写操作返回 403：显示权限原因，不自动重试；SSAR 明确拒绝时不显示创建/编辑/删除入口。
- 成员集群：读路径带集群段；写路径同样带集群段；无法写入时显示错误而不是落到 host（成员集群告警写入未在本环境验证，见验收状态）。
- reset 请求返回 403/409/422：弹窗保持打开并显示原因，规则保持原状，可关闭或重试。
- reset 成功后列表 refetch：规则数/状态徽章以回读为准；成功提示只作用于本次操作，切换页签后清除。

## 明确不做

- **内置策略的编辑 / 编辑 YAML / 删除**：内置策略由安装器维护；启停与 reset 之外的对象修改会在下一次协调时被覆盖，故不提供。
- **模板规则构建器**：老 console 的「模板规则 + 指标查询」构建器（按节点/工作负载/指标生成表达式）不迁移；项目级规则组此前已采用「直接编辑 PromQL」的模型，集群级复用同一模型，避免两个作用域出现两套规则语义。模板规则对象仍会原样展示其表达式与状态，可用 YAML 编辑。
- **策略创建向导的分步交互**：新 UI 用单个对话框（基本信息与规则同屏）代替老 console 的两步向导；字段覆盖名称/别名/检查间隔/描述与规则列表。
- **reset 恢复 metadata.labels**：reset 只写 `spec`；enable 标签保持当前值，不把安装时的 enable 值写回（避免静默重新启用已停用策略）。若将来需要连 enable 一起恢复，再单独加选项。
- **详情展示原始对象 / 审计字段 / YAML**：只渲染白名单摘要，不提供 YAML、事件或审计日志视图。
- **告警消息删除 / 静默 / 通知配置**：消息生命周期归告警控制器。

## 假设

- 内置策略的 enable 标签就是平台的启停开关（与项目级规则组、老 console 相同）；写标签后协调器的行为不在控制台可观测范围内。
- 消息的 labels/annotations 字段名由告警控制器决定，可能随版本增减；详情用白名单渲染，未知键自然被忽略。
- initial-configuration 注解的值是安装器写入的完整对象 JSON；本实现只依赖其中的 `spec`，对 metadata 其余字段不解释。
- v2beta1 聚合消息接口的 labels/annotations 是 `Record<string,string>`，没有嵌套结构。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01** — 内置策略行提供启用/停用，写 enable 标签并回读一致；不提供编辑/删除。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02** — 消息标题点击打开详情，展示固定字段与 labels/annotations 白名单摘要。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03** — 详情不渲染原始对象与未在白名单中的键。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-04** — 带初始配置注解的内置策略可经确认弹窗恢复初始规则（写回注解中的 spec），成功刷新并提示、失败显示原因。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-05** — 自定义页签可按名称、别名、检查间隔、描述与规则列表创建策略；创建后列表出现该行并可按唯一名搜索到。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-06** — 自定义行可编辑（描述/别名/检查间隔/规则）、编辑 YAML、启用/停用（停用确认）、删除（删除确认）；写操作失败时对话框保留并显示原因。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-07** — 两个页签的列表显示规则状态计数、耗时、最近检查、规则数与创建时间，并提供搜索、策略状态/规则状态筛选、排序、分页档位、显示列与刷新。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-08** — 行详情进入独立详情页，显示属性、规则表（状态/最近检查/查看指标数据）与按 `rule_group` 过滤的告警消息时间线；返回链接回列表。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-09** — 批量启用/停用逐条写 enable 标签并汇总结果，停用前确认，不可写行不可勾选。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01** — 内置策略行有且仅有一个启停入口（无编辑/删除），探测确认能写；消息详情打开且各字段非空，详情文本不含 `rule_id`/原始 JSON。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02** — 有初始配置注解的内置策略出现 reset 入口；确认后回读 spec 与注解 spec 一致，enable 状态不变；测试 finally 恢复原状。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03** — 临时策略经 UI 创建后 API 回读到同一对象（含别名/间隔/规则），经编辑/启停/YAML/删除后每次回读一致；测试 finally 删除临时对象，列表中不残留。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-04** — 列表规则状态计数与聚合 kapis `status.rulesStats` 一致；状态缺失的行显示 `-`；规则状态筛选只保留计数大于 0 的行；详情页规则状态与 `status.rulesStatus` 按索引一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03`
