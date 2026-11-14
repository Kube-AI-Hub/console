# 集群告警策略写入与消息下钻 · 技术方案（L3）

[需求](../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md) · 读列表与计数见 [cluster-alerting.md](./cluster-alerting.md)

## 概述

三个能力共享同一份数据与组件：内置策略（`globalrulegroups`）的启用/停用、内置策略恢复初始配置，以及告警消息行的下钻详情。启停复用项目级规则组已有的 `setEnabled`（merge-patch enable 标签）；reset 从 `alerting.kubesphere.io/initial-configuration` 注解解析初始对象并只把 `spec` merge-patch 回去；下钻把列表行已持有的字段与 labels/annotations 白名单铺进弹窗，不新增请求。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02

## 设计目标与非目标

目标：内置策略可停用/启用，且写入路径与项目级规则组完全一致；带安装器初始配置的策略可确认后恢复规则；消息可下钻到关键字段与简要标签，而不是整对象。

非目标：内置策略的编辑/删除、reset 恢复 enable 标签、消息删除/静默、原始对象/YAML/审计视图、集群级自定义策略的创建/编辑。

## 关键约束

- 启停只 patch `alerting.kubesphere.io/enable`（`application/merge-patch+json`），不 PUT，不写 `spec`。
- `globalrulegroups` 是 cluster-scoped CRD；探测：dryRun PATCH 200，真实 PATCH 200，GET 回读 `false`，恢复后回读 `true`。
- reset 依据 `alerting.kubesphere.io/initial-configuration`：值是安装时的完整对象 JSON；只取其中 `spec` 做 merge-patch，不写 metadata。探测：`PATCH ...?dryRun=All` → 200；真实 merge-patch → 200；回读 `spec` 与注解 `spec` 深比较一致；随后用 PUT 恢复原 spec/labels → 200。
- reset 不写 enable 标签：启停是独立开关，静默改状态会让「恢复规则」变成「顺手启用」。
- 详情只渲染白名单键，不请求新接口，不展示原始 item。
- 行内点击由消息标题的 Button 承载：ResourceList 没有 `onRowClick`，扩展共享表格组件超出本功能点范围。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01 — 内置策略启停复用 enable 标签，探测证据留档

**为什么**：`globalrulegroups` 与项目级规则组共用同一套 `spec.rules` 与 `alerting.kubesphere.io/enable` 标签。老 console 的 `enable.alerting.rule`（`src/actions/alerting.js:193-244`）对 builtin/custom 都走 `patch`，body 只有 `metadata.labels['alerting.kubesphere.io/enable']`。对 `config-reloaders` 的探测复现了这条路径：`PATCH ...?dryRun=All` → 200；真实 merge-patch → 200；GET 回读 `enable: "false"`；再 PATCH 回 `"true"` → GET 回读 `"true"`，18 个组的原始标签全部复原。因此页面直接用既有 `setEnabled({scope:'global'})`，不新增接口、不写 receiver、不假设 `spec.enabled` 存在。

**被否方案**：继续把内置策略当不可写。API 明确接受，且老 console 已提供入口；藏起来只会迫使读者改 YAML。

**何时重新考虑**：安装器开始把 enable 标签当受管字段并在协调时重置（见已知坑）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02 — 消息下钻用行内弹窗 + 白名单摘要

**为什么**：一条告警的信息量很小（summary/message、state、severity、rule_group、rule_type、activeAt、value、少量 labels/annotations），列表响应已带全；再发一次请求或新建详情路由只增加等待与一个空路由。labels/annotations 用白名单渲染：只列运维需要的键，既不把控制器内部字段（如 `rule_id`）当信息展示，也不会因为平台新增标签而把原始对象带进页面。

**被否方案**：展开原始 item 的 JSON/YAML。那是调试视图，不是运维视图，还会暴露未筛选字段。

**何时重新考虑**：需要按 label 做服务端检索或跳转监控图表时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03 — 行点击用标题按钮，不改共享表格

**为什么**：`ResourceList` 的 schema 没有 row click 配置，而修改 `packages/ai-kit` 的表格属于跨包改动、会影响所有列表。消息标题本来就是行的主内容，渲染成 Button（`cluster-alerting-messages:open`）即可获得点击、键盘焦点与可访问名；行操作「详情」保留为第二条路径。

