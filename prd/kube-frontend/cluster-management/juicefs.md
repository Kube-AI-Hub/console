# JuiceFS 共享存储（L3）

[子模块需求](./_index.md)

## 概述

集群级共享存储页 `/kube-frontend/clusters/<cluster>/juicefs-storage`，三个页签：**卷**（列出现有 JuiceFS 卷及其容量、已用、挂载点）、**用量**（集群总量与各卷用量条）、**性能**（客户端指标的时间趋势）。数据来自平台已有的 JuiceFS 聚合 API（卷清单与汇总，由 PV 与客户端 statfs 在服务端 join）与监控 API 的 `juicefs_*` 序列。

老 console 在「集群 → 存储 → JuiceFS 共享存储」下有三页签（概览 / 卷与配额 / 性能）。B200 上安装了 juicefs-csi，`kubesphere-system` 里有 juicefs-csi-controller/plugin，两个 API 都可用。

## 用户故事

### US1 - 定位共享存储写满或变慢的原因 (Priority: P1)

作为 **平台运维**，我希望 **在一个页面里看到共享卷的容量、已用与客户端性能**，以便 **在模型加载变慢或卷接近写满时，先判断是哪个卷、是容量问题还是缓存/延迟问题**。

**Independent Test**：打开集群级 JuiceFS 共享存储页，核对三个页签都可切换；卷页签行数等于 `/kapis/juicefs.kubesphere.io/v1alpha1/volumes` 返回的条数（0 条时显示空态）；用量页签显示卷数量与总容量；性能页签在指标可用时显示 9 个指标的统计与趋势。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01** — 已知集群里安装了 juicefs-csi 且有共享卷，当打开集群级 JuiceFS 共享存储页，则「卷 / 用量 / 性能」三个页签可见且可切换；卷页签行数等于 JuiceFS 接口返回的卷数（为 0 时显示空态），并列出名称、状态、容量、已用、挂载点数、创建时间；用量页签显示卷数量、总容量、已用容量、最高使用率与各卷用量；性能页签在指标可用时显示客户端指标的最新/平均/最大值与趋势，指标不可用时给出明确说明。

## 设计目标

1. 三个页签共用同一份卷清单，页面上的卷集合与顺序一致（不允许两个页签各请求一次再分叉）。
2. 只读：配额修改与 benchmark 属写操作，不在本页提供入口。
3. 性能页的单位必须与指标实际单位一致：吞吐 B/s、延迟 ms、比例 %，累计计数器不当作瞬时值展示。

## 约束与边界

- 卷与汇总只读平台 JuiceFS 聚合 API：`/kapis/juicefs.kubesphere.io/v1alpha1/{volumes,summary}`（成员集群在 kapis 与组名之间加 `clusters/<id>`）；不解析 CRD、不直连 JuiceFS 元数据引擎。
- 性能只读监控 API（`monitoring.kubesphere.io/v1alpha3`），指标名固定为 `juicefs_*`；页面不直连 Prometheus。
- 卷接口一次返回全部卷（无分页参数），页面不做服务端分页。
- 状态与创建时间来自 PV：JuiceFS 接口不重复 PV 元数据，页面额外读一次集群级 PV 列表做 join。

## UI 交互设计

- 页头：标题「JuiceFS 共享存储」+ 一句描述；下方是页签条（卷 / 用量 / 性能）。
- **卷**：表格六列——名称（第二行显示 JuiceFS 目录）、状态（PV 阶段徽章）、容量（不漂移时不带徽章）、已用（字节 + 使用率）、挂载点数（悬停显示节点名）、创建时间。
- **用量**：四张汇总卡（卷数量、总容量、已用容量、最高使用率）+ 存储节点一行 + 提示条（配额漂移、嵌套卷、指标关闭）+ 各卷用量条（按使用率降序，含 inode 用量）。
- **性能**：时间范围按钮（最近 1 小时 / 6 小时 / 24 小时）+ 指标表（指标、最新、平均、最大、趋势 sparkline）；区间内读写吞吐全为 0 时补一句「没有读写流量」。
- 加载中：骨架；失败：错误面板 + 重试；空：明确空态（没有卷 / 没有性能数据）。

## 文案与校验

- 标题与描述用 `cluster.juicefs.title/description`；其余文案用本轮新增的 `cluster.juicefs.*` 键（同时写中英文）。
- 容量用二进制单位（KiB/MiB/GiB/TiB）；吞吐在容量单位后加 `/s`；延迟换成毫秒保留两位；比例为一位小数。
- 状态由 PV 阶段翻译（已绑定 / 可用 / 已释放 / 失败），未知值原样显示。
- 没有创建时间（PV 未匹配）时显示 `-`，不显示 1970。

## 边界情况

- 卷数为 0：卷页签显示空态「暂无共享卷」；用量页签同样显示空态。
- 某个卷找不到同名 PV：状态与创建时间显示 `-`，其余列照常显示。
- 客户端容量与配额不一致（`quotaDrift`）：容量列带「配额漂移」徽章，用量页签另给提示条。
- 嵌套卷（`parent` 非空）：用量页签提示「目录位于另一卷之下，用量会计入父卷」。
- 集群未开启 JuiceFS 指标（`summary.metricsEnabled=false`）：性能页签不发表格，直接说明原因。
- 指标存在但区间内没有任何点：显示「暂无性能数据」空态。
- 读写吞吐全为 0：表格仍显示，另加「所选区间内没有读写流量」提示，避免被读成页面坏了。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01** — 三个页签（卷 / 用量 / 性能）的集群级 JuiceFS 共享存储页。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-02** — 卷清单与用量来自 JuiceFS 聚合 API，性能来自监控 API；缺数据时给出可解释的空态。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-03** — 性能指标按各自单位展示，累计计数器不当作瞬时值。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01** — 卷页签行数 = 接口返回条数；三个页签可切换且内容互不缺失；性能页签在 B200 上显示 9 个指标行。

## 明确不做

- 修改卷配额（老 console 的 `PUT /volumes/{name}`，会创建一次性 job 并在失败时回滚 PV）：写操作，需要作业状态与回滚的可观测，另立。
- benchmark（吞吐压测）面板：同属写操作，且需要作业轮询。
- 卷的生命周期管理（创建/删除卷）、跨集群视图。
- 页面直连 Prometheus 或解析 JuiceFS CRD。

## 假设

- 平台提供 JuiceFS 聚合 API，且卷的 `name` 与其 PV 名一致（B200 上已验证）。
- `juicefs_*` 指标由挂载客户端上报；`juicefs_cpu_usage` 是累计计数器，本页不展示。
- 卷数量级为个位数到几十，一次全量返回可接受。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01`
