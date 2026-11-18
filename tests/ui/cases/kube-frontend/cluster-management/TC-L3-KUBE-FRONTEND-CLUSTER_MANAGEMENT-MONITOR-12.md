# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12 集群监控 · 概览页签：状态行 / 7 指标主图与明细 / RDMA 状态 / 服务组件监控

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{{BASE_URL}}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

概览页签自上而下四个分区：① 集群状态行（节点在线环图、XPU 厂商构成环图、组件状态 3×2 磁贴）；② 集群资源用量（左侧 7 行当前值 used/total，右侧一张可选指标的大图）；③ RDMA 状态（health / 端口 / 吞吐 / 错误 4 个互斥指标页签，各带当前值与曲线，另按端口清单列出异常节点）；④ 服务组件监控（延迟 / 请求速率 / 调度尝试 / 尝试速率 4 个互斥页签，各带当前值与曲线）。RDMA 与服务组件两块复用旧的图表面板形态；RDMA 端口清单用路径集群段独立读取；概览不再有「查看 RDMA 趋势」按钮。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12** — 已知集群就绪且监控查询可用，当打开概览页签，则页签内容 `cluster-monitor:overview` 自上而下为状态行、集群资源用量、RDMA 状态块、服务组件监控块（后两块的页签与指标细节分别由 AC-17 / AC-18 断言）：状态行三块同高——节点在线环图（`cluster-monitor:overview:node-ring`，内文为健康节点数/总节点数，百分比文本 `cluster-monitor:overview:node-ring:value` 等于健康节点数÷总节点数、最多一位小数（验收断言允许 ±1 个百分点舍入误差），点击进入该集群节点页；`totalNodes` 缺失显示「未上报」、为 0 显示空态说明，不显示 0/0）、节点 XPU 厂商构成环图（`cluster-monitor:overview:vendor-donut`，按数量降序列出各厂商标段与 HTML 图例，每行 `cluster-monitor:overview:vendor:<vendor>` 含厂商名、节点数与百分比，百分比=该厂商节点数÷各厂商计数之和×100；`healthy`/`total` 不计入厂商行与分母；`CPU` 行表示无 XPU 的节点、显示真实节点数且不是空态，各厂商计数合计为 0 时只显示空态说明且不渲染环图）、组件状态（`cluster-monitor:status:components`，含 6 个服务组件磁贴与 etcd/controller-manager/scheduler 三个核心组件，语义与既有 ClusterStatusSection 相同；宽屏按 3 列 2 行排列、窄屏堆叠）；资源用量区左侧为 7 行指标（`cluster-monitor:overview:usage`，每行 `cluster-monitor:overview:usage:<key>`，key 依次为 gpuMemory|gpu|gpuAllocated|cpu|memory|disk|pods），每行显示名称与 used/total 当前值（文本 `cluster-monitor:overview:usage:<key>:value`），右侧为大图 `cluster-monitor:overview:usage-chart`（TrendChart 带坐标轴/网格/交互读数，图例 `cluster-monitor:overview:usage-chart:legend`）；默认选中第一行，点击某行切换大图指标，当前值单位按行分别为 bytes（B/KiB/MiB/GiB）、卡/核/个（整数）与百分比（0–1 比率×100）；任一行缺少 used 或 total 序列时显示「-」且对应大图为空态说明，不显示 0 也不画零线；比率类数值允许大于 100%（超配不截断，图轴上限取数据峰值）；RDMA 状态块 `cluster-monitor:overview:rdma` 与服务组件监控块 `cluster-monitor:overview:components` 分别见 AC-17 / AC-18；概览不再渲染「查看 RDMA 趋势」跳转按钮（原 `cluster-monitor:overview:view-rdma` 句柄删除），RDMA 明细趋势只从物理资源监控页签进入；查询加载中显示骨架、主查询无数据显示空态说明、失败显示错误说明与重试（403 无重试）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-17** — 已知集群就绪且概览 range 查询可用，当打开概览页签，则「RDMA 状态」块 `cluster-monitor:overview:rdma` 以 4 个互斥指标页签呈现（页签容器 `cluster-monitor:overview:rdma:tabs`，页签 `cluster-monitor:overview:rdma:tab:<health|ports|throughput|errors>`，顺序固定 health → ports → throughput → errors，每个页签显示当前值 `:rdma:tab:<key>:value`）：health = `cluster_ib_health`×100（%，最多一位小数）、ports = `cluster_ib_port_up` / `cluster_ib_port_total`（整数计数，以 / 分隔）、throughput = `cluster_ib_tx_bytes` / `cluster_ib_rx_bytes`（B/KiB/MiB/GiB 每秒）、errors = `cluster_ib_rx_errors` / `cluster_ib_retrans`（整数计数）；右侧图 `cluster-monitor:overview:rdma:chart`（`data-ai-state`=ready，当前值 `:chart:now`，图例 `cluster-monitor:overview:rdma:chart:legend` 与 `:rdma:legend:<metric>`）画出选中页签的序列（health 1 条、ports/throughput/errors 各 2 条），带坐标轴、网格与交互读数，数据来自概览同一次 range 查询；某页签没有序列时 `:chart:empty`（`data-ai-state`=empty）显示「该时间范围内没有数据」与可能原因，不画零线，页签当前值显示「-」；RDMA 端口清单来自 `GET /kapis[/clusters/<cluster>]/rdma.kubesphere.io/v1alpha1/ports?limit=-1`（集群段在路径中，不用 `?cluster=`），读取成功且有 `healthy=false` 的端口时 `:rdma:abnormal` 按异常端口数降序列出节点与「down/total 个端口不可用」（节点行 `:rdma:abnormal:<node>`），全部端口正常时只显示 `:rdma:no-abnormal` 的「所有 RDMA 端口均正常。」，清单读取失败（404/403/5xx/网络）时显示 `:rdma:inventory-unavailable` 的「RDMA 端口清单不可用」而不是声称正常；概览不再渲染「查看 RDMA 趋势」按钮（`cluster-monitor:overview:view-rdma` 句柄删除），RDMA 明细趋势仍只从物理资源监控页签进入（一个动作一个入口）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-18** — 已知集群就绪且组件指标可读，当打开概览页签，则「服务组件监控」块 `cluster-monitor:overview:components` 以 4 个互斥页签呈现（页签容器 `cluster-monitor:overview:components:tabs`，页签 `cluster-monitor:overview:components:tab:<latency|requestRate|attempts|attemptRate>`，顺序固定，每个页签显示当前值 `:components:tab:<key>:value`）：latency = APIServer 请求延迟（总平均 + 按 `verb` 多序列，API 秒值×1000 显示 ms，两位小数）、requestRate = APIServer 总请求速率（次/秒，两位小数）、attempts = 调度器调度尝试次数（按 `result` 多序列，累积整数）、attemptRate = 调度器调度尝试速率（按 `result` 多序列，次/秒）；右侧图 `cluster-monitor:overview:components:chart`（`data-ai-state` = loading/ready/empty/error，图例 `:components:chart:legend` 与 `:components:legend:<line>`，当前值 `:chart:now`）画出选中页签的同一张图，身份按 `verb` / `result` 标签合并而不是按返回顺序配对，整条 `NaN` 的序列不画零线；加载中显示骨架；某页签没有序列时 `:chart:empty` 显示「本集群未上报该组件指标」说明与可能原因，不显示 0；请求失败时显示错误说明与重试 `cluster-monitor:overview:components:retry`（403 只说明无权限、无重试）；块内查询复用 API Server 监控 / 调度器监控页签的组件查询与身份合并语义（同一响应、同一时间窗），一块失败不影响概览其它分区。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US9 - 概览用环图/构成图呈现，并保留主图与明细 (Priority: P1)

