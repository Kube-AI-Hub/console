# TC-L3-KUBE-FRONTEND-MONITORING-RULES-09 告警策略详情 · 规则搜索与分页

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules/thanos-rule?scope=global`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

策略详情的规则表每页 10 条并可翻页；搜索框按名称/表达式/摘要/说明/级别过滤，无匹配时给出说明；规则数不超过 10 时不渲染分页器。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-09** — 已知某规则组含 N 条规则（N 可能 >10），当打开策略详情，则规则表每页显示 10 条并在表格下方显示「第 x-y 条，共 N 条规则」与上一页/下一页按钮（N ≤ 10 时不渲染分页器）；当在规则搜索框输入关键字（匹配告警名称、PromQL 表达式、摘要、说明或级别，不区分大小写），则规则表只显示匹配行且分页回到第 1 页，无匹配时显示「没有匹配「关键字」的规则」而不是空表；清空关键字后恢复全部规则。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 点开一条策略，看清每条规则与它当前的告警状态 (Priority: P1)

作为 **项目运维**，我希望 **在策略详情页看到每条规则的名称、严重度、持续时间、说明与完整表达式，并知道哪条规则正在告警**，以便 **判断一条策略到底覆盖了什么、现在哪条在响**。

**Independent Test**：从列表打开一条含规则的策略详情，核对规则表行数等于接口 `spec.rules` 长度、表达式全文可见、状态列取自该策略的活动告警；没有规则时说明而不是空表。

## 前置与配置

- 集群存在 globalrulegroups 且其中一组规则数 > 10

## 测试步骤

1. 通过 API 找一组规则数 > 10 的策略，打开其详情（带 scope 参数）
2. 核对规则表行数为 10 且分页器显示「第 1-10 条，共 N 条规则」
3. 点下一页，核对范围变成第 11 条起
4. 在搜索框输入该组某条规则名的前缀，核对只剩匹配行；再输入不存在的字符串，核对出现无匹配说明

## 期望结果

- 首页 10 行，范围文案与实际一致
- 翻页后范围文案更新且行数 ≤ 10
- 搜索后行数减少且每行都含关键字；分页器在结果 ≤ 10 时消失
- 无匹配时显示 alertingrules:detail:no-rule-match，而不是空表

## 失败排查

- 搜索永远无匹配：取值用了 CRD 字段名（alert/expr）而不是 mapper 的 name/expression
- 分页器不出现：规则数 ≤ 10，属正常

## 产品改版后如何更新自动化

- 句柄：alertingrules:detail:rule-table / :rule-search / :rule-pager / :rule-range / :rule-prev / :rule-next / :no-rule-match
