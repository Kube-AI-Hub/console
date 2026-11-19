# 集群监控（L3）

[子模块需求](./_index.md)

## 概述

集群监控是一个导航入口、页内五个基础页签：概览、物理资源监控、API Server 监控、调度器监控、资源用量排行（etcd 接入监控时另有第 6 个条件 etcd 页签）；顺序与旧 console 的「集群状态」一致，`?tab=<key>` 可深链，默认概览。页头只有一套时间窗（最近 1 小时 / 6 小时 / 24 小时 / 7 天）与自动刷新开关，五个页签共用；页签内不再有第二套时间窗或刷新控件。

概览先回答「这个集群整体是否正常」：节点在线环图、节点 XPU 厂商构成环图、组件状态 3×2 磁贴；再回答「资源用到了哪里」：左侧 7 项指标的当前用量、右侧一张可选指标的大趋势图；最后是两块旧 console 概览的图表面板：RDMA 状态（health / 端口 / 吞吐 / 错误 4 个指标页签，各带曲线与当前值，并列出端口异常的节点）与服务组件监控（APIServer 延迟 / 速率、调度器尝试 / 速率 4 个页签，复用组件指标查询与身份合并）。物理资源页签把旧 console 的多序列指标按 GPU / 主机 / 磁盘 / 网络 / RDMA 五组合并成 18 张大图（负载 3 条线、磁盘读写吞吐与 IOPS、Pod 三态、RDMA 端口/吞吐/错误等），统一带坐标轴、图例与交互读数。API Server 与调度器各自一个页签承载组件级图（按 verb / result / quantile 合并身份），资源用量排行页签复用节点用量排行并新增导出 JSON。折线继续用 ai-kit 的 `TrendChart`，环图/构成图用本批新增的 `DonutChart`（ai-kit 引入 recharts）。

集群未就绪时该页不挂载，由集群作用域路由层整页显示「等待集群加入」面板与集群概览入口，不渲染页签、趋势与状态分区。

数值来自 KubeSphere 监控的 **range query**（`start`/`end`/`step`，返回 `matrix`），与集群概览读的当前值（`vector`）是两次不同的读取。概览的用量行读取 used 与 total 两条序列并按时间戳配对相除；每个页签把自己的主指标放在一次 range 查询里取回。

组件页签读 `/kapis/monitoring.kubesphere.io/v1alpha3/components/<apiserver|scheduler>` 的组件级指标（请求速率与延迟按 verb、调度尝试/速率/延迟按 result/quantile）；组件端点与集群端点不同，见「约束与边界」。排行页签读节点用量排行接口，并从当前指标与排序的行生成导出文件。

## 用户故事

### US1 - 看趋势而不只是当前值 (Priority: P1)

作为 **集群管理员**，我希望 **看到最近一段时间的用量曲线**，以便 **区分「一直很忙」和「刚刚抖了一下」——概览的当前值无法回答这个**。

**Independent Test**：打开集群监控，核对四个卡片都画出曲线，且每张卡片显示最小/最大/当前值。

### US2 - 切换时间窗看到不同粒度 (Priority: P1)

作为 **集群管理员**，我希望 **在 1 小时到 7 天之间切换**，以便 **既能看刚才发生了什么，也能看这一周的规律**。

**Independent Test**：点「最近 24 小时」，核对窗口切换后重新取数、当前值随之更新，且曲线点数与步长符合预期（不出现上万点）。

### US3 - 指标缺失时明确说明 (Priority: P2)

作为 **集群管理员**，我希望 **某个指标没有数据时卡片说明原因**，以便 **不会把「没数据」看成「用量为零」**。

**Independent Test**：在监控后端不可用的环境打开该页，卡片显示「该时间范围内没有数据」而不是一条 0 线。

### US4 - 分辨控制面哪个操作/结果出了问题 (Priority: P1)

作为 **集群管理员**，我希望 **看到 APIServer 的请求速率与延迟按 verb 分开、Scheduler 的调度尝试按 result 分开**，以便 **判断控制面是整体变慢还是某个操作（GET/PUT…）变慢、调度是成功还是失败了——只看一个总量会把「GET 变慢」和「调度失败」混成同一个数字**。

**Independent Test**：打开集群监控，核对「系统组件」分区的 APIServer 请求延迟图有 GET/POST/PUT 等多条线且图例按 verb 命名，Scheduler 调度尝试图有 scheduled/error/unschedulable 三条线，线与图例一一对应。

### US5 - 组件指标不可用时说清原因 (Priority: P2)

作为 **集群管理员**，我希望 **组件指标没有上报、读取失败或没有权限时页面说清是哪一种**，以便 **不会把「这个集群没上报 etcd 监控」当成「etcd 一切为 0」，也不会对无权限的请求反复点重试**。

**Independent Test**：在该集群 etcd 无序列时打开页面，etcd 子组显示「本集群未上报该组件指标」类说明而不是 0 或空白表格；让组件请求返回 403 时，该子组显示权限说明且没有重试按钮。

### US6 - 先看集群状态再看趋势 (Priority: P1)

作为 **集群管理员**，我希望 **在趋势之前先看到节点在线状态、XPU 厂商分布与组件状态**，以便 **先判断集群整体是否正常，再决定看哪条趋势——一屏曲线回答不了「集群是不是坏了」**。

**Independent Test**：在就绪集群打开监控，核对「集群状态」分区在趋势分组之前、三块都有与接口一致的数字；未启用的模块显示「未安装」，无 XPU 节点时厂商块显示空态说明。

### US7 - 集群未就绪时整页等待而不是一屏「不可用」 (Priority: P1)

作为 **集群管理员**，我希望 **集群未就绪时这个页面由路由层整页拦住并指向集群概览**，以便 **不会对着一屏不可能成功的重试按钮和被「不可用」占满的面板反复操作，也不会看到两个内容不同的等待视图**。

**Independent Test**：打开未就绪集群的监控页，路由层显示「等待集群加入」面板与「前往集群概览」入口，页面本身不挂载（没有趋势卡、没有状态分区、没有重试按钮）；集群就绪后重新进入该页显示完整页面。

### US8 - 按使用场景进入五个页签并可直接深链 (Priority: P1)

作为 **集群管理员**，我希望 **打开监控后按场景在概览、物理资源、API Server、调度器、资源用量排行五个基础页签之间切换（etcd 接入监控时另有条件 etcd 页签），并能把某个页签直接存成链接**，以便 **在排查控制面变慢、磁盘 IO、RDMA 或资源排行时不用在一屏长页面里滚动寻找，刷新或分享后也不会丢失当前场景**。

**Independent Test**：打开监控默认在概览；点「调度器监控」后只显示调度器图表，地址栏出现 `?tab=scheduler`，刷新后仍停在调度器；五个页签都能通过 `?tab=` 直接打开；切页签不触发其它页签的查询；节点详情复用该页面时没有页签条。

### US9 - 概览用环图/构成图呈现，并保留主图与明细 (Priority: P1)

作为 **集群管理员**，我希望 **在概览用节点环图与厂商构成环图先看「构成是否健康」，再用一张大图对比资源趋势、左侧保留 7 个当前值**，以便 **一眼看出节点健康与厂商构成，也知道当前用量是多少，而不是只有数字和进度条**。

