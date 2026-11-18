# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12 集群监控 · 概览页签：节点环图 / 厂商构成图 / 组件磁贴 / 7 指标主图与明细 / RDMA 摘要

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{{BASE_URL}}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

概览页签先给「集群整体是否正常」的图形答案：节点在线环图（healthy/total 与百分比文本）、XPU 厂商构成环图（图例行含厂商名/数量/百分比）、组件状态 3×2 磁贴与核心组件一行；再给集群资源用量：左侧 7 行指标的当前值 used/total，右侧一张带坐标轴/网格/读数的大图；下方 RDMA 摘要与「查看 RDMA 趋势」按钮切到物理资源页签。任一指标缺失显示 «-» 与空态说明，不填 0，也不画零线。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12** — 已知集群就绪且监控查询可用，当打开概览页签，则页签内容 `cluster-monitor:overview` 自上而下为状态行、集群资源用量、RDMA 摘要：状态行三块同高——节点在线环图（`cluster-monitor:overview:node-ring`，内文为健康节点数/总节点数，百分比文本 `cluster-monitor:overview:node-ring:value` 等于健康节点数÷总节点数、最多一位小数（验收断言允许 ±1 个百分点舍入误差），点击进入该集群节点页；`totalNodes` 缺失显示「未上报」、为 0 显示空态说明，不显示 0/0）、节点 XPU 厂商构成环图（`cluster-monitor:overview:vendor-donut`，按数量降序列出各厂商标段与 HTML 图例，每行 `cluster-monitor:overview:vendor:<vendor>` 含厂商名、节点数与百分比，百分比=该厂商节点数÷各厂商计数之和×100；`healthy`/`total` 不计入厂商行与分母；`CPU` 行表示无 XPU 的节点、显示真实节点数且不是空态，各厂商计数合计为 0 时只显示空态说明且不渲染环图）、组件状态（`cluster-monitor:status:components`，含 6 个服务组件磁贴与 etcd/controller-manager/scheduler 三个核心组件，语义与既有 ClusterStatusSection 相同；宽屏按 3 列 2 行排列、窄屏堆叠）；资源用量区左侧为 7 行指标（`cluster-monitor:overview:usage`，每行 `cluster-monitor:overview:usage:<key>`，key 依次为 gpuMemory|gpu|gpuAllocated|cpu|memory|disk|pods），每行显示名称与 used/total 当前值（文本 `cluster-monitor:overview:usage:<key>:value`），右侧为大图 `cluster-monitor:overview:usage-chart`（TrendChart 带坐标轴/网格/交互读数，图例 `cluster-monitor:overview:usage-chart:legend`）；默认选中第一行，点击某行切换大图指标，当前值单位按行分别为 bytes（B/KiB/MiB/GiB）、卡/核/个（整数）与百分比（0–1 比率×100）；任一行缺少 used 或 total 序列时显示「-」且对应大图为空态说明，不显示 0 也不画零线；比率类数值允许大于 100%（超配不截断，图轴上限取数据峰值）；RDMA 摘要 `cluster-monitor:overview:rdma` 显示端口 up/total、发送/接收速率与接收错误数，缺失项显示「-」；「查看 RDMA 趋势」按钮 `cluster-monitor:overview:view-rdma` 选中物理资源页签并写回 `?tab=resource`，不新增路由；查询加载中显示骨架、主查询无数据显示空态说明、失败显示错误说明与重试（403 无重试）。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US9 - 概览用环图/构成图呈现，并保留主图与明细 (Priority: P1)

作为 **集群管理员**，我希望 **在概览用节点环图与厂商构成环图先看「构成是否健康」，再用一张大图对比资源趋势、左侧保留 7 个当前值**，以便 **一眼看出节点健康与厂商构成，也知道当前用量是多少，而不是只有数字和进度条**。

**Independent Test**：概览状态行三块都有图形或磁贴形态；节点环图内文为健康/总节点数与百分比且与同次接口一致；厂商构成图图例每行含名称、数量与百分比；左侧 7 行用量与右侧大图指标一致，点行切换大图且单位正确；缺指标的行显示「-」，不显示 0。

