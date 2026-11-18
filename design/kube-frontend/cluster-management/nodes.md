# 节点列表（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/nodes.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-07
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-08
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-09
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-10
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-12

## 概述

节点列表：名称/内网 IP、状态、角色、CPU、内存。

## 设计目标与非目标

Ready、调度与负载独立展示，提供节点终端、局部元数据写入、已上报硬件拓扑和 vGPU 模式配置。非目标：排空、设备发现及生产模式切换验证。节点添加已由 2026-11-17 产品复核重纳，并在后端探测后改为签发 kubeadm join 命令，见本文末「DEC-…-NODES-12」。

## 关键约束

- 集群级集合；`namespace` 为空串。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01 — 容量与监控用量独立读取

**为什么**：Node 容量用于详情，列表使用监控比率与绝对量；指标不可用不能让节点本身消失。

**被否方案**：把可分配容量当作当前负载，或者缺少监控时显示零，会误导调度判断。

**何时重新考虑**：后端提供统一负载快照时，可减少读取次数。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02 — 关联资源独立读取，按页签延迟加载

**为什么**：容器组、事件与监控均有独立的数据来源，只有打开页签才请求。原生 Pod 查询使用 spec.nodeName 并跟随 continuation，
避免聚合列表忽略过滤条件或只显示第一页；事件同时过滤 Node 类型与名称。趋势复用 ClusterMonitorPage 的窗口和图表，不创建第二套绘图组件。

**被否方案**：四个页签都放出来，Pods 显示空表。空表会被读成「没有容器组」。

**何时重新考虑**：需要按节点排障容器时（那时应有按节点过滤的 Pod 查询）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05 — 节点协议独立适配，复用终端视图

**为什么**：nodes/exec 是主机权限入口，后端使用 JSON 消息，与原生容器 exec 的通道字节不兼容。
api-client 新 openNodeTerminalSession，只向共享 ExecConsoleDialog 提供 write/resize/close。
握手完成仍可能在创建节点访问 Pod，首次 stdout 才触发 ready；30 秒无输出会失败并关 socket。

**被否方案**：前端创建特权 Pod 再复用容器 exec，会改变授权语义；或复制旧 UI，会重复终端和会话逻辑。

**何时重新考虑**：后端更换节点访问协议时，仅替换传输适配，不改变视图与键盘行为。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06 — 标签与污点只做局部并发写入

**为什么**：节点大部分字段属于 kubelet。PATCH 仅写 labels 或 taints，并携带 resourceVersion。
删除标签使用 null，删除污点使用空数组；发生冲突保留输入，禁止静默覆盖新对象。

**被否方案**：拿旧节点对象整体 PUT，会触碰无关字段；无版本覆盖整份 taints，会丢失并行修改。

**何时重新考虑**：需要批量编辑节点污点时，设计批量事务和逐节点错误反馈。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03 — 容量必须换算成可读单位

**为什么**：接口按对象原样返回 `255600m` / `3170330328Ki`，直接打印会得到「3083573052660 / 3170330328Ki」——同一个量两种单位，看起来像 bug。
CPU 换算成核（1 位小数），内存与存储换算成 GiB/TiB，pods 显示整数。

**被否方案**：显示原始字符串并加 tooltip。读者要的不是原值，是能比较的量级。

**何时重新考虑**：需要精确字节数用于容量规划时（那时提供切换）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04 — 停止调度是行操作，不弹确认

**为什么**：cordon 可逆、不驱逐任何运行中的容器组，只阻止新调度。加确认框会让一件安全操作变得像危险操作，久而久之读者对确认框麻木。
反馈由状态列的「已停止调度」承担，且列表会 invalidate 重取——不是页面记住一次点击。

**被否方案**：弹窗确认。可逆操作不需要二次确认。

**何时重新考虑**：平台提供「排空」（驱逐容器组）时，那才是危险操作，需要确认。

## 系统现状

老页统计、搜索筛选、GPU/显存、容器组、厂商型号、vGPU 与 NTP 已按接口语义迁移，不复制旧 AGPL 实现。

