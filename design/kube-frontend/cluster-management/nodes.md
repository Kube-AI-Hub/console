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

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-14 — 统计块同时是筛选入口（2026-11-18）

**为什么**：统计块回答了「有多少」，但读者看完「控制平面 1」的下一步往往就是「只想看这一个」。此前唯一的路径是去工具条打开「角色」下拉、再选 `master`——统计块和筛选条件明明指的是同一组节点，却要读者自己把两边对应起来。让统计项直接可点，是把「读数」变成「入口」。

**做法**：
1. **`StatisticItem` 新增可选的 `onSelect` / `selected`**，纯增量：不传 `onSelect` 的项（健康率、以及另外两个调用点 `GpusPage` / `NodeResourceOverview`）输出的仍是原来的 `div` + `dt`/`dd`，无按钮、无动效类。
2. **点击是切换，不是单向开关**。控制面切 `role=master`，再点取消；厂商在 `deviceVendor` 这个多选参数里**追加/移除**自己，不是替换——一次点第二个厂商应当得到两类节点，而不是把第一个丢掉。集群节点清空全部筛选（它是总数，它的「筛选」就是没有筛选），仍然可点，因为按厂商筛完的人需要一个显眼的回全量入口。
3. **健康率保持只读**。这个 API 没有「不健康」这个筛选值，点它只能造一个假入口；一个点了没反应的格子比一个只读格子更糟。
4. **可点的格子必须看起来可点**。复用设计系统已有的三套动作原语，不新造动画：`ai-lift`（抬升 + accent 描边）、`ai-spotlight`（指针跟随高光）、`ai-pressable`（按下 `scale(.98)`），选中态用 `border-ai-accent bg-ai-accent/5`，与资源卡一致。三者都已在 `prefers-reduced-motion` 下各自关闭。
5. **是真 `<button>`，不是 `div onClick`**：`aria-pressed` 携带选中态，Tab 可达，Enter/Space 触发。`<button>` 只能放 phrasing content，所以按钮内把 `dt`/`dd` 换成 `span`，并在按钮上补 `aria-label="{名称}: {数值}"`——读屏听到的仍是「控制平面节点: 1」，而不是一个无名按钮。

**为什么筛选走服务端**：统计块和工具条驱动**同一个**查询参数（`role=master`、`deviceVendor=nvidia,cambricon`）。只过滤当前页的行会在第一页看起来对、翻页就错。mlu370 实测 `deviceVendor=cambricon` 返回 1 个节点，与统计数字一致。

**被否方案**：
- 让健康率也可点、点了筛出异常节点。当前 `status` 筛选没有「异常」这个值，要么新造一个后端参数，要么前端拉全量再过滤——两者都超出「统计块是快捷入口」的范围。
- 点击后不改变工具条。工具条的下拉是筛选状态的唯一真相，统计块只是另一个操作入口；不同步会让两处显示互相矛盾。
- 用 `div` + `role="button"`。原生 `button` 自带键盘激活与 `:active`，不必手写。

**何时重新考虑**：后端提供「不健康」筛选值时，健康率可以变成第三个可点项；或统计块项数增长到需要分组时。

**验证**：`nodes-stats-filter.test.tsx` 断言点击设值、再点取消、厂商多选叠加、点集群节点清空、健康率不是按钮（`queryByRole('button', {name: /节点健康率/})` 为 null 且存在 `progressbar`）。mlu370 实测：点控制面出现「清除角色」chip、再点消失；点寒武纪出现「清除厂商」chip 且「集群节点」的 `aria-pressed` 回落为 false；选中格子 computed style 为 `border-color: rgb(169,129,248)` + 5% accent 背景；健康率为 `div`、`cursor: auto`、无 `ai-lift`；三个可点格子为 `BUTTON`、`cursor: pointer`、`transition: transform`。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-15 — 控制面与厂商筛选互斥（2026-11-18）

**为什么**：两个统计项原本各改各的筛选，可以同时点亮「控制平面节点」和「英伟达」。控制面节点通常跑在 CPU 机器上，这个组合筛出来的多半是空集——读者看到 0 行，但页面上没有任何东西说明是这两个条件互相矛盾，只会以为列表坏了。