**Independent Test**：概览状态行三块都有图形或磁贴形态；节点环图内文为健康/总节点数与百分比且与同次接口一致；厂商构成图图例每行含名称、数量与百分比；左侧 7 行用量与右侧大图指标一致，点行切换大图且单位正确；缺指标的行显示「-」，不显示 0。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — 已知监控后端可用，当打开集群监控，则四个卡片分别显示 CPU 使用率、内存使用率、运行中的容器组、在线节点，每张卡片有一条曲线与最小/最大/当前三个数值；CPU 与内存的当前值为 0–100 的百分比（由用量除以总量算出），容器组与节点为整数计数。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 已知在集群监控页，当切换时间窗（1 小时 → 24 小时），则以新的起止时间重新取数，曲线与当前值更新；单条曲线的采样点数不超过 200（窗口越大步长越大）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 已知监控后端可用，当打开集群监控，则除 CPU/内存/容器组/节点外，还显示异常容器组数、已完成容器组数、1/5/15 分钟平均负载、磁盘使用率、inode 使用率、网络发送与接收速率，共 13 张卡片；磁盘使用率由「已用容量 / 总容量」算出（0–100 的百分比），inode 使用率把 API 返回的 0–1 比值换算为百分比，网络速率以 B/KiB/MiB/GiB 每秒显示，平均负载保留两位小数；任一指标在窗口内没有数据时该卡片显示空态说明而不是 0。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 已知监控后端可用，当打开集群监控，则除主机资源外还按分组显示 GPU、磁盘 I/O、网络与 RDMA 趋势：GPU 组含显存使用率、GPU 使用率（API 的 0–1 比值换算为百分比）与已分配 GPU 卡数（整数）；磁盘 I/O 组含读/写吞吐（B/KiB/MiB/GiB 每秒）与读/写 IOPS（两位小数）；RDMA 组含健康度、端口可用率（已启用端口数 ÷ 总端口数）、发送/接收速率、链路速率（API 以 bit/s 返回，显示为 Gb/s）、接收错误数、重传数、丢弃数与链路中断数；每个分组有标题且卡片顺序与分组顺序一致（GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA），全页共 29 张卡片（GPU 3 + 主机资源 11 + 磁盘 I/O 4 + 网络 2 + RDMA 9）；任一指标无数据时该卡片显示空态说明而不是 0；节点详情的监控沿用同一组件，只显示节点作用域的 CPU/内存/容器组三张卡片。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04** — 已知集群监控页已加载，当点「自动刷新：关」按钮，则按钮变为「自动刷新：开」且每 5 秒以当前时间窗重取一次（窗口向前滚动），期间曲线与当前值持续更新；当再次点击关闭，则不再发起定时请求。离开页面时定时器必须停止。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06** — 已知监控后端可用且组件指标端点可读，当打开集群监控的 API Server 监控 / 调度器监控页签（etcd 接入监控时另有 etcd 页签），则组件级指标按 APIServer、Scheduler、etcd 三个子组呈现（页签化后分别落在对应页签）；APIServer 子组显示请求速率（总数，次/秒）与请求延迟（总平均 + 按 `verb` 多序列，接口返回的秒值 ×1000 显示为 ms）；按 verb 的延迟按 `verb` 标签身份合并成多条线，同一 verb 一条线、不同 verb 不混成一条，整条为 `NaN` 的序列（本部署的 APPLY）不画成 0 线；Scheduler 子组显示调度尝试次数（按 `result` 分 scheduled/error/unschedulable，累积计数用整数）与调度尝试速率（同 result 三条线，次/秒），两者单位不同；多序列卡片带图例，图例项与线的身份一致；本部署 scheduler 调度延迟（平均值与分位）没有序列时该卡片显示空态说明而不是 0；APIServer 与 Scheduler 的当前值与同一次接口响应、同一时间窗的序列交叉核对一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07** — 已知 etcd 接入监控（etcd 页签可见）且本集群 `components/etcd` 请求成功但每条指标都返回 0 条序列，当打开 etcd 页签，则 etcd 子组显示「本集群未上报该组件指标」的说明与可能原因，不显示 0 值卡片、不显示空白表格、也不整组消失；当某个组件请求失败（如 5xx）时该子组显示错误说明与重试按钮且可重试；当失败为无权限（403）时该子组显示权限说明且不显示重试按钮；无数据、错误、无权限三种画面互不顶替，某个组件失败时其余有数据的组件子组保持可用。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08** — 已知集群已就绪且 componenthealth（`/kapis/[clusters/{c}/]resources.kubesphere.io/v1alpha2/componenthealth`）与 nodes/stats（`/kapis/[clusters/{c}/]resources.kubesphere.io/v1alpha3/nodes/stats`）可读，当打开集群监控，则在趋势分组之前显示「集群状态」分区，含节点在线状态、节点 XPU 厂商分布、组件状态三块；节点在线状态显示健康节点数/总节点数（形如 1/1）与在线比例，点击进入该集群节点页，totalNodes 缺失显示「未上报」、为 0 显示空态说明而不是把 0/0 当正常；厂商分布按 nodes/stats 中除 healthy/total 外的全部厂商键列出节点数与占比（占比=该厂商节点数÷各厂商节点数之和，healthy/total 不计入），按数量降序；CPU 键表示集群中没有 XPU 的节点数量，按 CPU 行显示（文案取 node.vendor.*），不是空态；仅当各厂商计数合计为 0（无节点或未上报）时显示空态说明；组件状态含服务组件 6 项（kubesphere-system=Kube AI Hub、kube-system=Kubernetes、istio-system=服务网格、kubesphere-monitoring-system=监控、kubesphere-logging-system=日志、kubesphere-devops-system=DevOps），每项为命名空间内 healthyBackends 之和 ÷ totalBackends 之和，集群 configz 未启用的模块显示「未安装」；核心组件三项 etcd/controller-manager/scheduler 中 controller-manager 与 scheduler 按 label.component 匹配且 healthyBackends>0 判为正常、否则异常/未上报，etcd 按 kubesphere-monitoring-system/etcd ServiceMonitor 是否存在判为「已接入监控/未接入」；三块宽屏同排、窄屏堆叠，分区标题与趋势分组标题同级。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09** — 已知集群未就绪（如成员集群的 agent 未连上，该集群所有 `/kapis/clusters/{c}/*` 返回 500 且信息为 `cluster {c} is not ready`），当打开集群监控，则集群监控页不挂载，由集群作用域路由层整页显示「等待集群加入」面板（`data-ai-id="cluster:not-ready"`）并提供集群概览入口（`cluster:not-ready-overview`）；页面不显示趋势卡、不显示集群状态分区、不显示重试按钮，也不在页面内重复实现第二套等待视图。就绪判断只认集群列表中的 `ready === false`：`ready` 缺失（列表读取中或读取失败）时不接管，页面照常挂载。状态分区的加载/空/未上报/无权限/失败互不顶替：加载中显示骨架；节点为 0 或厂商计数合计为 0 时显示空态说明，CPU 行不是空态；可读但节点或某模块没有记录时显示「未上报」而不是 0/0；componenthealth 403 时只有状态分区显示无权限说明且无重试，nodes/stats 403 时只有厂商块显示无权限说明；任一 5xx 时对应块显示错误说明与重试按钮且不影响另一块与趋势分区。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-10** — 已知集群监控页已就绪且「集群状态」分区已加载，当打开「自动刷新：开」，则在 5 秒内 componenthealth、nodes/stats、etcd ServiceMonitor 三个查询各再次发起一次并按新响应更新（状态分区数字刷新，已有内容不被加载骨架整体遮挡）；当再次点击关闭，则不再发起这三类定时请求；离开页面时定时器停止。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11** — 已知集群已就绪，当打开 `/kube-frontend/clusters/<cluster>/monitor`，则页头显示标题「集群监控」、描述、时间窗按钮组（`cluster-monitor:range:<key>`）与自动刷新开关（`cluster-monitor:auto-refresh`），页头下方是互斥页签条，按固定顺序显示概览、物理资源监控、API Server 监控、调度器监控、资源用量排行五项，并在 etcd 接入监控（ServiceMonitor 探测为 200）时于末尾追加第 6 个 etcd 页签（`data-ai-id="cluster-monitor:tab:<overview|resource|apiserver|scheduler|ranking|etcd>"`，标签取 `cluster.monitor.tab.*`；etcd 页签内容为现有 etcd 组件图与无序列说明），默认选中概览并只渲染 `cluster-monitor:tabpanel:overview`；点「物理资源监控」时选中态与面板切到 `resource`，URL 通过路由 search 参数写回 `?tab=resource`（`navigate({ search: { tab }, replace: true })`，不新增浏览器历史记录；后退/前进不切换页签），刷新或直接粘贴该地址仍停在物理资源页签；`?tab=` 为未知值（例如 `?tab=foo`）或该页签当前不可见（etcd 未接入监控时的 `?tab=etcd`）时按概览渲染，不报错、不改写地址栏其它查询参数；页头的时间窗与自动刷新只有一套，任何页签内都不出现第二套时间窗/刷新控件，切换时间窗或开启自动刷新时当前页签按新区间重新取数；切换页签只为新进入的页签发起其主查询，从未挂载过的页签不发起请求，再次进入已加载页签时在同一时间窗内复用缓存而不重复请求；节点详情复用该页面（传入 `node`）时不渲染页签条、只保留节点作用域趋势，且不读取集群级页签数据；`cluster-monitor:surface` 的 `data-ai-state` 等于当前页签主查询的状态（loading/ready/empty/error），未选中页签的查询不改变该状态。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12** — 已知集群就绪且监控查询可用，当打开概览页签，则页签内容 `cluster-monitor:overview` 自上而下为状态行、集群资源用量、RDMA 状态块、服务组件监控块（后两块的页签与指标细节分别由 AC-17 / AC-18 断言）：状态行三块同高——节点在线环图（`cluster-monitor:overview:node-ring`，内文为健康节点数/总节点数，百分比文本 `cluster-monitor:overview:node-ring:value` 等于健康节点数÷总节点数、最多一位小数（验收断言允许 ±1 个百分点舍入误差），点击进入该集群节点页；`totalNodes` 缺失显示「未上报」、为 0 显示空态说明，不显示 0/0）、节点 XPU 厂商构成环图（`cluster-monitor:overview:vendor-donut`，按数量降序列出各厂商标段与 HTML 图例，每行 `cluster-monitor:overview:vendor:<vendor>` 含厂商名、节点数与百分比，百分比=该厂商节点数÷各厂商计数之和×100；`healthy`/`total` 不计入厂商行与分母；`CPU` 行表示无 XPU 的节点、显示真实节点数且不是空态，各厂商计数合计为 0 时只显示空态说明且不渲染环图）、组件状态（`cluster-monitor:status:components`，含 6 个服务组件磁贴与 etcd/controller-manager/scheduler 三个核心组件，语义与既有 ClusterStatusSection 相同；宽屏按 3 列 2 行排列、窄屏堆叠）；资源用量区左侧为 7 行指标（`cluster-monitor:overview:usage`，每行 `cluster-monitor:overview:usage:<key>`，key 依次为 gpuMemory|gpu|gpuAllocated|cpu|memory|disk|pods），每行显示名称与 used/total 当前值（文本 `cluster-monitor:overview:usage:<key>:value`），右侧为大图 `cluster-monitor:overview:usage-chart`（TrendChart 带坐标轴/网格/交互读数，图例 `cluster-monitor:overview:usage-chart:legend`）；默认选中第一行，点击某行切换大图指标，当前值单位按行分别为 bytes（B/KiB/MiB/GiB）、卡/核/个（整数）与百分比（0–1 比率×100）；任一行缺少 used 或 total 序列时显示「-」且对应大图为空态说明，不显示 0 也不画零线；比率类数值允许大于 100%（超配不截断，图轴上限取数据峰值）；RDMA 状态块 `cluster-monitor:overview:rdma` 与服务组件监控块 `cluster-monitor:overview:components` 分别见 AC-17 / AC-18；概览不再渲染「查看 RDMA 趋势」跳转按钮（原 `cluster-monitor:overview:view-rdma` 句柄删除），RDMA 明细趋势只从物理资源监控页签进入；查询加载中显示骨架、主查询无数据显示空态说明、失败显示错误说明与重试（403 无重试）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13** — 已知集群就绪且监控 range 查询可用，当打开「物理资源监控」页签，则该页签以 `cluster-monitor:resource` 为根、按 GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA 五组渲染（组标题 `cluster-monitor:resource:group:<gpu|host|disk|network|rdma>`，每图 `cluster-monitor:resource:chart:<key>`，图例 `<chart>:legend`），共 18 张图：GPU 组 gpuMemory（`cluster_gpu_memory_utilisation`×100，%）、gpuUtilization（`cluster_gpu_utilization`×100，%）、gpuAllocated（`cluster_gpu_allocated`，卡，整数）；主机组 cpu（`cluster_cpu_utilisation`×100，%）、memory（`cluster_memory_utilisation`×100，%）、load（`cluster_load1`/`cluster_load5`/`cluster_load15` 三条线，两位小数）、diskUsage（`cluster_disk_size_usage`，B/KiB/MiB/GiB）、inode（`cluster_disk_inode_utilisation`×100，%）、pods（running/completed/abnormal 三条线，分别来自 `cluster_pod_running_count`/`cluster_pod_succeeded_count`/`cluster_pod_abnormal_count`，个）；磁盘组 throughput（read/write 两条线，来自 `cluster_disk_read_throughput`/`cluster_disk_write_throughput`，B/s）、iops（read/write 两条线，来自 `cluster_disk_read_iops`/`cluster_disk_write_iops`，两位小数）；网络组 traffic（tx/rx 两条线，来自 `cluster_net_bytes_transmitted`/`cluster_net_bytes_received`，B/s）；RDMA 组 health（`cluster_ib_health`×100，%）、ports（portUp/portTotal 两条线，来自 `cluster_ib_port_up`/`cluster_ib_port_total`，个）、throughput（tx/rx 两条线，来自 `cluster_ib_tx_bytes`/`cluster_ib_rx_bytes`，B/s）、linkSpeed（`cluster_ib_link_speed` 为 bit/s，÷1e9 显示 Gb/s 并保留一位小数）、errors（rxErrors/retrans/discards 三条线，来自 `cluster_ib_rx_errors`/`cluster_ib_retrans`/`cluster_ib_discards`，个）、linkDowned（`cluster_ib_link_downed`，个）；每张图带坐标轴、网格与交互读数，多序列按身份标签合并（同一身份一条线、不同身份不混线、不按返回顺序配对），序列名取 `cluster.monitor.series.*`，颜色取 ai-kit 图表 token；本页签只发起一次 range 查询（上述指标一次取回）；某指标在本集群没有序列或全部非有限值时该图只显示空态说明 `<chart id>:empty`，不画零线、不以 0 代替；切换离开再回到本页签时同一时间窗内复用已取数据。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14** — 已知集群就绪且组件指标可读，当打开「API Server 监控」页签，则显示两张带坐标轴与图例的大图：请求延迟 `cluster-monitor:apiserver:chart:latency`（总平均一条线 + 按 `verb` 合并的多条线，API 返回的秒值×1000 显示 ms 并保留两位小数；整条为 `NaN` 的序列不画成 0 线）与请求速率 `cluster-monitor:apiserver:chart:rate`（总请求速率，次/秒，两位小数）；多序列按 `verb` 身份合并且图例项与线一一对应，不按返回顺序配对；本页签查询与调度器页签独立，加载中显示骨架、无序列时显示空态说明而不是 0、失败显示错误说明与重试、403 显示无权限说明且无重试；本页签查询失败不影响其它页签。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15** — 已知集群就绪且组件指标可读，当打开「调度器监控」页签，则显示三张带坐标轴与图例的大图：调度尝试次数 `cluster-monitor:scheduler:chart:attempts`（按 `result` 分 scheduled/error/unschedulable 三条线，累积计数、整数）、调度尝试速率 `cluster-monitor:scheduler:chart:rate`（同样按 `result` 三条线，次/秒）、调度延迟 `cluster-monitor:scheduler:chart:latency`（平均一条线 + 分位 p99/p90/p50 多条线，API 秒值×1000 显示 ms）；本部署调度延迟没有序列时该图只显示空态说明，不画零线、不显示 0；多序列按 `result`/`quantile` 身份合并；本页签查询与 API Server 页签独立，加载/空/失败/403（无重试）分支互不顶替。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16** — 已知集群就绪，当打开「资源用量排行」页签，则页签内容为节点用量排行表（复用 NodeRankingPanel，`aiIdPrefix="cluster-monitor:ranking:"`，保留名称/指标值/排序/搜索/分页，行与控件句柄以 `cluster-monitor:ranking:` 为前缀），页签标题与说明取既有 `cluster.nodeUsage.*` 文案；排行表右上角有导出按钮 `cluster-monitor:ranking:export`（文案 `cluster.nodeUsage.export`，title/hint `cluster.nodeUsage.exportHint`）；有数据时点击导出下载名为 `node.usage.rank.json` 的 JSON 文件，内容为 `{cluster, metric, order, generatedAt, items:[{name, values}]}`，items 为当前指标与排序下的全部行（`nodeRankingApi` 支持一次全量时用 `pageSize=-1`，不支持时逐页拉取；若后端只能给出已加载页，则导出已加载行并在文件中如实标注范围），不包含当前页以外的筛选缺失或伪造行；当前指标/排序无数据时导出按钮为禁用态并显示 `cluster.nodeUsage.exportEmpty` 提示，不生成空文件；节点用量排行独立页 `node-usage` 同时提供同款导出（句柄 `node-usage:export`），两处导出内容形状一致；切换排行页签不触发其它页签查询，导出失败（如接口 403/5xx）显示错误说明而不下载残缺文件。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-17** — 已知集群就绪且概览 range 查询可用，当打开概览页签，则「RDMA 状态」块 `cluster-monitor:overview:rdma` 以 4 个互斥指标页签呈现（页签容器 `cluster-monitor:overview:rdma:tabs`，页签 `cluster-monitor:overview:rdma:tab:<health|ports|throughput|errors>`，顺序固定 health → ports → throughput → errors，每个页签显示当前值 `:rdma:tab:<key>:value`）：health = `cluster_ib_health`×100（%，最多一位小数）、ports = `cluster_ib_port_up` / `cluster_ib_port_total`（整数计数，以 / 分隔）、throughput = `cluster_ib_tx_bytes` / `cluster_ib_rx_bytes`（B/KiB/MiB/GiB 每秒）、errors = `cluster_ib_rx_errors` / `cluster_ib_retrans`（整数计数）；右侧图 `cluster-monitor:overview:rdma:chart`（`data-ai-state`=ready，当前值 `:chart:now`，图例 `cluster-monitor:overview:rdma:chart:legend` 与 `:rdma:legend:<metric>`）画出选中页签的序列（health 1 条、ports/throughput/errors 各 2 条），带坐标轴、网格与交互读数，数据来自概览同一次 range 查询；某页签没有序列时 `:chart:empty`（`data-ai-state`=empty）显示「该时间范围内没有数据」与可能原因，不画零线，页签当前值显示「-」；RDMA 端口清单来自 `GET /kapis[/clusters/<cluster>]/rdma.kubesphere.io/v1alpha1/ports?limit=-1`（集群段在路径中，不用 `?cluster=`），读取成功且有 `healthy=false` 的端口时 `:rdma:abnormal` 按异常端口数降序列出节点与「down/total 个端口不可用」（节点行 `:rdma:abnormal:<node>`），全部端口正常时只显示 `:rdma:no-abnormal` 的「所有 RDMA 端口均正常。」，清单读取失败（404/403/5xx/网络）时显示 `:rdma:inventory-unavailable` 的「RDMA 端口清单不可用」而不是声称正常；概览不再渲染「查看 RDMA 趋势」按钮（`cluster-monitor:overview:view-rdma` 句柄删除），RDMA 明细趋势仍只从物理资源监控页签进入（一个动作一个入口）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-18** — 已知集群就绪且组件指标可读，当打开概览页签，则「服务组件监控」块 `cluster-monitor:overview:components` 以 4 个互斥页签呈现（页签容器 `cluster-monitor:overview:components:tabs`，页签 `cluster-monitor:overview:components:tab:<latency|requestRate|attempts|attemptRate>`，顺序固定，每个页签显示当前值 `:components:tab:<key>:value`）：latency = APIServer 请求延迟（总平均 + 按 `verb` 多序列，API 秒值×1000 显示 ms，两位小数）、requestRate = APIServer 总请求速率（次/秒，两位小数）、attempts = 调度器调度尝试次数（按 `result` 多序列，累积整数）、attemptRate = 调度器调度尝试速率（按 `result` 多序列，次/秒）；右侧图 `cluster-monitor:overview:components:chart`（`data-ai-state` = loading/ready/empty/error，图例 `:components:chart:legend` 与 `:components:legend:<line>`，当前值 `:chart:now`）画出选中页签的同一张图，身份按 `verb` / `result` 标签合并而不是按返回顺序配对，整条 `NaN` 的序列不画零线；加载中显示骨架；某页签没有序列时 `:chart:empty` 显示「本集群未上报该组件指标」说明与可能原因，不显示 0；请求失败时显示错误说明与重试 `cluster-monitor:overview:components:retry`（403 只说明无权限、无重试）；块内查询复用 API Server 监控 / 调度器监控页签的组件查询与身份合并语义（同一响应、同一时间窗），一块失败不影响概览其它分区。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-19** — 已知任一监控页签的图表卡片尚未取到数据，则该卡片以骨架占位而不是空白或整块灰底：卡片 `data-ai-id="<前缀>:chart:<key>"` 在首屏带 `data-ai-state="loading"` 与 `aria-busy="true"`，内部渲染骨架句柄 `<前缀>:chart:<key>:loading`（轴刻度条 + 脉冲带 + 图例占位），且**不**渲染 `<前缀>:chart:<key>:empty` 说明；骨架卡片的标题行、绘图区、图例行三段高度与数据到达后（`data-ai-state` 为 `ready` 或 `empty`）分别相同（差值 ≤ 1px），卡片总高度同样不变，数据到达时页面不跳动；读者点刷新时卡片报 `refreshing` 并保留曲线与遮罩，自动刷新不报 `refreshing`。

