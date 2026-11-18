# 集群概览 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/overview.md)

## 概述

集群级落地页：集群对象（是什么）+ KubeSphere 监控（多忙）+ 控制面健康（能不能调度）。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-08
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-09
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-10
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-11
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-12

## 设计目标与非目标

目标：首屏优先资源容量/用量与节点排行，身份与控制面随后；任一路数据缺失不拖垮整页。

非目标：无数据来源的大屏指标、集群设置写入和节点属性列表；本批增加选中资源历史和一键终端。

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

**后续覆盖**：DEC-07 已纠正“旧版只显示利用率”的判断；DEC-09 按用户要求移除额外利用率文本行，
当前保留实际使用卡数、总量、使用/总量比例及独立分配量。下述第二行方案仅作为历史决策保留。

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

老 console 的集群首页为六块。此前“前四块完整/Top5 已承接”的判断被 2026-11-15 源码与截图复盘推翻，
本批补六类资源、scheduler error、组件分类、kubeconfig、可见性和 Top5；保留配置开关、未知值与原生终端改进。

## 仓库落点

- 页面：apps/console-next/src/pages/cluster/ClusterOverviewPage.tsx
- 资源：同目录OverviewResourcePanel.tsx、overviewResourceMetrics.ts、useOverviewRefresh.ts
- 图表：console/packages/ai-kit/src/primitives/{MetricRing,TrendChart}.tsx；UI barrel导出
- 终端：apps/console-next/src/components/resource/KubectlConsoleDialog.tsx，共享ExecConsoleDialog
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
2. Ready 条件的 message 只在未就绪时显示：就绪集群上它只是一句重复徽标的话（"Cluster is available now"），未就绪时它才是唯一的下一步线索。
3. 监控缺失时不得渲染 0：要么显示实际值，要么显示「不可用」。
4. 任何百分比都必须与同行的分子分母一致。
5. 无 GPU 的集群不渲染 GPU 行。
6. 本页不产生任何写请求。

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

- 高级图表缩放及面板定制，本批提供资源选择、时间窗与采样读数。
- 集群设置写入（描述、可见性、可插拔组件）。
- 多集群列表页（B200 已启用多集群，但只有 host 一个集群对象）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06 — 身份侧栏与负载主栏

**为什么**：版本和模块用于识别环境，资源用量与控制面是日常主任务。双栏提高首屏负载可见性；使用已有 Progress、Skeleton 和 Link，不新增进度组件。刷新协调四类集群查询，代理接入面板仍独立读取。

**被否方案**：继续纵向堆叠全部面板，负载容易落在首屏以下；或用 gpu02 数值填集群卡片，会混淆范围。

**何时重新考虑**：需要历史总览或个性化面板时再设计仪表盘布局。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-08
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-09
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-10

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07 — 恢复原子能力，不以新概念替换旧事实

**为什么**：旧 ResourcesUsage 同时有 GPU 使用量与分配量，旧决策错把旧版描述为只有利用率；
旧决策以“无 DevOps/服务网格”为排除理由，与真实六类组件接口不符。卡数、分配、比率和配置/组件入口均独立保留。

**被否方案**：删除原理由或继续以“避免重复”省略 Top5/工具，会让后续迁移继续重复误判。
历史决策保留用于复盘，本决策覆盖其遗漏部分。

**何时重新考虑**：用户明确批准范围缩减或后端契约真正移除能力，并有同角色实测证据时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-08 — Top5 与完整页共享服务端排行

**为什么**：nodes type=rank 支持 sort_metric/sort_type/page/limit/resources_filter，概览取5、完整页分页。
nodeRankingApi 按 node 身份合并不同序列、保留目标指标顺序；NodeRankingPanel 共享九种指标换算与节点元数据，避免按数组位置拼错。

**被否方案**：在当前节点分页结果中取五项；或认为已有节点列表就能替代首页排行。

**何时重新考虑**：后端提供统一排行快照和稳定资源 ID 后替换合并模型。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04 — 补齐资源和标签字段

ClusterUsage 增加 gpuUsed、gpuMemoryUsedBytes/gpuMemoryTotalBytes、diskUsedBytes/diskTotalBytes，
分别取 cluster_gpu_usage、cluster_gpu_memory_usage/total、cluster_disk_size_usage/capacity。
GPU 为卡数可小数，内存/磁盘 bytes 转 GiB/TiB；缺失为 undefined，比例不截断事实数值。
KubernetesStatus 增加 error，取 scheduler_schedule_attempts 的 result=error；
scheduled/error/unschedulable 为三个独立标签，不是当前 Pod 数。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05 — 组件范围与用户配置

