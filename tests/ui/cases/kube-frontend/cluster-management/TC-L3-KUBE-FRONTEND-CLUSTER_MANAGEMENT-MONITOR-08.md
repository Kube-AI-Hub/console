# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08 集群监控 · 集群状态分区（节点在线 / XPU 厂商 / 组件状态）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

概览页签最上方是「集群状态」状态行（位于资源用量之前）：节点在线环图（healthy/total + 百分比）、XPU 厂商构成环图（图例含名称/数量/百分比）、组件状态 3×2 磁贴（6 个服务组件 + etcd/controller-manager/scheduler 核心组件）；宽屏三块同排、窄屏堆叠。自动刷新开关同时驱动状态行的 componenthealth / nodes/stats / etcd ServiceMonitor 三查询。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08** — 已知集群已就绪且 componenthealth（`/kapis/[clusters/{c}/]resources.kubesphere.io/v1alpha2/componenthealth`）与 nodes/stats（`/kapis/[clusters/{c}/]resources.kubesphere.io/v1alpha3/nodes/stats`）可读，当打开集群监控，则在趋势分组之前显示「集群状态」分区，含节点在线状态、节点 XPU 厂商分布、组件状态三块；节点在线状态显示健康节点数/总节点数（形如 1/1）与在线比例，点击进入该集群节点页，totalNodes 缺失显示「未上报」、为 0 显示空态说明而不是把 0/0 当正常；厂商分布按 nodes/stats 中除 healthy/total 外的全部厂商键列出节点数与占比（占比=该厂商节点数÷各厂商节点数之和，healthy/total 不计入），按数量降序；CPU 键表示集群中没有 XPU 的节点数量，按 CPU 行显示（文案取 node.vendor.*），不是空态；仅当各厂商计数合计为 0（无节点或未上报）时显示空态说明；组件状态含服务组件 6 项（kubesphere-system=Kube AI Hub、kube-system=Kubernetes、istio-system=服务网格、kubesphere-monitoring-system=监控、kubesphere-logging-system=日志、kubesphere-devops-system=DevOps），每项为命名空间内 healthyBackends 之和 ÷ totalBackends 之和，集群 configz 未启用的模块显示「未安装」；核心组件三项 etcd/controller-manager/scheduler 中 controller-manager 与 scheduler 按 label.component 匹配且 healthyBackends>0 判为正常、否则异常/未上报，etcd 按 kubesphere-monitoring-system/etcd ServiceMonitor 是否存在判为「已接入监控/未接入」；三块宽屏同排、窄屏堆叠，分区标题与趋势分组标题同级。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-10** — 已知集群监控页已就绪且「集群状态」分区已加载，当打开「自动刷新：开」，则在 5 秒内 componenthealth、nodes/stats、etcd ServiceMonitor 三个查询各再次发起一次并按新响应更新（状态分区数字刷新，已有内容不被加载骨架整体遮挡）；当再次点击关闭，则不再发起这三类定时请求；离开页面时定时器停止。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 先看集群状态再看趋势 (Priority: P1)

作为 **集群管理员**，我希望 **在趋势之前先看到节点在线状态、XPU 厂商分布与组件状态**，以便 **先判断集群整体是否正常，再决定看哪条趋势——一屏曲线回答不了「集群是不是坏了」**。

**Independent Test**：在就绪集群打开监控，核对「集群状态」分区在趋势分组之前、三块都有与接口一致的数字；未启用的模块显示「未安装」，无 XPU 节点时厂商块显示空态说明。

## 前置与配置

- 已登录，且集群 host 已就绪
- componenthealth（/kapis/resources.kubesphere.io/v1alpha2/componenthealth）与 nodes/stats（/kapis/resources.kubesphere.io/v1alpha3/nodes/stats）返回 200
- KubeSphere 监控的 range query 与组件指标可用

## 测试步骤

1. 用 API 读取 componenthealth 的 nodeStatus、kubesphereStatus，nodes/stats 的厂商计数，configz 的模块开关与 etcd ServiceMonitor 状态
2. 打开集群监控（默认 overview），等待 cluster-monitor:surface 就绪
3. 核对状态行三块齐全，且位于资源用量（cluster-monitor:overview:usage）之前
4. 核对节点环图 healthy/total（1/1）与百分比（健康÷总数，最多一位小数，±1 个百分点内一致），节点入口指向该集群节点页
5. 逐行核对厂商构成图图例：行集合等于 nodes/stats 除 healthy/total 外的厂商键；数量与占比（数量÷各厂商计数之和×100）与接口一致；host 为 cambricon 1、100%
6. 逐行核对 6 个服务组件磁贴与 3 个核心组件；未启用模块显示未安装、无记录显示未上报；etcd 按 ServiceMonitor 显示已接入/未接入
7. 测量三块 getBoundingClientRect：宽屏 top/高度对齐、间距一致；分区标题与资源用量标题 font-size 一致
8. 用 page.route 计数 componenthealth / nodes/stats / etcd ServiceMonitor：点「自动刷新：开」后 15s 内三类各至少重取一次且已有内容不被骨架遮挡；关闭后 8s 内不再新增
9. 把 viewport 收窄到 900，核对三块纵向堆叠且页面无横向溢出

## 期望结果

- 状态行在概览页签内、资源用量之前；宽屏三块同排（top 差≤2px、高度差≤2px），窄屏堆叠
- 节点在线 1/1，百分比=健康÷总数（最多一位小数，±1 内一致），入口指向 /kube-frontend/clusters/host/nodes
- 厂商构成图图例按数量降序，行数与 nodes/stats 厂商键一致；cambricon 数量 1、占比 100%（不是旧页的 1.00%）
- 6 个服务组件磁贴与 3 个核心组件齐全，状态与接口聚合一致；未启用=未安装、无记录=未上报，不显示 0/0
- 自动刷新开启时三查询各按 5s 节拍重取且已有内容不被骨架整体遮挡；关闭后不再发起这三类定时请求
- 900 宽下三块纵向堆叠、无横向溢出；概览的资源用量区（7 行当前值 + 主图）仍在

## 失败排查

- 厂商占比显示 1.00%：把 0..1 的比例当成了百分数，应 ×100 后加 %
- 服务组件显示 0/0：把「没有记录」当成了健康 0 后端，应显示未上报/未安装
- 状态行不在概览或跑到资源用量之后：检查 ClusterOverviewTab 的渲染顺序
- 三块没有同排/等高：检查网格断点与卡片根元素是否在同一 grid 容器
- 自动刷新只刷趋势：状态行三查询没有拿到 live/autoRefresh，refetchInterval 仍为 false

## 产品改版后如何更新自动化

- 状态行：cluster-monitor:status、cluster-monitor:overview:node-ring / :node-ring:count / :node-ring:value / :node-ring:link
- 厂商：cluster-monitor:overview:vendor-donut / :overview:vendor:<vendor>[:count|:percent]
- 组件：cluster-monitor:status:components:service:<namespace>[data-ai-status] / :components:core:<etcd|controller-manager|scheduler>[data-ai-status]
- 资源用量：cluster-monitor:overview:usage / :overview:usage:<key>
- 自动刷新：cluster-monitor:auto-refresh