以上 AC-11…19 是本批页签 IA、图表形态与概览两块恢复内容的验收判据；AC-12 的概览四分区顺序由 AC-17 / AC-18 补足后两块细节，TC-…-MONITOR-12 同时覆盖 AC-12 / AC-17 / AC-18。AC-01/03/05/06/07 描述的是页签化之前的平铺单页形态（四张趋势卡、13 卡、29 卡、单页「系统组件」分区）；本批把这些内容迁入对应页签并改为图表形态，指标集合、单位、空态与状态分支仍按这些 AC 的语义执行，页面位置与图表形态以 AC-11…13 为准（AC-07 的归宿为条件 etcd 页签）；旧平铺断言不再作为验收判据，其 TC 的更新登记为待补（见「明确不做」与交付记录）。

## 设计目标

1. 曲线回答「形状」，数值回答「多少」，两者同时给出。
2. 窗口决定步长，避免一次拉回上万点。
3. 百分比必须由「用量 ÷ 总量」算出，不能把字节当百分比。
4. 同一指标的多个身份（verb/result/quantile）同图显示、按身份取线；缺值、真实 0、无数据、无权限分别表达。
5. 一个导航入口、五个基础页签 + 条件 etcd 页签：按使用场景拆分（概览 / 物理资源 / API Server / 调度器 / 排行 / etcd），页签可深链，切页签不请求未挂载页签的数据。
6. 图表回答「构成」与「形状」：节点与厂商构成用环图，趋势用带坐标轴的多序列大图；同一屏里主图明显大于明细，明细给出精确当前值。
7. 同一指标的多条身份序列合并进一张图（负载 1/5/15、磁盘读写、网络收发、Pod 三态、RDMA 端口/吞吐/错误），而不是一个身份一张卡。
8. 页签各自持有自己的主查询与状态，一页签失败不拖垮另一页签；页头的时间窗与自动刷新是页面级动作，只出现一次。
9. 概览在回答「集群是否健康」「资源用在哪」之后，继续回答「RDMA 织物是否正常」「控制面是否退化」：用旧 console 的多指标页签 + 曲线 + 异常节点清单呈现，而不是四个数字或一个跳转按钮。

