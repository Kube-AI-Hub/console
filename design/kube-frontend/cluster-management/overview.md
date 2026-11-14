# 集群概览 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/overview.md)

## 概述

集群级落地页：集群对象（是什么）+ KubeSphere 监控（多忙）+ 控制面健康（能不能调度）。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03

## 设计目标与非目标

目标：一屏读完集群的身份、容量与模块状态，且任一路数据缺失都不拖垮整页。

非目标：趋势图与历史、集群设置的写入、节点明细。

## 关键约束

- 集群对象走 kapis：/kapis/cluster.kubesphere.io/v1alpha1/clusters/<id>。
- 监控走 KubeSphere 监控 API：/kapis/monitoring.kubesphere.io/v1alpha3/{cluster,components/<name>}。
- 一次请求取多个指标（metrics_filter 以 | 连接，每个名字以 $ 结尾）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-OVERVIEW-01 — 两个数据源，各自独立降级

**为什么**：集群对象是静态事实（版本、模块、就绪），监控是随时间变化的测量。把两者放进同一个查询，会让「没有监控后端」这种常见部署形态变成整页失败，连版本都看不到。B200 上两者都可用，但也存在只装其中一个的集群（首次探测该集群 metrics 返回 404，复测 200，正说明任一接口都可能瞬时缺失）。分开即可让任一侧缺失只影响自己那块。

**被否方案**：一个聚合 hook 里并发取两份数据、任一处失败就整体报错。省一次加载态，代价是一个面板的缺失抹掉另一面板的全部信息。

**何时重新考虑**：若平台侧提供「集群概要」聚合接口，前端就该只调用它。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-OVERVIEW-02 — 用 KubeSphere 监控 API，不用 metrics.k8s.io

**为什么**：集群级用量（总容量、已分配、容器组配额、GPU 总量）只有 KubeSphere 的 named metrics 才有；metrics.k8s.io 只给「当前用量」，没有总容量、已分配与配额。老 console 的仪表盘同样读 KubeSphere 监控。

**被否方案**：metrics.k8s.io 求和。拿不到总容量与配额，无法算百分比，也无法区分「已分配」。

**何时重新考虑**：未安装 KubeSphere 监控的集群上需要该页时，再补一条 metrics.k8s.io 的降级读取。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-OVERVIEW-03 — GPU 以「卡」计数，不以百分比计数

**为什么**：管理员申请的是整卡。6 / 15 直接回答「还能不能再起一个 GPU 任务」；40% 不能。利用率作为第二行，因为卡可能被占用却闲着，两者是不同的事实。

**被否方案**：只显示利用率百分比（老 console 的 GPU 利用率卡片）。看起来信息量足够，实际无法回答调度问题。

**何时重新考虑**：引入 vGPU 细粒度切分后，「卡」不再是分配单位。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-OVERVIEW-04 — 模块列表来自 configz，未知键原样显示

**为什么**：status.configz 报告模块配置开关，不证明 API 安装。它开放增长（本集群就有 dongba、platformModel 等非标准键），按白名单过滤会遗漏配置事实；为 false 只显示「未启用」，不宣称未安装。

**被否方案**：照搬老 console 的六个固定图标。老 console 为 DevOps、服务网格等画了图，但本产品线没有这些模块，灰色图标只会招来「为什么不可用」的提问。

**何时重新考虑**：产品需要为模块提供跳转入口时，再为已知模块加链接（未知键仍原样显示）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-OVERVIEW-05 — metrics_filter 一次取全部指标

**为什么**：一个面板要 12 个指标，逐条请求是 12 次往返。监控 API 支持以 | 分隔的批量过滤，实测一次返回全部指标。

**被否方案**：每指标一个 query（便于单独缓存）。在这个页面上它们总是一起显示，拆开只增加延迟与失败面。

**何时重新考虑**：若某个指标成为独立面板并按不同频率刷新。

## 系统现状

老 console 的集群首页为 Dashboard：ClusterInfo、ServiceComponents、ResourcesUsage、KubernetesStatus、ClusterNodes、Tools 六块。本次保留前四块并补已有运维页面的快捷入口；节点 Top5 不重复节点列表。

