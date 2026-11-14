# 集群概览功能对照与遗漏复盘

> **后续补齐**：以下保留复盘时 `38d5eb47d` 的缺口和原因，不改写历史。
> OVR-01 至 OVR-08 已在后续实现中补齐并完成 5178 相关验收，见
> [补齐与逐项验收](./cluster-overview-completion-20261115.md)。新版未部署生产，真实成员集群尚未验收。

## 1. 结论与范围

**新版概览是部分迁移，不是旧版概览的完整功能对齐。** 双栏布局、未知值处理和终端交互已改善，
但仍有八项需要补齐或纠正的能力差异。此前 `38d5eb47d` 的测试通过证明了当批新增功能可用，
不能证明旧概览的全部区块、字段和交互已迁移。

本次应用户要求只做源码、截图、只读接口对照与流程复盘；**未修改页面实现，未关闭这些缺口，
未部署生产，也未执行节点/GPU/集群写操作**。没有把旧 AGPL 源码复制到 Apache 实现。

- 旧版部署：<https://console-dev.brightaitoken.ai/clusters/host/overview>
- 新版本地全栈：<http://localhost:5178/kube-frontend/clusters/host/overview>
- 采集日期：2026-11-15；同一 B200、host、admin，连续采集，1600×900。
- 源码基线：概览实现 `38d5eb47d`；实际旧部署请求同时记录，不能假设旧部署与本地旧源码逐字一致。
- 新版证据只证明本地 BFF 到 B200 的链路，不证明新版已部署到生产 ingress/TLS。

## 2. 截图证据

| 旧版 | 新版 |
| --- | --- |
| [1600×900 首屏](./assets/overview-parity-20261115/legacy-1600x900-viewport.png) | [1600×900 首屏](./assets/overview-parity-20261115/new-1600x900-viewport.png) |
| [全页](./assets/overview-parity-20261115/legacy-1600x900-full.png) | [全页](./assets/overview-parity-20261115/new-1600x900-full.png) |
| [Top5 指标菜单展开](./assets/overview-parity-20261115/legacy-ranking-options-1600x900.png) | 概览没有排行面板或指标菜单 |

全页截图用于排除“只是移到首屏以下”。旧版磁盘和工具在首屏下方仍存在，新版全页没有它们。
截图中的动态数值只作本次证据，不作为今后的固定测试值。
菜单首屏只显示部分选项；九项总集合由源码及展开后的 DOM 文本核对，不声称单张截图展示了全部选项。

## 3. 从源码拆开的六个旧区块

旧入口：[Overview](../../src/pages/clusters/containers/Overview/index.jsx)，就绪集群进入
[Dashboard](../../src/pages/clusters/containers/Overview/Dashboard/index.jsx)：

| 旧区块与条件 | 新版归宿 | 对齐结论 |
| --- | --- | --- |
| ClusterInfo，多集群时展示 | BasicInfoPanel | 部分保留，集群可见性缺失，见 OVR-08 |
| ServiceComponents | ModulesPanel + 独立 components 页 | 不是等价替换，分类入口缺失，见 OVR-06 |
| ResourcesUsage | UsagePanel | 六类资源缩成五张卡，其中节点是新增；显存、磁盘缺失，GPU 口径改变 |
| Tools，仅平台管理员可见 | 四个常用入口，其中有 kubectl | kubectl 已承接；kubeconfig 查看/下载缺失，见 OVR-05 |
| KubernetesStatus | KubernetesStatusPanel | 同样四个数字但最后一个换了标签，见 OVR-04 |
| ClusterNodes：NodesStatus + NodesTop5 | 无概览面板；nodes/node-usage 独立页 | Top5 未等价承接，见 OVR-07；NodesStatus 本地旧源码只是空 div，不虚构旧能力 |

旧页面右下角“工具箱”是全局 Shell 能力，不是 Dashboard/Tools 的第三个工具。
本次只登记概览内的 kubectl 与 kubeconfig，不把整个旧 Shell 当作概览缺口。

## 4. 八项差异登记

全部为**已登记待补**；“实现建议”不是本轮已实现，也不是未经验证的“不迁移”决定。

