# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01 集群级告警 · 消息合并与策略两页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-alerting`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/alerting-policies`
- **需求**: `prd/kube-frontend/cluster-management/cluster-alerting.md`

## 产品功能

集群告警消息页合并 clusteralerts 与 globalalerts，首屏行数等于 min(20,total)；告警策略页「自定义策略/内置策略」两个页签的行数分别等于 clusterrulegroups / globalrulegroups 的 API 计数，内置页签无写操作。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-alerting.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01** — 已知在 host 集群（`globalrulegroups` 有 18 个内置策略、`clusterrulegroups` 当前为空），当打开集群告警策略页，则默认「自定义策略」页签，行数等于 `clusterrulegroups` 的 API 条数；切到「内置策略」页签后行数等于 `globalrulegroups` 的 API 条数（页大小为 50，覆盖当前计数），且内置页签不提供启用/停用或编辑入口；当打开集群告警消息页，则列出 `clusteralerts` 与 `globalalerts` 合并后的消息，首屏行数等于 `min(20, clusteralerts.totalItems + globalalerts.totalItems)`，并显示消息、状态、级别、所属策略、来源与触发时间。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-alerting.md`](../../../../design/kube-frontend/cluster-management/cluster-alerting.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群视角看全告警，而不必逐个项目点进去 (Priority: P1)

作为 **集群管理员**，我希望 **在一个集群页面上看到当前所有在响的告警，并区分哪些来自自定义策略、哪些来自平台内置策略**，以便 **判断这次告警是不是平台自带规则发出的，以及自定义策略是否已经生效**。

**Independent Test**：打开集群告警消息页，首屏行数等于 `min(20, clusteralerts.totalItems + globalalerts.totalItems)`，「来源」列同时能出现自定义与内置；打开集群告警策略页，自定义页签行数等于 `clusterrulegroups` 条数、内置页签行数等于 `globalrulegroups` 条数。

## 前置与配置

- 已登录，且在 host 集群
- 告警模块已安装，v2beta1 的 clusteralerts / globalalerts / clusterrulegroups / globalrulegroups 可读

## 测试步骤

1. 用 API 读取 clusterrulegroups 与 globalrulegroups 条数
2. 打开 /kube-frontend/clusters/host/alerting-policies，核对默认「自定义策略」页签行数
3. 切到「内置策略」页签，核对行数与 globalrulegroups 条数，并打开行操作菜单确认没有启用/停用
4. 用 API 读取 clusteralerts 与 globalalerts 的 totalItems，计算 min(20, 两者之和)
5. 打开 /kube-frontend/clusters/host/alerting-messages，核对首屏行数与表头含「来源」

## 期望结果

- 自定义页签行数 = clusterrulegroups 条数；内置页签行数 = globalrulegroups 条数（页大小 50 内）
- 内置页签行操作只有「详情」，没有启用/停用
- 消息页首屏行数 = min(20, clusteralerts.totalItems + globalalerts.totalItems)
- 消息表含来源列，页面状态不是 loading

## 失败排查

- 页面消息为空：是否走了 v1alpha2（200 空体）而不是 v2beta1 的 clusteralerts/globalalerts
- 页签行数对不上：确认页大小是否覆盖计数，切换页签后是否等待 active query 完成
- 内置页签出现写操作：检查 rowActions 是否按 tab 过滤

## 产品改版后如何更新自动化

- 页面列或 data-ai-id 变化时同步本用例；集群策略计数以 API 为准，不写死 18