作为 **集群管理员**，我希望 **在概览用节点环图与厂商构成环图先看「构成是否健康」，再用一张大图对比资源趋势、左侧保留 7 个当前值**，以便 **一眼看出节点健康与厂商构成，也知道当前用量是多少，而不是只有数字和进度条**。

**Independent Test**：概览状态行三块都有图形或磁贴形态；节点环图内文为健康/总节点数与百分比且与同次接口一致；厂商构成图图例每行含名称、数量与百分比；左侧 7 行用量与右侧大图指标一致，点行切换大图且单位正确；缺指标的行显示「-」，不显示 0。

## 前置与配置

- 已登录 admin，集群 host 已就绪
- componenthealth、nodes/stats 可读；监控 range query 可用；components/apiserver 与 components/scheduler 可读
- RDMA 端口清单接口 /kapis/clusters/<cluster>/rdma.kubesphere.io/v1alpha1/ports 可访问（本部署可能 404，按不可用分支断言）

## 测试步骤

1. 用 API 读取 componenthealth 的 nodeStatus、nodes/stats 的厂商计数；用一次 range 查询读契约 §4 的 7 组成对指标与 RDMA 4 组指标（health / port_up / port_total / tx / rx / rx_errors / retrans）；读取 components/apiserver 与 components/scheduler 的序列（保留 verb / result 身份）；读取 RDMA 端口清单
2. 打开 /kube-frontend/clusters/host/monitor（overview 页签），等待 cluster-monitor:surface 就绪
3. 核对四个分区按顺序出现：cluster-monitor:status → cluster-monitor:overview:usage → cluster-monitor:overview:rdma → cluster-monitor:overview:components（用 getBoundingClientRect 的 y 递增），且状态行三块可见
4. 核对用量列表恰好 7 行、key 顺序为 gpuMemory / gpu / gpuAllocated / cpu / memory / disk / pods；逐行读 :overview:usage:<key>:value 与 API used/total 交叉核对；核对右侧主图有坐标轴与图例，切换左侧指标后主图变化
5. 核对 RDMA 状态块：cluster-monitor:overview:rdma 可见，:rdma:tabs 内 4 个页签顺序为 health → ports → throughput → errors；逐个页签读 :rdma:tab:<key>:value 并核对格式（health 为百分比；ports 为两个整数；throughput 为两个字节/秒；errors 为两个整数），用 API 序列核对数值
6. 核对 :rdma:chart 的 data-ai-state 为 ready、有坐标轴/图例/:chart:now，图例与当前页签的序列一一对应；点其它页签后图与图例切换到该页签的指标
7. 核对端口清单分支：API 读取失败时 :rdma:inventory-unavailable 可见且不出现「均正常」；API 成功时按端口 healthy 统计异常节点——有异常则 :rdma:abnormal 列出这些节点（:rdma:abnormal:<node> 含 down/total），无异常则 :rdma:no-abnormal 可见
8. 断言概览不存在 cluster-monitor:overview:view-rdma（「查看 RDMA 趋势」按钮已删除）
9. 核对服务组件监控块：:overview:components 可见，:components:tabs 内 4 个页签顺序为 latency → requestRate → attempts → attemptRate；逐个页签读 :components:tab:<key>:value 并核对单位（latency 为 ms 两位小数；requestRate / attemptRate 为次/秒两位小数；attempts 为整数）
10. 读取 :components:chart 的图例身份，与 API 的 verb / result 集合比对：latency 含总平均 + 按 verb 的线；attempts / attemptRate 按 result 一线；身份不按返回顺序配对；核对 :components:chart 有坐标轴、图例与 :chart:now
11. 用 page.route 让 components/apiserver 返回 200 且 results 为空，切一次时间窗触发重取：核对服务组件块的 :components:chart:empty 显示「本集群未上报该组件指标」类说明且不显示 0；移除拦截后恢复
12. 用 page.route 让概览 range 查询返回 200 且 results 为空，重新打开页签：核对 RDMA 4 个页签当前值为 «-»、:rdma:chart:empty 可见且无零线；用量 7 行显示 «-»、主图 :usage-chart:empty；服务组件块不受概览查询影响（其查询独立）