| ID / 优先级 | 旧版源码与截图事实 | 新版源码事实 | 归类与处理 |
| --- | --- | --- | --- |
| OVR-01 / P1 | GPU 显存：使用量、总量、比例；最终截图约 81%、2.11/2.61 Ti | ClusterUsage、METRICS、UsagePanel 都无显存字段 | 缺失；恢复集群显存 bytes、总量及比例 |
| OVR-02 / P1 | 磁盘：使用量、容量、比例；本次截图约 25%、15.64/63 TB | 未请求磁盘指标，也无磁盘卡 | 缺失；恢复磁盘量、容量及比例，统一但明确单位 |
| OVR-03 / P1 | GPU：最终截图实际已使用 1.91 卡、已分配 6 卡、总量 15 卡，比例约 13% | 请求 `cluster_gpu_usage` 却在 mapper 丢弃；GPU 卡用 `gpuAllocated` 作主分子，显示 6/15、40%，利用率另为 13% | 语义损失；使用量、分配量、总量和利用率分别命名，允许小数，不用分配量替代实际用量 |
| OVR-04 / P1 | 调度失败次数取 `scheduler_schedule_attempts{result="error"}`，截图为 1 | 只映射 scheduled 与 unschedulable，最后一项“无法调度”显示 226 | 字段缺失兼语义替换；补回 error，unschedulable 可作为明确新增项，二者不能互相替代 |
| OVR-05 / P1 | kubectl + kubeconfig；后者只读编辑器、下载 kubeconfig.yaml、使用提示 | kubectl 路由与近全屏终端已存在；无概览 kubeconfig 工具 | 部分承接；补用户身份、集群范围一致的只读查看/下载，不与“更新成员集群 kubeconfig”混淆 |
| OVR-06 / P1 | Kube AI Hub、Kubernetes、Istio、监控、日志、DevOps 六个分类组件入口，链接带 `?type=` | 模块徽标不含 Link，四个快捷入口无 components；独立 ComponentsPage 有列表但无 type 分类，查询不接收 cluster | 部分承接；恢复概览组件分类入口与同集群过滤，配置开关不能代替组件事实 |
| OVR-07 / P1 | Top5 默认 GPU 显存，九类指标可切换，节点名/IP/控制面标记、值、节点详情和“查看更多” | 概览无 Top5；NodesPage 是节点属性列表，NodeUsagePage 只有 CPU/内存/磁盘/Pod，缺 GPU/显存/分配率/load1/inode、详情链接与首页预览 | 缺失；恢复概览 Top5 + 等价完整排行下钻，不从当前分页结果算全局 Top5 |
| OVR-08 / P2 | ClusterInfo 显示“对部分租户(企业空间)可见”等集群可见性 | toClusterDetail 已映射 visibility，BasicInfoPanel 没渲染 | 缺失；恢复只读可见性。版本品牌文案另作统一，不当作新字段 |

### 4.1 资源字段的请求到显示链路

