# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09 集群监控 · 未就绪整页接管与状态分区加载/空/未上报/无权限/失败分支

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/test/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

集群未就绪时集群监控页不挂载，路由层整页显示「等待集群加入」面板并提供集群概览入口，不显示趋势/状态分区/重试；集群就绪时状态分区的加载、空、未上报、无权限、失败五种画面互不顶替，一块失败不影响另一块与趋势分区。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09** — 已知集群未就绪（如成员集群的 agent 未连上，该集群所有 `/kapis/clusters/{c}/*` 返回 500 且信息为 `cluster {c} is not ready`），当打开集群监控，则集群监控页不挂载，由集群作用域路由层整页显示「等待集群加入」面板（`data-ai-id="cluster:not-ready"`）并提供集群概览入口（`cluster:not-ready-overview`）；页面不显示趋势卡、不显示集群状态分区、不显示重试按钮，也不在页面内重复实现第二套等待视图。就绪判断只认集群列表中的 `ready === false`：`ready` 缺失（列表读取中或读取失败）时不接管，页面照常挂载。状态分区的加载/空/未上报/无权限/失败互不顶替：加载中显示骨架；节点为 0 或厂商计数合计为 0 时显示空态说明，CPU 行不是空态；可读但节点或某模块没有记录时显示「未上报」而不是 0/0；componenthealth 403 时只有状态分区显示无权限说明且无重试，nodes/stats 403 时只有厂商块显示无权限说明；任一 5xx 时对应块显示错误说明与重试按钮且不影响另一块与趋势分区。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US7 - 集群未就绪时整页等待而不是一屏「不可用」 (Priority: P1)

作为 **集群管理员**，我希望 **集群未就绪时这个页面由路由层整页拦住并指向集群概览**，以便 **不会对着一屏不可能成功的重试按钮和被「不可用」占满的面板反复操作，也不会看到两个内容不同的等待视图**。

**Independent Test**：打开未就绪集群的监控页，路由层显示「等待集群加入」面板与「前往集群概览」入口，页面本身不挂载（没有趋势卡、没有状态分区、没有重试按钮）；集群就绪后重新进入该页显示完整页面。

## 前置与配置

- 集群 test 未就绪：all /kapis/clusters/test/* 返回 500 cluster test is not ready
- 集群 host 已就绪且 componenthealth / nodes/stats 可读
- 已登录 admin，并可读取两个集群

## 测试步骤

1. 打开 /kube-frontend/clusters/test/monitor，等待路由层 cluster:not-ready 可见
2. 核对没有 cluster-monitor:surface、没有趋势卡、没有状态分区、没有任何重试按钮，且有 cluster:not-ready-overview 入口且 href 指向 test 集群概览
3. 打开 host 集群监控，用 page.route 让 componenthealth 返回 403，重新打开页面
4. 核对节点块与组件块显示无权限说明、且两块都没有重试按钮；厂商块仍显示真实行
5. 让 componenthealth 返回 500，重新打开页面，核对节点块与组件块显示错误说明与重试；点组件块的重试确认再次发起请求；移除拦截后再点重试确认恢复 1/1
6. 让 nodes/stats 返回 403，重新打开页面，核对只有厂商块显示无权限说明且无重试，节点在线与组件状态仍为真实数据
7. 让 nodes/stats 返回 500，重新打开页面，核对厂商块显示错误与重试，而节点在线与组件状态仍为真实数据
8. 让趋势 range query 返回 500，核对节点在线、厂商与组件状态仍为真实数据（趋势失败不顶替状态分区）
9. 让 componenthealth 返回 200 但没有 nodeStatus，核对节点块显示未上报而不是 0/0
10. 让 componenthealth 返回 nodeStatus.totalNodes=0，核对节点块显示空态说明而不是把 0/0 当正常
11. 让 nodes/stats 返回 200 空对象，核对厂商块显示空态说明而不是空的比例条
12. 移除全部拦截，重新打开页面，核对状态分区恢复真实数据

## 期望结果

- test 集群整页只有等待面板与概览入口：cluster:not-ready 可见、cluster:not-ready-overview 可见且 href 以 /clusters/test/overview 结尾；无 cluster-monitor:surface、无趋势卡、无状态分区、无重试按钮
- 403：cluster-monitor:status:node-online:permission 与 cluster-monitor:status:permission 可见，两块没有 retry；厂商行仍为真实数据
- 500：cluster-monitor:status:node-online:error、cluster-monitor:status:error 与重试按钮可见；点重试再发一次请求；移除拦截后重试恢复 1/1；趋势仍是 29 张卡
- nodes/stats 403：cluster-monitor:status:vendor:permission 可见且无 retry，节点在线仍显示 1/1，服务组件行仍在
- nodes/stats 500：cluster-monitor:status:vendor:error 与 :vendor:retry 可见，节点在线仍显示 1/1，服务组件行仍在
- 趋势 range query 500：状态分区三块仍为真实数据，不被趋势错误顶替
- 缺 nodeStatus：cluster-monitor:status:node-online:unreported 可见且文案为未上报，不渲染 0/0
- totalNodes=0：cluster-monitor:status:node-online:empty 可见，不渲染 0/0
- nodes/stats 空对象：cluster-monitor:status:vendor:empty 可见
- 移除拦截后状态分区恢复真实数据（节点 1/1、厂商行存在）

## 失败排查

- 403 出现重试按钮：BlockError 的 isPermission 分支未生效
- 空响应被当成错误：componenthealth 200 缺字段应落到未上报，nodes/stats 空对象应落到厂商空态
- 未就绪页面挂载了页面：路由层 route.tsx 的 ready===false 判断没有生效，或 page 段被误判
- 移除拦截后不恢复：query retry 未触发 refetch，或 page.route 未 unroute

## 产品改版后如何更新自动化

- 句柄：cluster:not-ready / cluster:not-ready-overview / cluster-monitor:status<:error|:permission|:retry> / :status:node-online:<unreported|empty|permission|error|retry> / :status:vendor:<empty|permission|error|retry> / :status:components:core:<etcd|controller-manager|scheduler>
