# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-02 资源事件查询：柱状图与过滤条件

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-events`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/events`
- **需求**: `prd/kube-frontend/cluster-management/cluster-events.md`

## 产品功能

资源事件页上方显示最近 12 小时的事件柱状图与总数，过滤条件对柱状图和列表同时生效。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-events.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-events.md`](../../../../prd/kube-frontend/cluster-management/cluster-events.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-02** — 已知资源事件页，当设置任一过滤条件（消息 / 项目 / 资源类型 / 资源名称 / 原因 / 类别）并点「查询」，则列表回到第 1 页并用该条件重新取数，页脚总数随之变化；点「重置」则清空所有条件并回到未过滤状态；**上方的 12 小时柱状图与列表使用同一组过滤条件**（柱状图的总数与桶由 `operation=histogram` 返回），因此柱高描述的就是下方这批记录；柱状图接口失败时只降级该卡片（显示「事件统计暂不可用」），列表照常可用。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-events.md`](../../../../design/kube-frontend/cluster-management/cluster-events.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-events.md`](../../../../prd/kube-frontend/cluster-management/cluster-events.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群里现在什么在报错 (Priority: P1)

作为 **集群管理员**，我希望 **按类型/关键字过滤最近事件**，以便 **在不知道具体对象时定位问题**。

**Independent Test**：打开资源事件页，核对行数等于接口返回条数；切到「警告」后所有行都是 Warning。

## 前置与配置

- 已登录且有集群权限
- 租户事件接口可用

## 测试步骤

1. 打开资源事件页，确认柱状图卡片与总数存在
2. 在「原因」中输入一个不可能匹配的值并点「查询」
3. 观察请求是否带 reason_filter，列表是否为空、总数是否变为 0
4. 点「重置」，观察请求不再带 reason_filter、总数恢复

## 期望结果

- 柱状图与列表使用同一组过滤条件，否则柱高会描述另一批记录

## 失败排查

- 柱状图不随过滤变化：两次请求没有共用 filters
- 柱状图接口失败时整页报错：没有把统计降级为单卡片

## 产品改版后如何更新自动化

- 选择器：cluster-events:histogram / :histogram:bars / :histogram:total / :histogram:empty / :histogram:error / :filter:reason / :search / :reset / :total / :empty