## 约束与边界

- 读 `/kapis/monitoring.kubesphere.io/v1alpha3/cluster`，带 `start`/`end`/`step`。
- 百分比卡片需要两条序列：用量与总量。
- 系统组件读 `/kapis/monitoring.kubesphere.io/v1alpha3/components/<apiserver|scheduler|etcd>`，带 `metrics_filter`（`|` 分隔、每个名字以 `$` 结尾）、`start`/`end`/`step`、`cluster`。
- 只保留最近 7 天：监控后端自身的保留期决定，页面不承诺更早的数据。
- 状态分区读三处集群级接口，均为 JSON：componenthealth `/kapis/[clusters/{c}/]resources.kubesphere.io/v1alpha2/componenthealth`（`nodeStatus`、`kubernetesStatus`、`kubesphereStatus` 数组）；nodes/stats `/kapis/[clusters/{c}/]resources.kubesphere.io/v1alpha3/nodes/stats`（`厂商名 → 节点数`，另带 `healthy` / `total` 汇总字段）；ServiceMonitor `apis[/clusters/{c}]/monitoring.coreos.com/v1/namespaces/kubesphere-monitoring-system/servicemonitors/etcd`（200=已接入，404=未接入）。
- 成员集群的集群段紧跟 `/kapis` 或 `/apis`：`/kapis/clusters/{c}/...`，不拼在 group 之后，也不用 `?cluster=` 查询参数代替。
- 成员集群未就绪的语义：所有 `/kapis/clusters/{c}/...` 返回 HTTP 500，信息为 `cluster {c} is not ready`。这不是 403（无权限），也不是空数据（200 空集）；页面按「未就绪」处理并整页让位，不做逐块错误重试。
- 状态分区三块的数据源互相独立（节点与组件状态来自 componenthealth，厂商分布来自 nodes/stats，etcd 项来自 ServiceMonitor），一块失败不阻塞另一块，也不阻塞趋势分区。
- 状态分区与集群就绪判断都只读。
- 组件指标可能整组没有序列（本部署 etcd），页面必须如实说明，不能填 0。
- 路由：`monitor` 是唯一入口；`validateSearch` 接受 `tab` ∈ `overview|resource|apiserver|scheduler|ranking|etcd`；未知值忽略、默认 `overview`；etcd 页签仅在 ServiceMonitor 探测为 200 时可见，隐藏时 `?tab=etcd` 按 `overview` 渲染；用 `Route.useSearch()` 读、`Route.useNavigate()` 写，切页签写 `{ search: { tab }, replace: true }`（不进浏览器历史）。
- 节点详情复用同页（传入 `node`）时没有页签，只保留节点作用域趋势。
- 图表统一走共享组件：折线/面积用 ai-kit `TrendChart`（多序列/坐标轴/交互读数），构成用本批新增的 ai-kit `DonutChart`（recharts）；不在页面内自绘 SVG 环图/饼图/折线。
- recharts 装在独立 pnpm 项目 `console/packages/ai-kit`（`^3.11.0`），不要加到 kube-frontend workspace；ai-kit 构建产物由 `kube-frontend/packages/ui` 再导出。
- 每个页签只保留一个主查询（物理资源页签一次取 18 张图的指标；组件页签各一次 `components/<apiserver|scheduler>`；排行页签走既有 node 用量排行接口）。
- 只读页面；不改 api-client 既有方法签名，若排行导出需要新增参数只加不改并同步 barrel 导出。
- 图表容器加 `aria-label`（图名）；交互元素用共享 `Button`/`Tabs` + `actionProps`（ai-surface 契约）。
- 状态：loading 用 Skeleton；empty 用说明文本（`<chart id>:empty`）；error 用 ResourceErrorPanel（403 无重试）；不得用 0 顶替无数据。
- 概览一次 range 查询同时携带 7 组用量指标与 RDMA 4 组指标（health、port_up、port_total、tx/rx bytes、rx_errors、retrans），让四分区共用同一窗口与时间戳；RDMA 端口清单是独立清单读取（不是指标），不并入 range 查询。
- RDMA 端口清单必须用路径集群段 `GET /kapis[/clusters/<cluster>]/rdma.kubesphere.io/v1alpha1/ports?limit=-1`；不能用 `?cluster=` 代替（对成员集群实测返回 0 条，见 design GOT）。
- 概览服务组件块复用 `componentMonitorQueries` 的 `useComponentMetrics` / `toComponentCharts`（与 API Server / 调度器页签同一查询与身份合并），概览里不复制第二套请求，也不按返回顺序配对身份。
- 概览顺序固定：状态行 → 集群资源用量 → RDMA 状态 → 服务组件监控；RDMA 块与服务组件块各自 loading / empty / error 分支，一块失败不影响其它分区。
- 只读。

