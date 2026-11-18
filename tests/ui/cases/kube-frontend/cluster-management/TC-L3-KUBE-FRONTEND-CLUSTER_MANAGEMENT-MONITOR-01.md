# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01 集群监控 · 四个趋势与时间窗切换

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

集群监控页签化后，原「四条趋势」分到两个页签：概览页签的节点在线环图负责节点健康数/总数与比例，物理资源监控页签用多序列大图承载 CPU、内存、容器组（运行/完成/异常）等主机指标；当前值在图例中给出，百分比由用量÷总量按时间戳配对算出；页头切换时间窗会按新区间重新取数。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — 已知监控后端可用，当打开集群监控，则四个卡片分别显示 CPU 使用率、内存使用率、运行中的容器组、在线节点，每张卡片有一条曲线与最小/最大/当前三个数值；CPU 与内存的当前值为 0–100 的百分比（由用量除以总量算出），容器组与节点为整数计数。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 已知在集群监控页，当切换时间窗（1 小时 → 24 小时），则以新的起止时间重新取数，曲线与当前值更新；单条曲线的采样点数不超过 200（窗口越大步长越大）。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看趋势而不只是当前值 (Priority: P1)

作为 **集群管理员**，我希望 **看到最近一段时间的用量曲线**，以便 **区分「一直很忙」和「刚刚抖了一下」——概览的当前值无法回答这个**。

**Independent Test**：打开集群监控，核对四个卡片都画出曲线，且每张卡片显示最小/最大/当前值。

### US2 - 切换时间窗看到不同粒度 (Priority: P1)

作为 **集群管理员**，我希望 **在 1 小时到 7 天之间切换**，以便 **既能看刚才发生了什么，也能看这一周的规律**。

**Independent Test**：点「最近 24 小时」，核对窗口切换后重新取数、当前值随之更新，且曲线点数与步长符合预期（不出现上万点）。

### US3 - 指标缺失时明确说明 (Priority: P2)

作为 **集群管理员**，我希望 **某个指标没有数据时卡片说明原因**，以便 **不会把「没数据」看成「用量为零」**。

**Independent Test**：在监控后端不可用的环境打开该页，卡片显示「该时间范围内没有数据」而不是一条 0 线。

## 前置与配置

- 已登录，且对集群 host 有读取权限
- KubeSphere 监控的 range query 可用，页面默认停在概览页签（最近 1 小时）

## 测试步骤

1. 用 API 取最近 1 小时的 cluster_cpu_usage / cluster_cpu_total、cluster_memory_usage_wo_cache / cluster_memory_total、cluster_pod_running_count，以及 componenthealth 的 nodeStatus
2. 打开集群监控页（默认 overview），等待 cluster-monitor:surface 就绪
3. 核对概览状态行的节点在线环图显示 healthy/total 且比例文本为百分比（cluster-monitor:overview:node-ring / :node-ring:count / :node-ring:value）
4. 点「物理资源监控」页签（cluster-monitor:tab:resource），等 cluster-monitor:resource:chart:host:cpu 可见
5. 核对 host:cpu / host:memory / host:pods 三张图都在，并读取图例当前值
6. 用接口同一时间戳的用量与总量核对 CPU、内存当前值等于用量÷总量×100
7. 读取 host:pods 的 running 图例值，应为整数计数
8. 记录切换前的监控请求，点「最近 24 小时」，核对新请求的 start 落在 24 小时窗口内、曲线与当前值更新
9. 核对切换后单条曲线点数与窗口步长匹配（24h 步长 15m，不随窗口线性膨胀）

## 期望结果

- 节点在线环图存在，healthy/total 与 componenthealth 一致，比例是百分比而不是 0/0
- CPU 与内存图例当前值为 0–100 的百分比，且等于同时间戳的用量÷总量（不是原始字节/核数）
- 容器组当前值为整数计数
- 切到 24 小时窗口后监控请求的 start/end 按新窗口变化，曲线与当前值更新，不继续用旧区间
- 曲线点数与所选窗口的步长匹配，不随窗口线性膨胀

## 失败排查

- 百分比大于 100 或出现 9e11 量级：直接画了字节/核，没有除以总量
- 切换窗口后数值不变：query key 未包含区间，或 end 每次渲染都重算
- 页签缺失或图表找不到：确认页签 IA 的 cluster-monitor:tab:* 与 cluster-monitor:resource:chart:<group>:<key> 句柄；旧的四张卡片句柄已被页签化替换

## 产品改版后如何更新自动化

- 页签：cluster-monitor:tab:<overview|resource|...>、cluster-monitor:tabpanel:<key>
- 图表：cluster-monitor:resource:chart:<group>:<key>（本用例 host:cpu / host:memory / host:pods），图例值位于 <chart>:legend:<series>:value
- 节点环图：cluster-monitor:overview:node-ring / :node-ring:count / :node-ring:value
- 改 pages/cluster_monitor.py 与 ClusterMonitorPage.tsx