组件 host GET resources v1alpha3 /components；member 使用 /kapis/clusters/<cluster>/resources.kubesphere.io/v1alpha3/components，
列表、详情、Pods 缓存含 cluster。按六类 namespace 分类；概览组数量是组件对象数，不声称旧页有健康计数。
列表路由接受 type，清除回全量。

用户配置 GET resources v1alpha2/[clusters/<cluster>/]users/<username>/kubeconfig；Client.request 显式 responseType=text，
默认 JSON 契约不变。使用当前登录用户，不是集群连接 kubeconfig PUT。只在弹窗挂载时读取，
key 含用户/集群、gcTime=0；关闭取消并移除缓存，身份变化的 owner/key 防止旧内容显示。
下载临时 Blob URL 用后释放；不写 localStorage，不自动读取、不截图或记录正文。403 经共享错误面板无重试。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06 — 排行语义

GET monitoring v1alpha3 /nodes?cluster=<cluster>&type=rank&sort_metric=<白名单>&sort_type=desc&page=1&limit=5。
metrics_filter 覆盖九项排序指标及 GPUtotal/Podcount，resources_filter 转义搜索文本。
total_item 为真实总数；空集合的 omitted total_item 可为0，非空无总数报错。
GPUallocated 排序为卡数、展示为 allocated/total 比例；load1 原数值，其余比率乘100，未知不填零。
查看更多携带 metric，完整页按服务端分页及排序，节点名称链接详情；元数据独立读取，缺失显示 -。

新增单测覆盖 distinct used/allocated、error/unschedulable、乱序多指标身份、Top5 查询及敏感缓存清理；
E2E 将真实采样、模拟超过5节点、403/member URL 与下载验证分开记录。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-09 — 固定字段栅格与主题化视觉

**为什么**：上批功能已补齐，但 used/total 的合并文本、可选额外行和不同长度使卡片不整齐；
本次按用户明确要求，将 Kubernetes 状态放在基本信息下方，资源卡保留统一名称、数量双列、
使用率条和分配区域。没有分配字段时留空，不用伪造值补高度。GPU 额外利用率行移除，
但实际使用/总量比例及独立分配量保留。

**被否方案**：给每种指标单独写高度或补0占位，会重复展示和误导事实；硬编码白色边框在切换主题时失效。
统一 Panel 使用节点详情的 rounded-ai-lg、border-ai-line、bg-ai-surface-1。
图标复用 ai-kit Icon，资源/排行条复用 Progress，不为美化新增历史查询或私有图表。

**何时重新考虑**：需要可配置仪表盘或历史趋势时，另行设计；本次只改展示，不改变 API 口径。

### INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07 — 视觉验收不降低数据验收

新卡片发布 data-ai-field=name/used/total/ratio/allocated，原资源/动作 ai-id 保留。
分配区域是空槽时不输出文字；支持字段未上报仍显示 -，真实0不隐藏。
OVERVIEW-06 核对左列相邻区块、三档相对字段坐标、空分配区域和节点页面实际计算边框颜色；
旧 OVERVIEW-01/02 从斜杠文本改为逐字段断言，原同次数据对账、工具、排行和权限回归保留。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-10 — 平台版本标签写 Kube AI Hub

**为什么**：概览「基本信息」里的版本号来自集群对象 `status.kubeSphereVersion`，那是安装器写入的平台版本。产品对外名称是 Kube AI Hub，标签写成 KubeSphere 会让人以为这是上游发行版而不是本产品。文案 key 用 `cluster.overview.productVersion`（设置页同义 key `cluster.settings.productVersion`），`data-ai-id="overview:product-version"` 对应同一字段；接口字段名仍是 `kubeSphereVersion`。用户可见文案里的产品名一律写 Kube AI Hub；`kubesphere.io` API 组、注解名与 CRD 字段保持原样。

**被否方案**：把 CRD / 接口字段改名为 `kubeAiHubVersion`。已装集群和 ks-apiserver 仍写 `kubeSphereVersion`，改字段名会让概览读不到版本。

**何时重新考虑**：平台 CRD 把该字段正式改名，且已装集群完成迁移之后。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-11 — 资源和排行优先于辅助信息

**为什么**：用户新的运维顺序是先定位容量和压力，再定位异常节点。资源、选中趋势、Top5位于上部，
身份/Kubernetes状态仍相邻并默认显示在辅助区。全部字段及原句柄保留，不靠隐藏面板换空间。

