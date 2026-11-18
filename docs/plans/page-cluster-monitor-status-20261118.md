# 集群监控 · 集群状态分区与未就绪接管（2026-11-18）

> 单元：本批 Lead 契约（task-1 实现 / task-2 规格 / task-3 验证）。日期 2026-11-18。
> 方法：[旧前端迁移指南](../legacy-ui-migration-guide.md)；模板：[单页迁移交付模板](./page-migration-template.md)。
> 规格：`prd|design/kube-frontend/cluster-management/monitor.md`（AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08/09/10、DEC-11…16、CON-03、GOT-07…11）。
> 旧页截图（2026-11-18 实拍 https://ka.watering.ai，已归档到本目录）：`assets/cluster-monitor-status-20261118/old-host.png`、`old-agent.png`、`old-test.png`。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群管理员在集群监控页**先判断集群整体是否正常**（节点是否在线、XPU 厂商构成、控制面组件是否健康），再看趋势；集群作用域，路径无 workspace / namespace 段 |
| 旧入口、源码版本、部署 URL | 路由 `/clusters/:cluster/monitor-cluster/overview`；入口容器 `src/pages/clusters/containers/Monitor/Cluster/index.jsx` + `routes.js` + `Overview/index.jsx`；卡片 `src/pages/clusters/components/Cards/Monitoring/{ClusterResource,RdmaResource,ETCD,ServiceComponent}`；store `src/stores/monitoring/{base,component}.js`。部署 https://ka.watering.ai，2026-11-18 实测 `host` / `agent` / `test` 三集群（旧构建） |
| 新入口、路由/页面文件、工作树 | 新入口 `/kube-frontend/clusters/<cluster>/monitor`；路由 `apps/console-next/src/routes/kube-frontend.clusters.$cluster/monitor/`；页面 `apps/console-next/src/pages/cluster/ClusterMonitorPage.tsx`，分区 `ClusterStatusSection.tsx`（已存在）。工作树：改动**未提交**（用户要求不 commit/push），与 task-1（源码）、task-3（tests/ui）并行 |
| 环境、集群、角色 | 本地 dev 站（`cd console/kube-frontend && ./scripts/dev-mlu370.sh start` → http://127.0.0.1:5178/kube-frontend/...，`KA_BACKEND` 默认 https://ka.watering.ai）；mlu370 集群 `host`（就绪，1 节点 cambricon）、`agent`（就绪，3 节点 nvidia）、`test`（无 Ready 条件）；admin |
| 视口、主题、语言 | 1600×900 首屏及全页；1024 / 1280 / 1600；中文为主 + 英文复核；深色主题；浅色与第二色调未验收 |
| 子页面与状态范围 | 单页分区，无子页 / 页签 / 弹窗；状态分区三块 × 加载 / 有数据 / 空 / 未上报 / 无权限 / 失败 / 未安装；页面级未就绪由集群作用域路由层接管 |
| 明确排除及批准 | 不做厂商饼图（`DEC-...-13`）；不做 etcd 真实健康（`DEC-...-15`）；不新增独立路由或页签（`DEC-...-11`）；不在页面内重复实现未就绪等待视图（`DEC-...-12`）；旧页服务组件点击进入组件页**本轮不做（登记待补，批准依据见 PRD 明确不做）**；旧页 2 秒无条件轮询 componenthealth 不继承，改为随页面「自动刷新」开关 5 秒重取（AC-10，属改进非 parity）。以上均写入 PRD「明确不做」或本节 |
| 并行文件与安全边界 | 本记录作者只写 `prd/`、`design/`、`docs/plans/`；源码由 task-1 负责、`tests/ui` 由 task-3 负责；本页全部为只读请求；不执行生产写入；不提交 git |

## 2. 旧能力全集与归宿

