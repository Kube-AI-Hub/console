# 应用资源监控（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/resource-monitor.md)

## 概述

集群作用域新增 `monitor-resource` 页：两个页签（按工作负载 / 按容器组）+ 时间范围选择 + 排序表。数据由新模块 `pages/cluster/resourceMonitorQueries.ts` 读取：一次 Pod range query 取 CPU/内存，按工作负载页签再用一次集群级 ReplicaSet 读取把 ReplicaSet 归属解析到 Deployment。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01

## 设计目标与非目标

目标：集群视角的工作负载/容器组资源排行；时间范围可切换；监控不可用与无数据有明确说明；复用集群列表骨架（搜索/排序/分页/空态）。

非目标：下钻曲线、项目过滤、导出、写操作、新指标。

## 关键约束

- 页面位于 `/kube-frontend/clusters/<cluster>/monitor-resource`：集群作用域，只有 `cluster` 参数。
- 监控 API：`/kapis/monitoring.kubesphere.io/v1alpha3/pods` 支持 `cluster`、`limit`、`metrics_filter`、`start`/`end`/`step`；`step` 必须是带单位的 Prometheus 时长（`60s` / `5m`）。
- 没有集群级 workloads 集合：`/namespaces/<ns>/workloads` 需要命名空间，`/workloads` 返回 404。
- ReplicaSet 不能通过 kapis 通用资源代理读（`resource is not supported`）；`/apis/apps/v1/replicasets` 可读。
- 页签用 `@kube-ai-hub/ui` 导出的 `Tabs` / `TabsContent`，触发器通过 `TabItem.aiId` 暴露句柄；页面不出现裸 `<button>`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01 — 用 range query 求窗口平均，而不是即时值

**为什么**：时间范围选择器如果只改变一个不参与计算的标签，就是假控件。range query 为每个容器组返回窗口内的样本序列，页面取平均作为该窗口的用量：1h/60s、6h/5m、24h/15m、7d/2h，与集群监控页的 step 选择一致，序列点数稳定在几十个。

**被否方案**：即时查询 + 只在标签上显示范围。读者换范围后数字不变，会以为监控坏了。

**何时重新考虑**：需要区分「峰值」与「平均」（例如告警复盘）时，加一个聚合方式选择器。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-02 — 按工作负载由 Pod 指标聚合，ReplicaSet 归属补一跳

**为什么**：监控 API 没有集群级 workloads 集合，而逐命名空间请求 workloads 在几百个项目的集群上是 N 次请求且 N 不可控。Pod 指标一次就能覆盖整个集群；唯一的信息缺口是 Deployment 的 Pod 标的是 ReplicaSet，所以用一次集群级 `/apis/apps/v1/replicasets` 读取把 ReplicaSet 映射到 Deployment。StatefulSet / DaemonSet 的 Pod 已直接带 owner 名，无需映射。

**被否方案 1**：逐命名空间请求 `/namespaces/<ns>/workloads`。行的语义最准，但请求数随项目数增长，首屏不可控。
**被否方案 2**：按名字截断 ReplicaSet 的哈希后缀推 Deployment 名。哈希长度与命名不是 API 契约，遇到带哈希风格的 Deployment 名会误判。

**另一条**：静态镜像 Pod（`owner_kind: Node`）不计入按工作负载——它们不是部署出来的负载，且会与节点视角重复；在按容器组页签仍可见。

**何时重新考虑**：监控后端提供集群级 workloads 集合，或提供从 Pod 到顶层 workload 的标签时，改为直接读 workload 指标。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-03 — 监控不可用 / 无数据 / 有数据是三种页面状态

**为什么**：「请求失败」「监控装了但没采集到」「没有容器组」在表格里都表现为空，但处置方式完全不同：前两者要找监控组件，后者是集群真的空。请求失败进入 `cluster-resource-monitor:unavailable` 说明 + 重试；200 但零序列进入 `cluster-resource-monitor:empty` 说明；有数据才渲染表格。