## UI 交互设计

- 顶部标题 + 时间窗按钮组（互斥，当前项高亮），窄屏换行。
- 「集群状态」分区紧随页头、在 GPU 趋势分组之前；分区标题与「GPU / 主机资源 / 磁盘 I/O / 网络 / RDMA」分组标题同级（同一层级的分区标题，都只做分区不折叠）。分区内三块：节点在线状态、节点 XPU 厂商分布、组件状态；宽屏三块同排，窄屏堆叠。
- 节点在线状态：健康节点数 / 总节点数（形如 1/1）+ 在线比例，整块可点击进入该集群节点页。比例用比例条表达「健康占总量的多少」；它不是一个单独的数字装饰。
- 厂商分布：按节点数降序的列表，每行为厂商图标 + 厂商名 + 节点数 + 占比比例条与百分比；占比的分母是各厂商节点数之和，`healthy` / `total` 汇总字段不参与。`CPU` 行表示「有节点但没有 XPU」，它带真实节点数，不是空态；只有各厂商计数合计为 0（无节点或未上报）时才显示空态说明、不画空的比例条。
- 组件状态：上半为 6 个服务组件，每项为图标 + 名称 + 健康后端数 / 总后端数（命名空间内 `healthyBackends` 之和 ÷ `totalBackends` 之和）；configz 未启用的模块显示「未安装」而不是 0/0。下半为三个核心组件：etcd 显示「已接入监控 / 未接入」，controller-manager 与 scheduler 显示「正常 / 异常 / 未上报」。不同语义不共用同一个「健康」徽标。
- 状态分支：加载中每块给骨架；空数据给空态说明；读不到但接口成功（没有记录）显示「未上报」；无权限只说明「无权限查看」且不给重试；其他失败给错误说明与重试。五种画面互不顶替，失败的重试只重取该块的数据源。
- 自动刷新开关同时作用于趋势与集群状态分区：开启后每 5 秒重取趋势与状态分区三查询（状态分区已有内容不因瞬时重取被整体清空），关闭后停止；不保留旧页每 2 秒无条件轮询 componenthealth 的行为。
- 未就绪：页面本身不挂载，由集群作用域路由层整页显示「等待集群加入」面板（`data-ai-id="cluster:not-ready"`），内含「该集群尚未加入，此页面在集群就绪前不可用」与「前往集群概览」入口（`cluster:not-ready-overview`）；页面内不再放第二套等待视图，也不放重试按钮。
- 四个卡片两列排布；卡片内：标题、当前值、曲线、最小/最大/当前/截至时间。
- 曲线按卡片自身峰值缩放（含 15% 余量），因为固定 0–100 刻度会让 5% 的曲线贴在底部，看起来和「无数据」一样。
- 「系统组件」分区在物理资源五组之后，含 APIServer / Scheduler / etcd 三个子组；每个子组一个标题、两列卡片网格；多序列卡片在图下方列图例（色点 + 身份 + 当前值），未返回的身份不以 0 补线。
- 子组状态：加载中给骨架；有数据给卡片；无数据显示说明（不提重试）；失败显示错误说明 + 重试（403 不显示重试）。