## 仓库落点

- `pages/cluster/NodesPage.tsx`、`nodeListQueries.ts`、`GpuModeDialog.tsx`、`gpuModeConfig.ts`
- `api-client/src/node-list.ts`、`gpu.ts`
- ai-kit `ResourceList`、`MultiSelect`、`InputSearch`、`StatisticsGroup`、`MetricCell`；共享 Pagination 不另造节点版本。
- `packages/api-client/src/storage.ts` 的 `toNodeSummary` / `nodeStatus` / `nodeRole`
- `NodeDetailPage.tsx`、`NodeMetadataDialog.tsx`、`NodeResourcesPanel.tsx` 与共享 `ClusterMonitorPage.tsx`
- `api-client/src/node-terminal.ts`、`node-resources.ts`、`cluster.ts`
- `server/src/upgrade.ts` 仅额外允许版本化 nodes/exec，不允许任意 kapis 升级。
- 后端参考 `kube-server/pkg/kapis/terminal/v1alpha2` 与 `pkg/models/terminal`；本批不更改后端实现。

## 对外契约

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05 — 节点终端

GET `/kapis/terminal.kubesphere.io/v1alpha2/[clusters/<cluster>/]nodes/<node>/exec`；
子协议 binary.k8s.io，token 经 bearer 子协议由 BFF 转 Authorization，不放进 URL。
stdin 为 `{Op:"stdin",Data}`；resize 为 `{Op:"resize",Cols,Rows}`；
stdout 的 Data 原样交给 xterm，toast 报错并关闭连接。远端 shell 由后端选择。

标签、污点与调度 PATCH `/api/v1/[clusters/<cluster>/]nodes/<node>`。
Pod GET 原生集合，fieldSelector=spec.nodeName；事件 GET /events，fieldSelector=involvedObject.kind=Node,involvedObject.name。
节点趋势 GET monitoring v1alpha3 `/nodes/<node>`，指标 CPU/内存用量与总量按时间戳相除、乘 100；容器组数为整数。

## 不变量

状态等于 Ready 条件；角色缺省 `worker`。

## 已知坑

- 没有 Ready 条件的节点（刚接入）不能当作 Ready。
- 角色标签可能有多个，用逗号连接。
- 节点访问 Pod 未启动前 WebSocket 可以已经打开，不能仅以握手成功判定可输入。
- Ubuntu 的 /bin 为符号链接，readline 的尾斜杠补全可能不同；真实补全验证使用 /usr 目录。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`；单测覆盖 `nodeStatus` / `nodeRole`。
2026-11-14 在 localhost:5178 构建产物验证 NODES-07 至 10：真实读取统计和监控，模拟分页与模式写入，三档截图。
前端全量 160 条单测、节点 API 8 条、config 契约 12 条以及 ai-kit/Storybook 构建通过。
既有 NODES-01/02/03/06 通过；NODES-05 因上游节点终端没有输出帧而跳过，不计作通过。
API 包与 config 契约测试的严格空值类型错误已在 2026-11-17 修复（仅测试夹具，未放宽规则）；当前 `pnpm typecheck` 全量 0 error。

## 后续改进

节点添加已改为后端签发 kubeadm join（DEC-…-NODES-12，TC-…-NODES-12）；member 硬件读取及模式写入需后端提供明确集群路由后开放。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06`

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-07 — 总览与过滤列表分别缓存

**为什么**：用户要求总览不随筛选变化。stats 与 control-plane 的 queryKey 只有 cluster，列表 key 包含全部条件和分页；基础范围排除 edge。worker 排除 master/control-plane 标签而不是要求 worker 标签。

**被否方案**：从当前页计算健康率或厂商数量，会把分页结果误作整个集群。

**何时重新考虑**：产品明确新增筛选结果统计时，只新增独立标签，不改总览口径。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-09 — 批量采样与共享展示组件

**为什么**：当前页按 node 合并监控采样，转义并锚定 resources_filter；NTP 单独读取全部基础范围节点，以全局中位数计算偏移。ai-kit 只负责纯展示和可选通用属性，不承担指标换算或 API。

