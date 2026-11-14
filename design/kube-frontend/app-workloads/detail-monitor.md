# 工作负载 / Pod 详情 · 监控 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/detail-monitor.md)

## 概述

详情页新增一个「监控」页签，面板组件 `WorkloadMonitorPanel` 同时服务工作负载与 Pod：工作负载读 `/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/{ns}/workloads/{kind}?resources_filter=<name>` 的 `workload_cpu_usage` / `workload_memory_usage_wo_cache`，Pod 读 `/namespaces/{ns}/pods/{pod}` 的 `pod_cpu_usage` / `pod_memory_usage_wo_cache`。两者都是 range（matrix）查询，页面把结果画成内联 SVG 柱图。区间与步长由窗口决定：1h→60s、6h→5m、24h→15m。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01

## 设计目标与非目标

**目标**：详情页内看用量趋势；三态（不可用 / 无数据 / 0 值）可区分；工作负载趋势与服务端汇总口径一致。

**非目标**：Job/CronJob 监控（无工作负载级指标）；容器级监控；GPU 指标（已有专页）；告警、导出、需要图表库的交互。

## 关键约束

- 数据只来自监控 API（宪法 C1），复用 `rangeMetricsApi`；本次为它新增 `.workload()` / `.pod()` 两个 scope，路径与参数集中在 api-client。
- 工作负载用量取服务端 recording rule（`namespace:workload_*_usage:sum`），前端不再逐 Pod 求和。
- 只在 deployments / statefulsets / daemonsets / pods 上显示页签；jobs/cronjobs 不显示。
- 窗口同时决定区间与步长；按钮用 `Button`，页面带字面量 `data-ai-id`。
- 不引入图表库。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01 — 工作负载用量读服务端汇总，不在前端逐 Pod 相加

**为什么**：`workload_cpu_usage` 在服务端被映射为 `namespace:workload_cpu_usage:sum` recording rule——它本身就是对「该工作负载的关联 Pod」的求和。详情页要的正是这个口径。若前端改成先取 `/workloads/{kind}/{workload}/pods` 的逐 Pod 序列再相加，会：多下载 N 条序列；把「sum over pods」的定义从服务端复制到页面；一旦 recording rule 的聚合方式调整（例如排除某些容器），两边就会静默不一致。

**被否方案**：前端逐 Pod 求和。看着更「透明」，但口径重复，且实测 `/workloads/{kind}/{workload}/pods` 的过滤行为不可靠（见已知坑）。

**何时重新考虑**：需要「按 Pod 拆分」的视图时（例如图例列出每个 Pod 的曲线），那是另一个功能，不是详情页的总量。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-02 — 监控页签只给 3 种控制器与 Pod

**为什么**：监控 API 的工作负载级指标按 path kind 映射成 `workload=~"<Kind>:(...)"`，只定义了 `deployment` / `statefulset` / `daemonset` 三种（`promql.go` 的 `makeWorkloadMetricExpr`，其余 kind 落到 `.*`）；Job/CronJob 没有对应的 `namespace:workload_*_usage:sum` 序列。给它们一个只会显示「不可用」的页签，比没有更糟——读者会反复点。

**被否方案**：所有 kind 都放页签，Job/CronJob 显示「不可用」。等于把「能力没有」做成「看起来坏了」。

**被否方案**：Job/CronJob 用 Pod 级指标近似。Job 的 Pod 会被清理，曲线会随保留策略断裂；口径也不对。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-03 — 三态区分：不可用 / 无数据 / 0 值

**为什么**：三种情况的读者动作完全不同：
- 请求报错 → 集群可能没装监控后端，应该去查监控组件（`:unavailable`）。
- 请求成功但窗口内没有采样点 → 对象刚创建、还没被采集，或指标在此集群不存在（`:empty`）。
- 有采样点、值全为 0 → 这就是「空闲」，是合法数据，必须画图（零高度柱）并显示 0。

把后两者合并会让「空闲」看起来像「没数据」；把前两者合并会让「没装监控」看起来像「这个负载没流量」。

**被否方案**：空数组也画一张空图。读者无法区分空闲与未采集。
**被否方案**：报错也显示空态。把基础设施问题伪装成产品功能。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-04 — 窗口同时驱动区间与采样步长

**为什么**：接口返回原始采样。24h @60s 是 1,440 点，柱宽不足一像素；每档窗口配一个把点数稳定在 60–100 的步长（与集群监控、GPU 资源页一致）。窗口在选定瞬间折算成绝对时间戳，避免把 `Date.now()` 放进 query key 导致无限重取。

## 系统现状