> 先按旧源码与部署实测列原子能力，再关联新 AC；不从新 AC 反推旧能力。**页面级状态分支单独成行**（LEG-014～018）。
> 验收状态列在 TC-…-08/09 与实现就位后回填；当前标注为「待验证」的不得当作通过。

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-CLUSTER-STATUS-001 | `Cluster/index.jsx`（Banner `CLUSTER_STATUS` + `routes`），`routes.js` 六页签 overview/resource/etcd/api-server/scheduler/ranking；etcd 页签 `requireETCD` | 登录且集群可见 | 六个页签互斥切换；默认 overview；banner 标题「集群状态」 | 改进：收敛为两个入口——`/monitor`（状态分区 + 趋势五组 + 系统组件）与既有独立页 `/node-usage`（节点用量排行）；不新增页签/路由 | AC-...-08 / AC-...-09；TC-...-08 断言监控页无页签条、状态分区在趋势前 | 既有入口已交付；状态分区待验证 |
| LEG-CLUSTER-STATUS-002 | `Overview/index.jsx` `renderNodeStatus`：`StatusCircle used=counts.node.health total=counts.node.total`，图例 `ONLINE_NODES`/`ALL_NODES` | 始终 | 节点健康编号环：健康数/总数 + 图例 | 改进：节点在线状态块（`healthy/total` 数字 + 在线比例条），不再用编号环保留「当前值」 | AC-...-08；TC-...-08 断言 host 显示 1/1、agent 显示 3/3 且比例 100%；数字与同次 componenthealth 一致 | 待验证 |
| LEG-CLUSTER-STATUS-003 | 同文件 `handleNodeClick`：`hasPermission({module:'nodes',action:'view'})` → `routing.push('/clusters/:cluster/nodes')` | 有节点查看权限 | 点击节点卡进入该集群节点页；无权限不跳转 | 保留：节点块整块可点，直接链接到本集群节点页；**权限口径：不预检，由目标页在无权限时呈现无权限画面**（与全站一致，页面不预检路由；DEC-17） | AC-...-08；TC-...-08 断言点击后到达 `/nodes` | 待验证 |
| LEG-CLUSTER-STATUS-004 | `Overview/index.jsx` `fetchNodeStats` → `/kapis[/clusters/{c}]/resources.kubesphere.io/v1alpha3/nodes/stats`；多集群前缀 `globals.app.isMultiCluster` | 始终 | GET；返回对象键为厂商/汇总；加载中 `Loading` | 保留并拆分数据源：节点在线读 componenthealth.`nodeStatus`；厂商读 nodes/stats | AC-...-08；TC-...-08 用互不相同的数字（healthy/total 与厂商计数）对账 | 待验证 |
| LEG-CLUSTER-STATUS-005 | 同文件 `renderNodeVendorPie` 的 `vendorList`：色点 + `renderGpuVendorIcon` + `getVendorDisplayName` + `{value} NODE_PL ({percent}%)`；`vendor==='CPU'` → `NO_XPU_NODES` | `total > 0` | 厂商列表：图标、厂商名、节点数、占比；CPU 键显示为「无 XPU 节点」 | 保留并改：厂商图标 + 名称 + 节点数 + **比例条 + 百分比**；行集合 = nodes/stats 除 `healthy`/`total` 外的全部厂商键；`CPU` 键表示无 XPU 的节点，作为 CPU 行显示（真实节点数、计入分母），**不是空态**；仅当各厂商计数合计为 0 时空态 | AC-...-08；TC-...-08 断言 host 寒武纪 1 节点 100%、agent 英伟达 3 节点 100%，每行百分比=数量÷合计 | 待验证 |
| LEG-CLUSTER-STATUS-006 | 同文件 recharts `Pie`/`Cell`/`Sector` + `renderNodePieActiveShape` hover 显示节点数与百分比；`PIE_COLORS` 9 色 | `total > 0` | 环形饼图 + hover 标签；颜色来自旧 scss 变量 | 批准不做：改为列表 + 比例条（DEC-13）。理由：不引图表库；列表已含精确数字；厂商变多时饼图不可读 | AC-...-08 不承诺饼图；TC-...-08 断言页面无 `svg.recharts-surface` / 无饼图容器 | 明确不做（批准依据 DEC-13） |
| LEG-CLUSTER-STATUS-007 | 同文件 `percent: total > 0 ? (count / total).toFixed(2) : '0'`，渲染时直接拼 `%` | `total > 0` | 占比显示为 `1.00%`（实为 100%） | 修正：占比 = 节点数 ÷ 各厂商节点数之和 × 100，带合理精度（GOT-09） | TC-...-08 断言占比不是 0.01 量级、合计约 100% | 待验证 |
| LEG-CLUSTER-STATUS-008 | 同文件：`Object.keys(nodeStats)` 除 `total`/`healthy` 全当厂商；CPU 键显示 `NO_XPU_NODES` | `total > 0` | 无 XPU 的节点以「无 XPU 节点」一行展示 | 改进：`healthy`/`total` 不是厂商；`CPU` 键作为 CPU 行展示并计入占比分母；空态仅用于各厂商计数合计为 0（无节点/未上报）；CPU 行不是空态（GOT-08） | AC-...-08；TC-...-08 断言空态文案且无「healthy」行 | 待验证 |
| LEG-CLUSTER-STATUS-009 | `renderServiceComponents`：kubeaihub/kubeSystem/istio/monitoring/logging/devops；`get(counts, '[type].health', 0)/total`；`disabled` 时 `DISABLED` | 始终 | 6 个服务组件图标 + 后端健康数/总数；未启用模块显示「已禁用」 | 改进：6 项按命名空间聚合 `ΣhealthyBackends ÷ ΣtotalBackends`；未启用（configz）显示「未安装」而不是 0/0（DEC-14） | AC-...-08；TC-...-08 断言 host 的 kubernetes 5/5、monitoring 10/10、logging 9/9、devops 6/6，istio 未安装 | 待验证 |
| LEG-CLUSTER-STATUS-010 | `stores/monitoring/component.js` `data.kubesphere` 与模板 `counts.kubeaihub` 键名不一致；`get(...,0)` 兜底 | 始终 | Kube AI Hub 恒显示 `0/0` | 修正：按 `kubesphere-system` 聚合；不再恒零（GOT-10） | TC-...-08 断言 Kube AI Hub 显示值等于接口 ΣhealthyBackends/ΣtotalBackends（若该命名空间无记录则显示「未上报」而不是 0/0） | 待验证 |
| LEG-CLUSTER-STATUS-011 | 同文件 `disabled: !globals.app.hasClusterModule(cluster, 'servicemesh'/'monitoring'/'logging'/'devops')`；`handleComponentsClick` 在 disabled 时不跳转 | 始终 | 未启用模块置灰 + 显示「已禁用」；点击无动作 | 改进：读集群对象 `status.configz`；未启用 → 「未安装」（不是 0/0、也不是「已禁用」这种可恢复措辞） | AC-...-08；TC-...-08 断言 agent 的 istio 显示「未安装」且无 0/0 | 待验证 |
| LEG-CLUSTER-STATUS-012 | `getCoreComponentStatus`/`renderCoreComponents`：etcd-0=`supportETCD`、controller-manager=`supportControllerManager`、scheduler=`supportKsScheduler`；图标 `check`/`substract` | 始终 | 三项状态图标，无点击；controller-manager/scheduler 由 kubesphereStatus 的 `label.component` + `healthyBackends>0` 判定；etcd 由 ServiceMonitor 判定 | 改进：etcd 项显示「已接入监控/未接入」；controller-manager/scheduler 显示「正常/异常/未上报」；不同语义不共用同一个健康徽标（DEC-15） | AC-...-08；TC-...-08 断言三项文案分别与 componenthealth/servicemonitor 同次响应一致 | 待验证 |
| LEG-CLUSTER-STATUS-013 | `Overview/index.jsx` `updateData`：`setTimeout(2000)` 递归 `requestHealthMetrics`；`componentWillUnmount` `clearTimeout` | 页面挂载期间 | 每 2 秒刷新组件健康 | 改进：不继承 2 秒无条件轮询（高频、无法关闭、递归定时器与卸载时序不可靠）；改为页面「自动刷新」开关以 5 秒驱动状态分区三查询（componenthealth / nodes-stats / etcd ServiceMonitor），关闭或卸载即停止（DEC-16、AC-10）；旧 2s→新 5s 属对旧行为的收敛，不是 parity | AC-...-10；TC-...-08/09 断言开启后 5 秒内三查询各再次发起、关闭后停止 | 实现完成：task-4 单测 7 passed；真实浏览器 OFF/ON/OFF 请求数 = 0/3/0（task-4 报告）；TC 断言待 task-3 回填 |
| LEG-CLUSTER-STATUS-014 | 部署实测 `host` 旧页：节点 1/1、寒武纪 1 节点、Kubernetes 5/5、Monitoring 10/10、Logging 9/9、DevOps 6/6；`agent` 旧页：3/3、英伟达 3 节点、Kubernetes 7/7、Monitoring 12/12、Logging 9/9、DevOps 6/6、Istio 已禁用（截图 old-host/old-agent） | 集群 Ready，admin | **页面级正常态**：三块都有数据 | 保留：状态分区在就绪集群渲染三块；数据来自新接口而非旧 store | AC-...-08；TC-...-08 在 host 与 agent 上各断言一次 | 待验证 |
| LEG-CLUSTER-STATUS-015 | 部署实测 `test`（无 Ready 条件）旧页：**没有整页接管**；节点 0/0、厂商「暂无数据」、模块「已禁用」，把 500 吞成 0/0（截图 old-test） | 集群未就绪 | **页面级未就绪**：旧页显示 0/0 + 暂无数据 + 已禁用，读者会以为集群健康但没数据 | 改进（**非 parity**）：集群作用域路由层 `ready === false` 且非 overview → 不挂载页面，整页 `cluster:not-ready` 面板 + `cluster:not-ready-overview` 概览入口；页面内不重复实现（DEC-12、GOT-11） | AC-...-09；TC-...-09 在 `test` 上断言 `cluster:not-ready` 可见、无 `cluster-monitor:surface`、无趋势卡、无重试、概览入口可点 | 待验证；**部署构建可能尚未含该路由层（本地/新构建才有）** |
| LEG-CLUSTER-STATUS-016 | 旧页 `to(request.get(...))` 吞掉所有错误（含 403），各块回落 0/0 / 暂无数据 | componenthealth 或 nodes/stats 返回 403 | **页面级无权限**：旧页没有专用画面，无权限与失败/空不可分 | 改进：componenthealth 403 → 只有状态分区「无权限查看」且无重试；nodes/stats 403 → 只有厂商块无权限说明；两块互不影响（AC-09） | AC-...-09；TC-...-09 用 route mock 分别模拟两个 403，断言另一块与趋势正常 | 待验证 |
| LEG-CLUSTER-STATUS-017 | 旧页 `total === 0 ? NO_DATA`；组件无记录时 0/0；节点 0/0 | 真实空 / 未上报 | **页面级空**：0/0 与「暂无数据」混用 | 改进：totalNodes 缺失→「未上报」；为 0→空态说明；各厂商计数合计为 0→空态说明（CPU 行不是空态）；模块无后端记录→「未上报」；0/0 不当正常（AC-08/09） | AC-...-08 / AC-...-09；TC-...-08/09 用 mock 空响应与缺字段断言四种文案不同 | 待验证 |
| LEG-CLUSTER-STATUS-018 | 旧页 `Loading spinning={...isLoading}`（componenthealth 与 nodeStats 各自） | 请求中 | **页面级加载**：旧页用 loading 遮罩 | 保留：三块各自骨架（不互相等待；趋势分区骨架独立） | AC-...-09；TC-...-09 延迟响应断言骨架可见且无 0 值 | 待验证 |
| LEG-CLUSTER-STATUS-019 | `ClusterResource/index.jsx` `StatusTabs` 7 个 tab：GPU_MEMORY/GPU/GPU_ALLOCATION/CPU/MEMORY/DISK/PODS | 始终 | 7 tab 互斥切换，每 tab 一张面积图 | 已承接：新页趋势分组 GPU / 主机资源（AC-...-03/05）；本次不重做 | 既有交付；不新增断言 | 通过（历史批次，本轮不重验） |
| LEG-CLUSTER-STATUS-020 | `RdmaResource/index.jsx` `StatusTabs` 4 tab + 异常节点列表 | 始终 | RDMA 健康/端口/吞吐/错误 4 tab | 已承接：新页 RDMA 趋势组（AC-...-05）+ 异常节点说明；本次不重做 | 既有交付；不新增断言 | 通过（历史批次，本轮不重验） |
| LEG-CLUSTER-STATUS-021 | `ServiceComponent/index.jsx` `StatusTabs` 4 tab：APIServer 延迟/速率、Scheduler 尝试/速率 | 始终 | 4 tab 互斥 | 已承接：新页「系统组件」分区（AC-...-06/07）；本次不重做 | 既有交付；不新增断言 | 通过（历史批次，本轮不重验） |
| LEG-CLUSTER-STATUS-022 | 同文件 `handleComponentsClick`：monitoring view 权限且未 disabled → `/clusters/:cluster/components?type=...` | 有权限且模块已启用 | 点击服务组件图标进入集群组件页 | **本轮不做（待补，批准依据）**：状态行回答「是否健康」不是导航入口；组件页已有入口（概览组件面板/侧栏），摘要行再加 6 个深链会把「状态」与「去哪看」混在一行；旧页 `?type=` 过滤在新组件页是客户端分组，复刻可行但本轮 AC 未承诺（见 PRD 明确不做） | 未映射→登记待补（批准不做，不计入通过）；不写成「已迁移」 | 待补（批准不做） |

