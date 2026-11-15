# 集群监控（L3）

[子模块需求](./_index.md)

## 概述

集群资源用量随时间的变化：CPU 使用率、内存使用率、运行中的容器组、在线节点四个趋势。时间窗为最近 1 小时 / 6 小时 / 24 小时 / 7 天。

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

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — 已知监控后端可用，当打开集群监控，则四个卡片分别显示 CPU 使用率、内存使用率、运行中的容器组、在线节点，每张卡片有一条曲线与最小/最大/当前三个数值；CPU 与内存的当前值为 0–100 的百分比（由用量除以总量算出），容器组与节点为整数计数。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 已知在集群监控页，当切换时间窗（1 小时 → 24 小时），则以新的起止时间重新取数，曲线与当前值更新；单条曲线的采样点数不超过 200（窗口越大步长越大）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 已知监控后端可用，当打开集群监控，则除 CPU/内存/容器组/节点外，还显示异常容器组数、已完成容器组数、1/5/15 分钟平均负载、磁盘使用率、inode 使用率、网络发送与接收速率，共 13 张卡片；磁盘使用率由「已用容量 / 总容量」算出（0–100 的百分比），inode 使用率把 API 返回的 0–1 比值换算为百分比，网络速率以 B/KiB/MiB/GiB 每秒显示，平均负载保留两位小数；任一指标在窗口内没有数据时该卡片显示空态说明而不是 0。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 已知监控后端可用，当打开集群监控，则除主机资源外还按分组显示 GPU、磁盘 I/O、网络与 RDMA 趋势：GPU 组含显存使用率、GPU 使用率（API 的 0–1 比值换算为百分比）与已分配 GPU 卡数（整数）；磁盘 I/O 组含读/写吞吐（B/KiB/MiB/GiB 每秒）与读/写 IOPS（两位小数）；RDMA 组含健康度、端口可用率（已启用端口数 ÷ 总端口数）、发送/接收速率、链路速率（API 以 bit/s 返回，显示为 Gb/s）、接收错误数、重传数、丢弃数与链路中断数；每个分组有标题且卡片顺序与分组顺序一致（GPU → 主机资源 → 磁盘 I/O → 网络 → RDMA），全页共 29 张卡片（GPU 3 + 主机资源 11 + 磁盘 I/O 4 + 网络 2 + RDMA 9）；任一指标无数据时该卡片显示空态说明而不是 0；节点详情的监控沿用同一组件，只显示节点作用域的 CPU/内存/容器组三张卡片。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04** — 已知集群监控页已加载，当点「自动刷新：关」按钮，则按钮变为「自动刷新：开」且每 5 秒以当前时间窗重取一次（窗口向前滚动），期间曲线与当前值持续更新；当再次点击关闭，则不再发起定时请求。离开页面时定时器必须停止。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06** — 已知监控后端可用且组件指标端点可读，当打开集群监控，则在物理资源分组之后显示「系统组件」分区，按固定顺序含 APIServer、Scheduler、etcd 三个子组；APIServer 子组显示请求速率（总数，次/秒）与请求延迟（总平均 + 按 `verb` 多序列，接口返回的秒值 ×1000 显示为 ms）；按 verb 的延迟按 `verb` 标签身份合并成多条线，同一 verb 一条线、不同 verb 不混成一条，整条为 `NaN` 的序列（本部署的 APPLY）不画成 0 线；Scheduler 子组显示调度尝试次数（按 `result` 分 scheduled/error/unschedulable，累积计数用整数）与调度尝试速率（同 result 三条线，次/秒），两者单位不同；多序列卡片带图例，图例项与线的身份一致；本部署 scheduler 调度延迟（平均值与分位）没有序列时该卡片显示空态说明而不是 0；APIServer 与 Scheduler 的当前值与同一次接口响应、同一时间窗的序列交叉核对一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07** — 已知本集群 `components/etcd` 请求成功但每条指标都返回 0 条序列，当打开集群监控，则 etcd 子组显示「本集群未上报该组件指标」的说明与可能原因，不显示 0 值卡片、不显示空白表格、也不整组消失；当某个组件请求失败（如 5xx）时该子组显示错误说明与重试按钮且可重试；当失败为无权限（403）时该子组显示权限说明且不显示重试按钮；无数据、错误、无权限三种画面互不顶替，某个组件失败时其余有数据的组件子组保持可用。

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
- 组件指标可能整组没有序列（本部署 etcd），页面必须如实说明，不能填 0。
- 只读。

## UI 交互设计

- 顶部标题 + 时间窗按钮组（互斥，当前项高亮），窄屏换行。
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

## 明确不做

- 节点/容器组级别的下钻与排行：老 console 的「物理资源」「节点用量排行」是独立页面，另做。
- 独立路由的 etcd / apiserver / scheduler 监控页：旧 console 是三个独立页签；本轮改为在集群监控页内以「系统组件」分区承载（见 `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06` / `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`），独立路由不再需要。
- etcd 节点级服务状态卡（在线 / 有 leader / leader 变更次数，旧 `ETCDNodes`）：本部署无 etcd 指标序列，无法验收；登记为待补，不以组件页健康数冒充。
- 告警阈值线叠加：需要知道每条规则的阈值，规则体里没有统一字段。

## 假设

- range query 返回 `matrix`；若返回 `vector`（忽略 range 参数），按单点处理而不是当作趋势。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — range query 读取四条（含两条总量）序列，窗口决定步长。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 百分比由用量 ÷ 总量按时间戳配对计算。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03** — 无数据时说明，不画零线。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04** — 组件指标走 `/components/<module>` range 查询，多序列按 verb/result/quantile 标签身份合并与着色。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05** — 组件无数据、错误、无权限分别呈现；无数据不填 0。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01** — 百分比在 0–100 之间；窗口切换后重新取数。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-02** — 组件分区三个子组齐全；多序列身份不混淆；etcd 无数据如实说明；无权限不给重试。