- 监控 API 路由：`kube-server/pkg/kapis/monitoring/v1alpha3/register.go`（`/namespaces/{namespace}/workloads/{kind}`、`/namespaces/{namespace}/pods/{pod}`）。
- 指标定义：`named_metrics.go` 的 `WorkloadMetrics` / `PodMetrics`；`promql.go` 的 `workload_cpu_usage`（`round(namespace:workload_cpu_usage:sum, 0.001)`，单位核）、`workload_memory_usage_wo_cache`、`pod_cpu_usage`、`pod_memory_usage_wo_cache`（单位字节）。
- 选择器构造：`makeWorkloadMetricExpr` 把 path kind 映射为 `Deployment|StatefulSet|DaemonSet`（其余 `.*`），拼成 `workload=~"<Kind>:(<resources_filter>)"`。
- 页签体系：`WorkloadDetailPage.tsx` 的 `tabsFor(kind)` + `TAB_LABEL_KEYS`；面板未挂载即不请求（切页签不额外取数）。
- 旧 console：Deployment 详情有监控页签，读同一组 `workload_*` 指标。

## 仓库落点

| 层 | 路径 |
| --- | --- |
| api-client | `packages/api-client/src/cluster.ts`：`rangeMetricsApi` 抽出 `query()`，新增 `.workload()` / `.pod()`；测试 `packages/api-client/test/metrics.test.ts` |
| 面板 | `apps/console-next/src/pages/app-workloads/WorkloadMonitorPanel.tsx` |
| 页签 | `apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx`（`DetailTab` 增加 monitor、`tabsFor`、`TAB_LABEL_KEYS`、面板挂载） |
| 用例 | `tests/ui/{specs,tests}/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01.*` |

## 对外契约

| 用途 | 路径 | 参数 |
| --- | --- | --- |
| 工作负载序列 | `/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/{ns}/workloads/{deployment|statefulset|daemonset}` | `metrics_filter=workload_cpu_usage$|workload_memory_usage_wo_cache$`、`resources_filter=<name>`、`start`/`end`（秒）、`step`、`cluster` |
| Pod 序列 | `/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/{ns}/pods/{pod}` | 同上，指标为 `pod_cpu_usage` / `pod_memory_usage_wo_cache` |

返回形态：`results[].data.result[]` 为 matrix；`values: [[epoch 秒, "值"], …]`。CPU 单位核；内存单位字节。

## 不变量

1. 工作负载趋势只来自服务端汇总指标；页面不逐 Pod 相加。
2. 监控页签只出现在 deployments / statefulsets / daemonsets / pods 上。
3. 三种状态互斥且可区分：请求失败 → `:unavailable`；成功但 0 点 → `:empty`；有点 → `:chart`（值为 0 也画零高度柱）。
4. 窗口切换必须改变请求的 `start`/`end`/`step`，并把当前窗口写进 `data-ai-window`。
5. 切页签不额外发起请求之外的取数（面板只在 active 时挂载）。

## 已知坑

- **path kind 必须是单数**：`promql.go` 只认 `deployment` / `statefulset` / `daemonset`；传复数（`deployments`）不会报错，而是落到 `.*`——kind 限制静默失效。api-client 里做了映射。
- **`resources_filter` 被嵌进 `workload=~"<Kind>:(<filter>)"`**：因此 `^name$` 这种锚定写法永远匹配不到（锚点会在 `<Kind>:` 之后）；用「纯名字 + 转义正则元字符」。实测 `coredns` / `coredns$` 命中，`^coredns$` 返回空。
- **`/workloads/{kind}/{workload}/pods` 的过滤不可靠**：实测该路径返回了 27 条无关 DaemonSet 的序列（workload 过滤未生效），不能用来「逐 Pod 汇总」。
- **未知指标名返回 200 + `results: null`**：不是错误，api-client 得到空数组 → 页面按空态处理。
- **单位**：CPU 是核（0.017），内存是字节（314388480）；直接打印字节会得到十位数字。
- **零高度柱不是数据缺失**：断言图表是否存在要看「有没有采样点」，不要看第一根柱子的高度/可见性（GPU 趋势页踩过同样的坑）。
- **新建对象可能先空态**：Pod/工作负载创建后要等下一个采集周期才有序列，空态是正确表现。
- **Job/CronJob 没有工作负载级指标**：不要给它们加监控页签。
- **不要每次渲染取 `Date.now()`**：窗口要在选定瞬间折算成绝对区间，否则 query key 每帧变化、无限重取。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01.yaml`；用例先用监控区间接口挑一个**有序列**的 Deployment（探不到就按空态断言），再打开详情页验证页签与图表。
- 可观测点：`workload-detail:tab-trigger:monitor`（触发器）、`workload-detail:tab:monitor`（面板容器）、`workload-detail:monitor`、`:range`（`aria-pressed`）、`:chart`（`data-ai-window`、`data-ai-points`）、`[data-ai-bar]`（柱子）、`:cpu` / `:memory`、`:empty`、`:unavailable`、`:retry`。
- api-client 单测：`metrics.test.ts` 覆盖 kind 映射、resources_filter 转义、pod 路径、matrix 解析与排序。

## 后续改进

- 卡片级/容器级趋势（需要另一组指标与交互）。
- 请求量/网络等其他指标接入同一面板（`rangeMetricsApi` 已支持任意命名指标）。
- 图表交互（hover 读数、缩放）需要图表库，届时重新评估。
- Job/CronJob：若监控侧补了工作负载级指标，再加页签（届时只需改 `MONITORED_WORKLOAD_KINDS` 与 kind 映射）。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01