**被否方案**：逐节点请求导致 N+1；当前页中位数会随分页改变偏移；复制独立列表破坏统一分页交互。

**何时重新考虑**：后端提供完整节点指标快照时替换批量请求。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-10 — 信号提交不等于模式切换完成

**为什么**：GPU PUT 写入 desired 注解后由 agent 异步执行。保存前记录 baseline 时间戳，回读必须匹配新 desired 的模式、参数和 status 时间，不能把旧 completed 当作本次结果。独立五分钟计时停止等待，人工刷新仍可确认晚到结果。

**被否方案**：HTTP 200 立即展示完成；自动重试模式写入可能重复重启设备插件。

**何时重新考虑**：后端提供 requestId 和事务状态接口后，改按 requestId 追踪。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-08 — 节点列表和统计

GET resources.kubesphere.io/v1alpha3/[clusters/<cluster>/]nodes，基础 labelSelector=!node-role.kubernetes.io/edge。
page/limit/sortBy/ascending 控制分页；name 匹配名称或地址；status 为 running/warning/unschedulable；
role=master 覆盖控制面标签；deviceVendor 逗号分隔 OR；xpuModel 不区分大小写包含。
GET 同路径 /stats 返回 total/healthy/厂商数量；控制面数量取 role=master&limit=1 的 totalItems。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-09 — 指标与单位

