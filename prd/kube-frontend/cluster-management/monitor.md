# 集群监控（L3）

[子模块需求](./_index.md)

## 概述

集群资源用量随时间的变化：CPU 使用率、内存使用率、运行中的容器组、在线节点四个趋势。时间窗为最近 1 小时 / 6 小时 / 24 小时 / 7 天。

趋势之前另有一个「集群状态」分区：节点在线状态、节点 XPU 厂商分布、组件状态（6 个服务组件与 etcd/controller-manager/scheduler 三个核心组件）。它先回答「这个集群整体是否正常」，再让读者决定看哪条趋势。集群未就绪时该页不挂载，由集群作用域路由层整页显示「等待集群加入」面板与集群概览入口，不渲染趋势与状态分区。

数值来自 KubeSphere 监控的 **range query**（`start`/`end`/`step`，返回 `matrix`），与集群概览读的当前值（`vector`）是两次不同的读取。

页面另有一个「系统组件」分区：APIServer、Scheduler、etcd 三个系统组件的组件级指标（请求速率与延迟按 verb、调度尝试按 result、etcd 提案/DB/WAL 等）。组件端点与集群端点不同，见「约束与边界」。

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

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — 已知监控后端可用，当打开集群监控，则四个卡片分别显示 CPU 使用率、内存使用率、运行中的容器组、在线节点，每张卡片有一条曲线与最小/最大/当前三个数值；CPU 与内存的当前值为 0–100 的百分比（由用量除以总量算出），容器组与节点为整数计数。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 已知在集群监控页，当切换时间窗（1 小时 → 24 小时），则以新的起止时间重新取数，曲线与当前值更新；单条曲线的采样点数不超过 200（窗口越大步长越大）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 已知监控后端可用，当打开集群监控，则除 CPU/内存/容器组/节点外，还显示异常容器组数、已完成容器组数、1/5/15 分钟平均负载、磁盘使用率、inode 使用率、网络发送与接收速率，共 13 张卡片；磁盘使用率由「已用容量 / 总容量」算出（0–100 的百分比），inode 使用率把 API 返回的 0–1 比值换算为百分比，网络速率以 B/KiB/MiB/GiB 每秒显示，平均负载保留两位小数；任一指标在窗口内没有数据时该卡片显示空态说明而不是 0。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 已知监控后端可用，当打开集群监控，则除主机资源外还按分组显示 GPU、磁盘 I/O、网络与 RDMA 趋势：GPU 组含显存使用率、GPU 使用率（API 的 0–1 比值换算为百分比）与已分配 GPU 卡数（整数）；磁盘 I/O 组含读/写吞吐（B/KiB/MiB/GiB 每秒）与读/写 IOPS（两位小数）；RDMA 组含健康度、端口可用率（已启用端口数 ÷ 总端口数）、发送/接收速率、链路速率（API 以 bit/s 返回，显示为 Gb/s）、接收错误数、重传数、丢弃数与链路中断数；每个分组有标题且卡片顺序与分组顺序一致（GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA），全页共 29 张卡片（GPU 3 + 主机资源 11 + 磁盘 I/O 4 + 网络 2 + RDMA 9）；任一指标无数据时该卡片显示空态说明而不是 0；节点详情的监控沿用同一组件，只显示节点作用域的 CPU/内存/容器组三张卡片。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04** — 已知集群监控页已加载，当点「自动刷新：关」按钮，则按钮变为「自动刷新：开」且每 5 秒以当前时间窗重取一次（窗口向前滚动），期间曲线与当前值持续更新；当再次点击关闭，则不再发起定时请求。离开页面时定时器必须停止。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06** — 已知监控后端可用且组件指标端点可读，当打开集群监控，则在物理资源分组之后显示「系统组件」分区，按固定顺序含 APIServer、Scheduler、etcd 三个子组；APIServer 子组显示请求速率（总数，次/秒）与请求延迟（总平均 + 按 `verb` 多序列，接口返回的秒值 ×1000 显示为 ms）；按 verb 的延迟按 `verb` 标签身份合并成多条线，同一 verb 一条线、不同 verb 不混成一条，整条为 `NaN` 的序列（本部署的 APPLY）不画成 0 线；Scheduler 子组显示调度尝试次数（按 `result` 分 scheduled/error/unschedulable，累积计数用整数）与调度尝试速率（同 result 三条线，次/秒），两者单位不同；多序列卡片带图例，图例项与线的身份一致；本部署 scheduler 调度延迟（平均值与分位）没有序列时该卡片显示空态说明而不是 0；APIServer 与 Scheduler 的当前值与同一次接口响应、同一时间窗的序列交叉核对一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07** — 已知本集群 `components/etcd` 请求成功但每条指标都返回 0 条序列，当打开集群监控，则 etcd 子组显示「本集群未上报该组件指标」的说明与可能原因，不显示 0 值卡片、不显示空白表格、也不整组消失；当某个组件请求失败（如 5xx）时该子组显示错误说明与重试按钮且可重试；当失败为无权限（403）时该子组显示权限说明且不显示重试按钮；无数据、错误、无权限三种画面互不顶替，某个组件失败时其余有数据的组件子组保持可用。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08** — 已知集群已就绪且 componenthealth（`/kapis/[clusters/{c}/]resources.kubesphere.io/v1alpha2/componenthealth`）与 nodes/stats（`/kapis/[clusters/{c}/]resources.kubesphere.io/v1alpha3/nodes/stats`）可读，当打开集群监控，则在趋势分组之前显示「集群状态」分区，含节点在线状态、节点 XPU 厂商分布、组件状态三块；节点在线状态显示健康节点数/总节点数（形如 1/1）与在线比例，点击进入该集群节点页，totalNodes 缺失显示「未上报」、为 0 显示空态说明而不是把 0/0 当正常；厂商分布按 nodes/stats 中除 healthy/total 外的全部厂商键列出节点数与占比（占比=该厂商节点数÷各厂商节点数之和，healthy/total 不计入），按数量降序；CPU 键表示集群中没有 XPU 的节点数量，按 CPU 行显示（文案取 node.vendor.*），不是空态；仅当各厂商计数合计为 0（无节点或未上报）时显示空态说明；组件状态含服务组件 6 项（kubesphere-system=Kube AI Hub、kube-system=Kubernetes、istio-system=服务网格、kubesphere-monitoring-system=监控、kubesphere-logging-system=日志、kubesphere-devops-system=DevOps），每项为命名空间内 healthyBackends 之和 ÷ totalBackends 之和，集群 configz 未启用的模块显示「未安装」；核心组件三项 etcd/controller-manager/scheduler 中 controller-manager 与 scheduler 按 label.component 匹配且 healthyBackends>0 判为正常、否则异常/未上报，etcd 按 kubesphere-monitoring-system/etcd ServiceMonitor 是否存在判为「已接入监控/未接入」；三块宽屏同排、窄屏堆叠，分区标题与趋势分组标题同级。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09** — 已知集群未就绪（如成员集群的 agent 未连上，该集群所有 `/kapis/clusters/{c}/*` 返回 500 且信息为 `cluster {c} is not ready`），当打开集群监控，则集群监控页不挂载，由集群作用域路由层整页显示「等待集群加入」面板（`data-ai-id="cluster:not-ready"`）并提供集群概览入口（`cluster:not-ready-overview`）；页面不显示趋势卡、不显示集群状态分区、不显示重试按钮，也不在页面内重复实现第二套等待视图。就绪判断只认集群列表中的 `ready === false`：`ready` 缺失（列表读取中或读取失败）时不接管，页面照常挂载。状态分区的加载/空/未上报/无权限/失败互不顶替：加载中显示骨架；节点为 0 或厂商计数合计为 0 时显示空态说明，CPU 行不是空态；可读但节点或某模块没有记录时显示「未上报」而不是 0/0；componenthealth 403 时只有状态分区显示无权限说明且无重试，nodes/stats 403 时只有厂商块显示无权限说明；任一 5xx 时对应块显示错误说明与重试按钮且不影响另一块与趋势分区。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-10** — 已知集群监控页已就绪且「集群状态」分区已加载，当打开「自动刷新：开」，则在 5 秒内 componenthealth、nodes/stats、etcd ServiceMonitor 三个查询各再次发起一次并按新响应更新（状态分区数字刷新，已有内容不被加载骨架整体遮挡）；当再次点击关闭，则不再发起这三类定时请求；离开页面时定时器停止。

