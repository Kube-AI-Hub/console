# 集群监控页页签化 / 图表化 —— 本批共享契约（Lead，2026-11-18）

所有实现方（chart-kit / impl-overview / impl-tabs / spec-verify）以此文件为准；冲突时先报 Lead，不自行改契约。

## 0. 背景与目标
旧 console「集群状态」= 5 个页签（概览/物理资源监控/API Server 监控/调度器监控/资源用量排行）。新页此前平铺成单页、用数值替代图表。本批（增量 1）：
- 恢复 **页内页签 IA**（一个导航入口，5 个页签，可深链）。
- ai-kit **引入 recharts**（已装到 packages/ai-kit，^3.11.0），新增 DonutChart（构成图）；折线/面积继续用现成 TrendChart（已支持多序列/坐标轴/交互读数）。
- 概览：状态行恢复 **节点环图 + 厂商构成环图 + 组件状态 3×2 磁贴**；资源用量改 **主图+明细**（左侧 7 指标当前值，右侧大图）。
- 物理资源页签：保留旧页多序列合并（负载/磁盘吞吐/IOPS/网络/Pod/ RDMA 错误等），大图 + 坐标轴 + 图例，按 GPU/主机/磁盘/网络/RDMA 分组。
- API Server / 调度器页签：各自独立页签承载现有组件图（大图 + 图例）。
- 资源用量排行页签：复用 NodeRankingPanel，新增 **导出 JSON**（node-usage 页同时获得该能力）。
- 时间窗/自动刷新：页头一套（现有控件），页签内共用；切页签不重复请求未挂载页签的数据。

## 1. 路由与页签
- 路由 `routes/kube-frontend.clusters.$cluster/monitor/index.tsx`：`validateSearch` 接受 `tab` ∈ `overview|resource|apiserver|scheduler|ranking`，非法值忽略；默认 `overview`。用 `Route.useSearch()` 读、`Route.useNavigate()` 写（切换页签时 `navigate({ search: { tab } })`）。
- `ClusterMonitorPage` props：`{ cluster: string; node?: string; tab?: MonitorTabKey; onTabChange?: (tab) => void }`。
  节点详情复用的 `node` 分支：**没有页签**，只保留节点作用域趋势（现有行为），不引入 tab。
- `Tabs`（@kube-ai-hub/ui）：items 标签用 `cluster.monitor.tab.{overview,resource,apiserver,scheduler,ranking}`，aiId `cluster-monitor:tab:<key>`；内容容器 `data-ai-id="cluster-monitor:tabpanel:<key>"`。
- 页头保持：标题「集群监控」、描述、时间窗按钮组（`cluster-monitor:range:*`）、自动刷新（`cluster-monitor:auto-refresh`）、错误/重试（`cluster-monitor:retry`）。**一个动作一个入口**：页签内不再放时间窗/刷新。
- 页面 `AiSurface aiId="cluster-monitor:surface"` 的 state = 当前页签主查询状态（loading/ready/empty/error）。

## 2. 观测点（data-ai-id，测试按此断言）
- 页签：`cluster-monitor:tab:overview|resource|apiserver|scheduler|ranking`；面板 `cluster-monitor:tabpanel:<key>`。
- 概览（`cluster-monitor:overview`）：
  - 节点环图 `cluster-monitor:overview:node-ring`（内文 healthy/total + 百分比文本 `cluster-monitor:overview:node-ring:value`）
  - 厂商环图 `cluster-monitor:overview:vendor-donut`（图例行 `cluster-monitor:overview:vendor:<vendor>`，含名称/数量/百分比）
  - 组件状态 `cluster-monitor:status:components`（磁贴 `:components:service:<ns>`、`:components:core:<key>`，语义与现有 ClusterStatusSection 相同）
  - 资源用量：列表 `cluster-monitor:overview:usage`，行 `cluster-monitor:overview:usage:<key>`（key ∈ gpuMemory|gpu|gpuAllocated|cpu|memory|disk|pods），当前值文本 `:usage:<key>:value`；大图 `cluster-monitor:overview:usage-chart`（图例 `:usage-chart:legend`）
  - RDMA 摘要 `cluster-monitor:overview:rdma`；跳转按钮 `cluster-monitor:overview:view-rdma`
- 物理资源（`cluster-monitor:resource`）：分组 `cluster-monitor:resource:group:<gpu|host|disk|network|rdma>`；图 `cluster-monitor:resource:chart:<key>`（key 见 §4），每图图例 `:chart:<key>:legend`。
- API Server（`cluster-monitor:apiserver`）：图 `cluster-monitor:apiserver:chart:latency`、`:chart:rate`。
- 调度器（`cluster-monitor:scheduler`）：图 `cluster-monitor:scheduler:chart:attempts`、`:chart:rate`、`:chart:latency`。
- 排行（`cluster-monitor:ranking`）：复用 NodeRankingPanel，新增 `aiIdPrefix` prop（页签传 `cluster-monitor:ranking:`）；导出按钮 `<prefix>export`。
- 每个图表组件必须在无数据时渲染说明文本（`<chart id>:empty`），不得画零线。

