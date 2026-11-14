# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01 资源事件查询 · 最近事件与类型过滤

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-events`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/events`
- **需求**: `prd/kube-frontend/cluster-management/cluster-events.md`

## 产品功能

集群级事件浏览：倒序、类型过滤、窗口内关键字过滤，并明说窗口边界。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-events.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-events.md`](../../../../prd/kube-frontend/cluster-management/cluster-events.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01** — 已知集群有事件，当打开资源事件页，则按最近发生时间倒序列出类型、原因、对象、消息与「最近发生 · 次数」；行数等于接口在 `limit=200` 下的返回条数；切换类型过滤为「警告」后所有行类型均为 Warning；关键字过滤按原因/消息/命名空间/对象名匹配当前窗口；窗口满 200 条时显示「显示最近 200 条」的说明。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-events.md`](../../../../design/kube-frontend/cluster-management/cluster-events.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-events.md`](../../../../prd/kube-frontend/cluster-management/cluster-events.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群里现在什么在报错 (Priority: P1)

作为 **集群管理员**，我希望 **按类型/关键字过滤最近事件**，以便 **在不知道具体对象时定位问题**。

**Independent Test**：打开资源事件页，核对行数等于接口返回条数；切到「警告」后所有行都是 Warning。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群内有事件

## 测试步骤

1. 用 API 读 /api/v1/events?limit=200 与 fieldSelector=type=Warning
2. 打开资源事件页
3. 核对行数与接口一致、首行为最新事件
4. 切换类型过滤为警告，核对所有行均为 Warning

## 期望结果

- 行数等于接口返回条数
- 首行对应接口最新事件
- 过滤后只剩所选类型
- 窗口满时显示「显示最近 200 条」

## 失败排查

- 行数为 0：读了命名空间级接口（/api/v1/namespaces/<ns>/events）
- 过滤无效：只给了 filters 没给 filterValues/onFilterChange
- 首行不是最新：没有按 lastSeen 倒序

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterEventsPage.tsx