## 设计目标

1. 曲线回答「形状」，数值回答「多少」，两者同时给出。
2. 窗口决定步长，避免一次拉回上万点。
3. 百分比必须由「用量 ÷ 总量」算出，不能把字节当百分比。
4. 同一指标的多个身份（verb/result/quantile）同图显示、按身份取线；缺值、真实 0、无数据、无权限分别表达。

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

## 文案与校验

- 百分比取整加 `%`；计数取整。
- 无数据：说明 + 一句可能原因。
- 时间窗标签：最近 1 小时 / 6 小时 / 24 小时 / 7 天。
- 组件单位：请求/调度速率为「次/秒」（两位小数）；延迟与 fsync/commit 时长为 ms（API 的秒 ×1000，两位小数）；调度尝试次数与待处理提案为整数；DB 大小按 B/KiB/MiB/GiB；客户端流量为字节/秒。
- 组件无数据：「本集群未上报该组件指标」+ 一句可能原因（未安装监控或指标未被采集）。

## 边界情况

- 监控后端缺失或 range query 不受支持：卡片显示「该时间范围内没有数据」，页面不整体失败。
- 用量序列存在但总量序列缺失：该卡片按无数据处理（无法算百分比，不能编一个）。
- 序列时间戳不一致：按时间戳配对，不按下标 zip。
- 组件序列值可能是 `NaN`（本部署 APPLY verb）：丢弃非有限值，整条为 NaN 时按无数据。
- 组件指标「有序列且值为 0」显示 0；「没有序列」显示说明——两者不得混用。
- 组件请求 403：显示无权限说明且不提供重试；其他失败提供重试。
- CPU 行不是空态：`nodes/stats` 的 `CPU` 键表示无 XPU 的节点数，必须作为一行显示（集群有节点、只是没有加速卡）；空态只用于厂商计数合计为 0（无节点/未上报），两者不得混用。

