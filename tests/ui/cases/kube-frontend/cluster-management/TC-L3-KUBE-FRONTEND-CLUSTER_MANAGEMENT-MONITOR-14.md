# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14 集群监控 · API Server 页签：延迟（总均 + 按 verb）与请求速率大图

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{{BASE_URL}}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

API Server 监控是独立页签：请求延迟（总平均 + 按 verb 多条线，API 秒值 ×1000 显示 ms）与请求速率（总请求，次/秒）两张大图，带坐标轴、网格、图例与读数；组件查询与其它页签独立，加载/空/无权限/失败四种画面互不顶替，403 不提供重试。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14** — 已知集群就绪且组件指标可读，当打开「API Server 监控」页签，则显示两张带坐标轴与图例的大图：请求延迟 `cluster-monitor:apiserver:chart:latency`（总平均一条线 + 按 `verb` 合并的多条线，API 返回的秒值×1000 显示 ms 并保留两位小数；整条为 `NaN` 的序列不画成 0 线）与请求速率 `cluster-monitor:apiserver:chart:rate`（总请求速率，次/秒，两位小数）；多序列按 `verb` 身份合并且图例项与线一一对应，不按返回顺序配对；本页签查询与调度器页签独立，加载中显示骨架、无序列时显示空态说明而不是 0、失败显示错误说明与重试、403 显示无权限说明且无重试；本页签查询失败不影响其它页签。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US8 - 按使用场景进入五个页签并可直接深链 (Priority: P1)

作为 **集群管理员**，我希望 **打开监控后按场景在概览、物理资源、API Server、调度器、资源用量排行五个基础页签之间切换（etcd 接入监控时另有条件 etcd 页签），并能把某个页签直接存成链接**，以便 **在排查控制面变慢、磁盘 IO、RDMA 或资源排行时不用在一屏长页面里滚动寻找，刷新或分享后也不会丢失当前场景**。

**Independent Test**：打开监控默认在概览；点「调度器监控」后只显示调度器图表，地址栏出现 `?tab=scheduler`，刷新后仍停在调度器；五个页签都能通过 `?tab=` 直接打开；切页签不触发其它页签的查询；节点详情复用该页面时没有页签条。

### US4 - 分辨控制面哪个操作/结果出了问题 (Priority: P1)

作为 **集群管理员**，我希望 **看到 APIServer 的请求速率与延迟按 verb 分开、Scheduler 的调度尝试按 result 分开**，以便 **判断控制面是整体变慢还是某个操作（GET/PUT…）变慢、调度是成功还是失败了——只看一个总量会把「GET 变慢」和「调度失败」混成同一个数字**。

**Independent Test**：打开集群监控，核对「系统组件」分区的 APIServer 请求延迟图有 GET/POST/PUT 等多条线且图例按 verb 命名，Scheduler 调度尝试图有 scheduled/error/unschedulable 三条线，线与图例一一对应。

## 前置与配置

- 已登录 admin，集群 host 已就绪
- /kapis/monitoring.kubesphere.io/v1alpha3/components/apiserver 可读

## 测试步骤

1. 用 API 读 components/apiserver 的 window range query（与页面同窗口同 step），取延迟与请求速率指标及 verb 身份
2. 打开 /kube-frontend/clusters/host/monitor?tab=apiserver，等待面板就绪
3. 核对两张图 cluster-monitor:apiserver:chart:latency 与 :chart:rate 都可见、都画出曲线、都有图例与坐标轴
4. 核对延迟图按 verb 的多条线与图例身份一致：一个 verb 一条线，不同 verb 不混成一条；整条 NaN 的身份不画零线
5. 核对延迟显示单位为 ms（API 秒 ×1000），速率显示为次/秒；至少抽查一组图例读数与 API 同一时间窗末值数量级一致
6. 用 page.route 让 components/apiserver 返回 403：重新打开页签，核对无权限说明可见且没有重试按钮
7. 让 components/apiserver 返回 500：核对错误说明与重试按钮可见；点重试核对再次发起请求；移除拦截后重试恢复
8. 在 apiserver 处于 500 时切到 scheduler 页签，核对 scheduler 图仍正常（两个页签独立）

## 期望结果

- apiserver 页签两张图（latency/rate）齐全，有曲线、坐标轴、图例；延迟多条线按 verb 身份分开
- 延迟单位 ms（秒 ×1000），速率单位次/秒；数值与同窗口 API 响应一致
- 403：仅该页签显示无权限且无重试；500：错误说明 + 重试，且不影响 scheduler 页签
- 空数据（200 无序列）时对应图显示 :empty 说明而不是零线

## 失败排查

- 延迟数值小 1000 倍：秒没有 ×1000 就显示成 ms
- verb 多条线被合并：身份只用了 metric_name，没有按 verb 标签分组
- 403 出现重试：错误面板没有区分无权限分支
- 切到 scheduler 也失败：组件查询被提升到页面级共用 query key

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:apiserver:chart:<latency|rate>[:legend|:empty]