旧：[ResourcesUsage:33–118](../../src/pages/clusters/containers/Overview/Dashboard/ResourcesUsage/index.jsx#L33-L118)
及 [ResourceItem](../../src/pages/clusters/containers/Overview/Dashboard/ResourcesUsage/ResourceItem/index.jsx)。
新：[clusterMetricsApi:179–227](../../kube-frontend/packages/api-client/src/cluster.ts#L179-L227)
及 [UsagePanel](../../kube-frontend/apps/console-next/src/pages/cluster/ClusterOverviewPage.tsx)。

| 指标 | 旧版展示 | 新版请求 | 新版模型/展示 |
| --- | --- | --- | --- |
| cluster_gpu_memory_usage / total | 显存量和比例 | 否 | 无 |
| cluster_disk_size_usage / capacity | 磁盘量和比例 | 否 | 无 |
| cluster_gpu_usage | GPU 实际使用量，允许小数 | 是 | mapper 丢弃，不能以“已请求”算完成 |
| cluster_gpu_allocated / total | 分配量 / 总量，独立于使用 | 是 | 有，但分配率成为主进度 |
| cluster_cpu_usage / total / allocated | CPU 使用、容量、分配 | 是 | 保留；精度从 43.12/68.62 核缩为 43/69，列为 P2 格式核对项 |
| cluster_memory_usage_wo_cache / total / allocated | 内存使用、容量、分配 | 是 | 保留；需统一 GiB/TiB 标识 |
| cluster_pod_running_count / quota | 容器组运行数 / 配额 | 是 | 保留 |
| cluster_cpu_quota / memory_quota | 旧请求中存在，当前旧资源行未直接使用 | 否 | 只记“请求差异”，不冒充可见功能缺失 |
| cluster_node_online / total | 旧 ResourcesUsage 不展示 | 是 | 新增节点就绪率，是改进，不能抵消显存/磁盘缺失 |

旧版缺值填 0、allocated=0 时不显示分配行、按数组位置拼排行等缺陷不应照搬；
恢复功能时保留新版未知值、真实零、精确节点身份、近全屏终端与共享 ai-kit 的改进。

### 4.2 Kubernetes 状态不是“有四个数字就对齐”

旧：[KubernetesStatus:127–143](../../src/pages/clusters/containers/Overview/Dashboard/KubernetesStatus/index.jsx#L127-L143)。
新：[componentMetricsApi:335–347](../../kube-frontend/packages/api-client/src/cluster.ts#L335-L347)。

请求速率、请求延迟、scheduled 均已保留。**error 是调度执行错误次数，unschedulable 是无合适节点的尝试次数**。
二者同属一个指标的不同 result 标签，不能因为都“没有成功”就合并。数量也不是当前待调度 Pod 数。
验收要按标签回读，而不是只核对四个框都有非空值。

### 4.3 系统组件与排名的边界

旧：[ServiceComponents](../../src/pages/clusters/containers/Overview/Dashboard/ServiceComponents/index.jsx)，
[NodeStore](../../src/stores/rank/node.js)，[NodesTop5](../../src/pages/clusters/containers/Overview/Dashboard/ClusterNodes/NodesTop5/index.jsx)。
新：[ComponentsPage](../../kube-frontend/apps/console-next/src/pages/cluster/ComponentsPage.tsx)，
[NodeUsagePage](../../kube-frontend/apps/console-next/src/pages/cluster/NodeUsagePage.tsx)。

旧概览的组件图标本身**没有展示健康副本计数**；不要把“新增组件健康统计”写成旧功能已缺失。
已有 components 列表确实展示后端健康，它不能取代首页分类跳转。后续可复用列表数据做健康增强，但须另列 AC。

旧 Top5 九类排序为：GPU 显存利用率、GPU 利用率、GPU 已分配、CPU 利用率、load1、内存利用率、
磁盘利用率、inode 利用率、Pod 利用率。GPU 分配值在行内以 allocated/total 比例呈现；
旧排序键为 allocated 数量，未来不能暗中改成比例排序，需明确决策和测试。
新 NodeUsage 的 Pod 是数量排序，不等于旧 Pod 配额利用率；缺值默认零也是承接限制。

## 5. 实际只读探测

以下为本地 BFF 到 B200 的 GET，无模拟响应；动态数值来自连续采样，不宣称所有截图同一时间戳。

| 路径 / 参数 | 结果 | 证明与限制 |
| --- | --- | --- |
| monitoring v1alpha3 `/cluster?cluster=host&last=true&metrics_filter=…` | 200；显存 usage/total、磁盘 usage/capacity、GPU usage/allocated/total 全有采样 | OVR-01/02/03 不是接口无数据；最终样本 GPU usage=1.91、allocated=6、total=15 |
| monitoring v1alpha3 `/components/scheduler?cluster=host&metrics_filter=scheduler_schedule_attempts$` | 200；scheduled=3852、error=1、unschedulable=226 | OVR-04 两个标签同时存在，不能换口径 |
| monitoring v1alpha3 `/nodes?cluster=host&type=rank&sort_metric=node_gpu_memory_utilisation&sort_type=desc&page=1&limit=5` | 200；gpu01 约 0.8372、gpu02 约 0.7733，total_item=2 | Top5 能读；两节点集群显示不足五项是正常，不证明五节点截断/全九项排序均已验收 |
| resources v1alpha3 `/components` | 200；50 项，六类系统命名空间均存在 | 本地新组件读取已有能力；不是“产品没有 DevOps/Istio” |
| `/kapis/clusters/host/resources.kubesphere.io/v1alpha2/components` | 200；50 项 | 与旧部署浏览器实际请求一致 |
| resources v1alpha2/v1alpha3 `/klusters/host/components` | 404 | 本地旧 Store 拼写路径与部署实际路径不同；不能据这两次 404 宣称组件不存在 |
| resources v1alpha2 `/users/admin/kubeconfig` | 200；text/plain，正文非空；未保存或输出凭据正文 | 需按用户、权限和集群路由验收；不是成员集群连接配置的 PUT |

旧部署捕获到 `/kapis/clusters/host/…` 前缀，新版为 group 下路径加 cluster 查询。
本次证明 host 可用，不扩展为所有 member 可用；后续补功能需要独立的 member/403 用例。

## 6. 为什么会遗漏

| 根因 | 可核对证据 | 机制 |
| --- | --- | --- |
| 六个区块仅被口头列出，没有字段/动作清单 | 初始设计称迁移“前四块”；资源 METRICS 和模型漏显存/磁盘 | 区块同名便视为完成，内部字段损失未登记 |
| 交互升级先于行为完整性确认 | DEC-03 强调卡数替代比例，却误述旧版“只显示利用率”；旧 ResourceItem 同时有实际使用与分配 | 改进被用来重定义数据语义，gpu_usage 请求后仍被丢弃 |
| 用配置开关代替运行事实 | 初始 DEC-04 以“产品没有 DevOps/服务网格”为排除理由；本次六类入口与接口都存在 | 模块徽标替代组件导航，消除了原任务入口 |
| “别处承接”未做等价证明 | PRD 写 Top5 已由节点页承担；新节点用量只覆盖四类指标 | 页面相似被当成任务、指标、排序、下钻和权限等价 |
| 没有按标签对账 | mapper 只保留 scheduled/unschedulable；旧显示 error | 两个失败类指标被误认为同义 |
| 测试复制了缩水后的 AC | OVERVIEW-01 的 USAGE_ROWS 仅 cpu/memory/pods/nodes；控制面仅核“四字段非空” | 测试验证实现自身而不是旧能力集合，丢字段仍全绿 |
| 路由与文档门禁被误当成完整迁移门禁 | gap_check 查 URL，check_docs 查 AC 追溯，parity_report 从 PRD 生成 | 可以发现未登记页面/孤儿用例，不能发现一开始就漏写的字段 |
| 布局收尾没有重开旧概览全页比较 | 38d5eb47d 回归重在新布局、终端、缺值与硬件；执行记录无旧概览并排截图 | 本地验证真实有效，但“功能已补齐”的结论超出了证据范围 |

这不是 ai-kit 能力不足造成的：现有组件已经能展示卡片、表格、选择器和弹窗。
直接责任是清点和验收口径不完整；接口、文档与截图证据未组成同一份能力清单。

## 7. 纠正与下一轮计划

这次**推翻的是“可因避免重复而省略首页任务”的判断**，不是撤销双栏/共享组件/未知值改进。
保留旧判断及上述证据，不删除历史理由；原 PRD/design 中对应“明确不做”待功能实施时正式反转并补 AC/DEC/CON。

| 批次 | 待做 | 完成判据 |
| --- | --- | --- |
| A：指标口径 | OVR-01/02/03/04 | 显存/磁盘全链路，GPU 使用与分配独立，scheduled/error/unschedulable 标签逐项对账；缺值、零、单位与小数单测 |
| B：工具与组件 | OVR-05/06/08 | 同用户同集群 kubeconfig 只读查看/下载，权限和安全；六类组件入口及过滤；可见性只读展示 |
| C：首页与排行 | OVR-07 | 全局 Top5、九类排序、IP/控制面/下钻；大于五节点的模拟响应与真实只读查询分开报告 |
| D：最终验收 | 全部八项 | 旧能力清单逐项对应新 AC/spec/测试；新旧首屏与全页截图，部署新版复核后才宣称生产完成 |

- [x] 拆分六个旧区块，建立八项差异登记与请求→模型→显示对照。
- [x] 保存新旧 1600×900 首屏、全页及旧排行菜单截图。
- [x] 只读探测缺失指标、scheduler 标签、排行和实际组件路径。
- [x] 更新迁移指导、执行计划、能力矩阵与前批记录的结论边界。
- [ ] 实施 A/B/C，同步 PRD/design、YAML 与镜像 Python，不以本报告冒充功能交付。
- [ ] 新增“旧功能覆盖率”检查：未映射旧能力数、未经证明的承接数必须为零；先人工表，后自动化。
- [ ] 在新版真实部署复核 ingress/TLS/权限，补大于五节点、member、403 与 kubeconfig 安全验收。

## 8. 防止再次发生的交付证据

每个概览/详情页至少交付：旧组件树及条件、可见字段与动作、指标/标签/单位矩阵、同角色同集群的截图、
每项差异归宿、替代页面等价证据、相关 AC/spec/测试和部署复核状态。
**“有路由”“有同名卡片”“另页有类似列表”“门禁全绿”均不能单独证明功能完整。**
