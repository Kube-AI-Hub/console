# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06 集群监控 · 系统组件 APIServer/Scheduler 多序列、身份与单位

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

集群监控页在物理资源分组之后显示「系统组件」分区；APIServer 请求速率/延迟与 Scheduler 调度尝试/速率按 verb、result 身份分成多条线，延迟以 ms、速率为次/秒，全 NaN 的序列不画成 0 线。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06** — 已知监控后端可用且组件指标端点可读，当打开集群监控，则在物理资源分组之后显示「系统组件」分区，按固定顺序含 APIServer、Scheduler、etcd 三个子组；APIServer 子组显示请求速率（总数，次/秒）与请求延迟（总平均 + 按 `verb` 多序列，接口返回的秒值 ×1000 显示为 ms）；按 verb 的延迟按 `verb` 标签身份合并成多条线，同一 verb 一条线、不同 verb 不混成一条，整条为 `NaN` 的序列（本部署的 APPLY）不画成 0 线；Scheduler 子组显示调度尝试次数（按 `result` 分 scheduled/error/unschedulable，累积计数用整数）与调度尝试速率（同 result 三条线，次/秒），两者单位不同；多序列卡片带图例，图例项与线的身份一致；本部署 scheduler 调度延迟（平均值与分位）没有序列时该卡片显示空态说明而不是 0；APIServer 与 Scheduler 的当前值与同一次接口响应、同一时间窗的序列交叉核对一致。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 分辨控制面哪个操作/结果出了问题 (Priority: P1)

作为 **集群管理员**，我希望 **看到 APIServer 的请求速率与延迟按 verb 分开、Scheduler 的调度尝试按 result 分开**，以便 **判断控制面是整体变慢还是某个操作（GET/PUT…）变慢、调度是成功还是失败了——只看一个总量会把「GET 变慢」和「调度失败」混成同一个数字**。

**Independent Test**：打开集群监控，核对「系统组件」分区的 APIServer 请求延迟图有 GET/POST/PUT 等多条线且图例按 verb 命名，Scheduler 调度尝试图有 scheduled/error/unschedulable 三条线，线与图例一一对应。

## 前置与配置

- 监控后端可用，且 /kapis/monitoring.kubesphere.io/v1alpha3/components/apiserver 与 .../scheduler 返回 200
- 页面默认时间窗为最近 1 小时

## 测试步骤

1. 打开集群监控，等 cluster-monitor:surface 离开 loading，再等 cluster-monitor:group:apiserver / scheduler 进入 ready
2. 核对系统组件分区存在，三个子组顺序为 API Server → Scheduler → etcd
3. 读取 APIServer 请求延迟卡片的图例身份，与同一窗口接口返回的 apiserver_request_by_verb_latencies 的 verb 集合比对
4. 读取 Scheduler 调度尝试与尝试速率卡片的图例身份，与 scheduler_schedule_attempts 的 result 集合比对
5. 读取调度延迟卡片的空态，并确认接口的 scheduler_e2e_scheduling_latency_quantile 没有序列

## 期望结果

- 分区在物理资源五组之后；三个子组顺序固定，etcd 子组显示未上报（其断言在 TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07）
- APIServer 请求延迟图例按 verb 一条线，整条为 NaN 的 APPLY 不出现、不画 0 线；总平均单独一条
- 延迟显示为 ms（接口秒值 ×1000），请求速率与按 verb 速率为次/秒；按 verb 速率之和与总速率相近
- Scheduler 调度尝试为 scheduled/error/unschedulable 三条整数线，尝试速率为三条次/秒线；有序列且值为 0 时显示 0
- 调度延迟（平均与分位）在本部署无序列时卡片显示空态说明，不显示 0

## 失败排查

- 只看到一条延迟线：多序列被按位置合并或按指标名合并，检查 componentMonitorQueries.ts 的身份标签
- 延迟显示成 0.00x：秒没有 ×1000，检查 formatComponentValue 的 milliseconds 分支
- APPLY 出现一条贴底直线：NaN 没有过滤，检查 api-client component 方法的 Number.isFinite

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:components / cluster-monitor:group:<apiserver|scheduler|etcd> / cluster-monitor:<component>:<card> / :latest / :series:<identity> / :series:<identity>:value / :chart path[data-ai-series]