统计：22 条原子能力。既有承接 3（019–021，历史批次已验收，本轮不重验）+ 001 的入口部分；本次实现范围 15（002–014、015–018 中的页面级分支；AC-10 的自动刷新行为并入 LEG-013）；批准不做/待补 2（006 批准不做；022 本轮不做·待补）。**实现与验收状态在 TC-…-08/09 与 task-1 落地后回填，本节不提前声称通过。**

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | **返回类型** | 字段或指标/标签 | 原单位→显示单位/精度/分母 | API 映射→页面位置 | 缺值/零/异常/过期值规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LEG-002/003/004 | `GET /kapis[/clusters/{c}]/resources.kubesphere.io/v1alpha2/componenthealth`，无参数 | **JSON** | `nodeStatus.totalNodes` / `nodeStatus.healthyNodes`；`kubesphereStatus[]`（`namespace`/`label`/`totalBackends`/`healthyBackends`）；`kubernetesStatus[]`（本页不用于核心组件判定） | 计数→整数；在线比例 = healthyNodes ÷ totalNodes | `clusterStatusApi.componentHealth` → 节点在线状态块、服务组件、核心组件 | totalNodes 缺失→未上报；为 0→空态；字段非数字→按缺失；本部署 host 实测 200，nodeStatus 为 1/1 | 同一响应内 healthyNodes/totalNodes 与卡面数字、比例一致；服务组件 x/y 等于该命名空间内 ΣhealthyBackends/ΣtotalBackends |
| LEG-005/007/008 | `GET /kapis[/clusters/{c}]/resources.kubesphere.io/v1alpha3/nodes/stats`，无参数；未复用 `nodeListApi.stats`（那是节点列表的 labelSelector 语义） | **JSON** | 键 = 厂商名 → 节点数；`healthy` / `total` 为汇总字段；`CPU` 键表示无 XPU 的节点数（按 CPU 行显示） | 节点数整数；占比 = 该厂商节点数 ÷ 各厂商节点数之和 × 100 | `clusterStatusApi.nodeVendorStats`（未复用 `nodeListApi.stats`）→ 厂商分布块 | healthy/total 不进入厂商列表与分母；各厂商计数合计为 0 → 空态；**CPU 行不是空态**；403→只有本块无权限；5xx→错误+重试 | host 实测返回 cambricon=1、healthy=1、total=1：显示寒武纪 1 节点 100%；各厂商计数之和等于显示行数值之和 |
| LEG-009/010/011 | 同 componenthealth（服务组件） | **JSON** | `kubesphereStatus[].namespace` → 分组；每组 Σ`healthyBackends` / Σ`totalBackends` | 后端数→整数；顺带百分比 = health ÷ total | `clusterStatusApi.componentHealth` → 服务组件 6 项 | 无该命名空间记录→未上报（不是 0/0）；configz 未启用→未安装（不读后端数）；403→状态分区无权限 | host：kubernetes 5/5、monitoring 10/10、logging 9/9、devops 6/6 与接口一致；kubesphere-system 无记录时显示未上报 |
| LEG-012a | 同 componenthealth | **JSON** | `kubesphereStatus[].label.component` = `kube-controller-manager` / `kube-scheduler`；`healthyBackends` | 无单位；>0 正常、=0 异常、无匹配记录未上报 | `clusterStatusApi.componentHealth` → 核心组件 | 匹配不到→未上报；为 0→异常（不是未上报）；403→随状态分区无权限 | 同一次响应内 label 匹配与显示状态一致；host 实测两条记录存在 |
| LEG-012b | `GET /apis[/clusters/{c}]/monitoring.coreos.com/v1/namespaces/kubesphere-monitoring-system/servicemonitors/etcd` | **JSON** | 200 = 已接入；404 = 未接入；其他失败 | 无单位；只表达「是否接入」，不表达 etcd 健康 | `clusterStatusApi.etcdServiceMonitor` → 核心组件 etcd 项 | 200→已接入；404→未接入；403→「无权限」徽标（不判为未接入、不显示重试）；5xx→「失败」徽标 + 重试；不因未接入而隐藏组件趋势子组（与旧 `requireETCD` 不同） | host/agent/test 实测 200（已接入）与 404（未接入）分支各记录一次；读失败只影响 etcd 项 |
| LEG-011（模块开关） | `GET /kapis[/clusters/{c}]/resources.kubesphere.io/v1alpha1/clusters/{c}`（集群详情；与概览共享 `cluster-detail` 查询键） | **JSON** | `status.configz.{servicemesh,monitoring,logging,devops}` | 布尔 | `clusterDetail` → 服务组件「未安装」判断 | configz 缺失或读取失败 → 按未知处理（不声称「未安装」）；读取失败不阻塞状态分区其余块 | 未启用模块的 configz 为 false 时显示「未安装」；configz 读取失败时仍显示后端数而非 0/0 |
| LEG-014～018 | `GET /kapis[/clusters/{c}]/resources.kubesphere.io/v1alpha1/clusters`（集群列表） | **JSON** | 集群项 `ready` / Ready 条件 `status.conditions` | 布尔 | 路由层 `routes/kube-frontend.clusters.$cluster/route.tsx`（既有，不在本页实现） | 只有 `ready === false` 才接管；`ready` 缺失（列表加载中/失败）不接管；未就绪时集群所有 `/kapis/clusters/{c}/*` 返回 500 文本 `cluster {c} is not ready` | `test` 集群实测：列表 `ready===false` 时面板可见、页面不挂载；`host`/`agent` `ready===true` 时页面正常挂载 |
| LEG-013（AC-10 自动刷新） | 状态分区三查询：componenthealth（v1alpha2）、nodes/stats（v1alpha3）、servicemonitors/etcd（apis monitoring.coreos.com）；页面「自动刷新」开关开启 `live=true` | **JSON** | 三查询按与趋势相同的开关重取；无新增字段 | 间隔 5 秒（`refetchInterval: live ? 5000 : false`） | `ClusterStatusSection live={autoRefresh}` → 开启后三查询每 5s 重取，关闭即停止 | 关闭/卸载后不再发请求；单块失败不阻断其他块重取 | 开启前记一次三请求计数，开启后 5s 内每查询至少再发起一次；关闭后 6s 内无新请求 |
| LEG-019～021 | `GET /kapis[/clusters/{c}]/monitoring.kubesphere.io/v1alpha3/cluster` 与 `.../components/{apiserver|scheduler|etcd}`（既有趋势分区） | **JSON** | 见既有 `CON-...-01/02` | 见既有 CON | 既有趋势分区（本次不改） | 见既有 AC-...-03/05/06/07 | 本轮不重验（回归由既有用例覆盖） |