- 页签条在页头（标题/描述/时间窗/自动刷新）下方，五项等距排列、当前项高亮；窄屏可横向滚动或换行，不挤压页头。内容容器按选中页签渲染，未选中页签不挂载。
- 概览布局（自上而下）：① 状态行三块同高（节点环图 / 厂商构成环图 + 图例 / 组件状态磁贴 3×2 + 核心组件一行）；②「集群资源用量」左右布局（左列 7 行可点指标与 used/total，右列一张大图，图高明显大于左列行高）；③「RDMA 状态」块：左侧 4 个指标页签（每项名称 + 当前值），右侧一张大图 + 图例 + 当前值，图上方按端口清单显示异常节点列表或「所有 RDMA 端口均正常。」/「端口清单不可用」；④「服务组件监控」块：左侧 4 个页签（延迟 / 请求速率 / 调度尝试 / 尝试速率），右侧一张大图 + 图例 + 当前值。两块都不再有跳转按钮。
- 物理资源页签：五组，每组一个组标题 + 大图网格（宽屏两列、窄屏一列）；每张图有图名、图例与空态说明，图高大于旧卡片。
- API Server / 调度器页签：页签内 2 张 / 3 张大图，图例在图下方；状态说明与重试只作用于本页签。
- 排行页签：节点用量排行表（列、排序、搜索、分页与独立页一致）+ 导出按钮；导出按钮在无数据时禁用并给出提示。
- 节点详情变体：无页签条，只显示节点作用域趋势。

## 文案与校验

- 百分比取整加 `%`；计数取整。
- 无数据：说明 + 一句可能原因。
- 时间窗标签：最近 1 小时 / 6 小时 / 24 小时 / 7 天。
- 组件单位：请求/调度速率为「次/秒」（两位小数）；延迟与 fsync/commit 时长为 ms（API 的秒 ×1000，两位小数）；调度尝试次数与待处理提案为整数；DB 大小按 B/KiB/MiB/GiB；客户端流量为字节/秒。
- 组件无数据：「本集群未上报该组件指标」+ 一句可能原因（未安装监控或指标未被采集）。

- 页签名取 `cluster.monitor.tab.*`（概览 / 物理资源监控 / API Server 监控 / 调度器监控 / 资源用量排行）。
- 概览标题与提示取 `cluster.monitor.overview.*`；物理资源图题取 `cluster.monitor.resource.*` 与既有指标名；多序列名取 `cluster.monitor.series.*`。
- 排行导出取 `cluster.nodeUsage.export` / `exportHint` / `exportEmpty`；导出文件名固定 `node.usage.rank.json`。
- 图表空态沿用 `cluster.monitor.empty` / `emptyHint`；组件空态沿用 `cluster.monitor.components.*`；无数据不显示 0。
- 状态行节点环图百分比最多一位小数，验收断言允许 ±1 个百分点舍入误差；其它百分比按 AC-12 / AC-13 的精度规则。
- RDMA 状态块：页签名取既有 `cluster.monitor.rdmaHealth` / `cluster.monitor.rdmaPorts` / `cluster.monitor.resource.rdmaThroughput` / `cluster.monitor.overview.rdmaErrorsTab`；值为百分比（最多一位小数）/ 整数计数 / 字节每秒；端口清单文案取 `cluster.monitor.rdmaNoAbnormalNodes` / `rdmaAbnormalNodes` / `rdmaAbnormalPorts` / `rdmaInventoryUnavailable`。
- 服务组件监控块：标题与提示取 `cluster.monitor.overview.components` / `overview.componentsHint`；页签名复用 `cluster.monitor.component.*`；值为 ms（两位小数）/ 次/秒（两位小数）/ 整数；空态取 `cluster.monitor.components.notReported` / `notReportedHint`。
- 单位与精度按 AC-12 / AC-13 / AC-17 / AC-18：bytes 按 B/KiB/MiB/GiB（每秒速率加 /s）、比率×100 显示 `%`、链路速率 bit/s→Gb/s 一位小数、IOPS 与负载两位小数、计数取整。