**被否方案**：统一用表格空态。把「监控没装」显示成「没有容器组」，会让人去查业务而不是查监控。

**何时重新考虑**：监控 API 能返回「后端就绪状态」时，可以在页面顶部直接显示组件健康，而不是靠请求结果推断。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-04 — 默认 CPU 降序、每页十行，首屏即 Top 10

**为什么**：本页的问题是「谁最热」，按名称排第一页等于让读者自己找。CPU 是最常见的第一问题，所以默认按 CPU 降序；每页十行让「Top 10」成为首屏，而不是二十行里再找。内存与名称仍可排序，分页覆盖全部对象。

**被否方案**：固定只显示 Top 10 且不可翻页。会隐藏第 11 名的异常对象，也无法回答「这个负载排第几」。

## 系统现状

老 console 的集群 Monitor/Resource 提供物理/虚拟资源用量与项目排行；按工作负载、按容器组的资源排行在项目总览里是「Top 5」卡片，没有集群级的两个页签视图。本功能点补上这个集群视角，复用监控 API 与集群列表骨架。

## 仓库落点

- `apps/console-next/src/pages/cluster/ResourceMonitorPage.tsx`
- `apps/console-next/src/pages/cluster/resourceMonitorQueries.ts`（range 读取、ReplicaSet 归属、聚合）
- `apps/console-next/src/routes/kube-frontend.clusters.$cluster/monitor-resource/{route,index}.tsx`
- 文案：`packages/locales/src/index.ts` 的 `cluster.resourceMonitor.*`

## 对外契约

- 页面句柄：`cluster-resource-monitor:surface`；页签面板 `cluster-resource-monitor:tab:workloads` / `...:tab:pods`；范围容器 `...:range`（按钮 `...:range:{1h,6h,24h,7d}`）；空态 `...:empty`；不可用 `...:unavailable`。
- 读取：`GET /kapis/monitoring.kubesphere.io/v1alpha3/pods?cluster=<c>&limit=-1&metrics_filter=pod_cpu_usage$|pod_memory_usage_wo_cache$&start&end&step`；`GET /apis/apps/v1/replicasets`。
- 页面 URL：`/kube-frontend/clusters/<cluster>/monitor-resource`。

## 不变量

- 两个页签共享同一份 Pod 指标读取；切换页签不发起新的 Pod 指标请求。
- 名称列的行链接指向项目控制台里该对象的页面；项目列文本等于对象的 namespace。
- 每行是所选窗口内的平均用量，单位：CPU 核（<1 核毫核）、内存二进制字节单位。
- 有数据时行数大于 0；无数据 / 不可用时一定出现说明块。

## 已知坑

- `step` 写成 `300` 会被监控 API 拒绝（`time: missing unit in duration`）；必须是 `5m` 这类时长。
- `metrics_filter` 里的 `$` 和 `|` 直接拼进 URL 会被服务端拒；用 query 参数编码。
- Pod 指标里 Deployment 的 Pod 标的是 ReplicaSet，不补这一跳会把 Deployment 排行显示成哈希后缀的 ReplicaSet。
- `owner_kind: Node` 的静态镜像 Pod 若混入工作负载排行，会和节点视角重复计算。
- 监控 API 的 cluster 参数与 BFF 直连 kube API 的集群段不同：前者是查询参数，后者依赖路径前缀；不要混用。

## 测试与可观测

- E2E：`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01`。用例先用 BFF 探测 range query 是否有数据：有数据则断言两个页签行数 > 0、四列表头、切换 24h 后仍有数据；无数据则断言空态或不可用说明。
- 观测点：页面句柄、页签面板句柄与行句柄 `data-ai-row`（`Kind:namespace/name`）就是断言入口。

## 后续改进

- 行点击下钻到该工作负载/容器组在项目监控里的趋势。
- 聚合方式（平均/峰值）选择器。
- 按项目过滤与导出。
- 监控后端就绪状态直接显示在页面顶部。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01`