## 前置与配置

- 已登录 admin，集群 host 已就绪
- componenthealth、nodes/stats 可读；监控 range query 可用

## 测试步骤

1. 用 API 读取 componenthealth 的 nodeStatus、nodes/stats 的各厂商计数，以及一次 range 查询取契约 §4 的 7 组成对指标与 RDMA 摘要指标
2. 打开 /kube-frontend/clusters/host/monitor（overview 页签），等待 surface 就绪
3. 核对概览页签内节点环图存在：文本为 healthy/total，cluster-monitor:overview:node-ring:value 为百分比且与 healthy÷total 一致
4. 核对厂商构成环图存在，图例行集合等于 nodes/stats 除 healthy/total 外的厂商键；逐行核对名称、数量与百分比（数量÷各厂商计数之和），合计约 100%
5. 核对组件状态磁贴 cluster-monitor:status:components 内的 6 个服务磁贴与 3 个核心组件行可见，data-ai-status 语义与同页 ClusterStatusSection 一致（本用例只断言存在与语义属性，不重复 MONITOR-08 的逐行数据核对）
6. 核对用量列表恰好 7 行且 key 顺序为 gpuMemory / gpu / gpuAllocated / cpu / memory / disk / pods；逐行读取 cluster-monitor:overview:usage:<key>:value，与 API 的 used/total 交叉核对（字节类按 B/KiB/MiB/GiB/TiB 换算后比较，比率类为百分比，计数类为整数）
7. 核对右侧主图 cluster-monitor:overview:usage-chart 画出了曲线、有坐标轴刻度与图例 :usage-chart:legend；切换左侧指标后主图对应指标变化（或按实现的选中态断言）
8. 核对 RDMA 摘要区 cluster-monitor:overview:rdma 有端口/吞吐/错误等数值；点「查看 RDMA 趋势」后核对切到 resource 页签（?tab=resource、resource 面板可见），地址仍在本页、不新增路由
9. 用 page.route 让 range query 返回 200 且 results 为空，重新打开页签：核对 7 行当前值显示 «-»、主图显示 cluster-monitor:overview:usage-chart:empty 说明、没有零线；移除拦截后恢复
10. 测量状态行三块（节点环图 / 厂商构成图 / 组件磁贴）的 getBoundingClientRect：宽屏 top 对齐、同高；主图区宽度明显大于左侧指标列表

## 期望结果

- 节点环图显示 healthy/total 与百分比，数字与 componenthealth 一致；厂商构成图行数与占比与 nodes/stats 一致
- 组件状态磁贴 6+3 齐全，保留 data-ai-status 语义
- 用量 7 行 key 与顺序固定；当前值与 API used/total 一致；比率类按百分比显示、缺失显示 «-»
- 主图有曲线、坐标轴与图例，且随选中指标变化；RDMA 摘要与按钮存在，按钮切到物理资源页签
- 无数据时行显示 «-»、主图给出 :empty 说明，不出现零线
- 宽屏三块同排同高，主图区显著大于左侧列表；窄屏无横向溢出

## 失败排查

- 环图不出现：DonutChart/MetricRing 未渲染或数据为 0 时直接消失（应为空态说明）
- 百分比是 1.00% 量级：把 0–1 比值当百分比直接打印，缺 ×100
- 用量行出现 0：缺值被默认成 0，应从接口缺失走到 «-» 与空态
- 主图无坐标轴：TrendChart 没有传 showAxes/showGrid/interactive
- 点「查看 RDMA 趋势」整页刷新：按钮用了 <a href> 而不是 onTabChange

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:overview:node-ring[:value] / :overview:vendor-donut / :overview:vendor:<vendor> / :overview:usage / :overview:usage:<key>[:value] / :overview:usage-chart[:legend|:empty] / :overview:rdma / :overview:view-rdma / :status:components[:service:<ns>|:core:<key>]
