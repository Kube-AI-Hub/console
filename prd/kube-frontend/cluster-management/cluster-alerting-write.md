# 集群告警策略写入与消息下钻（L3）

[子模块需求](./_index.md) · 读列表与计数见 [cluster-alerting.md](./cluster-alerting.md)

## 概述

集群级告警的两个写/读细节能力：

- **内置策略启停**：`globalrulegroups` 由安装器安装，但其启停开关是规则组的 `alerting.kubesphere.io/enable` 标签——老 console 的 `enable.alerting.rule` 就是 PATCH 这个标签。探测确认该资源接受同样的 merge-patch，因此集群告警策略页的内置页签提供启用/停用；编辑/删除仍不提供。
- **消息下钻**：集群告警消息行可点击标题打开详情弹窗，显示 summary/message、state、severity、rule_group、rule_type、activeAt、当前值，以及 labels/annotations 的白名单摘要；不展示原始对象 JSON 与审计级字段。

## 用户故事

### US2 - 下钻一条告警，并停用平台内置策略 (Priority: P1)

作为 **集群管理员**，我希望 **点开一条告警看到它的状态、级别、所属策略、规则类型与关键标签/注解**，并能 **停用某条由平台内置策略发出的告警**，以便 **在确认误报来源后立即止血，而不是等平台升级或改 YAML**。

**Independent Test**：打开集群告警消息页，点第一条消息的标题，详情弹窗出现且 summary/state/severity/rule_group/rule_type/labels/annotations 各有一项非空；打开集群告警策略页内置页签，首行行操作菜单里有「启用」或「停用」。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01** — 已知在 host 集群，当打开集群告警策略页并切到「内置策略」页签，则每行行操作菜单提供「详情」与「启用/停用」（实测 `PATCH /apis/alerting.kubesphere.io/v2beta1/globalrulegroups/<name>` 的 merge-patch 在 dryRun 与真实写入下均返回 200，`alerting.kubesphere.io/enable` 标签写入后回读为 `false`、恢复后为 `true`；写的是与老 console 相同的标签），但不提供编辑/删除；当打开集群告警消息页并点击首行消息标题，则弹出详情，显示 summary/message、state、severity、rule_group、rule_type、activeAt、当前值，以及 labels/annotations 的白名单摘要，且这些字段至少各有一项非空；详情不展示原始对象 JSON 与审计级字段。

## 设计目标

1. 内置策略的写操作收敛为启用/停用：只 patch enable 标签，不动 `spec`，不调用 receiver 接口。
2. 消息详情在行内打开，字段来自列表已经持有的数据；labels/annotations 只渲染白名单键。

## 约束与边界

- 内置策略启停写 `alerting.kubesphere.io/enable` 标签（`application/merge-patch+json`），与项目级规则组、老 console 共用同一个键；探测：`?dryRun=All` 返回 200，真实写入返回 200，GET 回读 `false`，恢复后回读 `true`，5 秒内未被协调器改写。
- 不提供内置策略的编辑/删除/恢复默认；对象上的 `alerting.kubesphere.io/initial-configuration` 注解是安装器的 reset 依据，本期不消费。
- 启停失败（403/409/422）在页面顶部显示归一后的错误，列表保持原状态，可重试。
- 消息详情只渲染固定字段与白名单 labels（alertname、severity、rule_group、rule_type、rule_level、namespace、pod、container、node、workload、instance、resource、group、version、verb）/ annotations（summary、message、description、runbook_url）；其余键与原始 item 不进入 DOM。
- 消息详情不请求新接口：列表响应已带全字段；详情弹窗只用当前行。

## UI 交互设计

- 内置页签顶部提示：「内置策略由平台安装；启用/停用写入规则组的 enable 标签，与老 console 一致。」
- 两个页签的行操作：详情、启用/停用（互斥显示）；不出现编辑/删除。
- 消息表格的消息标题是按钮；点击打开「详情」弹窗，行操作「详情」保留。弹窗分三段：属性、标签摘要、注解摘要。
- 页面句柄：`cluster-alerting-messages:open`、`cluster-alerting-messages:detail`、`:detail:labels`、`:detail:annotations`、`cluster-alerting-policies:enable`、`:disable`、`cluster-alerting-policies:builtin-hint`。

## 文案与校验

- 详情字段：摘要 / 消息 / 状态 / 级别 / 告警策略 / 规则类型 / 当前值 / 标签摘要 / 注解摘要；缺失值显示 `-`。
- 内置提示文案见 UI 交互设计。
- 启停无二次确认（与项目级规则组一致）；失败时错误文案由 `errorMessage` 归一。

## 边界情况

- 内置策略启停返回 403/409/422：显示错误、徽章保持原值、允许重试。
- 启停后列表刷新前读到旧值：以 query invalidate 后的回读为准。
- 消息没有 labels/annotations 或白名单键都为空：详情仍打开，摘要段显示 `-`，不报错。
- 消息在打开详情后被控制器移除：弹窗只读当前行快照，不重新请求；关闭后列表刷新自然消失。
- 并发修改同一策略：PUT 不用于启停；PATCH 只改标签，冲突面最小。

## 明确不做

- **内置策略的编辑 / 删除 / 恢复默认**：编辑/删除仍属安装器；reset（基于 `initial-configuration` 注解重建）本期不迁移。
- **详情展示原始对象 / 审计字段 / YAML**：只渲染白名单摘要，不提供 YAML、事件或审计日志视图。
- **告警消息删除 / 静默 / 通知配置**：消息生命周期归告警控制器。
- **集群级自定义策略的创建 / 编辑 / 删除**：项目级已具备，集群级写通道未迁移。

## 假设

- 内置策略的 enable 标签就是平台的启停开关（与项目级规则组、老 console 相同）；写标签后协调器的行为不在控制台可观测范围内。
- 消息的 labels/annotations 字段名由告警控制器决定，可能随版本增减；详情用白名单渲染，未知键自然被忽略。
- v2beta1 聚合消息接口的 labels/annotations 是 `Record<string,string>`，没有嵌套结构。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01** — 内置策略行提供启用/停用，写 enable 标签并回读一致；不提供编辑/删除。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02** — 消息标题点击打开详情，展示固定字段与 labels/annotations 白名单摘要。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03** — 详情不渲染原始对象与未在白名单中的键。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01** — 内置策略行有且仅有一个启停入口（无编辑/删除），探测确认能写；消息详情打开且各字段非空，详情文本不含 `rule_id`/原始 JSON。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01`