**被否方案**：沿用身份左栏占据首屏，或复制示例大屏的Token/功率等无接口指标；前者弱化主任务，后者虚构数据。
本决策覆盖原身份优先布局，不撤销旧字段与未知值改进。

**何时重新考虑**：用户需要可配置仪表盘或展示目标改为集群身份管理。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-12 — 环图与历史复用纯展示原语

**为什么**：现有rangeMetricsApi已提供集群matrix采样，无需新后端或重型图库。
overviewResourceMetrics列明七资源的usage/total，按时间戳匹配分母。窗口1h/6h/24h对应60s/5m/15m。
MetricRing继承Progress语义色，TrendChart的新axes/grid/area/interactive/yDomain/formatter均可选默认关闭，
保留旧消费者外观，缺口面积分别闭合。悬停和键盘只展示真实采样，动画遵循reduced-motion。

**被否方案**：每张卡下载全部历史，按数组索引拼比例，或用compute utilization替换GPU使用卡数；
它们分别增加请求、错配时间和改变事实。装饰性随机波动不是实时监控。

**何时重新考虑**：需要缩放、多轴、大量序列或独立时间刷选时再评估图表引擎。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-13 — 一个30秒协调器与可见性暂停

**为什么**：默认自动更新回答实时运维需求，useOverviewRefresh统一刷新资源/历史/排行/Kubernetes状态，
不让每个卡片创建计时器。窗口时间只在刷新/切窗改变，隐藏时停止，可见恢复读一次，有请求未完成不重叠。
按用户最新要求不显示最近刷新时间；查询失败保留旧值时仍明确标识。
刷新控件复用ghost小按钮，暂停/start图标随自动刷新状态切换，短文字为暂停/继续，title和aria-label保留30秒周期。
手动刷新使用refresh图标及loading等待反馈，kubectl使用primary主按钮，避免刷新控件抢占终端入口的视觉重点。

**被否方案**：每次render把Date.now放queryKey会循环请求；固定旧历史范围不停refetch不会向前滚动。
为制造动态效果无条件5秒拉取所有数据会增加负载。

**何时重新考虑**：后端提供推送式聚合快照，或实测30秒请求影响集群负载。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-14 — 点击即准备并连接，直接工具路由仍主动开启

**为什么**：概览按钮是用户明确的启动行为，不需要跳转后重复点击。
KubectlConsoleDialog挂载即读当前身份工具目标，准备态到ExecConsoleDialog沿用原生协议。
key含cluster/username/实例，关闭取消并清理；晚到响应和旧身份不能重新开会话。403不给重试。

**被否方案**：给工具路由一律自动连接会改变直接访问行为；新建高权限工具Pod会越过授权。
原“概览不自动连接”仅保留为页面挂载不连接，用户点击则一次启动。

**何时重新考虑**：工具目标服务契约变化或需要多终端管理。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-15 — 节点统计与排行1:2，资源整卡交互

**为什么**：最新布局要求将节点计数移出六资源网格，放在排行左侧，基本信息/Kubernetes状态对齐左列。
两行共用`minmax(0,1fr)/minmax(0,2fr)`及相同间距，节点统计保留总量、就绪数量及就绪率。
用户明确要求移除节点就绪率趋势，nodeOnly组合复用同一用量query且禁用历史query，不渲染时间窗或图表；六资源历史仍保留。
常用运维入口四项复用secondary Button，导航项使用asChild Link保留路由语义，统一h-12/w-full/justify-start/px-4。
图标与文字采用相同gap，链接和kubeconfig按钮的尺寸、起始位置及文字基线一致。

资源使用ai-kit Card interactive及useSpotlight，整卡承担一个动作；标题/数值/留白点击都可选中，
Enter/Space和aria-pressed/描述提供键盘读数，不嵌套第二个按钮。减弱动画关闭抬升与非必要过渡。

**被否方案**：复制私有hover卡片、只让标题可点，或保留七卡形成不齐的网格；都会造成视觉/点击区域分叉。
仅移动标题而丢弃节点总量或就绪率，不符合保留已有能力的要求；节点历史的移除以用户明确批准为边界。

**何时重新考虑**：新增资源类别或用户需要可配置面板列宽时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-16 — 密集属性表复用 DescriptionList，不新建私有行组件

**为什么**：改动前基本信息是单列 `grid-cols-1 gap-y-3` 的八行堆叠（1600 下 614px 高），且标签用 `text-ai-fg-muted`（`#c9e1f3`）比值的 `text-ai-fg-secondary`（`#a9d1de`）更亮——在 14px 同字号下标签比值更抢眼，主次颠倒。整块既高又分不清主次。