**被否方案**：给 ResourceList 加 `onRowClick`。收益是整行可点，代价是共享组件的契约变更与全站回归；本页只有一类对象需要下钻。

**何时重新考虑**：多个列表都需要整行点击时，再把能力提升到共享组件。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-04 — reset 只把注解里的 spec merge-patch 回去，不整对象 PUT

**为什么**：`initial-configuration` 注解保存的是安装时的完整对象（apiVersion/kind/metadata/spec），其中 metadata 带有安装时刻的 `namespace`/`labels`/`annotations`。老 console 的 reset 直接 PUT 这个对象（再把当前注解塞回去），但 PUT 需要 `resourceVersion`，且会把安装时的 metadata 一起写回——例如把 enable 标签改回 `true`，等于在「恢复规则」时静默重新启用一个被停用的策略。这里改为：GET 当前对象 → 解析注解 → 只 PATCH `spec`（merge-patch 对 `spec.rules` 数组即整体替换，正好是一次规则重置）。探测验证 dryRun/真实写入均 200，回读 spec 与注解 spec 完全一致，随后 PUT 复原成功。

**被否方案**：PUT 整对象（老 console 路径）。dry-run PUT 缺 `resourceVersion` 会 422；带上当前 resourceVersion 后可行，但会覆盖 metadata/启用状态，冲突面更大。

**何时重新考虑**：reset 需要恢复的不只是规则（例如同时恢复 enable 或 annotations）时，再显式扩展并写清语义。

## 系统现状

