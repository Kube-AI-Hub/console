# 性能 · 技术方案（L3）

## 概述

性能页通过 `monitoring.kubesphere.io/v1alpha3` 查询 JuiceFS 客户端指标（`juicefs_*`），六张图按节点各一条曲线。指标来自每节点一个 mount pod 的 `:9567/metrics`。

## 关联需求

- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04`

## 设计目标与非目标

**目标**：六张图能解释「为什么慢」；单位与语义一致；空闲时给空态而不是零线；指标未开启时给出配置提示。

**非目标**：不做告警、不做按模型归因。

## 关键约束

- 指标名必须在 `named_metrics.go` 白名单里，模板在 `promql.go`。
- 单位：字节速率 `throughput`、延迟 `second`、比率 `%`、错误 `次/秒`。

## 方案决策

### DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01 — 吞吐用 `throughput`，不用 `bandwidth`

- **为什么**：JuiceFS 客户端给的是**字节**速率。`bandwidth` 会按 bit 换算（`1024**2/8` 才是 1 Mbps），MiB/s 会被显示成 Mbps，差 8 倍且语义错。此前页面就显示成 `0 Mbps`。
- **被否方案**：在页面里自己乘 8。等于把单位约定散落到每个图。
- **何时重新考虑**：展示网络链路速率时用 `bandwidth`（那是 bit/s 的事实）。

### DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02 — 延迟用 `second`，并保证 `unit` 不为空

- **为什么**：`getSuitableUnit` 只认 `second`/`cpu`/`memory`/`throughput`/`bandwidth` 等已注册的 `unitType`；传 `time` 会返回空单位，`MediumArea.renderTitle` 于是走 `t(\`${title}_PL\`)`，页面出现 `缓存读延迟_PL`。
- **被否方案**：给 `UnitTypes` 新增 `time` 别名。会让「单位」这件事有两个名字，下次还会错。
- **何时重新考虑**：`utils/monitoring.js` 统一改为按指标类型推导单位时。

### DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03 — 标题显示「当前值 + 区间合计」，空区间给空态

- **为什么**：指标是瞬时速率（`rate(...[5m])`）。实测 8 小时窗口 103 个点全为 0，但 `increase(...[8h])` 是 4.1 GiB——空闲时段只画零线，运维会以为「存储坏了」。区间合计说明「这段时间确实有流量，只是此刻没有」。
- **被否方案**：改画累计量。曲线会一直上升，读不出「现在快不快」。
- **何时重新考虑**：有更长的采样保留期、需要做容量规划时，另开一个「累计」视图。

## 系统现状

- 页面：`console/src/pages/clusters/containers/Storage/JuiceFS/Performance/index.jsx`
- 指标模板：`kube-server/pkg/simple/client/monitoring/prometheus/promql.go`
- 白名单：`kube-server/pkg/models/monitoring/named_metrics.go`

## 仓库落点

| 层 | 路径 |
| --- | --- |
| 页面 | `console/src/pages/clusters/containers/Storage/JuiceFS/Performance/index.jsx` |
| 状态 | `console/src/stores/juicefs.js`（`fetchPerformance`） |
| 指标模板 | `kube-server/pkg/simple/client/monitoring/prometheus/promql.go` |
| 白名单 | `kube-server/pkg/models/monitoring/named_metrics.go` |
| 抓取配置 | `ks-installer/roles/common/files/juicefs/templates/mount-monitor.yaml` |

## 对外契约

- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — 指标名 `juicefs_read_bytes`、`juicefs_written_bytes` 返回**字节/秒**；`juicefs_cache_read_latency`、`juicefs_fuse_latency` 返回**秒**；`juicefs_cache_hit_ratio` 返回 0..1。
- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — 每条序列带 `instance`（`IP:port`），按节点区分。

## 不变量

- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — 页面上的单位与接口返回的物理量一致：字节速率不显示为 bit 速率。
- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — 页面文本里不出现未翻译 key（`*_PL`、`*_DESC`）。

## 已知坑

- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — `juicefs_fuse_read_size_bytes` 是 histogram，只有 `_sum`/`_count`，没有裸指标名；`rate(juicefs_fuse_read_size_bytes[5m])` 永远为空。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — mount pod 用 hostNetwork，不声明容器端口，PodMonitor 的端口过滤会一个 target 都匹配不到；抓取要用每节点静态 target + `additionalScrapeConfigs`。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03** — 只加 PromQL 模板不登记白名单，`metrics_filter` 匹配不到，接口返回 `results: null`。

## 测试与可观测

- L3 用例：有流量时六图有曲线且单位正确（`TC-...-PERFORMANCE-01`）、空闲时空态与未翻译 key（`TC-...-PERFORMANCE-02`）。
- 指标未开启的场景由 `metricsEnabled` 驱动，页面显示提示而非空图。

## 后续改进

- 命中率与延迟加 95 分位线。

## 验收用例

- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01`
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02`
