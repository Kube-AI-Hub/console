# 集群监控 · 物理资源面板补齐（GPU / 磁盘 I/O / RDMA）

> 单元：CHECK-07（监控/图表/组件/日志与通知）中的 R-29「图表能力整体（14 类指标 → 4 条线）」剩余项。
> 日期 2026-11-15。方法：docs/legacy-ui-migration-guide.md；模板：docs/plans/page-migration-template.md。
> 规格：prd|design/kube-frontend/cluster-management/monitor.md（AC-MONITOR-05、DEC-05/06、CON/GOT）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务 | 集群管理员在集群监控页看清 GPU、磁盘 I/O 与 RDMA 的实际用量与健康，而不只是 CPU/内存/Pod/节点 |
| 旧入口/源码 | `clusters/containers/Monitor/Cluster/Monitor/PhysicalResource/index.jsx`（约 30 张图，含 GPU 3、磁盘吞吐/IOPS、网络 2、RDMA 10） |
| 新入口/文件 | `/kube-frontend/clusters/<cluster>/monitor`；`pages/cluster/ClusterMonitorPage.tsx`；`packages/api-client/src/cluster.ts`（rangeMetricsApi 未改） |
| 环境/角色 | B200（BFF 8092 → 隧道 18088），host 集群，admin；深色主题，中文为主 + 英文复核 |
| 视口 | 1280×900 全页 + 1024/1600；英文 1280 |
| 子页面与状态 | 集群监控页；节点详情的监控复用同一组件（只保留 node 作用域的三张卡）；空/错误/加载三态 |
| 并行边界 | 只改 ClusterMonitorPage、locales（cluster.monitor.*）、prd/design monitor、tests/ui 下 MONITOR 用例；未触碰并行方在途文件 |

## 2. 旧能力与归宿（摘要）

| 旧能力 | 归宿 | 新 AC/用例 |
| --- | --- | --- |
| GPU 显存使用率 / GPU 使用率 / 已分配卡数 | 补齐（比值×100，卡数为整数） | AC-MONITOR-05；TC-MONITOR-05 |
| 磁盘读/写吞吐 | 补齐（字节/秒，B/KiB/MiB/GiB） | 同上 |
| 磁盘读/写 IOPS | 补齐（两位小数） | 同上 |
| 网络发送/接收速率 | 保留（此前已有） | AC-MONITOR-03 |
| RDMA 健康度 / 端口可用率 / 收发速率 / 链路速率 / 错误 / 重传 / 丢弃 / 链路中断 | 补齐（端口可用率 = up ÷ total；链路速率 bit/s → Gb/s） | AC-MONITOR-05；TC-MONITOR-05 |
| etcd / apiserver / scheduler 面板 | 未纳入（`/kapis/monitoring.../cluster` 对 `etcd_*`/`apiserver_*`/`scheduler_*` 实测返回 0 条序列，组件级指标走另一路径） | 登记为后续单元 |
| 分组标题 | 改进（旧 console 一列平铺，新页按 GPU/主机/磁盘/网络/RDMA 五组） | AC-MONITOR-05；DEC-06 |

## 3. 数据契约与全链路（实测 2026-11-15）

- 查询：`GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?cluster=host&metrics_filter=<name>$&start&end&step=60s`；
  逐条实测均返回 1 条序列：`cluster_gpu_utilization`、`cluster_gpu_memory_utilisation`、`cluster_gpu_allocated`、
  `cluster_disk_{read,write}_{iops,throughput}`、`cluster_ib_{health,port_up,port_total,rx_bytes,tx_bytes,link_speed,rx_errors,retrans,discards,link_downed}`。
- 值示例：GPU 显存 0.69（→69%）、磁盘读 IOPS 37753.5、IB 健康 0.867（→87%）、IB 链路速率 907500000000 bit/s（→907.5 Gb/s）。
- 单位规则：比值型（GPU 显存/GPU 使用率/IB 健康）为 0–1，×100；端口可用率 = `port_up ÷ port_total`（同一时间戳）；
  吞吐为字节/秒；IOPS 两位小数；链路速率为 **bit/s**，÷1e9 显示 Gb/s。
- 缺值：某指标没有序列时卡片显示「该时间范围内没有数据」而不是 0。

## 4. 交互、视觉与复用

- 分组：GPU / 主机资源 / 磁盘 I/O / 网络 / RDMA，每组一个标题 + 两列网格（`cluster-monitor:group:*`）。
- 卡片沿用共享 TrendChart/Sparkline；每张卡显示当前值 + 最小/最大/当前/截至时间；线按卡片自身峰值缩放（DEC-04 保留）。
- 未新增公共组件：分组只是布局，指标查询沿用既有 `rangeMetricsApi.cluster`。

## 5. 编码与回归

- `ClusterMonitorPage` 的 CHARTS 从 13 张扩到 29 张并带 group/nodeScoped 标记；新增 linkRate 格式与 5 个分组标题。
- 既有 MONITOR-01/03 的「卡片数」断言按新结构更新为 29（不是放宽，而是与新 AC 对齐）；节点详情仍只显示三张 node 作用域卡片。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未通过或未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 上表全部有归宿；etcd/apiserver/scheduler 有探测证据后登记后续 | 组件级指标面板 |
| 数据语义 | 通过 | 5 组卡片对接口同窗口序列交叉核对（GPU 显存/端口可用率差值 ≤2 个百分点） | — |
| 交互与权限 | 通过 | 时间窗、自动刷新、空态沿用既有用例；新增卡片无独立权限面 | 受限账号未单独验 |
| 视觉与主题 | 通过（人工） | `/tmp/cluster-monitor-{1280,1600,en}.png`；分组顺序、单位、无横向溢出 | 浅色/第二色调未验 |
| 静态/类型/构建/测试 | 通过 | check_docs --strict 本批 0/0；console-next tsc 0；vite build ✓；监控相关 E2E 5 passed（-n 0） | 全仓串行 E2E 未跑 |
| 本地全栈/B200 | 通过 | BFF→B200 真实指标（非模拟） | 新版部署未验 |

备注：一次套件运行里 MONITOR_RESOURCE-01 曾因并发负载下重查询返回空而失败，单独复跑与整套复跑均通过（11s / 62s），登记为环境抖动而非产品缺陷；有证据可复查。
