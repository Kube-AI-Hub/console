# 性能（L3）

## 概述

共享存储的第三屏。六张图：读吞吐、写吞吐、块缓存命中率、缓存读延迟、FUSE 操作延迟、对象存储错误。数据来自每个存储节点上 mount pod 里的 JuiceFS 客户端，按节点各一条曲线。运维在这里回答「模型加载为什么慢」：是缓存没命中、对象存储慢，还是客户端本身被压住。

## 用户故事

### US1 - 作为集群运维，看清每个节点上的读写吞吐与缓存命中率

**Independent Test**：打开 `/clusters/default/juicefs-storage/performance`，选「最近 1 小时」：六张图各出现曲线（有流量时）或「该时间范围内无读写」文案（无流量时）；读吞吐的单位是 `B/s` 系（不是 `Mbps`）；标题里有当前值与区间合计。

### US2 - 作为集群运维，确认单位与文案没有错

**Independent Test**：在同一页面检查六张图的标题：不出现 `_PL`、`_DESC` 之类未翻译 key；延迟图的单位是 `s` 或 `ms`；命中率是 `%`；错误是「次/秒」。

## 验收场景

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — Given 客户端指标已开启且有流量，When 打开性能页并选择最近 1 小时，Then 六张图都画出至少一条曲线，标题显示当前值与区间合计，读写的单位是 B/s 系。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — Given 所选区间内没有读写（全部为 0），When 查看读/写吞吐图，Then 显示「该时间范围内无读写」而不是一条零线；其余图照常显示。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03** — Given 性能页已渲染，When 检查六张图的标题与单位，Then 不出现未翻译 key，延迟为 s/ms、命中率为 %、错误为次/秒。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04** — Given 客户端指标未开启，When 打开性能页，Then 显示配置提示与开启步骤，而不是六张空图。

## 设计目标

- 图要能解释「为什么慢」：吞吐与命中率回答「是不是每次都在读对象存储」，延迟回答「是不是客户端在等」。
- 单位必须与数据语义一致：JuiceFS 客户端给的是**字节**速率，用 `bandwidth`（bit 换算）会把 MiB/s 显示成 Mbps，差 8 倍还会误导。
- 空闲不等于故障：没有流量时给出明确空态，不用零线伪装成「一直很慢」。

## 约束与边界

- 只读页面。
- 指标经 `monitoring.kubesphere.io/v1alpha3` 查询；指标名必须在后端白名单里登记。
- 时间范围由页面顶部的选择器控制，默认最近 8 小时。

## UI 交互设计

- 顶部：时间范围选择（最近 10 分钟 … 最近 7 天）+ 采样间隔说明。
- 图表两列，窄屏（<1280）一列；每张图 120px 高，标题在左上角。
- 标题格式：`<当前值> <单位>  <指标名>`，第二行是 `<区间合计> <单位> 区间合计`。

## 文案与校验

| key | 中文 | 用途 |
| --- | --- | --- |
| `SHARED_STORAGE_READ_THROUGHPUT` | 读吞吐 | 图标题 |
| `SHARED_STORAGE_WRITE_THROUGHPUT` | 写吞吐 | 图标题 |
| `SHARED_STORAGE_CACHE_HIT_RATIO` | 块缓存命中率 | 图标题 |
| `SHARED_STORAGE_CACHE_READ_LATENCY` | 缓存读延迟 | 图标题 |
| `SHARED_STORAGE_FUSE_LATENCY` | FUSE 操作延迟 | 图标题 |
| `SHARED_STORAGE_OBJECT_ERRORS` | 对象存储错误 | 图标题 |
| `SHARED_STORAGE_NO_TRAFFIC` | 该时间范围内无读写 | 空态 |
| `SHARED_STORAGE_RANGE_TOTAL` | 区间合计 | 标题副行 |

## 边界情况

- 区间内只有部分节点有流量：有流量的节点画线，没有的节点不画，但标题仍显示区间合计。
- 查询失败或指标为空：显示「暂无监控数据」，不显示 `_PL`。
- 时间范围很短（10 分钟）且采样间隔大：仍要显示至少一个点或空态。

## 功能需求

- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — 系统 MUST 用 `throughput` 渲染字节速率、`second` 渲染延迟、`%` 渲染命中率。
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — 系统 MUST 在区间内无流量时显示「该时间范围内无读写」。
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03** — 系统 MUST 在标题里同时给出当前值与区间合计。
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04** — 系统 MUST 在指标未开启时给出配置提示。

## 成功标准

- **SC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — 性能页六张图在 5 秒内完成首次渲染。
- **SC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — 页面文本中未翻译 key 数为 0。

## 明确不做

- 不做告警阈值配置。
- 不做按模型的读写归因。
- 不做 Prometheus 之外的指标源。

## 假设

- mount pod 的 metrics 端点已开启并被 Prometheus 抓取。
- 客户端指标名已在后端白名单与 PromQL 模板里登记。

## 验收用例

- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01`
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02`