老 console 的集群告警策略页对内置页签提供启用/停用与恢复默认（`resetPolicy`，基于 `alerting.kubesphere.io/initial-configuration`）；消息页的行内信息已含 summary/message，点击策略名可跳到策略详情。本功能点迁移启停、reset 与消息详情；策略详情页不迁移。reset 的差异见 DEC-WRITE-04（只写 spec，不恢复 metadata）。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterAlertingPoliciesPage.tsx`（两个页签的行操作、builtin 提示）、`ClusterAlertingMessagesPage.tsx`（标题按钮与下钻弹窗）
- 接口：`packages/api-client/src/alerting.ts` 的 `ruleGroupsApi.setEnabled`（复用）、`ruleGroupsApi.resetToInitial`（新增）、`toRuleGroupSummary`（`resettable`）、`toClusterAlertSummary`（增加 ruleType/value/labels/annotations 映射）
- 文案：`packages/locales/src/index.ts` 的 `cluster.alerting.{field,detail,policies.builtinHint,policies.reset*}.*`
- 测试：`tests/ui/{specs,tests}/kube-frontend/cluster-management/...CLUSTER_ALERTING_WRITE-01` 与 `...WRITE-02`

## 对外契约

| 用途 | 路径 | 方法 | 探测结果 |
| --- | --- | --- | --- |
| 内置策略列表 | /apis/alerting.kubesphere.io/v2beta1/globalrulegroups | GET | 200，18 条均 builtin |
| 内置策略启停 | /apis/.../globalrulegroups/<name> | PATCH（merge-patch+json） | dryRun 200；真实 200；enable 标签 false 回读一致，恢复 true 后一致 |
| 内置策略 reset | /apis/.../globalrulegroups/<name> | GET + PATCH（merge-patch+json） | dryRun 200；真实 200；回读 spec 与注解 spec 深比较一致；随后 PUT 复原成功 |
| 内置策略详情 | 同上 + /<name> | GET | 200 |
| 消息列表（内置来源） | /kapis/alerting.kubesphere.io/v2beta1/globalalerts | GET | 200，`{items,totalItems}` |
| 消息列表（自定义来源） | /kapis/.../clusteralerts | GET | 200，`{items,totalItems}` |

启停请求体：

    { "metadata": { "labels": { "alerting.kubesphere.io/enable": "false" } } }

reset 请求体（`spec` 来自注解 JSON）：

    { "spec": { "rules": [ ... ] } }

reset 前置条件：`metadata.annotations["alerting.kubesphere.io/initial-configuration"]` 存在且是含 `spec` 的合法 JSON；api-client 在缺失/非法时抛出 422 语义的 ApiError。

消息下钻字段与白名单：

| 详情字段 | 来源 |
| --- | --- |
| 名称 | labels.alertname |
| 摘要 | annotations.summary |
| 消息 | annotations.message（缺省 annotations.description） |
| 状态 | state |
| 级别 | labels.severity |
| 告警策略 | labels.rule_group |
| 规则类型 | labels.rule_type |
| 触发时间 | activeAt |
| 当前值 | value |
| 标签摘要 | labels 白名单：alertname/severity/rule_group/rule_type/rule_level/namespace/pod/container/node/workload/instance/resource/group/version/verb |
| 注解摘要 | annotations 白名单：summary/message/description/runbook_url |

## 不变量

1. 启停只改 `alerting.kubesphere.io/enable`，`spec.rules` 不变。
2. 内置页签与自定义页签都有且仅有一个启停入口（按当前状态二选一），都没有编辑/删除；只有 `builtin && resettable` 的行有 reset。
3. reset 只写 `spec`，enable 标签与 annotations 不变；成功后列表 refetch，规则数以回读为准。
4. 详情只渲染白名单键；`rule_id` 等内部字段不进入 DOM。
5. 详情打开不产生网络请求；reset 前必须经过确认弹窗。
6. 启停/reset 失败不改变本地列表状态（由 invalidate 后回读决定）；reset 失败时弹窗保留并显示原因。

## 已知坑

- **enable 标签可能被安装器协调**：探测写入后短时间回读一致，但升级/协调时是否重置未验证；对象上的 `alerting.kubesphere.io/initial-configuration` 注解说明安装器保留初始配置。若升级后标签被重置，应在此记录并考虑只读提示。
- **不要写 receiver 或 spec.enabled**：探测与实际控制器读取的是 `metadata.labels['alerting.kubesphere.io/enable']`；`spec.enabled` 是旧模型字段，规则组对象上没有。
- **行点击不是表格能力**：自动化用 `[data-ai-row] [data-ai-id="cluster-alerting-messages:open"]` 定位首行标题，不要等整行 onClick。
- **白名单会滞后**：平台新增 label/annotation 时详情不会自动出现，需要同步 allowlist。
- **详情字段缺失**：没有 labels/annotations 或键为空时显示 `-`，不能当成读取失败。
- **initial-configuration 不是 PATCH 补丁**：它是完整对象 JSON；只取 `spec`，不要把它当 merge-patch body 直接发（会带 apiVersion/kind/metadata）。
- **reset 不恢复 enable**：如果读者期望「恢复安装时状态」包括启停，需要显式说明；当前实现保留当前启停状态（DEC-WRITE-04）。
- **注解可能缺失/非法**：列表上的 reset 入口由 `resettable`（注解非空）控制；并发移除时 api-client 抛 422 语义错误，弹窗显示原因。
- **reset 后 resettable 仍为真**：注解不被 reset 删除，因此可以重复恢复。
- **测试必须 finally 复原**：reset 会改真实集群的规则体；用例先快照 spec，再改一个无害描述、reset、回读，finally 用 PUT 恢复快照。

## 测试与可观测

- E2E：`...CLUSTER_ALERTING_WRITE-01.yaml`：内置页签首行菜单有详情+唯一启停入口、无编辑/删除；消息首行标题点击后详情可见，固定字段与 `:detail:labels`/`:detail:annotations` 非空，且不出现 `rule_id`/原始 JSON。
- E2E：`...CLUSTER_ALERTING_WRITE-02.yaml`：有注解的内置行出现 reset；先通过 API 把 spec 改出差异，再走 UI 确认重置，回读 spec 等于注解 spec；finally PUT 恢复快照。
- 可观测点：`cluster-alerting-policies:builtin-hint`、`:enable`、`:disable`、`:reset`、`:reset-confirm`、`:reset-error`、`:reset-success`、`cluster-alerting-messages:open`、`:detail`、`:detail:labels`、`:detail:annotations`。
- 失败时先看：页签是否 builtin、行操作是否被 tab 过滤、详情是否读到了 labels/annotations、是否有 403。

## 后续改进

- 内置策略的编辑/删除。
- 详情增加按 rule_group 跳转策略、按 label 过滤消息。
- 若多个列表都需要整行点击，再把 `onRowClick` 提升到共享表格组件。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02
