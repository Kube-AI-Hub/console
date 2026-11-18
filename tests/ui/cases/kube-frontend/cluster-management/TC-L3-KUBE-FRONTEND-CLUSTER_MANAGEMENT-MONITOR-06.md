# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06 集群监控 · 系统组件 APIServer/Scheduler 多序列、身份与单位

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

页签化后 API Server 监控与调度器监控各占一个页签：APIServer 页签用两张带轴大图承载请求延迟（总平均 + 按 verb 多序列，API 秒→ms）与请求速率（次/秒）；调度器页签用三张图承载调度尝试（按 result，累积整数）、尝试速率（次/秒）与调度延迟（平均+分位，秒→ms，本部署无序列时给空态）。多序列按 verb/result/quantile 身份合并，全 NaN 的序列不画 0 线。etcd 接入监控时另有条件 etcd 页签，本部署不可见（其分支见 MONITOR-07）。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06** — 已知监控后端可用且组件指标端点可读，当打开集群监控的 API Server 监控 / 调度器监控页签（etcd 接入监控时另有 etcd 页签），则组件级指标按 APIServer、Scheduler、etcd 三个子组呈现（页签化后分别落在对应页签）；APIServer 子组显示请求速率（总数，次/秒）与请求延迟（总平均 + 按 `verb` 多序列，接口返回的秒值 ×1000 显示为 ms）；按 verb 的延迟按 `verb` 标签身份合并成多条线，同一 verb 一条线、不同 verb 不混成一条，整条为 `NaN` 的序列（本部署的 APPLY）不画成 0 线；Scheduler 子组显示调度尝试次数（按 `result` 分 scheduled/error/unschedulable，累积计数用整数）与调度尝试速率（同 result 三条线，次/秒），两者单位不同；多序列卡片带图例，图例项与线的身份一致；本部署 scheduler 调度延迟（平均值与分位）没有序列时该卡片显示空态说明而不是 0；APIServer 与 Scheduler 的当前值与同一次接口响应、同一时间窗的序列交叉核对一致。

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

1. 用同一窗口读取 components/apiserver 与 components/scheduler 的序列（保留身份标签）
2. 打开集群监控，点「API Server 监控」页签（cluster-monitor:tab:apiserver），等 cluster-monitor:tabpanel:apiserver 就绪
3. 核对 cluster-monitor:apiserver:chart:latency 与 :chart:rate 存在；读取延迟图图例身份与接口 verb 集合对比，读取请求速率当前值
4. 点「调度器监控」页签（cluster-monitor:tab:scheduler），核对 :chart:attempts / :chart:rate / :chart:latency 三张图
5. 读取 attempts 的 result 身份与接口对比，核对尝试值为整数、速率为次/秒两位小数；读取延迟图空态并确认接口无序列
6. 用 page.route 让 apiserver 返回一条 APPLY 全 NaN 与 GET 有限值，切换时间窗触发重取，核对只画 GET 与总平均两条线

## 期望结果

- APIServer 页签两张图齐全；延迟图按 verb 一条线、总平均单独一条；整条 NaN 的 APPLY 不出现、不画 0 线；延迟为 ms（接口秒值×1000），速率为次/秒两位小数
- Scheduler 页签三张图齐全；attempts 按 result 一条线且为累积整数，rate 按 result 为次/秒，缺失身份不补 0 线
- 本部署调度延迟无序列时 :chart:latency 显示空态说明且没有曲线，不显示 0
- 多序列身份不混淆：同一身份一条线，返回顺序不影响图例

## 失败排查

- 只看到一条延迟线：多序列被按位置合并，检查 componentMonitorQueries.ts 的身份标签
- 延迟显示成 0.00x：秒没有 ×1000
- APPLY 出现贴底直线：NaN 没有过滤
- 找不到图：旧「系统组件分区」句柄已被页签图句柄替换（cluster-monitor:apiserver:chart:* 与 cluster-monitor:scheduler:chart:*）

## 产品改版后如何更新自动化

- 页签：cluster-monitor:tab:<apiserver|scheduler>、cluster-monitor:tabpanel:<key>
- 图表：cluster-monitor:<apiserver|scheduler>:chart:<key>，图例值位于 <chart>:legend:<identity>:value，空态位于 <chart>:empty，曲线为 path[data-ai-trend-line][data-ai-series]
- 改 pages/cluster_monitor.py 与 ClusterApiServerTab.tsx / ClusterSchedulerTab.tsx