## 3. ai-kit：DonutChart（chart-kit 任务）
`packages/ai-kit/src/primitives/DonutChart.tsx`：
```ts
export interface DonutSegment { key: string; label: string; value: number; color?: string }
export interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  segments: DonutSegment[]; label: string; emptyText: string;
  formatValue?: (value: number) => string; showLegend?: boolean; size?: number; centerLabel?: React.ReactNode;
}
```
- recharts `PieChart/Pie/Cell`；内半径 ~62%、外半径 ~88%；颜色默认取 `TREND_SERIES_COLORS`（注意是 `rgb(var(--ai-chart-N))` 字符串；recharts 需要可解析颜色则从 `getComputedStyle` 解析 token，失败回退内置调色板）。
- 图例：HTML 列表（色点 + 名称 + 值/占比），每行 `data-ai-segment={key}`；无数据（合计 ≤0 或全部非有限）→ 只渲染 `emptyText`，不渲染 SVG；`role="img" aria-label={label}`。
- 主题：只使用 ai-kit token（文字/边框/图例色）；不新增硬编码十六进制。
- 导出：`packages/ai-kit/src/index.ts` + `kube-frontend/packages/ui/src/index.ts`（命名导出 DonutChart + 类型）。
- Storybook story（深浅两主题）+ ai-kit 单测（分段渲染/图例/空态/非法值）。
- 构建：`cd console/packages/ai-kit && ./node_modules/.bin/vite build && ./node_modules/.bin/tsc -p tsconfig.build.json`（app 消费 dist；改完必须构建）。
- **注意**：ai-kit 是独立 pnpm 项目（`console/packages/ai-kit/pnpm-lock.yaml`，不在 kube-frontend workspace 里）；recharts 依赖已加到该 package.json 并安装，不要在 kube-frontend 再加。

## 4. 概览数据契约（impl-overview）
一次 range 查询（`rangeMetricsApi(api).cluster({cluster, metrics, start,end,step})`）取下列指标；比率类按时间戳相除，不用下标 zip：
- 用量行（used/total + 大图指标）：
  | key | 当前值 used/total | 大图指标（单位） |
  | gpuMemory | cluster_gpu_memory_usage / cluster_gpu_memory_total（bytes） | cluster_gpu_memory_utilisation（0..1 → ×100，%） |
  | gpu | cluster_gpu_usage / cluster_gpu_total（卡） | cluster_gpu_utilization（0..1 → ×100，%） |
  | gpuAllocated | cluster_gpu_allocated / cluster_gpu_total（卡） | cluster_gpu_allocated（整数） |
  | cpu | cluster_cpu_usage / cluster_cpu_total（核） | cluster_cpu_utilisation（0..1 → ×100，%） |
  | memory | cluster_memory_usage_wo_cache / cluster_memory_total（bytes） | cluster_memory_utilisation（0..1 → ×100，%） |
  | disk | cluster_disk_size_usage / cluster_disk_size_capacity（bytes） | cluster_disk_size_utilisation（0..1 → ×100，%） |
  | pods | cluster_pod_running_count / cluster_pod_quota（个） | cluster_pod_running_count（整数） |
- RDMA 摘要指标：cluster_ib_port_up、cluster_ib_port_total、cluster_ib_tx_bytes、cluster_ib_rx_bytes、cluster_ib_rx_errors。
- 缺任何一条：该行显示 `-`；大图按无数据说明；不填 0。比率 >1 时按百分比显示可 >100%（超配），不截断（仅图表 y 轴上限取数据峰值）。
- 主图：`TrendChart showAxes showGrid interactive`，`formatValue` 按行单位（bytes/cores/count/percent）。
- 「查看 RDMA 趋势」按钮 → 切到 resource 页签（调用 onTabChange('resource')），不新增路由。
- 组件状态磁贴：沿用 `ClusterStatusSection` 的查询与状态语义（componenthealth/模块未安装/未上报/403/5xx），只改布局为 3×2 网格 + 核心组件一行；状态分区标题「集群状态」。

