# TC-L3-KUBE-FRONTEND-MONITORING-RULES-05 告警策略 · 详情页列出身份信息、每条规则与当前状态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

从列表打开一条策略的详情页，读到策略身份、规则逐条（名称/严重度/持续/说明/完整表达式）和每条规则当前的告警状态；没有规则时说明而不是空表。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-05** — 已知某规则组含 N 条规则（N 可能为 0），当从列表行操作「详情」打开它，则页面地址落在 `…/alertingrules/<name>` 且带 `scope` 参数、页面状态为 `ready`；属性区显示名称、作用域、策略状态、类型、规则数与创建时间；规则表有 N 行，每行显示告警名称、严重度、持续时间、说明与完整 PromQL 表达式（不截断），并显示「告警中 / 待触发 / 正常」之一作为该规则当前状态（由该策略的活动告警按 `labels.alertname` 推导，不伪造状态）；N 为 0 时显示「该规则组没有规则」而不是空表；点返回入口回到告警策略列表。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 点开一条策略，看清每条规则与它当前的告警状态 (Priority: P1)

作为 **项目运维**，我希望 **在策略详情页看到每条规则的名称、严重度、持续时间、说明与完整表达式，并知道哪条规则正在告警**，以便 **判断一条策略到底覆盖了什么、现在哪条在响**。

**Independent Test**：从列表打开一条含规则的策略详情，核对规则表行数等于接口 `spec.rules` 长度、表达式全文可见、状态列取自该策略的活动告警；没有规则时说明而不是空表。

## 前置与配置

- 集群里有至少一条含规则的规则组（项目页合并了 global/cluster/project 三个来源）
- 已登录且有该项目的读取权限

## 测试步骤

1. 用 API 取 globalrulegroups 里第一条带规则的规则组，记下 name 与 spec.rules
2. 打开告警策略页，搜索该名称，从行菜单点「详情」
3. 等待详情页 ready，读属性区与规则表
4. 点详情页的返回入口，确认回到列表

## 期望结果

- URL 落在 /alertingrules/<name> 且带 scope 参数
- 详情包含名称、作用域、策略状态、类型、规则数
- 规则表行数等于 spec.rules 长度
- 至少一条规则显示严重度、持续与完整表达式
- 规则状态列显示告警中/待触发/正常之一，不显示 0 或伪造状态
- 返回入口回到告警策略列表

## 失败排查

- 详情页空白：确认 scope 搜索参数与集合路径（global→globalrulegroups）一致
- 行数不对：确认读 spec.rules，不是 spec.groups
- 表达式被截断：确认详情页没有对 expr 做 truncate

## 产品改版后如何更新自动化

- 详情结构或选择器变化时改 pages/monitoring.py 的 detail_* 方法
