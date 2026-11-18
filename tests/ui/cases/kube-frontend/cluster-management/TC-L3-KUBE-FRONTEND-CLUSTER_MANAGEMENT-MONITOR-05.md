# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05 集群监控 · GPU / 磁盘 I/O / RDMA 面板与单位

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

物理资源监控页签按 GPU / 主机资源 / 磁盘 I/O / 网络 / RDMA 五组渲染，共 18 张多序列大图；旧页按卡拆分的读写吞吐、读写 IOPS、网络收发、Pod 三态、负载 1/5/15、RDMA 端口/吞吐/错误合并为同一张图的不同身份序列。GPU 与健康度为 0–1 比值×100，链路速率 bit/s→Gb/s，IOPS 两位小数，无数据给空态说明。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 已知监控后端可用，当打开集群监控，则除主机资源外还按分组显示 GPU、磁盘 I/O、网络与 RDMA 趋势：GPU 组含显存使用率、GPU 使用率（API 的 0–1 比值换算为百分比）与已分配 GPU 卡数（整数）；磁盘 I/O 组含读/写吞吐（B/KiB/MiB/GiB 每秒）与读/写 IOPS（两位小数）；RDMA 组含健康度、端口可用率（已启用端口数 ÷ 总端口数）、发送/接收速率、链路速率（API 以 bit/s 返回，显示为 Gb/s）、接收错误数、重传数、丢弃数与链路中断数；每个分组有标题且卡片顺序与分组顺序一致（GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA），全页共 29 张卡片（GPU 3 + 主机资源 11 + 磁盘 I/O 4 + 网络 2 + RDMA 9）；任一指标无数据时该卡片显示空态说明而不是 0；节点详情的监控沿用同一组件，只显示节点作用域的 CPU/内存/容器组三张卡片。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看趋势而不只是当前值 (Priority: P1)

作为 **集群管理员**，我希望 **看到最近一段时间的用量曲线**，以便 **区分「一直很忙」和「刚刚抖了一下」——概览的当前值无法回答这个**。

**Independent Test**：打开集群监控，核对四个卡片都画出曲线，且每张卡片显示最小/最大/当前值。

## 前置与配置

- 监控后端可用（/kapis/monitoring.kubesphere.io/v1alpha3/cluster 返回指标）
- 页面默认时间窗为最近 1 小时

## 测试步骤

1. 打开集群监控，点「物理资源监控」页签（cluster-monitor:tab:resource），等 cluster-monitor:resource 就绪
2. 核对五个分组标题与顺序为 GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA
3. 核对图表总数为 18（gpu 3 + host 6 + disk 2 + network 1 + rdma 6）
4. 逐图核对 GPU、磁盘吞吐/IOPS、网络流量与 RDMA 图的图例或空态说明
5. 用接口同一窗口序列核对 GPU 显存=比值×100、RDMA 端口 up/total、链路速率显示为 Gb/s；吞吐为 B/s、IOPS 两位小数、错误类为整数

## 期望结果

- 五个分组齐全且顺序正确；共 18 张图，多序列图按身份一条线（负载 3、Pod 三态 3、磁盘读写 2、网络收发 2、RDMA 端口/吞吐/错误）
- GPU 显存/使用率与 RDMA 健康度为 0–100 百分比；已分配卡数、端口、错误/重传/丢弃/链路中断为整数
- 链路速率形如 '907.5 Gb/s'（一位小数），不是原始 bit/s 大整数
- 磁盘/网络/RDMA 吞吐为 B/KiB/MiB/GiB 每秒；IOPS 两位小数
- 任一图无数据时显示空态说明（<chart>:empty）而不是 0 或零线

## 失败排查

- 数值显示成 0–1：忘了 ×100（GPU/健康度是比值）
- 链路速率显示 907500000000.00：把 bit/s 当成普通小数，未用 Gb/s 格式
- 图数量或分组不对：多序列被按卡拆分、或组顺序错了；检查 monitorResourceCharts.ts 与 cluster-monitor:resource:chart:<group>:<key>

## 产品改版后如何更新自动化

- 页签/分组：cluster-monitor:tab:resource、cluster-monitor:resource:group:<gpu|host|disk|network|rdma>
- 图表：cluster-monitor:resource:chart:<group>:<key>，图例值位于 <chart>:legend:<series>:value，空态位于 <chart>:empty
- 分组与单位配置：monitorResourceCharts.ts
