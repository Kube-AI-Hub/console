# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-02 告警消息筛选（状态 / 级别）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-alerting`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/alerting-messages`
- **需求**: `prd/kube-frontend/cluster-management/cluster-alerting.md`

## 产品功能

集群告警消息页可按状态与级别筛选，筛选在服务端执行。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-alerting.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-02** — 已知集群告警消息页有消息，当在「状态」筛选里选「告警中」或「待触发」，则两个集合的请求都带上 `state` 参数，列表只显示该状态的消息、首屏行数等于该状态下的条数；当在「级别」筛选里选「严重/错误/提示」，则请求带上 `label_filters=severity=<值>`，列表只剩该级别；两个筛选可叠加，切换筛选时回到第 1 页；点「全部状态/全部级别」回到未过滤。筛选在**服务端**执行——集合是分页的，只在前端过滤等于只过滤碰巧取到的那一页。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-alerting.md`](../../../../design/kube-frontend/cluster-management/cluster-alerting.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群视角看全告警，而不必逐个项目点进去 (Priority: P1)

作为 **集群管理员**，我希望 **在一个集群页面上看到当前所有在响的告警，并区分哪些来自自定义策略、哪些来自平台内置策略**，以便 **判断这次告警是不是平台自带规则发出的，以及自定义策略是否已经生效**。

**Independent Test**：打开集群告警消息页，首屏行数等于 `min(20, clusteralerts.totalItems + globalalerts.totalItems)`，「来源」列同时能出现自定义与内置；打开集群告警策略页，自定义页签行数等于 `clusterrulegroups` 条数、内置页签行数等于 `globalrulegroups` 条数。

## 前置与配置

- 已登录且有集群告警读权限
- globalalerts 或 clusteralerts 至少有一个集合有消息

## 测试步骤

1. 打开告警消息页，记录首屏行数
2. 在「状态」筛选里选「待触发」，观察请求参数与行数
3. 再在「级别」筛选里选「提示」，确认两个条件叠加
4. 切回「全部状态」，确认行数恢复

## 期望结果

- 请求带上 state 与 label_filters，行数按筛选变化

## 失败排查

- 请求无 state 参数：筛选只在前端生效，分页集合下会漏数据
- 切换筛选后停在不存在的页码：没有回到第 1 页

## 产品改版后如何更新自动化

- 选择器：cluster-alerting-messages:filter:state / :filter:severity