## 边界情况

- 监控后端缺失或 range query 不受支持：卡片显示「该时间范围内没有数据」，页面不整体失败。
- 用量序列存在但总量序列缺失：该卡片按无数据处理（无法算百分比，不能编一个）。
- 序列时间戳不一致：按时间戳配对，不按下标 zip。
- 组件序列值可能是 `NaN`（本部署 APPLY verb）：丢弃非有限值，整条为 NaN 时按无数据。
- 组件指标「有序列且值为 0」显示 0；「没有序列」显示说明——两者不得混用。
- 组件请求 403：显示无权限说明且不提供重试；其他失败提供重试。
- CPU 行不是空态：`nodes/stats` 的 `CPU` 键表示无 XPU 的节点数，必须作为一行显示（集群有节点、只是没有加速卡）；空态只用于厂商计数合计为 0（无节点/未上报），两者不得混用。

- `?tab=` 非法值（如 `?tab=etcd`、空串、大小写不同）按概览渲染且不报错；URL 不因此被重写；同一页签重复点击不新增历史记录。
- 节点详情复用页收到 `node` 时优先无页签形态，忽略 `tab` 参数。
- 自动刷新开启时切换页签：新页签按当前区间立即取数，并在同一 5 秒节奏内继续；关闭后所有页签停止定时请求。
- DonutChart 输入为空、合计 ≤0 或全部非有限值：只渲染说明文本，不渲染 SVG，不画 0 宽扇区。
- 厂商只有一个或包含 `CPU` 行时按真实数量排序；`CPU` 行不是空态；空态只用于各厂商计数合计为 0。
- 18 张图中某条指标在本集群不存在：该图显示空态说明，其余图照常；不因一条缺失让页签整体失败。
- 排行导出：无数据按钮禁用；后端不支持全量时导出已加载行并如实标注；下载失败显示错误说明，不生成残缺文件。
- 页签隐藏时不保留在 DOM（懒挂载），避免隐藏容器内图表宽度为 0 与未挂载页签取数。

- 概览 range 查询成功但某 RDMA 指标没有序列：该页签当前值显示「-」，选中该页签时图显示 `:rdma:chart:empty` 说明，不画零线；其它页签照常显示。
- RDMA 端口清单返回 200 且 items 为空：清单读取成功，按「无异常端口」显示「所有 RDMA 端口均正常。」，不改判为不可用。
- RDMA 端口清单 404/403/5xx/网络失败：显示「RDMA 端口清单不可用」，不显示「均正常」，也不阻止 4 个指标页签的曲线。
- 服务组件监控块：一个组件查询失败只让相关页签进入 error（带重试；403 无重试），另一组件的页签与概览其它分区不受影响；请求成功但没有序列显示「本集群未上报该组件指标」而不是 0。
- 概览四分区顺序固定；切时间窗或自动刷新时四分区按同一窗口重取（端口清单是独立读取，失败不阻塞指标曲线）。

## 明确不做

- 节点/容器组级别的下钻与排行：老 console 的「物理资源」「节点用量排行」是独立页面；本轮把物理资源与排行迁入页内页签（AC-13/16），节点/容器组级下钻仍不做（登记后续，不是永久结论）。
- 独立路由的 etcd / apiserver / scheduler 监控页：本轮用页内页签承载，不新增独立路由。etcd 恢复为**条件页签**（与旧 `requireETCD` 一致）：ServiceMonitor `kubesphere-monitoring-system/etcd` 探测为 200 时在页签条末尾显示，404 或探测失败时隐藏；隐藏时 `?tab=etcd` 回退概览。本部署探测为 404、页签隐藏，AC-07 的正分支（有序列 / 无序列说明）本地 skip 并记录环境限制，需在接入 etcd 监控的集群上复验。
- etcd 节点级服务状态卡（在线 / 有 leader / leader 变更次数，旧 `ETCDNodes`）：本部署无 etcd 指标序列，无法验收；登记为待补，不以组件页健康数冒充。
- 告警阈值线叠加：需要知道每条规则的阈值，规则体里没有统一字段。
- 每页签独立时间窗/播放控制：本轮五个基础页签与条件 etcd 页签共用页头一套时间窗与自动刷新（AC-11、DEC-23）；后续若需要按页签独立窗口，另立批次评估，不把「共用」当成永久形态。
- 旧概览 RDMA 四子图与端口清单**已恢复**（AC-17：4 个指标页签 + 曲线 + 端口异常节点清单）；原「查看 RDMA 趋势」跳转按钮已删除（不再有 `cluster-monitor:overview:view-rdma`），RDMA 明细分组仍只从物理资源监控页签进入。后续可做：端口异常节点下钻到节点详情或物理资源页签（本轮只列节点名与 down/total，登记后续，不是永久结论）。
- 概览内不做 RDMA 端口清单的搜索 / 分页 / 导出：本轮清单只回答「哪个节点的端口不可用」，完整端口信息在节点详情与物理资源页签（登记后续）。
- 概览服务组件监控**已恢复**（AC-18：4 个页签复用组件查询与身份合并）；不做概览内的组件下钻（点击进入 API Server / 调度器页签或组件页，登记后续）。
- 排行导出：本轮导出当前 metric/order 的全部行（后端支持时），格式只提供 JSON（不做 CSV/Excel 与服务端导出）。若 `nodeRankingApi` 无法一次给出全量，则导出已加载页并在文件中如实标注范围（契约 §9）；后续补全量分页拉取或服务端导出（登记待补，不是永久结论）。
- 环图/构成图交互：本轮不做 hover 下钻、扇区点击筛选、跨集群构成对比；折线不做缩放/框选（TrendChart interactive 只提供读数）。后续需要时扩展 ai-kit（登记后续）。
- 服务组件图标点击进入组件页：本轮不做（登记待补）。理由：(a) 状态行回答「是否健康」，不是导航入口；(b) 新 console 的组件页已有入口（集群概览的组件面板/侧栏），在摘要行上再加 6 个深链会把「状态」与「去哪看」混在一行；(c) 旧页的 `?type=` 过滤在新组件页是客户端分组，复刻可行但本轮 AC 未承诺。
- 厂商分布不再用「列表 + 比例条」作为最终形态：本批恢复环图/构成图（DEC-26，取代 DEC-13 的结论）；DonutChart 的 HTML 图例仍给名称/数量/百分比。旧页 recharts 饼图的交互与配色不复刻（用 ai-kit token）。
- 旧平铺形态不回退：AC-01/03/05/06/07 描述的「单页平铺」形态（四张趋势卡、13 卡、29 卡、单页系统组件分区）已被本批页签化与图表化取代；这些 AC 的指标集合、单位、空态与状态分支语义继续有效，页面位置与图表形态以 AC-11…13 为准，对应 TC 的更新登记为待补（不删 AC、不删追溯）。
- etcd 真实健康不做承诺：etcd 项只表达「是否接入监控」（ServiceMonitor 是否存在），不做 leader、延迟或成员级健康判断。
- 不单独做「集群状态」页面或页签：状态分区只作为监控页的一个分区存在。
- 不在监控页内重复实现未就绪等待视图：未就绪由集群作用域路由层统一接管（已有 `cluster:not-ready` 面板），页面内不再加第二个。
- 不保留旧页每 2 秒无条件轮询 componenthealth 的行为：状态分区改为随页面自动刷新开关每 5 秒重取。

