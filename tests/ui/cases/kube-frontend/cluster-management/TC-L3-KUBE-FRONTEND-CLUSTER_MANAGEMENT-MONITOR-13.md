# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13 集群监控 · 物理资源页签：5 组 18 张多序列图（坐标轴/图例/空态）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{{BASE_URL}}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

物理资源监控页签按 GPU / 主机资源 / 磁盘 I/O / 网络 / RDMA 五组渲染 18 张趋势图，单张图承载同一指标的多个身份（负载 1/5/15、磁盘读/写吞吐与 IOPS、网络收发、Pod 三态、RDMA 端口/吞吐/错误）；每张图有坐标轴、网格、图例与交互读数；某指标无数据时该图给说明（<chart id>:empty）而不是零线；本页签一次 range 查询取全部指标。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13** — 已知集群就绪且监控 range 查询可用，当打开「物理资源监控」页签，则该页签以 `cluster-monitor:resource` 为根、按 GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA 五组渲染（组标题 `cluster-monitor:resource:group:<gpu|host|disk|network|rdma>`，每图 `cluster-monitor:resource:chart:<key>`，图例 `<chart>:legend`），共 18 张图：GPU 组 gpuMemory（`cluster_gpu_memory_utilisation`×100，%）、gpuUtilization（`cluster_gpu_utilization`×100，%）、gpuAllocated（`cluster_gpu_allocated`，卡，整数）；主机组 cpu（`cluster_cpu_utilisation`×100，%）、memory（`cluster_memory_utilisation`×100，%）、load（`cluster_load1`/`cluster_load5`/`cluster_load15` 三条线，两位小数）、diskUsage（`cluster_disk_size_usage`，B/KiB/MiB/GiB）、inode（`cluster_disk_inode_utilisation`×100，%）、pods（running/completed/abnormal 三条线，分别来自 `cluster_pod_running_count`/`cluster_pod_succeeded_count`/`cluster_pod_abnormal_count`，个）；磁盘组 throughput（read/write 两条线，来自 `cluster_disk_read_throughput`/`cluster_disk_write_throughput`，B/s）、iops（read/write 两条线，来自 `cluster_disk_read_iops`/`cluster_disk_write_iops`，两位小数）；网络组 traffic（tx/rx 两条线，来自 `cluster_net_bytes_transmitted`/`cluster_net_bytes_received`，B/s）；RDMA 组 health（`cluster_ib_health`×100，%）、ports（portUp/portTotal 两条线，来自 `cluster_ib_port_up`/`cluster_ib_port_total`，个）、throughput（tx/rx 两条线，来自 `cluster_ib_tx_bytes`/`cluster_ib_rx_bytes`，B/s）、linkSpeed（`cluster_ib_link_speed` 为 bit/s，÷1e9 显示 Gb/s 并保留一位小数）、errors（rxErrors/retrans/discards 三条线，来自 `cluster_ib_rx_errors`/`cluster_ib_retrans`/`cluster_ib_discards`，个）、linkDowned（`cluster_ib_link_downed`，个）；每张图带坐标轴、网格与交互读数，多序列按身份标签合并（同一身份一条线、不同身份不混线、不按返回顺序配对），序列名取 `cluster.monitor.series.*`，颜色取 ai-kit 图表 token；本页签只发起一次 range 查询（上述指标一次取回）；某指标在本集群没有序列或全部非有限值时该图只显示空态说明 `<chart id>:empty`，不画零线、不以 0 代替；切换离开再回到本页签时同一时间窗内复用已取数据。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US8 - 按使用场景进入五个页签并可直接深链 (Priority: P1)

作为 **集群管理员**，我希望 **打开监控后按场景在概览、物理资源、API Server、调度器、资源用量排行五个基础页签之间切换（etcd 接入监控时另有条件 etcd 页签），并能把某个页签直接存成链接**，以便 **在排查控制面变慢、磁盘 IO、RDMA 或资源排行时不用在一屏长页面里滚动寻找，刷新或分享后也不会丢失当前场景**。

**Independent Test**：打开监控默认在概览；点「调度器监控」后只显示调度器图表，地址栏出现 `?tab=scheduler`，刷新后仍停在调度器；五个页签都能通过 `?tab=` 直接打开；切页签不触发其它页签的查询；节点详情复用该页面时没有页签条。

## 前置与配置

- 已登录 admin，集群 host 已就绪，监控后端可用
- 本页签所需 cluster_* 指标在 range query 中可用（缺失的指标按空态断言并登记）

## 测试步骤

1. 打开 /kube-frontend/clusters/host/monitor?tab=resource，等待 surface 与页签面板就绪
2. 核对分组顺序与标题：gpu → host → disk → network → rdma，对应 cluster-monitor:resource:group:<g>
3. 核对每组图数量：gpu 3（gpuMemory/gpuUtilization/gpuAllocated）、host 6（cpu/memory/load/diskUsage/inode/pods）、disk 2（throughput/iops）、network 1（traffic）、rdma 6（health/ports/throughput/linkSpeed/errors/linkDowned），合计 18
4. 逐图核对 cluster-monitor:resource:chart:<group>:<key> 可见；有数据时至少画出一条曲线并有图例 :chart:<group>:<key>:legend；无数据时渲染 :chart:<group>:<key>:empty 说明且不画零线
5. 核对多序列身份：load 图三条（load1/load5/load15 或 cluster_load1/5/15 合并后）；磁盘吞吐/IOPS 各两条（读/写）；网络流量两条（发送/接收）；Pod 图三条（运行中/已完成/异常）；RDMA 端口两条（已启用/总端口）、RDMA 吞吐两条（发送/接收）、RDMA 错误三条（接收错误/重传/丢弃）；线与图例一一对应
6. 核对单位：利用率类图为百分比（含 %）；吞吐/流量为 B/s 系单位；IOPS 两位小数；链路速率为 Gb/s（API 的 bit/s ÷1e9，一位小数）
7. 核对本页签只有一次集群 range 查询：清空请求记录后打开 resource 页签，等待就绪，统计 /monitoring.kubesphere.io/v1alpha3/cluster 请求数为 1
8. 用 page.route 让 range query 返回只含部分指标（例如仅 cpu）：核对对应图仍画线，其余指标图显示 :empty 说明、不出现零线

## 期望结果

- 五个分组按 gpu/host/disk/network/rdma 顺序渲染，18 张图齐全（3/6/2/1/6）
- 每张图有标题、曲线、坐标轴与图例（单序列图图例可仅一项）；空数据图为 <chart id>:empty 说明
- 多序列身份按契约 §5 合并，图例项与线的身份一致，不同身份不混成一条
- 单位正确：利用率百分比、吞吐 B/s 系、IOPS 两位小数、链路速率 Gb/s 一位小数
- 本页签一次 range 查询完成全部指标；部分指标缺失时只影响对应图

## 失败排查

- 18 张图少了：分组配置缺项，或某指标无数据时整图被隐藏（应保留图并显示 :empty）
- 多序列图只有一条线：身份没有按 label 合并，而是每条 series 覆盖前一条
- 链路速率差 8 倍：把 bit/s 当字节/s 格式化
- 切换页签后出现两次 range 查询：页签重复挂载或查询 key 不稳定

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:resource:group:<gpu|host|disk|network|rdma> / cluster-monitor:resource:chart:<group>:<key>[:legend|:empty]
