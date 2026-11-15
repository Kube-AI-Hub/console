# TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-03 告警消息 · 详情下钻（策略与监控对象）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `alerts`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/alerting-messages`
- **需求**: `prd/kube-frontend/monitoring/alerts.md`

## 产品功能

告警消息详情按告警自身标签给出「告警策略」与「监控对象」两个下钻入口；标签不可解析时不伪造链接。

### 关联需求

- `prd/kube-frontend/monitoring/alerts.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/alerts.md`](../../../../prd/kube-frontend/monitoring/alerts.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-ALERTS-03** — 已知告警消息带有 `rule_group`/`rule_level` 以及 `namespace` 与一个对象键（pod/deployment/statefulset/daemonset/job/cronjob/service/ingress），当打开该消息详情，则出现「相关入口」：策略链接指向 `…/alertingrules/<rule_group>?scope=<global|cluster|project>`（scope 由 `rule_level` 推断，缺省为 project），对象链接指向该对象所在项目的作用域页面（工作空间由对象命名空间的 `kubesphere.io/workspace` 标签解析）；点击策略链接能进入策略详情页；告警没有这些标签时不渲染对应链接（不伪造入口）。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/alerts.md`](../../../../design/kube-frontend/monitoring/alerts.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/alerts.md`](../../../../prd/kube-frontend/monitoring/alerts.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 从一条告警跳到它的策略与被监控对象 (Priority: P1)

作为排障者，我打开一条告警后要能直接跳到触发它的策略，以及跳到告警描述的那个工作负载/容器组，而不是自己去列表里按名字找。

## 前置与配置

- 集群聚合告警集合（globalalerts）有至少一条消息

## 测试步骤

1. 打开集群告警消息页，点任一消息的详情
2. 核对 alerts:detail:links 与 alerts:detail:rule-link
3. 点策略链接，核对跳到告警策略详情且带 scope=global|cluster|project

## 期望结果

- 详情出现「相关入口」区，策略链接存在且 href 指向 …/alertingrules/<rule_group>?scope=<rule_level>
- 告警标签含 pod/deployment 等键时出现对象链接（不含时不为该行造链接）
- 点击后 URL 进入策略详情页

## 失败排查

- 链接为空：scope 推断错了（global 被当 project）
- 跳到 404：workspace/namespace 用了当前项目的而不是告警标签里的

## 产品改版后如何更新自动化

- 句柄：cluster-alerting-messages:detail / alerts:detail:links / alerts:detail:rule-link / alerts:detail:target-link