**返回类型统一为 JSON**：以上端点都不返回 YAML / 纯文本，不需要 `responseType: 'text'`。成员集群的集群段必须紧跟 `/kapis` 或 `/apis`（`clusterScoped`），不能用 `?cluster=` 查询参数代替；跨集群缓存键必须含 `cluster`。

## 4. 交互、视觉与复用基线

参考页：旧 console 的同一 overview 页（截图见 `assets/cluster-monitor-status-20261118/old-host.png`、`old-agent.png`、`old-test.png`）。复制它的**信息分组与密度**，不复制它的 0/0 吞错、饼图与「已禁用」措辞。

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 页头 → 「集群状态」分区（三块）→ GPU/主机/磁盘 I/O/网络/RDMA 趋势分组 → 系统组件分区；分区标题与趋势分组标题**同级**（都只做分区、不折叠）；状态分区三块在宽屏同排、窄屏堆叠 | 首屏 + 全页截图；用 `getBoundingClientRect()` 量「状态分区标题与 GPU 分组标题字号/字重一致」以及三块顶边差值 < 2px（同排） |
| 字段栅格 | 节点块：标签 + `healthy/total` + 比例；厂商行：图标/名称/节点数/比例条 + 百分比（右对齐数字）；服务组件：图标 + 名称 + `x/y`；核心组件：名称 + 状态词；未知值显示「未上报」，不填 0 | 各断点相对坐标；空态与未上报文案断言；不存在字段留空 |
| 字号层级 | 关系而非像素：分区标题与趋势分组标题同级；块标题略弱于分区标题；值（数字）大于单位；次色用于说明 | 计算样式断言字号/字重关系，不 `toContain('text-sm')` |
| 密度与铺满 | 三块同排时等宽栅格、缝隙一致；窄屏堆叠后不横向溢出；不把空态撑成全高 | 1024/1280/1600 无横向溢出；相邻块 gap 差值为 0–1px |
| 主题 | 只用 ai-kit 语义 token（`--ai-*`），状态色区分「正常/异常/未上报」；不写颜色字面量 | 深浅主题计算样式取样；令牌契约测试不倒退 |
| 图标与图表 | 厂商图标复用 `VendorIcon`/`vendorMarks`；比例条宽度为 0 时不画；不用饼图（DEC-13）；空值不画 0 条 | 断言厂商行有图标句柄且无 `recharts`；0 节点时无 0 宽条残留 |
| 通用控件 | 复用 `Panel`（块容器）、`Skeleton`（加载）、`ResourceErrorPanel`（失败+重试）、ai-kit `TrendChart`（趋势，既有）；不新增业务专用公共组件 | 分组/块用既有组件；错误面板有重试句柄、403 无重试 |
| 链接与状态 | 节点块 → 本集群节点页（有权限时）；未就绪 → 路由层概览入口；空/失败有说明与出口；未安装不是可点击入口 | 全部入口实际走通（TC-08/09）；空态/失败有正确出口 |
| 空态四要素 | 空态标题（这里是什么）+ 说明（为什么空）+ 主操作（适用时）+ 区分「真空 / 未上报 / 无权限 / 失败」 | 四种状态文案互不相同；共享层 empty-state-contract 棘轮不倒退 |
| 自动刷新 | 「自动刷新」开关同时驱动趋势与状态分区三查询（间隔 5 秒）；状态分区重取时保留已有内容（只更新数字，不用整块骨架把已知数据遮掉）；关闭或卸载即停止 | 开启后 5s 内三查询各再次发起；关闭后 6s 内无请求；重取期间数字不消失 |
| 控制台 | 不适用（本页无终端） | — |