## 5. 物理资源页签（impl-tabs）：18 张图，多序列合并
分组渲染（每组 h2，`cluster-monitor:resource:group:<g>`），每图 `TrendChart showAxes showGrid interactive` + 图例。指标与序列：
- gpu：gpuMemory（cluster_gpu_memory_utilisation ×100，%）、gpuUtilization（cluster_gpu_utilization ×100，%）、gpuAllocated（cluster_gpu_allocated，count）
- host：cpu（cluster_cpu_utilisation ×100）、memory（cluster_memory_utilisation ×100）、load（series load1/5/15 + cluster_load1/5/15，decimal）、diskUsage（cluster_disk_size_usage，bytes）、inode（cluster_disk_inode_utilisation ×100）、pods（series running/completed/abnormal ← cluster_pod_running_count/cluster_pod_succeeded_count/cluster_pod_abnormal_count，count）
- disk：throughput（series read/write ← cluster_disk_read_throughput/cluster_disk_write_throughput，B/s）、iops（series read/write ← cluster_disk_read_iops/cluster_disk_write_iops，2 decimals）
- network：traffic（series tx/rx ← cluster_net_bytes_transmitted/cluster_net_bytes_received，B/s）
- rdma：health（cluster_ib_health ×100）、ports（series portUp/portTotal ← cluster_ib_port_up/cluster_ib_port_total，count）、throughput（series tx/rx ← cluster_ib_tx_bytes/cluster_ib_rx_bytes，B/s）、linkSpeed（cluster_ib_link_speed，bit/s → Gb/s，1 decimal）、errors（series rxErrors/retrans/discards ← cluster_ib_rx_errors/cluster_ib_retrans/cluster_ib_discards，count）、linkDowned（cluster_ib_link_downed，count）
- 指标名先按契约；若某条在 live API 不存在（返回 0 序列）在该图显示空态说明，并在报告里列出缺失指标，不改契约。
- 查询：本页签一次 range 查询取上述全部指标（含 total 不需要）。

## 6. API Server / 调度器页签（impl-tabs）
复用 `componentMonitorQueries` 的查询/身份合并（verb/result/quantile），改为大图 + 图例：
- apiserver：latency（总均值 + 按 verb 合并，API 秒 ×1000 → ms）、rate（总请求速率，次/秒）；若实现成本低可加按 verb 速率，但至少这两张。
- scheduler：attempts（按 result scheduled/error/unschedulable，累积整数）、rate（按 result，次/秒）、latency（平均 + 分位，秒 ×1000 → ms；无序列时空态）。
- 每个页签的组件查询独立；一块失败不影响另一个页签；状态：loading 骨架/empty 说明/error ResourceErrorPanel（403 无重试）。
- 现有 `ComponentSection/ComponentGroup/ComponentCard` 可从 ClusterMonitorPage 抽出复用到本页签（保留 aiId 语义：`cluster-monitor:apiserver:chart:*` 等按 §2）。

## 7. 排行页签 + 导出（impl-tabs）
- 页签内容 = `<NodeRankingPanel cluster={cluster} aiIdPrefix="cluster-monitor:ranking:" />`。
- `NodeRankingPanel` 新增 props：`aiIdPrefix?: string`（默认 'node-usage:'，所有既有 data-ai-id 用前缀拼接，页签传 'cluster-monitor:ranking:'）、导出按钮（`<prefix>export`，t('cluster.nodeUsage.export')，title/hint t('cluster.nodeUsage.exportHint')）。
- 导出实现：取当前 metric/order 的**全部**行（pageSize=-1 或逐页拉取，以 nodeRankingApi 支持为准），生成 JSON 文件 `node.usage.rank.json`：`{cluster, metric, order, generatedAt, items:[{name, values}]}`；Blob + a.download；无数据时按钮禁用并显示 t('cluster.nodeUsage.exportEmpty') 提示（title）。
- 页签名/说明沿用既有 locale（`cluster.nodeUsage.*`），不新增重复文案。

## 8. 通用约束
- 只读页面；不改 api-client 既有方法签名（如需要新增，只加不改，并同步 barrel 导出与契约测试）。
- 文案只用 `useT()` 的既有/已新增 key；缺 key 报 Lead（locale 由 Lead 统一改，避免并行冲突）。
- 图表使用共享组件：折线/面积 = `TrendChart`（已有多序列/axes/interactive），构成 = 新 `DonutChart`；不要页面内自绘 SVG 环图/饼图。环图（单值占比）可用现有 `MetricRing`。
- 所有交互元素用共享 `Button`/`Tabs` + `actionProps`（ai-surface 契约）；图表容器加 `aria-label`（图名）。
- 状态：loading 用 Skeleton；empty 用说明；error 用 ResourceErrorPanel（403 无重试）；不得用 0 顶替无数据。
- 视觉关系（不写像素）：页签标题 > 图表标题；概览状态行三块同高；主图区明显大于左侧指标列表；组标题与页签内其它小标题同层。
- 自验：console-next `typecheck` + `build` + `vitest run`；ai-kit 改动的 `build`+测试；改完发消息给 Lead 与 verify。
- 写入范围见各自任务；不要改 `tests/ui/`（verify 负责）、不要改 `prd|design|docs/`（spec 负责，Lead 协调）、不要改 locale。

## 9. 本批不承诺（登记后续，不写入 AC 通过项）
- 每个页签独立时间窗/播放控制（本轮共用页头时间窗）。
- 旧概览 RDMA 块的四张子图（只做摘要 + 跳物理页签）。
- 旧排行导出字段若后端不支持全量，则导出当前已加载页并在记录中如实说明。
- 旧仓库等下游细节不在本批。
