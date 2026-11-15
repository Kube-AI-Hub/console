# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-03 资源事件查询：时间段选择与实时刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-events`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/events`
- **需求**: `prd/kube-frontend/cluster-management/cluster-events.md`

## 产品功能

资源事件页支持点击柱状图柱选择时间段，以及 5 秒实时刷新开关。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-events.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-events.md`](../../../../prd/kube-frontend/cluster-management/cluster-events.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-03** — 已知资源事件页显示 12 小时柱状图，当点击任一柱（桶），则该桶的 30 分钟时间段成为「已选时间段」：列表改为只取该时间段（请求带 `start_time`/`end_time`），总数随之变化，柱状图保持 12 小时并把该柱高亮；再次点击同一柱或点「清除」则取消选择、列表回到全量；当点「实时：关」按钮，则按钮变为「实时：开」并每 5 秒同时重取柱状图与列表（窗口前移、回到第 1 页），再次点击停止。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-events.md`](../../../../design/kube-frontend/cluster-management/cluster-events.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-events.md`](../../../../prd/kube-frontend/cluster-management/cluster-events.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群里现在什么在报错 (Priority: P1)

作为 **集群管理员**，我希望 **按类型/关键字过滤最近事件**，以便 **在不知道具体对象时定位问题**。

**Independent Test**：打开资源事件页，核对行数等于接口返回条数；切到「警告」后所有行都是 Warning。

## 前置与配置

- 已登录且有集群权限
- 租户事件接口可用且有事件

## 测试步骤

1. 打开资源事件页，等待柱状图与列表加载
2. 点击最后一根柱，读取「已选时间段」与总数
3. 再次点击同一柱，确认选择被清除
4. 打开「实时：关」，等待 12 秒观察请求次数，再关闭并等待 8 秒

## 期望结果

- 直方图固定 12 小时、只高亮选中柱（不钻进子区间）

## 失败排查

- 点柱无效果：柱不是按钮或没有 onClick
- 实时关闭后仍有请求：定时器未清理

## 产品改版后如何更新自动化

- 选择器：cluster-events:bucket:<epoch> / :selected-range / :selected-clear / :real-time / :total