GET monitoring.kubesphere.io/v1alpha3/nodes，cluster/last=true/limit=-1，metrics_filter 为白名单。
GPU 使用率、用量、总量、分配量：node_gpu_utilisation/usage/total/allocated；
显存：node_gpu_memory_utilisation/usage/total；CPU：node_cpu_utilisation/usage/total；
内存：node_memory_utilisation/usage_wo_cache/total；容器组：node_pod_running_count/quota；
时间：node_time_seconds/node_timex_sync_status。实际请求使用完整 node_ 指标名。
比率乘100；内存和显存为 bytes 换算 GiB；GPU 卡数允许小数。CPU/内存 requests 来自 node.kubesphere.io/*-requests 注解。
非有限采样忽略，真实零保留；缺失或零分母显示 -；NTP 同步1/0/其他分别为真/假/未知。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-10 — host 模式配置

PUT /kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode?nodeName=<node>，
body 为 {mode,params:Record<string,string>}。success=false 作为失败，success=true 仅代表信号提交。
hami.io/gpu-mode-desired={mode,params,timestamp}；status 注解或 nodeInfo.gpuModeStatus={status,mode,message,timestamp}。
NVIDIA 的 mig 参数 devicesplitcount；hami-core 加 devicememoryscaling/devicecorescaling；
寒武纪 dynamic-smlu 参数 min-dsmlu-unit，env-share 参数 virtualization-num。
API 层禁止 member 写入，页面同步禁用；不静默写 host。

### INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-10 — 生产验证只读

B200 模式测试先拦截全部 GPU endpoint，再打开表单；所有 PUT 仅模拟返回，并在结束后核对 desired/status 注解未变。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11 — 身份侧栏与独立节点洞察

**为什么**：系统信息变化少，负载、分配和健康用于排障。NodeInfoSidebar 保留身份与模式入口，NodeResourceOverview 组合 StatisticsGroup、TrendChart、健康和共享容量 Table；硬件页延迟请求 GPU/RDMA，任一失败不隐藏节点。此前未确认 RDMA 契约而不做硬件，本批实际读取确认后独立实现。

**被否方案**：复制旧 AGPL 组件，或把每种故障合并成整页失败；前者违反迁移边界，后者会丢失仍可用的节点事实。拓扑按数组位置排序会将亲和信息误当设备，故采用唯一 X 识别。

**何时重新考虑**：后端提供带设备 ID 的拓扑模型时替换对角身份识别；未识别行仍保留 row-N。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11 — 节点洞察字段与单位

NodeDetail 增加 allocated、allocatedLimits 字符串 map、gpuTopology 行数组，以及 nodeInfo 的可选 cardCount、gpuMemoryTotalMiB（上游 gpuMemoryTotal 为 MiB）、deviceSplitCount。缺失 map 为 {}，heartbeat 缺失为空串；raw 保持原对象供 YAML。Requests/Limits 优先对应 status map，CPU/内存缺失才回退对应注解，不把 Requests 冒作 Limits。比率分母为 Allocatable，允许超配。

GET monitoring v1alpha3 `/nodes/<node>?cluster=<cluster>&last=true` 批量当前指标，趋势同路径按 start/end/step；节点比率乘100，显存/内存/磁盘 bytes 转 GiB，GPUallocated 为卡数。缺失/非有限样本不补零。

GET gpu v1alpha1 `/gpus?nodeName=<node>&limit=-1` 与 rdma v1alpha1 `/ports?nodeName=<node>&limit=-1` 返回集合后再按节点精确过滤。RDMA linkSpeed 为 bytes/s，展示乘8/1e9 Gb/s；healthy 和 rdmaAllocated 为不同后端结论，logical state 不单独代表健康。member 在 API 层拒绝硬件库存路由，不回退 host。

拓扑 CPU Affinity、NUMA Affinity、GPU NUMA ID 独立列；GPU/NIC/MLU 设备列自然排序，未知连接代码保留。唯一 X 识别设备；无唯一 X 显示 row-N，不按数组位置伪造设备。

### INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11 — 范围与健康

gpu02 的测量和分配不能用于 host 集群汇总。Ready True 正常；MemoryPressure/DiskPressure/PIDPressure/NetworkUnavailable False 正常，未知条件为 neutral。NTP 继续使用全部基础范围节点的时间中位数。

新增自动化：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11；既有 03/06 随表格和元数据页签调整选择器，保留容量、标签回读、清理与趋势采样断言。单测覆盖反向压力条件、超配、缺值、未知拓扑连接和 RDMA 精确身份。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-12 — 节点添加改为后端签发 kubeadm join（2026-11-17 修正）

**新决定**：节点列表提供「添加节点」弹窗，调用 ks-apiserver 新增的 `POST /kapis/resources.kubesphere.io/v1alpha3/nodes/join-command`，展示一条带到期时间的 `kubeadm join` 命令（含 CA hash），由管理员在目标主机执行。不依赖 KubeKey。

**原判断（保留，不删除）**：节点添加曾是「不做」——依据是「节点纳管属于安装器职责」；2026-11-17 产品复核重纳为 KubeKey 向导，入口按集群 `kkName` 显示。

**为什么再次修正**：实际探测发现当前 ks-apiserver（kube-server）没有 KubeKey 集成：`kubekey.kubesphere.io` 组与 CRD 在 B200、mlu370 均 404，按原方案交付会得到一个永远不显示的入口。Kubernetes 原生 kubeadm 加入只需要 bootstrap token 与 CA hash，ks-apiserver 可以安全签发短时 token；这既保留「不离开控制台」的肌肉记忆，也不要求控制台持有主机清单。

**落地约定**：
1. 后端接口：POST，权限按 `create nodes`（resources.kubesphere.io）授权；ttlHours 1-168，默认 24；返回 command/token/server/caCertHash/expiresAt；token 存 kube-system 的 bootstrap token Secret。
2. 页面：入口先按 create nodes 权限检查（IAM，用户身份；明确 false 隐藏、失败 fail-open）；调用失败按 404/405（后端版本不支持；405 是旧后端的 generic GET /nodes/{name} 对 POST 的响应）/403（无权限）/其他分类显示，不统一显示成"加载失败"；命令仅内存展示，不写 URL/日志，关闭即丢弃。
3. 后端未升级的集群仍显示入口但明确说明需要升级后端——这是可行动的依赖说明，不伪装成"不可用功能"。

**被否方案**：控制台 BFF 自己签发 token。会把集群写权限与 CA 处理放进静态前端服务，职责错位，且无法被其他客户端复用。

**何时重新考虑**：ks-apiserver 提供安装器/节点池的声明式接口时，接该接口并保留本命令作为 fallback。

**证据**：后端实现与单测见 [节点加入后端记录](../../../docs/plans/node-add-backend-20261117.md)。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-13 — 统计块用图形表达异构算力（2026-11-18）

**为什么**：原来的统计块是四五个并排的数字（集群节点、控制面、健康率、各厂商计数）。数字本身没错，但它回答不了这一页真正要回答的问题——**这台平台是不是在同时管理几种不同的加速卡**。四个数字排在一起，读者要先读完标签才知道「寒武纪 1」和「NVIDIA 2」是两类硬件；而老 console 的同一位置有厂商图标，一眼就能看出异构。

**做法**：
1. **每个统计项可带前导视觉**。`StatisticItem` 新增可选的 `icon`，`StatisticsGroup` 在标签左侧 40×40 的槽位渲染它。纯增量：不传 `icon` 的调用点（`GpusPage`、`NodeResourceOverview`）外观完全不变。
2. **图标 40px，与老 console 的 `Text` 组件同尺寸**。这不是装饰：统计条是靠比较图形来读的，20px 的标记挨着 18px 的数值会读成项目符号，而不是这一格的主角。统一槽位高度也让四个格子的基线一致。
3. **健康率用环图占前导槽位**，文字部分仍是「指标名 + 百分比」。老 console 这里放 `SimpleCircle`（健康数/总数的双段环），文字列只放数字；照此形状做，整条统计带的读法是统一的「图形 → 名称 → 数值」，而不是一格是图标、一格是百分比旁边恰好有个圆。
4. **每个厂商一项，各带自己的标记**；厂商多于一种时另起一行 `VendorMix`（加速卡在前、CPU 在后，零计数不占位——零意味着没有那种硬件，灰位等于暗示「本该有」）。

**厂商图标直接从 `console/src/assets/gpu-vendors` 搬运。** 那批文件本身是早期从别处引入老 console 的（NVIDIA/昇腾用 simple-icons 路径、燧原/沐曦取自厂商官网 SVG、其余按官方视觉特征手绘），许可已复核，允许在本仓库复用。搬运方式是**逐元素转写**：`vendorMarks.ts` 保留每个源文件的 `viewBox` 与元素类型（path/circle/rect/polygon）、fill/stroke 属性，因此形状与源文件一致，不是重画。

不引 `.svg` 文件而是内联几何：本应用没有 SVGR 插件，为十二个静态字形加一个构建依赖不值得；转写是机械的，且 `viewBox` 必须逐厂商保留——Enflame 是 27×47、MetaX 是 107×88，统一到 24×24 会把四个厂商的比例压变形。

> 更正：本决策最初写成「重新绘制、不是官方 logo」。经确认源文件许可允许复用，改为直接搬运；旧措辞作废。

**被否方案**：
- 保留手绘中性标记。许可允许复用真实厂商标记时，手绘版没有优势，反而与列表页（老 console）不一致。
- 把厂商标记统一成 24×24。见上：会压变形。
- 给零厂商留灰位。见上：零是「没有这种硬件」，不是「缺了一块」。

**何时重新考虑**：厂商数量增长到一行放不下、需要折叠成「+N」时；或需要彩色官方 logo 时（当前是单色 `currentColor`，跟随主题）。

**验证**：`vendor-marks.test.ts` 断言每个厂商几何互不相同、`viewBox` 与源文件一致（含 Enflame 27×47、MetaX 107×88 两个非标准坐标系）、`huawei`/大小写等写法被折叠、未知厂商落到中性标记；`vendor-mix.test.tsx` 断言加速卡排在 CPU 前、零计数不渲染、空集合不渲染、每个标记都有可访问名称。mlu370 实测：四项同 `y`、图标 40px、标签 12px、数值 18px；健康环绘出绿色弧（164 个绿色像素）；寒武纪标记绘出六边形轮廓（263 个 ink 像素）；页面无横向溢出。