改为 `DescriptionList` 的 `variant="dense"` + `divided`：`dense` 在父级 `<dl>` 上用 `[&>dt]:text-sm [&>dt]:font-medium [&>dt]:text-ai-fg` 与 `[&>dd]:text-xs [&>dd]:text-ai-fg-secondary` 同时区分字号和亮度（14px 中等标签 vs 12px 值），`divided` 用 nth-child 边界在每行之间画 1px `border-ai-line`。两块合计高度从 703px 降到约 470px（1600 档），信息密度明显提高而没有任何字段被删。

字号方向是「标签大于值」：属性表按字段名找行、再看右侧取值，标签是行的入口。最初做成 12px 弱标签 + 14px 主色值，视觉上答案压过了问题——读者先看到一串供应者名、版本号，却不知道它们各是什么字段。反过来之后标签是 14px 中等字重的主色、值是 12px 次色，与 `ResourceDetail` 的字段区块同一读法（标签在上、值在下、标签更重）。不再加 `tracking-wide`：标签已经是更响的一半，再加字距只会让左列像小型大写字母。

分隔线横跨两列依赖单元格起点对齐：线分别画在标签与值两个单元格的顶边，若用 `items-baseline`，两个单元格会因字号不同而错开（实测标签的边框比值的低 2.5px），一行就断成两段错位的短线。因此用 `items-start`：网格行让两半从同一 y 开始，首尾相接成一条通栏线；值换行时标签仍停在首行，也符合属性表的读法。

样式挂在 `<dl>` 而不是新增 `variant` prop 到 `DescriptionItem`：`DescriptionItem` 只渲染裸 `dt`/`dd` 片段、没有包裹元素（既有测试 `renders DescriptionItem as a bare dt/dd fragment` 锁定这一点），因此父级选择器能覆盖全部行，24 处既有详情页调用点零改动、外观不变。

两列从 `sm` 起生效，标签列 `minmax(5.5rem, 7.5rem)`：1024 下概览身份列只有 ~256px，120px 标签列仍留 ~104px 给值；「Kube AI Hub 版本」在 14px 中等字重下约 108px，上限刚好让它保持单行。值换行可读，标签换行会与相邻单行值错位，所以上限给标签、余量给值。仅在手机宽度（`<sm`）堆叠。

**被否方案**：在页面里自写一个 `Row` 组件。`config/consistency-contracts.test.ts` 的「defines the detail label/value row once」正是为了防止这种复制——八处详情页曾经各写一份并已经漂移（有的值用主色、有的用次色）。另一种是给 `DescriptionItem` 加 `dense` prop，但那要每个调用点都传，且无法改变列布局。

**何时重新考虑**：需要每行可展开、可编辑，或属性表要支持多列分组时；那时是新的表结构，不是密度变体。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-17 — 节点块铺满 1:2 槽位，头部与排行等高

**为什么**：节点块与排行同处 `minmax(0,1fr)/minmax(0,2fr)` 一行，行高由排行决定。改动前节点块内只有一张 134px 小卡，324px 的面板里约 170px 是空白，读起来像渲染故障；两块头部也不等高（20px 标题 vs 36px 下拉控件），正文基线错位。

保留列宽比例（AC-07 与 TC-06 锁定 1:2，且左列宽度须与基本信息一致），改块内结构：面板 `flex h-full flex-col`，`headerClassName="min-h-[3.75rem] items-center"` 给头部一个下限，`bodyClassName="flex min-h-0 flex-1 flex-col"` 让正文吃掉剩余高度。

正文不再「上排数字 + 下排进度条、中间留空」：环图在左、就绪/总量数字在右，两者作为一组用 `items-center` 在块内垂直居中，环心显示就绪率。这样面板被邻居撑高时，多出来的高度均匀落在内容上下，而不是在中间形成一条空白带；就绪率只出现一次（环心），不再另起一行重复同一个数字。

排行头部同样走共享 `Panel`（`icon` + `titleLevel={2}` + `headerClassName`），两块头部因此在结构上完全一致——不是靠两处各写 `min-h` 对齐，而是同一个组件同一个下限。

节点块的动作只有一个「查看全部节点」文字链接：TC-06 断言该块内按钮数为 0，因为选择资源是资源网格的职责；就绪率随时间变化是节点页的职责，所以块内不出现趋势、时间窗或第二个入口。