复用决定：全部为组合既有能力——厂商标识（`gpuVendors.ts` / `VendorIcon.tsx` / `vendorMarks.tsx`，已用于节点与 GPU 页）、错误面板（`ResourceErrorPanel`）、块容器与骨架（`Panel` / `Skeleton`）、趋势（ai-kit `TrendChart`，既有）。**无需新增 Storybook 故事**，不新建业务专用公共组件；比例条用页面内布局（`div` + 宽度百分比），不新增 ai-kit 原语。

## 5. 编码与回归

- [ ] PRD 的 AC-08/09/10 同时承接功能、数据语义、状态、权限、交互、视觉与刷新行为；design 写完整决策及被否方案（DEC-11…16、CON-03、GOT-07…11）。
- [ ] YAML 与 Python 一一镜像，句柄稳定（TC-…-08/09 由 task-3 负责）；原能力回归保留，视觉调整不以删除数据断言过关。
- [ ] 旧能力表独立比对新实现；可自动检出的遗漏加契约，其他项人工逐行核对——本节不声称已有通用自动门禁。
- [ ] API/mapper 单测、组件/应用测试、显式类型检查与构建分别记录（命令与结果见下方「验收记录」占位）。
- [ ] 固定本批构建并确认部署形态；相关及受共享组件影响的 E2E 串行判定。
- [ ] 改共享层前检索已交付 AC 与既有用例；本页不改共享默认值（无分页/默认排序改动）。
- [ ] 失败先确认是否本批引入：本批未提交，按模板用 `git stash` 或 `git worktree` 基线（以 Lead 统一口径为准）。
- [ ] 改过 AC 文案后重跑 `generate_case_docs.py`；grep 旧数字与措辞（如「已禁用」「0/0」「1.00%」）确认不被当作新承诺。
- [ ] AC-10：验证自动刷新开启后 5s 内 componenthealth / nodes-stats / etcd 三查询各再发一次、关闭后停止、卸载清理；注意状态分区跟随页面开关而不是各自独立 interval。
- [ ] 展示型区块的断言检查**内容**而非标题：状态分区整块消失时用例必须失败。
- [ ] 写入/接口 5xx 先按指南 §7.5 判定前端 / apiserver / 被调组件；本页只读，不涉及写入。
- [ ] 实际采样按同次响应核对；边界/403 使用安全 mock，不写生产。
- [ ] 新旧同角色同集群首屏/全页截图人工复核（old-host / old-agent / old-test 与 after 截图）。

