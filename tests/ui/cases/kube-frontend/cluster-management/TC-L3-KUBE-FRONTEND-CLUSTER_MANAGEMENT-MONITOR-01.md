# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01 集群监控 · 四个趋势与时间窗切换

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

集群监控显示 CPU/内存/容器组/节点四条趋势，每张卡片有曲线与最小/最大/当前值；切换时间窗会按新区间重新取数。

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
- KubeSphere 监控的 range query 可用

## 测试步骤

1. 用 API 取最近 1 小时的 cluster_cpu_usage 与 cluster_cpu_total，按时间戳相除得到百分比区间
2. 打开集群监控页，等待 surface 就绪
3. 核对四张卡片都存在且都画出了曲线
4. 核对 CPU 与内存的当前值为 0-100 的百分比，容器组与节点为整数
5. 点「最近 24 小时」，核对重新取数且当前值更新
6. 核对单条曲线点数不超过 200

## 期望结果

- 四张卡片齐全，各有最小/最大/当前三个数值
- 百分比由用量与总量相除得到（不得出现大于 100 的值）
- 切换时间窗后请求区间变化、数值更新
- 曲线点数与步长匹配，不随窗口线性膨胀

## 失败排查

- 百分比大于 100：说明直接把字节/核当成了百分比，需除以总量
- 曲线贴底一条直线：说明用了固定 0-100 刻度而不是按峰值缩放
- 切换窗口后数值不变：检查 query key 是否包含区间，或 end 是否每次渲染都重算
- 卡片显示无数据：确认 range query 返回 matrix 且 step 在保留期内

## 产品改版后如何更新自动化

- 卡片或标识变化时改 pages/cluster_monitor.py 与 ClusterMonitorPage.tsx
