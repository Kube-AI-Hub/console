# TC-L3-KUBE-FRONTEND-MONITORING-RULES-03 告警策略 · 详情列出每条规则

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

打开某规则组的详情，逐条列出告警名称、严重度、持续时间与说明；规则数为 0 时说明而不是空表。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-03** — 已知某规则组包含若干规则，当打开它的「详情」，则显示所属作用域、状态、类型、规则数，并逐条列出告警名称、严重度、持续时间与说明（含表达式全文）；规则数为 0 时显示「该规则组没有规则」而不是空表格。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 知道一条策略里具体有哪些告警 (Priority: P1)

作为 **项目运维**，我希望 **点开一条策略就能看到它包含的每一条告警及其严重度、持续时间与表达式**，以便 **判断某类告警是否真的被覆盖，而不是只看规则条数**。

**Independent Test**：打开某规则组详情，核对规则行数与接口返回的 `spec.rules` 长度一致，且每行显示严重度与表达式。

## 前置与配置

- 集群里至少有一个含规则的规则组

## 测试步骤

1. 用 API 取一个有规则的规则组，记下 name 与 spec.rules
2. 打开告警策略页，搜索并打开该行详情
3. 核对规则行数与接口一致
4. 核对某条规则的名称、严重度、持续时间与说明出现在详情里

## 期望结果

- 详情包含作用域、状态、类型、规则数
- 规则表行数等于 spec.rules 长度
- 至少一条规则显示了严重度与表达式

## 失败排查

- 详情为空：确认弹窗用的是按 name+scope 的单对象读取
- 行数不对：确认读的是 spec.rules 而不是 spec.groups
- 严重度为空：部分规则把 severity 放在 labels 里，读取端需两处都看

## 产品改版后如何更新自动化

- 详情结构变化时改 pages/monitoring.py 的 detail 选择器
