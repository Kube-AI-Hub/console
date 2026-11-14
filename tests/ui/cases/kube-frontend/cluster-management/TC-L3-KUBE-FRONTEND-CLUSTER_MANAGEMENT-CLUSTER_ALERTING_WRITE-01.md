# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01 集群告警 · 内置策略启停入口与消息下钻

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-alerting-write`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/alerting-policies`
- **需求**: `prd/kube-frontend/cluster-management/cluster-alerting-write.md`

## 产品功能

内置策略行提供详情与启用/停用（写 alerting.kubesphere.io/enable 标签，探测确认可写），不提供编辑/删除；消息页点击首行标题打开详情，字段与 labels/annotations 白名单摘要非空。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-alerting-write.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01** — 已知在 host 集群，当打开集群告警策略页并切到「内置策略」页签，则每行行操作菜单提供「详情」与「启用/停用」（实测 `PATCH /apis/alerting.kubesphere.io/v2beta1/globalrulegroups/<name>` 的 merge-patch 在 dryRun 与真实写入下均返回 200，`alerting.kubesphere.io/enable` 标签写入后回读为 `false`、恢复后为 `true`；写的是与老 console 相同的标签），但不提供编辑/删除；当打开集群告警消息页并点击首行消息标题，则弹出详情，显示 summary/message、state、severity、rule_group、rule_type、activeAt、当前值，以及 labels/annotations 的白名单摘要，且这些字段至少各有一项非空；详情不展示原始对象 JSON 与审计级字段。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../design/kube-frontend/cluster-management/cluster-alerting-write.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 下钻一条告警，并停用平台内置策略 (Priority: P1)

作为 **集群管理员**，我希望 **点开一条告警看到它的状态、级别、所属策略、规则类型与关键标签/注解**，并能 **停用某条由平台内置策略发出的告警**，以便 **在确认误报来源后立即止血，而不是等平台升级或改 YAML**。

**Independent Test**：打开集群告警消息页，点第一条消息的标题，详情弹窗出现且 summary/state/severity/rule_group/rule_type/labels/annotations 各有一项非空；打开集群告警策略页内置页签，首行行操作菜单里有「启用」或「停用」。

## 前置与配置

- 已登录，且在 host 集群
- globalrulegroups 至少 1 条；globalalerts 至少 1 条
- 探测结论：PATCH globalrulegroups/<name> 的 merge-patch（dryRun 与真实）返回 200，enable 标签写入后回读一致

## 测试步骤

1. 打开 /kube-frontend/clusters/host/alerting-policies，切到「内置策略」页签
2. 打开首行的行操作菜单，核对有「详情」和「启用/停用」之一，没有「编辑」「删除」
3. 打开 /kube-frontend/clusters/host/alerting-messages，点击首行消息标题
4. 核对详情弹窗出现，且规则类型/当前值/标签摘要/注解摘要都有内容

## 期望结果

- 内置行行操作含「详情」+「启用」或「停用」，不含编辑/删除；页面有内置策略提示
- 消息详情出现且字段非空：summary/message、state、severity、rule_group、rule_type、activeAt、value、labels、annotations
- 详情不出现 rule_id 等原始内部字段

## 失败排查

- 菜单没有启停：确认当前页签是 builtin，且 rowActions 未按 tab 过滤
- 详情为空：确认消息行来自 v2beta1 globalalerts，api-client 已映射 labels/annotations
- 详情出现 rule_id：检查白名单是否被绕过或整对象被渲染

## 产品改版后如何更新自动化

- 页面 data-ai-id 变化时同步本用例