## 仓库落点

- 页面：apps/console-next/src/pages/cluster/ClusterOverviewPage.tsx
- 路由：apps/console-next/src/routes/kube-frontend.clusters.$cluster/overview/{route.tsx,index.tsx}
- 区域注册：apps/console-next/src/areas/registry.ts（cluster-management 的 defaultPage 改为 overview）
- 接口：packages/api-client/src/cluster.ts（clusterApi / clusterMetricsApi / componentMetricsApi / toClusterDetail / toMetricValues）
- 文案：packages/locales/src/index.ts（cluster.overview.*）

## 对外契约

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03 — 缺失指标不填零

ClusterUsage 的数值字段由必有 number 调整为 number | undefined。未返回、空结果或非有限采样保留 undefined；真实零仍为 0。页面分母缺失或不大于零时隐藏进度条并显示 `-`，不再用 `?? 0` 补数据。所有用量仍来自 cluster endpoint，不求和当前页节点。

| 用途 | 路径 |
| --- | --- |
| 集群对象 | GET /kapis/cluster.kubesphere.io/v1alpha1/clusters/<id> |
| 集群指标 | GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=a$|b$&cluster=<id> |
| 控制面指标 | GET /kapis/monitoring.kubesphere.io/v1alpha3/components/<apiserver|scheduler>?metrics_filter=… |

指标名：cluster_cpu_usage、cluster_cpu_total、cluster_cpu_allocated、cluster_memory_usage_wo_cache、cluster_memory_total、cluster_memory_allocated、cluster_pod_running_count、cluster_pod_quota、cluster_node_total、cluster_node_online、cluster_gpu_allocated、cluster_gpu_total、cluster_gpu_utilization；apiserver_request_rate、apiserver_request_latencies、scheduler_schedule_attempts。

## 不变量

1. 就绪只认 Ready 条件为 True；条件缺失 = 未就绪。
2. 监控缺失时不得渲染 0：要么显示实际值，要么显示「不可用」。
3. 任何百分比都必须与同行的分子分母一致。
4. 无 GPU 的集群不渲染 GPU 行。
5. 本页不产生任何写请求。

## 已知坑

- **指标值的空结果不等于 0**：监控 API 对不存在的指标直接不返回该 metric_name，对存在但无数据的返回空 result。两种都要按「未知」处理，否则会显示 0%。
- **scheduler_schedule_attempts 是按 result 标签分多条的**：只取第一条会把「scheduled」和「unschedulable」混成一个数。必须按 labels.result 区分。
- **请求速率与延迟只是「当前值」**：没有时间戳列在页面上，30 秒 staleTime 内不刷新属于可接受口径，但不要据此做告警判断。
- **configz 的键是开放集合**：本集群实测含 dongba、platformModel、network.ippool 等非标准键，按固定白名单渲染会漏。
- **集群对象走 kapis 而非 resources 代理**：B200 上 resources 代理曾漏掉新建对象；详情页与列表页必须同源，否则会出现「列表有、详情 404」。
- **指标单位**：内存为字节，CPU 为核（cluster_cpu_usage 是求和后的核数，不是毫核）。

## 测试与可观测

用例：tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01.yaml
测试：tests/ui/tests/kube-frontend/cluster-management/test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_01.py

可观测点：data-ai-state 反映页面加载态；各字段带 cluster-overview:* 的 data-ai-id，自动化可逐字段读取。

## 后续改进

- 用量趋势曲线（需要指标历史接口）。
- 集群设置写入（描述、可见性、可插拔组件）。
- 多集群列表页（B200 已启用多集群，但只有 host 一个集群对象）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06 — 身份侧栏与负载主栏

**为什么**：版本和模块用于识别环境，资源用量与控制面是日常主任务。双栏提高首屏负载可见性；使用已有 Progress、Skeleton 和 Link，不新增进度组件。刷新协调四类集群查询，代理接入面板仍独立读取。

**被否方案**：继续纵向堆叠全部面板，负载容易落在首屏以下；或用 gpu02 数值填集群卡片，会混淆范围。

**何时重新考虑**：需要历史总览或个性化面板时再设计仪表盘布局。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02
