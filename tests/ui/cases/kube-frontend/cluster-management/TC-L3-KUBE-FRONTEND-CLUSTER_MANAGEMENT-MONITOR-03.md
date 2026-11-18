# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03 集群监控：物理资源指标

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

物理资源监控页签把旧页 13 张主机相关卡片合并为多序列大图（host 组 6 张 + network 组 1 张）：CPU/内存/inode 使用率（API 0–1 比值×100）、容器组三态（运行/已完成/异常）、1/5/15 分钟负载、磁盘用量（字节）、网络收发（B/s）；缺失数据显示空态说明而不是 0。节点数是概览页签的节点在线环图。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 已知监控后端可用，当打开集群监控，则除 CPU/内存/容器组/节点外，还显示异常容器组数、已完成容器组数、1/5/15 分钟平均负载、磁盘使用率、inode 使用率、网络发送与接收速率，共 13 张卡片；磁盘使用率由「已用容量 / 总容量」算出（0–100 的百分比），inode 使用率把 API 返回的 0–1 比值换算为百分比，网络速率以 B/KiB/MiB/GiB 每秒显示，平均负载保留两位小数；任一指标在窗口内没有数据时该卡片显示空态说明而不是 0。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看趋势而不只是当前值 (Priority: P1)

作为 **集群管理员**，我希望 **看到最近一段时间的用量曲线**，以便 **区分「一直很忙」和「刚刚抖了一下」——概览的当前值无法回答这个**。

**Independent Test**：打开集群监控，核对四个卡片都画出曲线，且每张卡片显示最小/最大/当前值。

## 前置与配置

- 已登录且监控后端可用
- 页面默认时间窗为最近 1 小时

## 测试步骤

1. 用同一窗口读取 cluster_cpu_utilisation / cluster_memory_utilisation / cluster_disk_inode_utilisation、cluster_pod_running_count / cluster_pod_succeeded_count / cluster_pod_abnormal_count、cluster_load1/5/15、cluster_disk_size_usage、cluster_net_bytes_transmitted / cluster_net_bytes_received
2. 打开集群监控，点「物理资源监控」页签（cluster-monitor:tab:resource），等 surface 就绪
3. 逐张核对 host:cpu / host:memory / host:pods / host:load / host:diskUsage / host:inode 与 network:traffic 存在，且有数据或空态说明
4. 读取图例当前值：cpu/memory/inode 为百分比、load1/5/15 两位小数、pods 三态整数、diskUsage 字节单位、network tx/rx 为 B/s
5. 用接口序列核对 cpu/memory/inode 当前值等于比值×100（±3 个百分点）
6. 切回概览页签，核对节点在线环图 healthy/total 与百分比

## 期望结果

- 7 张图齐全（6 张 host + 1 张 network），每张有图例与当前值；无数据时显示空态说明而不是 0
- CPU/内存/inode 为 0–100 百分比，等于 API 0–1 比值×100
- 容器组三态为整数、负载两位小数、磁盘用量带 B/KiB/MiB/GiB、网络速率为带 /s 的字节单位
- 节点数是概览页签的节点在线环图（healthy/total），不再是一张独立趋势卡

## 失败排查

- inode 显示 0% 或 1%：未乘 100
- 网络速率显示为纯数字：未按字节单位格式化
- 平均负载为整数：用了 Math.round
- 找不到 CPU 图：旧卡片句柄已改为页签图表 cluster-monitor:resource:chart:host:cpu

## 产品改版后如何更新自动化

- 图表句柄：cluster-monitor:resource:chart:<group>:<key>（host:cpu|memory|pods|load|diskUsage|inode、network:traffic），图例值位于 <chart>:legend:<series>:value
- 分组：cluster-monitor:resource:group:<gpu|host|disk|network|rdma>
- 节点环图：cluster-monitor:overview:node-ring
- 改 pages/cluster_monitor.py 与 ClusterResourceTab.tsx / monitorResourceCharts.ts