## 假设

- range query 返回 `matrix`；若返回 `vector`（忽略 range 参数），按单点处理而不是当作趋势。
- 监控 API 对契约 §5 的指标名返回 `matrix`；个别指标在本部署不存在时按空态处理并在交付记录里列出缺失指标，不在页面填 0。
- recharts `^3.11.0` 已安装在 `console/packages/ai-kit`（独立 pnpm 项目），ai-kit 构建后由 kube-frontend 的 ui 包再导出。
- `nodeRankingApi` 支持一次取全量（`pageSize=-1`）或可逐页拉取；两者都不支持时按已加载页导出并如实标注（见 AC-16）。
- 旧 console 的 5 个基础页签（overview/resource/api-server/scheduler/ranking）与本批页签一一对应；旧 etcd 页签按 `requireETCD` 条件显示，本批恢复为条件 etcd 页签（ServiceMonitor 200 显示、404/失败隐藏）。本部署探测为 404，所以页签隐藏。
- RDMA 端口清单接口返回 `items[]`（`nodeName` / `device` / `port` / `stateName` / `healthy`）与 `totalItems`，`limit=-1` 表示全部；host 集群走 `/kapis/...`、成员集群走 `/kapis/clusters/<c>/...`（集群段在路径中）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16`

- 上述 `TC-…-MONITOR-08` / `TC-…-MONITOR-09` 同时覆盖 `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-10`（自动刷新同时驱动状态分区三查询）。
- 本批新增 `TC-…-MONITOR-11…16` 覆盖 `AC-…-MONITOR-11…16`（spec 由验证方编写，covers 以本文件为准）；`TC-…-MONITOR-01/03/05/06/07` 的「平铺单页/系统组件分区/卡片数」断言随页签化更新，已授权由验证方本批更新（保留 covers 与行为断言，只改进入方式/句柄/计数）。
- `TC-…-MONITOR-12` 的 covers 扩为 `AC-…-MONITOR-12` / `AC-…-MONITOR-17` / `AC-…-MONITOR-18`：概览两块恢复内容由同一概览用例覆盖，pytest 断言由验证方扩展。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — range query 读取四条（含两条总量）序列，窗口决定步长。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 百分比由用量 ÷ 总量按时间戳配对计算。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 无数据时说明，不画零线。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04** — 组件指标走 `/components/<module>` range 查询，多序列按 verb/result/quantile 标签身份合并与着色。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 组件无数据、错误、无权限分别呈现；无数据不填 0。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06** — 状态分区读 componenthealth 的节点与组件聚合、nodes/stats 的厂商计数、ServiceMonitor 的 etcd 接入探测与集群 configz 的模块开关；三块各自独立降级。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07** — 集群就绪判断来自集群列表的 `ready === false`（路由层接管）；`ready` 缺失不接管。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08** — 页面自动刷新开关同时驱动趋势查询与状态分区三查询（componenthealth、nodes/stats、etcd ServiceMonitor），开启时每 5 秒重取，关闭或卸载时停止。

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09** — monitor 路由的 search 参数 `tab` 接受五个基础页签值与条件 etcd 值，未知值忽略、默认 `overview`；etcd 页签仅 ServiceMonitor 200 时可见、隐藏时回退概览；页签切换写回 URL（replace 语义），节点详情变体不带页签。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-10** — 页头只有一套时间窗与自动刷新；页签懒挂载、各自发起主查询，切页签不请求未挂载页签，`cluster-monitor:surface` 跟随当前页签主查询状态。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11** — 概览用节点环图、厂商构成环图与组件 3×2 磁贴呈现状态，用「7 行当前值 + 一张可选指标大图」呈现资源用量，并按 AC-17 / AC-18 承载 RDMA 状态与服务组件监控两块。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12** — 物理资源页签按五组渲染 18 张多序列图，统一坐标轴/图例/单位/空态，本页签一次 range 查询取全部指标。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13** — API Server 页签显示按 verb 合并的请求延迟与总请求速率，失败/空/403 分支独立。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14** — 调度器页签显示按 result 合并的调度尝试次数/速率与平均+分位延迟，失败/空/403 分支独立。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15** — 排行页签复用 NodeRankingPanel 并支持按当前 metric/order 导出 JSON（node-usage 页同步提供）。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16** — ai-kit 引入 recharts 并新增 DonutChart（分段/图例/空态/主题 token/无障碍），从 ai-kit 与 ui 包导出。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-17** — 概览 RDMA 状态块：4 个指标页签（health / ports / throughput / errors）+ 曲线 + 当前值，数据来自概览同一次 range 查询；端口清单用路径集群段读取，按异常节点列出，清单不可用如实说明；删除原「查看 RDMA 趋势」按钮。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-18** — 概览服务组件监控块：4 个页签（延迟 / 请求速率 / 调度尝试 / 尝试速率），复用 `componentMonitorQueries` 的查询与身份合并；带坐标轴与图例，empty / error / 403 分支独立。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — 百分比在 0–100 之间；窗口切换后重新取数。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 组件分区三个子组齐全；多序列身份不混淆；etcd 无数据如实说明；无权限不给重试。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 就绪集群的状态分区三块齐全，数字与同次接口响应一致，未安装模块如实说明，CPU 行表示无 XPU 节点且不是空态；未就绪成员集群整页为等待视图，无趋势、无状态分区、无重试；加载/空/未上报/无权限/失败五种画面互不顶替。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04** — 五个基础页签齐全（etcd 接入监控时另有条件 etcd 页签）、默认概览、`?tab=` 深链可用且未知值/隐藏 etcd 页签不报错；页头只有一套时间窗/刷新；切页签只为新页签取数，未挂载页签零请求。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 概览与物理资源页签的图表形态成立（节点/厂商为环图、主图明显大于左侧列表、18 张多序列图带轴/图例/空态），排行导出 JSON 与同次接口数据一致且无数据不出空文件。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06** — 概览四分区齐全且顺序固定；RDMA 4 页签的值/单位/曲线与端口异常节点清单正确，清单失败不冒充正常；服务组件 4 页签的身份合并与 ms / 次/秒 / 整数单位正确，无数据与失败分支不显示 0。
