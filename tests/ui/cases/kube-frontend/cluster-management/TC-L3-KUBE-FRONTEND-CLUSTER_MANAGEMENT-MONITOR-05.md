# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05 集群监控 · GPU / 磁盘 I/O / RDMA 面板与单位

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

物理资源面板按 GPU / 主机资源 / 磁盘 I/O / 网络 / RDMA 五组显示，补齐旧 console 的 GPU、磁盘吞吐/IOPS 与 RDMA 卡片，单位正确。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 已知监控后端可用，当打开集群监控，则除主机资源外还按分组显示 GPU、磁盘 I/O、网络与 RDMA 趋势：GPU 组含显存使用率、GPU 使用率（API 的 0–1 比值换算为百分比）与已分配 GPU 卡数（整数）；磁盘 I/O 组含读/写吞吐（B/KiB/MiB/GiB 每秒）与读/写 IOPS（两位小数）；RDMA 组含健康度、端口可用率（已启用端口数 ÷ 总端口数）、发送/接收速率、链路速率（API 以 bit/s 返回，显示为 Gb/s）、接收错误数、重传数、丢弃数与链路中断数；每个分组有标题且卡片顺序与分组顺序一致（GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA）；任一指标无数据时该卡片显示空态说明而不是 0；节点详情的监控沿用同一组件，只显示节点作用域的 CPU/内存/容器组三张卡片。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看趋势而不只是当前值 (Priority: P1)

作为 **集群管理员**，我希望 **看到最近一段时间的用量曲线**，以便 **区分「一直很忙」和「刚刚抖了一下」——概览的当前值无法回答这个**。

**Independent Test**：打开集群监控，核对四个卡片都画出曲线，且每张卡片显示最小/最大/当前值。

## 前置与配置

- 监控后端可用（/kapis/monitoring.kubesphere.io/v1alpha3/cluster 返回指标）

## 测试步骤

1. 打开集群监控，等 cluster-monitor:surface 进入 ready
2. 核对五个分组标题存在且顺序为 GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA
3. 核对 GPU/磁盘/RDMA 卡片存在且每个有当前值
4. 用接口同一窗口的序列核对：GPU 显存使用率的当前值 = 比值×100；RDMA 端口可用率 = 端口up/端口total×100；链路速率显示为 Gb/s

## 期望结果

- 五个分组标题与顺序正确；卡片总数 = 30（GPU 3 + 主机 11 + 磁盘 4 + 网络 2 + RDMA 10）
- GPU 使用率/显存为 0–100 百分比；已分配卡数为整数；磁盘吞吐带 /s 单位；IOPS 两位小数
- 链路速率形如 '907.5 Gb/s'（不是原始大整数）
- 任一卡片无数据时显示空态说明而不是 0

## 失败排查

- 数值显示成 0–1：忘了 scale=100（GPU/健康度是比值）
- 链路速率显示 907500000000.00：把 bit/s 当成普通小数，未用 Gb/s 格式

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:surface / :group:<gpu|host|disk|network|rdma> / :<card> / :<card>:latest