## 期望结果

- 概览四分区顺序固定（状态行 → 资源用量 → RDMA 状态 → 服务组件监控）；状态行三块、用量 7 行与主图、两块各 4 页签与曲线齐全
- 用量当前值与 API used/total 一致；比率类按百分比显示、缺失显示 «-»
- RDMA：4 页签顺序与单位正确（health % 一位小数、ports 整数对、throughput B/s 对、errors 整数对）；数值与 API 一致；图有轴/图例/当前值，切换页签切图
- 端口清单：失败只显示「RDMA 端口清单不可用」，不显示「均正常」；成功且异常时列出异常节点与 down/total；全正常时显示「所有 RDMA 端口均正常。」
- 服务组件：4 页签顺序与单位正确；latency 含总平均 + 按 verb 的多条线，attempts / attemptRate 按 result 一线，身份不混淆；空序列显示未上报说明而不是 0
- 概览不再有 :overview:view-rdma；RDMA 明细趋势仍只从物理资源监控页签进入
- 概览无数据时 RDMA 页签显示 «-» 与 :rdma:chart:empty、不画零线；服务组件块的空态由自己的组件查询决定

## 失败排查

- RDMA 4 页签只剩数字或没有图：块被退化成摘要，检查 ClusterOverviewRdmaBlock 是否渲染 TrendChart
- 端口清单显示「均正常」但 API 失败：把清单失败当成了无异常，检查 inventory.isError 分支
- 成员集群端口清单为 1 条（host 的数字）：用了 ?cluster= 而不是路径集群段 /kapis/clusters/<c>/...
- 服务组件块延迟线只有一条：身份被按位置合并，检查是否复用 toComponentCharts 的 verb 合并
- 服务组件块尝试次数显示成小数：把累积计数当成了速率
- 点「查看 RDMA 趋势」还能跳转：按钮未删除，应只保留块内 4 页签与物理资源页签入口

## 产品改版后如何更新自动化

- 概览分区：cluster-monitor:status / :overview:usage / :overview:rdma / :overview:components
- 用量：cluster-monitor:overview:usage / :overview:usage:<key>[:value] / :overview:usage-chart[:legend|:empty]
- RDMA 块：cluster-monitor:overview:rdma / :rdma:tabs / :rdma:tab:<health|ports|throughput|errors>[:value] / :rdma:chart[:now|:empty] / :rdma:chart:legend / :rdma:legend:<metric> / :rdma:no-abnormal / :rdma:abnormal / :rdma:abnormal:<node> / :rdma:inventory-unavailable
- 服务组件块：cluster-monitor:overview:components / :components:tabs / :components:tab:<latency|requestRate|attempts|attemptRate>[:value] / :components:chart[:now|:empty] / :components:chart:legend / :components:legend:<line> / :components:retry
- 状态行：cluster-monitor:status / :overview:node-ring[:value] / :overview:vendor-donut / :overview:vendor:<vendor>
