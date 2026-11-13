# 告警策略列表（L3）

[子模块需求](./_index.md)

## 概述

告警策略表：名称（副行显示作用域）、策略状态、规则数、类型（内置/自定义）、创建时间；行操作「详情」「启用/停用」。

**两种资源模型**：KubeSphere 3.3 及更早用 `alertingrules`；当前 API 组用**规则组**（`globalrulegroups` / `clusterrulegroups` / 命名空间级 `rulegroups`），每组含若干 Prometheus 规则。页面同一张，模型由探测 API 组决定。

## 用户故事

### US1 - 看清哪些策略启用、各有多少规则 (Priority: P1)

作为 **项目运维**，我希望 **在列表上看到启用状态与规则数**，以便 **确认监控覆盖是否如预期**。

**Independent Test**：打开告警策略页，核对列与启用徽章。

### US2 - 知道一条策略里具体有哪些告警 (Priority: P1)

作为 **项目运维**，我希望 **点开一条策略就能看到它包含的每一条告警及其严重度、持续时间与表达式**，以便 **判断某类告警是否真的被覆盖，而不是只看规则条数**。

**Independent Test**：打开某规则组详情，核对规则行数与接口返回的 `spec.rules` 长度一致，且每行显示严重度与表达式。

### US3 - 只启用或停用，不改规则体 (Priority: P2)

作为 **集群管理员**，我希望 **只切换策略的启用状态**，以便 **不会因为一次开关操作覆盖掉别人正在编辑的规则内容**。

**Independent Test**：对一条策略点「停用」，然后读取该对象，核对只有 `alerting.kubesphere.io/enable` 标签变化、`spec.rules` 内容不变；再点「启用」还原。

### US5 - 自己建一条策略并改它 (Priority: P1)

作为 **项目管理员**，我希望 **在页面上创建、修改、删除本项目自己的告警策略**，以便 **不必写 YAML 就能为项目加一条阈值告警**。

**Independent Test**：创建一条策略 → 回读对象确认 `spec.rules` 的告警名与表达式 → 编辑表达式 → 回读确认 → 删除 → 回读 404。

## 验收场景

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-01** — 已知集群提供规则组资源，当打开告警策略页，则列出全部规则组，列含名称（副行为作用域）、策略状态、规则数、类型、创建时间；每行规则数等于该组 `spec.rules` 长度；页面状态为 `ready`；分页总数等于各来源合并后的条数。
- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-02** — 已知某规则组处于启用状态，当对它点「停用」，则其 `alerting.kubesphere.io/enable` 标签变为 `false`、状态徽章变为「已停用」，且 `spec.rules` 未被改动；再点「启用」后标签与徽章还原。
- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-03** — 已知某规则组包含若干规则，当打开它的「详情」，则显示所属作用域、状态、类型、规则数，并逐条列出告警名称、严重度、持续时间与说明（含表达式全文）；规则数为 0 时显示「该规则组没有规则」而不是空表格。
- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-04** — 已知选定了某个项目，当创建一条策略（策略名、告警名、表达式、持续时间、严重度、说明）并提交，则该项目命名空间下出现对应的 `rulegroups` 对象，其 `spec.rules` 与填写内容一致；当通过行操作编辑表达式并提交，则回读对象中表达式已更新；当删除该策略，则对象不再存在。内置或集群级规则组不提供编辑/删除入口。

## 设计目标

1. 一页覆盖两代资源模型，读者不需要知道集群是 3.3 还是 3.4。
2. 开关只动一个标签，不重发规则体。
3. 规则内容可读：表达式不截断。

## 约束与边界

- 读 `/apis/alerting.kubesphere.io/v2beta1/{globalrulegroups,clusterrulegroups}`；选定项目时追加该项目的 `rulegroups`。
- 写 `alerting.kubesphere.io/enable` 标签（merge patch）。
- 不支持跨命名空间列出规则组：API 没有该集合，「全部项目」只列集群级规则组。
- 内置规则组（`alerting.kubesphere.io/builtin: true`）只读，不提供编辑入口。

## UI 交互设计

- 列：名称（副行作用域）、策略状态、规则数、类型、创建时间；窄屏依次折叠。
- 行操作：详情、启用/停用（两个互斥 `visible` 的条目，因为行操作标签是静态的）。
- 详情弹窗：先属性，再规则表；无规则时说明而不是空表。

## 文案与校验

- 状态：已启用 / 已停用。
- 类型：内置 / 自定义。
- 作用域：全局 / 集群 / 项目。
- 空态：暂无告警策略。

## 边界情况

- 集群没有该资源：退回 3.3 的 `alertingrules` 实现（同一页面）。
- 规则组无规则：规则数显示 0，详情里说明。
- 项目筛选为「全部项目」：只列集群级规则组，页面说明原因。

## 明确不做

- 多规则策略的可视化编辑：本页编辑器一次写一条规则，且写入会整体替换 `spec.rules`，因此规则数为 2 及以上的策略只读（否则会静默丢掉未展示的规则）。
- 内置与集群级规则组的编辑：由安装器维护，改了下一次协调会覆盖。
- 告警消息删除以外的批量操作。

## 假设

- 规则组返回标准 `{items}` 信封；规则体遵循 Prometheus 规则格式（`alert` / `expr` / `for` / `severity` / `annotations`）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-MONITORING-RULES-01`
- `TC-L3-KUBE-FRONTEND-MONITORING-RULES-02`
- `TC-L3-KUBE-FRONTEND-MONITORING-RULES-03`

## 功能需求

- **FR-L3-KUBE-FRONTEND-MONITORING-RULES-01** — 按 API 组探测资源模型，同一页面支持 `rulegroups` 与 `alertingrules`。
- **FR-L3-KUBE-FRONTEND-MONITORING-RULES-02** — 规则组列表合并多个来源并在前端分页。
- **FR-L3-KUBE-FRONTEND-MONITORING-RULES-03** — 启用/停用只写 enable 标签。
- **FR-L3-KUBE-FRONTEND-MONITORING-RULES-04** — 详情展示每条规则的名称、严重度、持续时间与表达式。
- **FR-L3-KUBE-FRONTEND-MONITORING-RULES-05** — 项目级、非内置、单规则的策略可创建、编辑与删除；其余只读。

## 成功标准

- **SC-L3-KUBE-FRONTEND-MONITORING-RULES-01** — 列表规则数与接口一致；开关后回读标签一致且规则体未变。
