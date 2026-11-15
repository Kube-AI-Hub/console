# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03 集群监控：物理资源指标

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

集群监控页显示 13 张物理资源卡片：CPU/内存/容器组（运行、异常、完成）/节点/负载 1-5-15/磁盘/inode/网络收发。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — （需求里找不到这条 AC，请先补需求或改 `covers`）

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

1. 打开集群监控页
2. 逐个核对待办卡片是否存在
3. 读取 CPU、内存、磁盘、inode、网络速率、平均负载的当前值

## 期望结果

- 磁盘使用率由已用/总量算出；inode 由 0–1 比值乘 100

## 失败排查

- inode 显示 0%：未乘 100
- 网络速率显示为纯数字：未按字节单位格式化
- 平均负载为整数：用了 Math.round

## 产品改版后如何更新自动化

- 选择器：cluster-monitor:cpu / :memory / :pods / :pods-abnormal / :pods-succeeded / :nodes / :load1 / :load5 / :load15 / :disk / :inode / :net-tx / :net-rx（每张卡片带 :latest 值）