**做法**：
1. **开控制面就清厂商**：点「控制平面节点」把 `vendor` 置空。控制面只有一个维度，不该再按厂商切分。
2. **开厂商就清控制面**：点任一厂商时，若当前 `role=master` 则把它清掉。
3. **关掉某个 tile 只移除它自己的筛选**。把「控制平面节点」关掉时不清 `vendor`——读者可能在工具条里选过厂商，关一个 tile 不该连带撤销别的控件做的选择。
4. **非 master 的 role 不动**。「NVIDIA 工作节点」是个真问题，所以 `role=worker` + 厂商是允许的组合；只有 `master` 与厂商互斥。
5. **工具条下拉走同一套规则**。`role=master` + 厂商同样矛盾，而只在一个入口生效的规则比没有更糟——读者会看到统计块和旁边的 chip 说法不一致。因此 `NodesPage` 里用 `reconcile()` 统一处理工具条与统计块两条路径。

**被否方案**：
- 两个条件都保留、只把列表显示成空。这是原来的行为，问题正是「空得没有解释」。
- 禁用（灰掉）另一个 tile 而不是清掉。禁用态需要解释为什么不能点，而清掉是读者本来就想要的结果：他点了控制面，就是想看控制面。
- 在列表上方加一句「这两个条件互斥」。事后解释不如事前不让它发生。

**何时重新考虑**：若集群里真的出现带 GPU 的控制面节点、且按厂商筛控制面成为常见需求，改成「允许组合，但空结果时提示是哪个条件导致的」。

**验证**：`nodes-stats-filter.test.tsx` 覆盖双向清除、关闭 tile 不清厂商、以及 tile 的 `aria-pressed` 与 chip 同步。mlu370 `agent` 集群实测（3 节点 / 1 控制面 / 3 英伟达）：先点英伟达出现「清除厂商」，再点控制面后「清除厂商」消失、只剩「清除角色」，英伟达 tile 回落为未选中；反方向同样成立；工具条「角色」下拉选控制平面时也会清掉已选的厂商。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-16 — 状态列按 kube-server 的三态，污点进 tooltip（2026-11-19）

**为什么**：状态列原本只反映 `Ready` condition（`Ready` / `NotReady` / `Unknown`），而老 console 与 `kube-server` 表达的是另一组更有信息量的三态。两个具体缺口：

1. **「无法调度」没有独立状态**。节点被 cordon（`spec.unschedulable: true`）后仍然健康、仍在运行容器，只是不再接新 Pod。用 `Ready` 表达会把这件事压成「就绪」，读者看不出它不再接活。
2. **压力类 condition 被忽略**。`MemoryPressure` / `DiskPressure` / `PIDPressure` 为 True 时节点其实不健康，但 `Ready` 可能仍是 True。

**做法**：复刻 `kube-server` 的 `getNodeStatus`（`pkg/models/resources/v1alpha3/node/nodes.go`）：

```go
if node.Spec.Unschedulable { return "unschedulable" }
for _, c := range node.Status.Conditions { if isUnhealthyStatus(c) { return "warning" } }
return "running"
```

- `spec.unschedulable` → `unschedulable`（无法调度）
- 任一 `expectedConditions` 不在期望值 → `warning`（告警）
- 否则 → `running`（运行中）

`expectedConditions` 也照搬：`MemoryPressure`/`DiskPressure`/`PIDPressure`/`NetworkUnavailable` 期望 `False`，`ConfigOK`/`KubeletReady`/`Ready` 期望 `True`。不在表里的 condition 没有期望值，不会让节点变告警。

**为什么在 `api-client` 里算而不是取接口字段**：`kube-server` 的 `getNodeStatus` 只用于**服务端筛选**（`query.FieldStatus`），响应里没有这个字段。实测 `GET …/nodes` 的 item 顶层只有 `apiVersion/kind/metadata/spec/status`，`status` 里也没有 `nodeStatus`。所以列表必须自己推导，且必须与筛选口径一致——否则「筛选无法调度」选出来的行和状态列显示会对不上。

