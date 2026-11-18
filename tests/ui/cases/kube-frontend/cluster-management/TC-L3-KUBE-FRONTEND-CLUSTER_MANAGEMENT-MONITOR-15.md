# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15 集群监控 · 调度器页签：调度尝试/速率（按 result）与延迟图

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{{BASE_URL}}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

调度器监控是独立页签：调度尝试次数（按 result scheduled/error/unschedulable，累积整数）、调度尝试速率（同 result，次/秒）、调度延迟（平均 + 分位，秒 ×1000 显示 ms；无序列时给空态说明）三张大图，带坐标轴、网格、图例与读数；查询独立于 API Server 页签。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15** — 已知集群就绪且组件指标可读，当打开「调度器监控」页签，则显示三张带坐标轴与图例的大图：调度尝试次数 `cluster-monitor:scheduler:chart:attempts`（按 `result` 分 scheduled/error/unschedulable 三条线，累积计数、整数）、调度尝试速率 `cluster-monitor:scheduler:chart:rate`（同样按 `result` 三条线，次/秒）、调度延迟 `cluster-monitor:scheduler:chart:latency`（平均一条线 + 分位 p99/p90/p50 多条线，API 秒值×1000 显示 ms）；本部署调度延迟没有序列时该图只显示空态说明，不画零线、不显示 0；多序列按 `result`/`quantile` 身份合并；本页签查询与 API Server 页签独立，加载/空/失败/403（无重试）分支互不顶替。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US8 - 按使用场景进入五个页签并可直接深链 (Priority: P1)

作为 **集群管理员**，我希望 **打开监控后按场景在概览、物理资源、API Server、调度器、资源用量排行五个基础页签之间切换（etcd 接入监控时另有条件 etcd 页签），并能把某个页签直接存成链接**，以便 **在排查控制面变慢、磁盘 IO、RDMA 或资源排行时不用在一屏长页面里滚动寻找，刷新或分享后也不会丢失当前场景**。

**Independent Test**：打开监控默认在概览；点「调度器监控」后只显示调度器图表，地址栏出现 `?tab=scheduler`，刷新后仍停在调度器；五个页签都能通过 `?tab=` 直接打开；切页签不触发其它页签的查询；节点详情复用该页面时没有页签条。

### US4 - 分辨控制面哪个操作/结果出了问题 (Priority: P1)

作为 **集群管理员**，我希望 **看到 APIServer 的请求速率与延迟按 verb 分开、Scheduler 的调度尝试按 result 分开**，以便 **判断控制面是整体变慢还是某个操作（GET/PUT…）变慢、调度是成功还是失败了——只看一个总量会把「GET 变慢」和「调度失败」混成同一个数字**。

**Independent Test**：打开集群监控，核对「系统组件」分区的 APIServer 请求延迟图有 GET/POST/PUT 等多条线且图例按 verb 命名，Scheduler 调度尝试图有 scheduled/error/unschedulable 三条线，线与图例一一对应。

## 前置与配置

- 已登录 admin，集群 host 已就绪
- /kapis/monitoring.kubesphere.io/v1alpha3/components/scheduler 可读

## 测试步骤

1. 用 API 读 components/scheduler 的 window range query，取 attempts/rate/latency 指标与 result/quantile 身份
2. 打开 /kube-frontend/clusters/host/monitor?tab=scheduler，等待面板就绪
3. 核对三张图 cluster-monitor:scheduler:chart:attempts / :chart:rate / :chart:latency 都可见
4. 核对 attempts 与 rate 图按 result 三条身份（scheduled/error/unschedulable）画线且图例与线一一对应；attempts 为整数累积值，rate 为次/秒
5. 核对 latency 图：有序列时按平均与分位（p50/p90/p99）多条线，单位 ms；无序列时显示 :chart:latency:empty 说明而不是零线
6. 用 page.route 让 components/scheduler 返回 500：核对错误说明 + 重试；移除拦截后恢复
7. 核对 scheduler 页签的查询独立：在 apiserver 页签数据正常时让 scheduler 失败，只影响 scheduler 页签

## 期望结果

- 三张图齐全；attempts/rate 按 result 分三条身份，图例与线一致
- attempts 整数累积、rate 次/秒、latency 秒 ×1000 显示 ms（平均 + 分位）
- latency 无序列时 :empty 说明，不画零线
- 失败只影响本页签，错误说明 + 重试；403 时不提供重试

## 失败排查

- attempts 与 rate 画成同一张/同一单位：两图共用了格式化函数
- latency 一条直线 0：无序列时用了 0 补线，应走空态
- 三条 result 线颜色相同或身份混淆：身份键没有包含 result 标签

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:scheduler:chart:<attempts|rate|latency>[:legend|:empty]
