# 性能 · 技术方案（L3）

## 概述

性能页通过 `monitoring.kubesphere.io/v1alpha3` 查询 JuiceFS 客户端指标（`juicefs_*`），六张图按节点各一条曲线。指标来自每节点一个 mount pod 的 `:9567/metrics`。

## 关联需求

- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-05`

## 设计目标与非目标

**目标**：六张图能解释「为什么慢」；单位与语义一致；空闲时给空态而不是零线；指标未开启时给出配置提示；需要时能主动测一次吞吐，把「慢」和「闲」分开。

**非目标**：不做告警、不做按模型归因、不做定时压测与长期历史。

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

### DEC-L3-CLUSTER-STORAGE-SHARED-STORAGE-PERFORMANCE-04 — 主动测试跑一次性 Job，不 exec mount pod

- **为什么**：mount pod 自己看到的文件系统是**只读**的（客户端 `.config` 里 `ReadOnly: true`），在那里跑 bench 会直接 `Read-only file system`。可写路径是 CSI 给 PVC 在节点上建的挂载点，而那个路径只存在于「挂载了这个 PVC 的 Pod」里——一次性 Job 正好提供这个上下文，还能用 `activeDeadlineSeconds` 和资源上限把测试关住。
- **被否方案**：`kubectl exec` 进 mount pod 再 remount rw。要改驱动行为，且测的是 mount pod 的视图而不是业务 Pod 实际看到的路径。
- **被否方案**：让前端直连对象存储测速。测的是 S3 而不是 JuiceFS 客户端 + 缓存这一整条路径，回答不了「模型加载为什么慢」。
- **何时重新考虑**：如果驱动以后给 mount pod 挂可写视图，可以直接在那里测，省掉 Job 的调度延迟。

### DEC-L3-CLUSTER-STORAGE-SHARED-STORAGE-PERFORMANCE-05 — 只测大文件，参数只开放文件大小与线程数

- **为什么**：页面要回答的是吞吐。小文件与元数据项（`juicefs bench` 的 small-file 与 stat 部分）测的是另一件事，而且耗时随文件数线性增长，放进一个要等结果的页面不合适。用 `--small-file-size 0` 关掉。
- **被否方案**：暴露块大小、small-file-count 等全部参数。配置项越多，越容易选出一组互相矛盾的值，而结果也没有可解释性。
- **何时重新考虑**：要做元数据专项压测时，单独一个入口。

## 系统现状

- 页面：`console/src/pages/clusters/containers/Storage/JuiceFS/Performance/index.jsx`
- 指标模板：`kube-server/pkg/simple/client/monitoring/prometheus/promql.go`
- 白名单：`kube-server/pkg/models/monitoring/named_metrics.go`

## 仓库落点

| 层 | 路径 |
| --- | --- |
| 页面 | `console/src/pages/clusters/containers/Storage/JuiceFS/Performance/index.jsx` |
| 主动测试面板 | `console/src/pages/clusters/containers/Storage/JuiceFS/Performance/BenchPanel/index.jsx` |
| 状态 | `console/src/stores/juicefs.js`（`fetchPerformance`、`startBench`、`fetchBench`、`fetchBenches`） |
| 指标模板 | `kube-server/pkg/simple/client/monitoring/prometheus/promql.go` |
| 白名单 | `kube-server/pkg/models/monitoring/named_metrics.go` |
| 抓取配置 | `ks-installer/roles/common/files/juicefs/templates/mount-monitor.yaml` |
| 主动测试接口 | `kube-server/pkg/kapis/juicefs/v1alpha1/bench.go`、`handler.go`（`startBench` / `getBench` / `listBenches`） |

## 对外契约

- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — 指标名 `juicefs_read_bytes`、`juicefs_written_bytes` 返回**字节/秒**；`juicefs_cache_read_latency`、`juicefs_fuse_latency` 返回**秒**；`juicefs_cache_hit_ratio` 返回 0..1。
- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — 每条序列带 `instance`（`IP:port`），按节点区分。
- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03** — `POST /kapis/juicefs.kubesphere.io/v1alpha1/volumes/{pv}/bench` 接受 `{fileSizeMiB, threads}`（都可省略，默认 256 / 1，上限 1024 / 4），返回 `BenchStatus{name, volume, phase, ...}`；同一卷已有 Pending/Running 的 Job 时返回 409。`GET /bench/{job}` 与 `GET /bench` 返回同一结构，`phase` 取 `Pending|Running|Succeeded|Failed`，成功时 `result` 里的吞吐单位是 **MiB/s**。

## 不变量

- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — 页面上的单位与接口返回的物理量一致：字节速率不显示为 bit 速率。
- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — 页面文本里不出现未翻译 key（`*_PL`、`*_DESC`）。
- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03** — 主动测试的写入量不超过 1024 MiB × 线程数，且 `activeDeadlineSeconds` 保证它不会一直跑；Job 完成后自己删除测试目录。
- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04** — 同一卷同一时刻最多一个测试 Job。

## 已知坑

- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — `juicefs_fuse_read_size_bytes` 是 histogram，只有 `_sum`/`_count`，没有裸指标名；`rate(juicefs_fuse_read_size_bytes[5m])` 永远为空。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — mount pod 用 hostNetwork，不声明容器端口，PodMonitor 的端口过滤会一个 target 都匹配不到；抓取要用每节点静态 target + `additionalScrapeConfigs`。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03** — 只加 PromQL 模板不登记白名单，`metrics_filter` 匹配不到，接口返回 `results: null`。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04** — mount pod 里的 `/jfs/<volume-id>` 是只读挂载（客户端 `.config` 的 `ReadOnly: true`），在那里跑 bench 会立刻 `Read-only file system`。测试必须挂在业务 PVC 上。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-05** — `juicefs bench` 默认先 drop 内核页缓存（需要 root 写 `/proc/sys/vm/drop_caches`），Job 里做不到，会打一行看起来像失败的警告。必须显式 `SKIP_DROP_CACHES=true`，并在结果旁注明读是热缓存。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-06** — bench 的表格是给人看的，客户端认为 stdout 是终端时会带 ANSI 颜色，直接按数字解析会得到 0。解析前要剥掉转义序列。

## 测试与可观测

- L3 用例：有流量时六图有曲线且单位正确（`TC-...-PERFORMANCE-01`）、空闲时空态与未翻译 key（`TC-...-PERFORMANCE-02`）。
- 指标未开启的场景由 `metricsEnabled` 驱动，页面显示提示而非空图。
- 主动测试：`TC-...-PERFORMANCE-03` 发起一次 256 MiB / 1 线程的测试，断言结果里有写、读两个吞吐（`MiB/s`）与每文件耗时；后端单测覆盖日志解析（含 ANSI 颜色、失败无表格）与并发 409。

## 后续改进

- 命中率与延迟加 95 分位线。
- 主动测试保留更长的历史并画趋势，用来对比两次改配前后的差异。
- 增加元数据专项（small file / stat）入口。

## 验收用例

- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01`
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02`
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03`