**污点 tooltip**：`taints` 从 `NodeDetail` 上移到 `NodeSummary`，因为列表行也需要它。无法调度时徽章外包 `Tooltip`，逐条列出 `key=value:effect`——污点可能不止一条（`node.kubernetes.io/unschedulable` 是 cordon 产生的，用户还可能手动加别的），只说「无法调度」读者仍不知道原因。格式与老 console 的 `renderTaintsTip` 一致。

**被否方案**：
- 继续用 `Ready`/`NotReady` 并另加一个「已停止调度」副标题。两个事实挤在一列里，且压力类 condition 仍然看不见。
- 照抄老 console 的 JS 版 `getNodeStatus`。它有 bug：`conditions.forEach(item => { health = … })` 是**赋值不是合取**，最终只由最后一个 condition 决定——内存压力为 True 但 Ready 在末尾时会被判成健康。Go 版本才是对的。
- 只在详情页展示污点。列表是读者发现「这个节点不接活了」的地方，答案要在那一行。

**何时重新考虑**：若 `kube-server` 把 `nodeStatus` 放进响应（而不是只用于筛选），改为直接读该字段，删掉本地推导。

**验证**：`nodes-stats-filter.test.tsx` 覆盖三态（含「内存压力 True + Ready True → 告警」这个区分新旧实现的用例）与无法调度时的 tooltip 锚点。mlu370 `agent` 实测：三个节点显示「运行中」；注入 cordon + 两条污点后显示「无法调度」，tooltip 内容为「污点 / node.kubernetes.io/unschedulable=:NoSchedule / dedicated=gpu-a100:NoExecute」，徽章为警示色（琥珀 30 像素、绿色 0 像素）；状态筛选下拉为「全部 / 运行中 / 告警 / 无法调度」，与老 console 截图一致。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-16 — 列表固定首末列与列口径提示（2026-11-19）

**为什么**：节点列表有十几列，横向滚动时读者失去参照——滚到右边看 GPU 数字，就不知道这一行是哪台机器了；要操作这一行，还得滚回去。同时，「GPU 用量」这类表头只有两三个字，装不下「实时利用率」与「调度器已分配」的区别，而这个区别正是数字被误读的原因。

**做法**：
1. **`ListColumn` 新增 `pin: 'start' | 'end'`**，只支持首末各一列。`ResourceList` 把选择框列固定到左、`rowActions` 生成的列固定到右——这两个是读者最常回看的锚点，不该要求每页手写。业务列由页面自己声明（节点列表固定 `name`）。
2. **固定列不可隐藏**。它是定位行的锚点，能隐藏就失去意义。在类型、列选择器、渲染过滤三处强制：`pin` 与 `hideable: true` 同时写在类型上编译失败；选择器只列 `hideable` 列（`ResourceList.tsx:619` 原有逻辑）；`visibleColumnKeys` 过滤显式放行 `pin` 列，挡住列选择器引入前存下的旧 key 列表。
3. **不做多列累加**。多列需要按可见列顺序累加 `left` 偏移，而列会被隐藏、被过滤，且 `<th>` 实际宽度未必等于声明宽度，累加会漂移。首末各一列不需要偏移计算。唯一的偏移来自两个内置前置列（`w-8` / `w-10`），宽度是文件内的字面量，所以用常量表 `PIN_LEFT` 而不是测量值。
4. **保持 `border-collapse`**。sticky 单元格在 collapse 模式下边框会随单元格滚走，所以固定列不画分隔线，改用不透明背景（挡住下层内容）+ 右侧固定列的 inset 阴影（`rgb(var(--ai-line))`，不是写死的黑色，浅色主题下也看得见）。改 `border-separate` 要重做全表现有边框，73 个调用点都受影响，收益只有一条线。
5. **固定列必须有 `width`**，否则内容变化时列宽跳动，固定反而更干扰。缺失时 `ResourceList` 放弃固定并 `console.warn`（按列 key 去重，避免每次渲染刷屏）。
6. **`hint` 渲染为表头旁的信息按钮**，用 `Tooltip`（键盘可达），不是 `title` 属性（只在悬停时出现、键盘不可达）。排序按钮与提示按钮是**兄弟节点**，不是嵌套——`<button>` 套 `<button>` 是非法 HTML，且点击目标会变歧义。提示按钮 `stopPropagation`，点它不会触发排序。

