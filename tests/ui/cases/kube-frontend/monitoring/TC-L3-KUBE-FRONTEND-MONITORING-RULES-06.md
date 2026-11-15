# TC-L3-KUBE-FRONTEND-MONITORING-RULES-06 告警策略 · 详情页的告警消息历史（时间线、空态、失败重试）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

打开一条策略的详情，按时间倒序读到它当前触发的告警消息（时间、状态、级别、摘要、目标、当前值、总数、分页）；没有消息时给出明确空态而不是错误；消息接口失败时给出可重试的错误。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-06** — 已知某规则组当前触发 M 条告警（M 可能为 0），当打开它的详情，则「告警消息」区以 `activeAt` 倒序显示最多 10 条消息，每条显示触发时间、状态（告警中/待触发）、级别、摘要、消息正文，并在接口提供时显示监控目标与当前值；区头显示「共 M 条」，M 大于 10 时分页可翻页；M 为 0 时显示「该策略当前没有告警消息」与说明，不显示错误面板；消息接口失败时该区显示错误与重试，重试成功后恢复列表；无权限（403）时显示无权限原因且不提供重试。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US7 - 在策略详情里看这条策略的告警消息 (Priority: P1)

作为 **值班运维**，我希望 **在策略详情里按时间倒序看到这条策略触发的告警消息**，以便 **不必切到总告警列表再按策略名筛一遍**。

**Independent Test**：打开一条正在告警的策略详情，核对消息区行数不超过 10、总数与接口 `totalItems` 一致、首行是最新一条；打开一条没有告警的策略，显示明确空态；消息接口失败时显示错误与重试。

## 前置与配置

- 集群里有至少一条产生过告警的全局规则组，也存在一条没有告警的规则组
- 已登录

## 测试步骤

1. 用 API 取 globalalerts，按 labels.rule_group 找出至少 3 条告警的规则组与一条 0 条告警的规则组
2. 打开有告警规则组的详情（scope=global），等消息区 ready
3. 读消息行、总数与排序
4. 打开 0 条告警规则组的详情，等消息区 empty
5. 用 route 让 globalalerts 返回 500，重开有告警规则组的详情，核对错误与重试入口；恢复后点重试

## 期望结果

- 消息区 ready 时首行是接口返回的最新一条（activeAt 最大）
- 行数不超过 10 且等于 min(total, 10)，总数文案等于接口 totalItems
- 每条消息显示触发时间、状态、级别、摘要与当前值/监控目标（接口提供时）
- 0 条告警时显示「该策略当前没有告警消息」，不出现错误面板
- 接口失败时消息区显示错误与重试，重试后恢复 ready

## 失败排查

- 消息区一直 loading：确认请求路径是 /kapis/alerting.kubesphere.io/v2beta1/globalalerts 且带 label_filters=rule_group
- 行数小于预期：过滤发生在服务端，不要在已分页的结果上再过滤
- 空态与错误混淆：先确认接口状态码，200+空数组才是空态

## 产品改版后如何更新自动化

- 消息区结构变化时改 pages/monitoring.py 的 messages_* 方法
