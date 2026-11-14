# 集群告警策略写入与消息下钻 · 技术方案（L3）

[需求](../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md) · 读列表与计数见 [cluster-alerting.md](./cluster-alerting.md)

## 概述

两个能力共享同一份数据与组件：内置策略（`globalrulegroups`）的启用/停用，以及告警消息行的下钻详情。前者复用项目级规则组已有的 `setEnabled`（merge-patch enable 标签）；后者把列表行已持有的字段与 labels/annotations 白名单铺进弹窗，不新增请求。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01

## 设计目标与非目标

目标：内置策略可停用/启用，且写入路径与项目级规则组完全一致；消息可下钻到关键字段与简要标签，而不是整对象。

非目标：内置策略的编辑/删除/reset、消息删除/静默、原始对象/YAML/审计视图、集群级自定义策略的创建/编辑。

## 关键约束

- 启停只 patch `alerting.kubesphere.io/enable`（`application/merge-patch+json`），不 PUT，不写 `spec`。
- `globalrulegroups` 是 cluster-scoped CRD；探测：dryRun PATCH 200，真实 PATCH 200，GET 回读 `false`，恢复后回读 `true`。
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

## 系统现状

老 console 的集群告警策略页对内置页签提供启用/停用与恢复默认（`resetPolicy`，基于 `alerting.kubesphere.io/initial-configuration`）；消息页的行内信息已含 summary/message，点击策略名可跳到策略详情。本功能点迁移启停与消息详情，reset 与策略详情页不迁移。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterAlertingPoliciesPage.tsx`（两个页签的行操作、builtin 提示）、`ClusterAlertingMessagesPage.tsx`（标题按钮与下钻弹窗）
- 接口：`packages/api-client/src/alerting.ts` 的 `ruleGroupsApi.setEnabled`（复用）、`toClusterAlertSummary`（增加 ruleType/value/labels/annotations 映射）
- 文案：`packages/locales/src/index.ts` 的 `cluster.alerting.{field,detail,policies.builtinHint}.*`
- 测试：`tests/ui/{specs,tests}/kube-frontend/cluster-management/...CLUSTER_ALERTING_WRITE-01`

## 对外契约

| 用途 | 路径 | 方法 | 探测结果 |
| --- | --- | --- | --- |
| 内置策略列表 | /apis/alerting.kubesphere.io/v2beta1/globalrulegroups | GET | 200，18 条均 builtin |
| 内置策略启停 | /apis/.../globalrulegroups/<name> | PATCH（merge-patch+json） | dryRun 200；真实 200；enable 标签 false 回读一致，恢复 true 后一致 |
| 内置策略详情 | 同上 + /<name> | GET | 200 |
| 消息列表（内置来源） | /kapis/alerting.kubesphere.io/v2beta1/globalalerts | GET | 200，`{items,totalItems}` |
| 消息列表（自定义来源） | /kapis/.../clusteralerts | GET | 200，`{items,totalItems}` |

启停请求体：

    { "metadata": { "labels": { "alerting.kubesphere.io/enable": "false" } } }

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
2. 内置页签与自定义页签都有且仅有一个启停入口（按当前状态二选一），都没有编辑/删除。
3. 详情只渲染白名单键；`rule_id` 等内部字段不进入 DOM。
4. 详情打开不产生网络请求。
5. 启停失败不改变本地列表状态（由 invalidate 后回读决定）。

## 已知坑

- **enable 标签可能被安装器协调**：探测写入后短时间回读一致，但升级/协调时是否重置未验证；对象上的 `alerting.kubesphere.io/initial-configuration` 注解说明安装器保留初始配置。若升级后标签被重置，应在此记录并考虑只读提示。
- **不要写 receiver 或 spec.enabled**：探测与实际控制器读取的是 `metadata.labels['alerting.kubesphere.io/enable']`；`spec.enabled` 是旧模型字段，规则组对象上没有。
- **行点击不是表格能力**：自动化用 `[data-ai-row] [data-ai-id="cluster-alerting-messages:open"]` 定位首行标题，不要等整行 onClick。
- **白名单会滞后**：平台新增 label/annotation 时详情不会自动出现，需要同步 allowlist。
- **详情字段缺失**：没有 labels/annotations 或键为空时显示 `-`，不能当成读取失败。

## 测试与可观测

- E2E：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01.yaml`：内置页签首行菜单有详情+唯一启停入口、无编辑/删除；消息首行标题点击后详情可见，固定字段与 `:detail:labels`/`:detail:annotations` 非空，且不出现 `rule_id`/原始 JSON。
- 可观测点：`cluster-alerting-policies:builtin-hint`、`:enable`、`:disable`、`cluster-alerting-messages:open`、`:detail`、`:detail:labels`、`:detail:annotations`。
- 失败时先看：页签是否 builtin、行操作是否被 tab 过滤、详情是否读到了 labels/annotations、是否有 403。

## 后续改进

- 内置策略的编辑/删除与恢复默认（reset 依赖 `initial-configuration` 注解，需先确认协调语义）。
- 详情增加按 rule_group 跳转策略、按 label 过滤消息。
- 若多个列表都需要整行点击，再把 `onRowClick` 提升到共享表格组件。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01
