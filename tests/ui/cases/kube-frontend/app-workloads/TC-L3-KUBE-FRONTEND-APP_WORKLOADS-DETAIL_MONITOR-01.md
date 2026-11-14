# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01 工作负载 / Pod 详情 · 监控页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail-monitor`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/kubesphere-system/deployments`
- **需求**: `prd/kube-frontend/app-workloads/detail-monitor.md`

## 产品功能

详情页的「监控」页签：CPU 与内存用量随时间（1h/6h/24h），工作负载读服务端按关联容器组汇总的序列，Pod 读自身序列；监控不可用 / 窗口内无数据 / 值为 0 三种情况可区分。

### 关联需求

- `prd/kube-frontend/app-workloads/detail-monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail-monitor.md`](../../../../prd/kube-frontend/app-workloads/detail-monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01** — 已知 Deployment 有运行中的关联容器组且集群监控在采集，当打开该 Deployment 详情并点「监控」页签，则默认 1 小时窗口显示 CPU 与内存两张趋势（有采样点时图表出现且点数 / 柱数 > 0，值为 0 时画零高度柱而不是空态），可切换到 6 小时 / 24 小时且当前窗口标记与请求区间、采样步长同步变化；当监控接口报错时显示「监控不可用」并可重试，当接口成功但窗口内没有采样点时显示「没有监控数据」，两者不混用；Pod 详情同样有监控页签并读 Pod 自身序列。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail-monitor.md`](../../../../design/kube-frontend/app-workloads/detail-monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail-monitor.md`](../../../../prd/kube-frontend/app-workloads/detail-monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在工作负载详情里判断它最近的资源用量

作为 **项目成员**，我希望 **在 Deployment / Pod 详情里直接看 CPU 与内存随时间的变化**，以便 **判断扩容、重启或流量变化前后的资源占用，而不用跳到集群监控再手动筛出这个负载**。

**Independent Test**：打开一个运行中的 Deployment 详情，点「监控」页签：有采样点时出现 CPU 与内存两张趋势图（柱数 > 0）；切到 6 小时窗口后窗口标记随之变化；没有监控后端时显示「监控不可用」而不是空白。

## 前置与配置

- 已登录，且对 kubesphere-system 有读取权限
- 集群启用监控后端，Deployment 的 workload_* 序列在采集；探测不到有序列的 Deployment 时用例 skip

## 测试步骤

1. 用监控区间接口在 kubesphere-system 里挑一个「workload_cpu_usage 有采样点」的 Deployment，记录点数
2. 打开该 Deployment 详情页，等页面 ready，点「监控」页签
3. 核对监控面板可见，并等到图表/空态/不可用三者之一出现
4. 有采样点时：核对图表出现、data-ai-points > 0、data-ai-bar 柱数 > 0、data-ai-window 为 1h，CPU 与内存两张卡都在
5. 点「最近 6 小时」，核对按钮按下态转移且 data-ai-window 变为 6h；再点 24h；最后切回 1h 截图
6. 找到该 Deployment 的一个 Pod，打开 Pod 详情 → 监控页签，按 Pod 序列有无断言图表或空态

## 期望结果

- 监控页签存在且可打开，面板对 Deployment 按关联容器组汇总、对 Pod 读自身序列
- 有采样点时图表出现且柱数 > 0（0 值画零高度柱，不算缺失）；窗口切换后 data-ai-window 跟随
- 无采样点时显示「该时间范围内没有监控数据」，监控接口报错时显示「监控不可用」，两者不混用

## 失败排查

- 没有监控页签：该 kind 不在 deployments/statefulsets/daemonsets/pods 之内（Job/CronJob 故意没有）
- 图表一直空：集群没有监控后端或 recording rule（页面应显示不可用/空态，不是空白）
- 窗口切换无效：data-ai-window 没跟 windowKey 走，或 query key 漏了窗口
- 柱子数 0 但页面有数据：断言方式错了——要数 [data-ai-bar] 的个数，不要看第一根柱是否可见

## 产品改版后如何更新自动化

- 选择器见 WorkloadMonitorPanel.tsx：workload-detail:tab-trigger:monitor / tab:monitor / monitor / :range / :chart（data-ai-window、data-ai-points）/ :empty / :unavailable / :cpu / :memory / [data-ai-bar]