**被否方案**：
- 给所有列表一次性开 `pin`。固定列会吃掉窄屏表格的可视宽度，只有列多到需要横向滚动的页面才该开。
- 用 `title` 属性做提示。移动端没有 hover，键盘用户也拿不到。
- 多列固定。见第 3 点，偏移无法可靠计算。

**何时重新考虑**：当某页确实需要固定三列以上时，改为测量真实列宽（`ResizeObserver`）并累加偏移，而不是继续用常量。

**验证**：`packages/ai-kit/test/list-pinning.test.tsx` 10 条覆盖：start 列的 th/td 都带 `sticky left-0` 与不透明背景、`rowActions` 末列自动 `sticky right-0`、无 pin 的表格 DOM 不变、第二个同侧 pin 被忽略并告警、无 width 的 pin 被放弃并告警、固定列不被 `visibleColumnKeys` 滤掉、选择器不提供固定列、hint 渲染信息按钮、点 hint 不触发排序、无 hint 不渲染按钮。ai-kit 全量 253 passed。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-17 — 厂商统计项分组显示（2026-11-19）

**为什么**：统计条是「总数 / 控制面 / 健康率 / 昇腾 / 昆仑芯 / 英伟达」七项平铺。前三项回答「有多少节点、健不健康」，后几项回答「分别是什么硬件」——两组是不同的问题，平铺时厂商计数读起来像前三个数字的续篇，异构这件事反而被稀释。

**做法**：
1. `StatisticItem` 新增可选的 `group` / `groupLabel`，纯增量：不传就是原来的平铺行，另两个调用点（`GpusPage`、`NodeResourceOverview`）零改动。
2. **相邻同类项**包进一个 wrapper，wrapper 之间画一条竖线（`border-l`）。分组是**结构 + 分隔线**，不是标题。
3. 组标签只作 `aria-label`，不做可见文字。

**为什么标题不做成可见文字**：先做成可见标题试了一版——它在 946px 宽的统计条里占掉约 100px，直接把厂商组挤到第二行，而第二行只有 3 个小格子，左侧空出大片留白，比平铺更难看。视觉上的分隔由竖线和「图形形状不同」已经足够表达；需要文字说明的读者由 `aria-label` 拿到。

**为什么按相邻而不是按 group 聚合**：`groupRuns()` 只合并**连续**的同类项。跨过一个未分组项去合并会把那个项挪走，等于调用方排好的顺序被组件改写。

**为什么竖线画在 wrapper 上而不是第一个子元素上**：wrapper 是 flex item，可能整体换行。若把线挂在组内第一个格子，组换行时线会跟着跑到新行中间；挂在 wrapper 的 `border-l` 上，线始终在组的左边界。另外第一组不画线——它左边没有东西，一条孤立的竖线读起来像渲染错误。

**被否方案**：
- 可见组标题。见上：挤掉一行。
- 把厂商项塞进第二个 `StatisticsGroup`。两个 `<dl>` 会得到两张独立卡片边框，而不是一条统计带。
- 用 `gap` 加大间距代替分隔线。纯间距在七项里读不出「这里换了问题」，分隔线是明确的边界。

**何时重新考虑**：若统计条宽度稳定大于 1200px、放得下标题而不换行，可以把 `groupLabel` 提升为可见文字，与竖线并用。

**验证**：`statistics-grouping.test.tsx` 覆盖平铺（不传 group 时 DOM 与原先一致、无 wrapper）、相邻合并与顺序、非相邻拆成两段、第一组不画线。mlu370 `agent` 实测（3 节点 / 3 种加速卡）：七项在同一行（`y=165`），竖线位于健康率与第一个厂商格之间（CSS `x=702`，1.25px `rgb(62,76,146)`），组 `aria-label` 为「按算力卡类型」，可见文字中没有该标题。
