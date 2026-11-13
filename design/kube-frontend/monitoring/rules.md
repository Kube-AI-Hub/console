# 告警策略（L3）

[子模块需求](../../../prd/kube-frontend/monitoring/rules.md)

## 概述

一张 告警策略 页面，两种资源模型：3.3 的 `alertingrules` 与本集群实际使用的规则组（`globalrulegroups` / `clusterrulegroups` / 命名空间级 `rulegroups`）。

## 关联需求

- AC-L3-KUBE-FRONTEND-MONITORING-RULES-01
- AC-L3-KUBE-FRONTEND-MONITORING-RULES-02
- AC-L3-KUBE-FRONTEND-MONITORING-RULES-03
- AC-L3-KUBE-FRONTEND-MONITORING-RULES-04

## 设计目标与非目标

目标：读者不必知道集群是 3.3 还是 3.4；开关只动一个标签；规则内容完整可读。

非目标：策略创建、规则体编辑、跨命名空间聚合。

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

## 系统现状

老 console 的告警策略页面向 3.3 的 `AlertingRule`，字段为名称、状态、规则数、最近检测时间。本次迁移保留这些字段语义，并把「最近检测时间」换成「创建时间」——规则组对象没有 `status.lastEvaluation`（那是 alertingrules 的字段），编造一个时间比不显示更糟。

## 仓库落点

- 页面：`apps/console-next/src/pages/monitoring/RuleGroupsPage.tsx`（模型分支在 `MonitoringListPage.tsx`）
- 接口：`packages/api-client/src/alerting.ts`（`ruleGroupsApi` / `alertingModel` / `toRuleGroupSummary` / `toRuleGroupDetail`）
- 查询：`apps/console-next/src/pages/monitoring/queries.ts`（`useAlertingModel`）
- 文案：`packages/locales/src/index.ts`（`monitoring.ruleGroups.*`）

## 对外契约

| 用途 | 路径 | 方法 |
| --- | --- | --- |
| 规则组列表（全局/集群） | /apis/alerting.kubesphere.io/v2beta1/{globalrulegroups,clusterrulegroups} | GET |
| 规则组列表（项目） | /apis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/rulegroups | GET |
| 单个规则组 | 同上 + /<name> | GET |
| 启用/停用 | 同上 + /<name>，body 只含 metadata.labels | PATCH (merge-patch+json) |
| 模型探测 | /apis/alerting.kubesphere.io/v2beta1 | GET |

## 不变量

1. 规则数 = `spec.rules` 长度。
2. 开关只改 `alerting.kubesphere.io/enable`，不改 `spec`。
3. 没有该标签的规则组视为启用（与旧模型一致：没被关掉就是开着的）。
4. 「全部项目」不列出项目级规则组，并在界面上说明。

## 已知坑

- **资源名不等于功能名**：3.4 没有 `alertingrules`。按名字读会得到 200 空体，看起来像「模块未安装」——这是本项目把队列里一项功能误判为环境阻塞的直接原因。
- **`status.lastEvaluation` 不存在**：规则组没有该字段，照抄旧列会显示 `-`，改显示创建时间并在此记录。
- **severity 在规则体顶层**，不在 `labels` 里（个别规则两处都有，读取时先顶层后 labels）。
- **合并分页**：不做前端切页时，第 2 页会因为三个来源各自返回第 2 页而看起来「丢了行」。
- **PATCH 到 kapis 不行**：这些资源只在 `/apis/` 下可写。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/monitoring/TC-L3-KUBE-FRONTEND-MONITORING-RULES-0{1,2,3}.yaml`
可观测点：`alertingrules:surface`、`alertingrules:search`、`alertingrules:detail`、`alertingrules:detail:rule-table`。

## 后续改进

- 自定义规则组的创建与编辑（等出现可验证的数据）。
- 规则组详情里跳转到告警消息（按规则名过滤）。

## 验收用例

- TC-L3-KUBE-FRONTEND-MONITORING-RULES-01
- TC-L3-KUBE-FRONTEND-MONITORING-RULES-02
- TC-L3-KUBE-FRONTEND-MONITORING-RULES-03
