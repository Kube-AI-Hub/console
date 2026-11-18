# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07 集群监控 · 系统组件未上报、请求失败与无权限分支

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

etcd 恢复为条件页签（旧 requireETCD 的页内形态）：ServiceMonitor kubesphere-monitoring-system/etcd 探测为 200 时页签条末尾出现 etcd 页签，404 或探测失败时隐藏，隐藏时访问 ?tab=etcd 回退概览。etcd 组件返回 200 但无序列时页内显示「本集群未上报该组件指标」说明而不是 0 值卡片；组件请求 5xx 显示错误与重试、403 只说明无权限不给重试；一个组件失败不影响其它页签。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07** — 已知 etcd 接入监控（etcd 页签可见）且本集群 `components/etcd` 请求成功但每条指标都返回 0 条序列，当打开 etcd 页签，则 etcd 子组显示「本集群未上报该组件指标」的说明与可能原因，不显示 0 值卡片、不显示空白表格、也不整组消失；当某个组件请求失败（如 5xx）时该子组显示错误说明与重试按钮且可重试；当失败为无权限（403）时该子组显示权限说明且不显示重试按钮；无数据、错误、无权限三种画面互不顶替，某个组件失败时其余有数据的组件子组保持可用。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 组件指标不可用时说清原因 (Priority: P2)

作为 **集群管理员**，我希望 **组件指标没有上报、读取失败或没有权限时页面说清是哪一种**，以便 **不会把「这个集群没上报 etcd 监控」当成「etcd 一切为 0」，也不会对无权限的请求反复点重试**。

**Independent Test**：在该集群 etcd 无序列时打开页面，etcd 子组显示「本集群未上报该组件指标」类说明而不是 0 或空白表格；让组件请求返回 403 时，该子组显示权限说明且没有重试按钮。

## 前置与配置

- 本部署 ServiceMonitor 探测为 404，etcd 页签隐藏；可用 page.route 模拟 200 覆盖 etcd 页内分支
- 本部署 components/etcd 返回 200 但每条指标 0 条序列
- 监控后端可用，apiserver/scheduler 组件有数据

## 测试步骤

1. 打开集群监控，核对页签条为基础 5 项（overview/resource/apiserver/scheduler/ranking）且没有 cluster-monitor:tab:etcd
2. 直接访问 ?tab=etcd，核对回退 overview（cluster-monitor:tabpanel:overview 可见、当前页签为 overview）
3. 用 page.route 让 servicemonitors/etcd 返回 200，重新打开页面，核对 etcd 页签出现
4. 点 etcd 页签，核对 cluster-monitor:etcd:no-data 文案含「未上报」类说明，且没有 0 值卡片或曲线
5. 让 components/etcd 返回 500，重进 etcd 页签，核对错误面板与重试按钮；点重试确认重新请求；再切到 apiserver 页签确认不受影响
6. 让 components/etcd 返回 403，核对无权限文案且没有重试按钮
7. 移除拦截后重新打开页面，核对 etcd 页签再次隐藏、页签条恢复基础 5 项

## 期望结果

- 404 时页签条不含 etcd；访问 ?tab=etcd 回退概览且不报错
- 200 时出现 etcd 页签；无序列时页内显示「本集群未上报该组件指标」类说明与可能原因，不渲染 0 值卡片、不画曲线、也不整组消失
- 5xx 时显示错误说明与重试按钮，点击会重新请求；403 时显示无权限说明且没有重试按钮
- 无数据、错误、无权限三种画面互不顶替；etcd 失败不影响 apiserver/scheduler 页签

## 失败排查

- etcd 显示 0：把 0 条序列当成了 0 值
- 403 也出现重试按钮：ResourceErrorPanel 的 isPermission 分支未生效
- 访问 ?tab=etcd 报错或停在不可见页签：条件页签隐藏时应回退 overview
- 找不到 etcd 句柄：cluster-monitor:tab:etcd / :tabpanel:etcd / :etcd:no-data / :etcd:retry

## 产品改版后如何更新自动化

- 页签：cluster-monitor:tab:etcd、cluster-monitor:tabpanel:etcd（仅 ServiceMonitor 200 时存在）
- 页内分支：cluster-monitor:etcd:no-data / :etcd:retry / :etcd:chart:<key>、resource-error
- 改 pages/cluster_monitor.py 与条件 etcd 页签实现