**验收记录（占位，待 TC-…-08/09 与 task-1 落地后与 Lead 核对回填）**

| 项 | 命令/方法 | 结果（待填） |
| --- | --- | --- |
| 规格门禁 | `cd console && python3 prd/tools/check_docs.py --strict prd/kube-frontend/cluster-management/monitor.md design/kube-frontend/cluster-management/monitor.md tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08.yaml tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09.yaml` | **errors=0 warnings=0（2026-11-18，本批 PRD+design+两条 TC spec）**；耗时约 4 分 30 秒（全量 tests 扫描） |
| 显式类型 | `cd console/kube-frontend/apps/console-next && npx tsc --noEmit -p tsconfig.json` | 待填 |
| 构建 | `cd console/kube-frontend && pnpm --filter @kube-ai-hub/console-next build` | 待填 |
| 单测 | console-next 新增 `test/cluster-monitor-status*.test.tsx`（task-1） | 待填 |
| E2E | TC-…-MONITOR-08/09 串行（task-3） | 待填 |
| 视觉 | 1024/1280/1600 × 深色 × zh/en，新旧对照 | 待填 |

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 待填 | 22 条原子 ID：既有承接 3、本次实现范围 15、批准不做/待补 2（006 批准不做；022 本轮不做·待补，批准依据见 PRD 明确不做） | 022 未映射→登记待补（批准不做），不得计入通过 |
| 数据语义 | 待填 | 同次响应对账见 §3 | 各厂商占比合计、服务组件聚合、核心组件 label 匹配、etcd 探测分支 |
| 交互与权限 | 待填 | TC-…-08/09；403 用 route mock；AC-10 自动刷新 5s 重取/关闭停止 | 真实受限账号 403 未验收；自动刷新断言待 task-3 落地 |
| 视觉与主题 | 待填 | 1024/1280/1600 × 深色 × zh/en；新旧截图对照 | 浅色、第二色调未验收 |
| 静态/类型/构建/测试 | 待填 | 见 §5 验收记录 | 全仓串行 E2E 未跑 |
| 本地全栈 | 待填 | 127.0.0.1:5178 → KA_BACKEND=https://ka.watering.ai，admin | 成员集群真实就绪后的正向数据（状态分区）未验收 |
| 新版部署/全站 | 未验收 | — | 部署环境；且部署构建可能尚未包含路由层 `cluster:not-ready`（本地/新构建才有） |

结论口径：按声明范围分别写「本地该页交付完成」「部分完成/阻塞」「新版部署已验收」，不使用没有范围的「全部完成」。本批工作树按用户要求**未提交**。
