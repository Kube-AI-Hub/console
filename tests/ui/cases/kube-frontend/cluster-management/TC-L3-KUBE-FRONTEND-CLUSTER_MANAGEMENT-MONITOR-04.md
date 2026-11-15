# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04 集群监控：自动刷新开关

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

集群监控页提供「自动刷新」开关，打开后每 5 秒按当前时间窗重取，关闭后停止。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04** — 已知集群监控页已加载，当点「自动刷新：关」按钮，则按钮变为「自动刷新：开」且每 5 秒以当前时间窗重取一次（窗口向前滚动），期间曲线与当前值持续更新；当再次点击关闭，则不再发起定时请求。离开页面时定时器必须停止。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看趋势而不只是当前值 (Priority: P1)

作为 **集群管理员**，我希望 **看到最近一段时间的用量曲线**，以便 **区分「一直很忙」和「刚刚抖了一下」——概览的当前值无法回答这个**。

**Independent Test**：打开集群监控，核对四个卡片都画出曲线，且每张卡片显示最小/最大/当前值。

## 前置与配置

- 已登录且监控后端可用

## 测试步骤

1. 打开集群监控页，记录初始请求数
2. 点击「自动刷新：关」按钮
3. 等待 12 秒，统计新增请求数
4. 再次点击关闭，等待 8 秒，统计新增请求数

## 期望结果

- 离开页面时定时器停止（不泄漏）

## 失败排查

- 无请求：定时器未启动或时间窗未滚动
- 关闭后仍有请求：定时器未清理

## 产品改版后如何更新自动化

- 选择器：cluster-monitor:auto-refresh（aria-pressed 表示开关状态）
