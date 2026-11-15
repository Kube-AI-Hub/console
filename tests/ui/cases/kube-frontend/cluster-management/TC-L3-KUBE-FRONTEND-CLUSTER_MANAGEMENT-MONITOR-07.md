# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07 集群监控 · 系统组件未上报、请求失败与无权限分支

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

组件指标「没有序列」显示本集群未上报的说明而不是 0 或空白表格；请求失败显示错误与重试，无权限（403）只说明不提供重试；一个组件失败不影响其余组件。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07** — 已知本集群 `components/etcd` 请求成功但每条指标都返回 0 条序列，当打开集群监控，则 etcd 子组显示「本集群未上报该组件指标」的说明与可能原因，不显示 0 值卡片、不显示空白表格、也不整组消失；当某个组件请求失败（如 5xx）时该子组显示错误说明与重试按钮且可重试；当失败为无权限（403）时该子组显示权限说明且不显示重试按钮；无数据、错误、无权限三种画面互不顶替，某个组件失败时其余有数据的组件子组保持可用。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 组件指标不可用时说清原因 (Priority: P2)

作为 **集群管理员**，我希望 **组件指标没有上报、读取失败或没有权限时页面说清是哪一种**，以便 **不会把「这个集群没上报 etcd 监控」当成「etcd 一切为 0」，也不会对无权限的请求反复点重试**。

**Independent Test**：在该集群 etcd 无序列时打开页面，etcd 子组显示「本集群未上报该组件指标」类说明而不是 0 或空白表格；让组件请求返回 403 时，该子组显示权限说明且没有重试按钮。

## 前置与配置

- 本部署 components/etcd 返回 200 但每条指标 0 条序列
- 监控后端可用，apiserver/scheduler 组件有数据

## 测试步骤

1. 打开集群监控，等 cluster-monitor:group:etcd 进入 empty
2. 读取 etcd 子组说明文案与卡片数量
3. 用 page.route 让 components/scheduler 返回 403，切换时间窗触发重取，等该子组进入 error
4. 确认无权限文案存在，且没有重试按钮；apiserver 子组仍为 ready
5. 换成 500 响应，切换时间窗，确认错误说明与重试按钮；点重试确认发起新请求
6. 移除拦截后再点重试，确认子组恢复 ready

## 期望结果

- etcd 子组显示「本集群未上报该组件指标」类说明与可能原因；不渲染 0 值卡片、不显示空白表格、不整组消失
- 403 时显示无权限说明且没有重试按钮；500 时显示错误说明与重试按钮，点击会重新请求
- 移除失败后重试成功，子组恢复为卡片；无数据、错误、无权限三种画面互不顶替

## 失败排查

- etcd 显示 0：把 0 条序列当成了 0 值，检查 group 的 empty 分支
- 403 也出现重试按钮：ResourceErrorPanel 的 isPermission 分支未生效
- 切换时间窗后没有重取：组件 query key 缺 window/start/end

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:components:not-reported:<component> / cluster-monitor:components:retry:<component> / cluster-monitor:group:<component>[data-ai-state]