## 明确不做

- 节点/容器组级别的下钻与排行：老 console 的「物理资源」「节点用量排行」是独立页面，另做。
- 独立路由的 etcd / apiserver / scheduler 监控页：旧 console 是三个独立页签；本轮改为在集群监控页内以「系统组件」分区承载（见 `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06` / `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`），独立路由不再需要。
- etcd 节点级服务状态卡（在线 / 有 leader / leader 变更次数，旧 `ETCDNodes`）：本部署无 etcd 指标序列，无法验收；登记为待补，不以组件页健康数冒充。
- 告警阈值线叠加：需要知道每条规则的阈值，规则体里没有统一字段。
- 不新增独立路由或页签：旧 console 的 overview / resource / etcd / api-server / scheduler / ranking 六个页签不逐一搬运；物理资源与系统组件已并入本页分区，节点用量排行已有独立页（`node-usage`）。
- 服务组件图标点击进入组件页：本轮不做（登记待补）。理由：(a) 状态行回答「是否健康」，不是导航入口；(b) 新 console 的组件页已有入口（集群概览的组件面板/侧栏），在摘要行上再加 6 个深链会把「状态」与「去哪看」混在一行；(c) 旧页的 `?type=` 过滤在新组件页是客户端分组，复刻可行但本轮 AC 未承诺。
- 厂商分布不做饼图：用列表 + 比例条表达，不引入图表库；精确数字由列表给出。
- etcd 真实健康不做承诺：etcd 项只表达「是否接入监控」（ServiceMonitor 是否存在），不做 leader、延迟或成员级健康判断。
- 不单独做「集群状态」页面或页签：状态分区只作为监控页的一个分区存在。
- 不在监控页内重复实现未就绪等待视图：未就绪由集群作用域路由层统一接管（已有 `cluster:not-ready` 面板），页面内不再加第二个。
- 不保留旧页每 2 秒无条件轮询 componenthealth 的行为：状态分区改为随页面自动刷新开关每 5 秒重取。

## 假设

- range query 返回 `matrix`；若返回 `vector`（忽略 range 参数），按单点处理而不是当作趋势。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09`

- 上述 `TC-…-MONITOR-08` / `TC-…-MONITOR-09` 同时覆盖 `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-10`（自动刷新同时驱动状态分区三查询）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — range query 读取四条（含两条总量）序列，窗口决定步长。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 百分比由用量 ÷ 总量按时间戳配对计算。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 无数据时说明，不画零线。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04** — 组件指标走 `/components/<module>` range 查询，多序列按 verb/result/quantile 标签身份合并与着色。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 组件无数据、错误、无权限分别呈现；无数据不填 0。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06** — 状态分区读 componenthealth 的节点与组件聚合、nodes/stats 的厂商计数、ServiceMonitor 的 etcd 接入探测与集群 configz 的模块开关；三块各自独立降级。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07** — 集群就绪判断来自集群列表的 `ready === false`（路由层接管）；`ready` 缺失不接管。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08** — 页面自动刷新开关同时驱动趋势查询与状态分区三查询（componenthealth、nodes/stats、etcd ServiceMonitor），开启时每 5 秒重取，关闭或卸载时停止。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — 百分比在 0–100 之间；窗口切换后重新取数。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 组件分区三个子组齐全；多序列身份不混淆；etcd 无数据如实说明；无权限不给重试。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 就绪集群的状态分区三块齐全，数字与同次接口响应一致，未安装模块如实说明，CPU 行表示无 XPU 节点且不是空态；未就绪成员集群整页为等待视图，无趋势、无状态分区、无重试；加载/空/未上报/无权限/失败五种画面互不顶替。