`Panel` 新增 `icon` / `titleLevel` / `headerClassName` / `bodyClassName` 四个可选属性，默认值保持既有行为（`h3`、`p-4`、无图标），15+ 既有消费者零改动。概览此前在页面内复制了一份 `function Panel`，本次删除并改从 `@kube-ai-hub/ui` 导入——barrel 之前没有导出 `Panel`，这正是复制的原因。

**被否方案**：改列宽比例（如 1:3 或固定 320px）能腾出更多高度，但要同时改 AC-07 与 TC-06 的 1:2 断言，且破坏「节点块与基本信息左边界/宽度一致」的既有约束；把节点就绪并进排行头部能省一个面板，但节点健康与节点负载是两个事实，合并后既无法独立降级，也要重写 `overview:node-summary` 的 `data-ai-id` 契约。

**何时重新考虑**：需要可配置仪表盘、或节点块要承载就绪趋势时；后者要新增历史查询，属于能力变更而非布局调整。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-18 — 就绪集群不重复显示 Ready 条件说明

**为什么**：`toClusterDetail` 把 Ready 条件的 `message`（缺省回落到 `reason`）映射成 `readyMessage`。B200 host 上该条件是 `True`，message 为 "Cluster is available now"——与绿色「运行正常」徽标表达同一件事，并排显示等于把同一个事实写两遍，还占掉状态行一半宽度。

规则改成「只在未就绪时显示」：`healthy = ready && enabled`，徽标右侧的说明仅在 `!healthy` 时渲染。未就绪时那句话是管理员唯一的下一步线索（例如代理集群提示要装 agent），不能删；就绪时删掉不损失信息。

集群列表 `MultiClusterListPage` 已经是这个规则（`!row.ready && row.readyMessage`），概览此前与它不一致；本次统一，两处对同一个字段给出同一种解释。

**被否方案**：继续无条件显示，靠 `title` 或截断减少视觉噪声——那句话本身没有新信息，缩小或悬停都不能让它变得有用。另一种是把 message 从接口层丢掉，但未就绪场景需要它，且它是 kapis 契约的一部分（CON-01），页面决定展示与否才是正确层次。

**何时重新考虑**：Ready 条件在就绪时开始携带新事实（例如最近一次健康检查时间）时，那句话不再重复徽标，届时再判断是否显示。
### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-19 — 未就绪集群整页让给「等待集群加入」

**为什么**：未就绪的集群没有可读数据——没有指标、没有节点、没有模块状态。此前只在页面顶部放一个代理接入面板，其余面板照常渲染，结果是一屏「不可用」占位加一个埋在其中、真正该做的事。旧 console 的 `Overview/index.jsx` 在 `!isReady` 时整页换成 `Initializing`，本次沿用这个判断。

**两种形态，因为坏掉的是两件不同的事**：

- `connectionType=proxy` 且未就绪：读者还需要执行清单，三步引导就是整页内容。清单来自平台代理服务；该服务未部署时接口 404 并提到 `tower`，把这个原因说出来比「未找到」有用，否则读者不知道集群为什么永远不会就绪。
- 其他情况（direct 集群初始化中、或代理清单刚执行完）：没有动作可做，页面只说明正在等待并自行刷新。

**保留页头**：集群名、暂停/刷新、kubectl 在等待期间仍然有意义（暂停自动刷新是为了不打断排查），所以只替换页头以下的内容，不整页清空。

**序号交给列表样式，不写进文案**：旧 console 把「1.」写进翻译串，导致数字无法单独调样式、每个语言都得跟着改标点。`<ol class="list-decimal">` 做同一件事而文案仍是句子。命令用行内 `code`：`t()` 返回字符串，先按占位符切开再插入元素，翻译里只保留 `{cmd}`。

**不重复提示**：控制器有 `readyMessage` 就显示它（例如「Agent has connected…」），没有就留空。刷新只在页头一处——面板内再放一个按钮就是同一个动作两个入口，而「本页会自动刷新」这句话也不该有：说明文字前的加载指示已经在表达「正在刷新中」，再用一句文案说同一件事是第三种表达方式。首版三种都有（说明区一句、按钮旁一句、面板底部一个按钮），读者会以为它们各自代表不同的动作。

**被否方案**：保留全部面板、只在顶部加提示。这正是改动前的样子：读者要在七八个「不可用」之间找出唯一下一步。另一种是等集群就绪前显示空页或骨架屏——那会掩盖「需要人去执行清单」这个事实。

**何时重新考虑**：未就绪集群开始提供部分可读数据（例如已注册但未就绪的节点清单）时，那部分值得单独成块，而不是继续整页让位。
