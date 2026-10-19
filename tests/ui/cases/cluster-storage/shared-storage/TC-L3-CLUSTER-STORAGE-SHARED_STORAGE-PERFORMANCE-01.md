# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01 性能 · 图表与单位

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `performance`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/performance`
- **需求**: `prd/cluster-storage/shared-storage/performance.md`

## 产品功能

性能页六张图的标题、单位与空态。

### 关联需求

- `prd/cluster-storage/shared-storage/performance.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/performance.md`](../../../../prd/cluster-storage/shared-storage/performance.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01** — Given 客户端指标已开启且有流量，When 打开性能页并选择最近 1 小时，Then 六张图都画出至少一条曲线，标题显示当前值与区间合计，读写的单位是 B/s 系。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03** — Given 性能页已渲染，When 检查六张图的标题与单位，Then 不出现未翻译 key，延迟为 s/ms、命中率为 %、错误为次/秒。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04** — Given 客户端指标未开启，When 打开性能页，Then 显示配置提示与开启步骤，而不是六张空图。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/performance.md`](../../../../design/cluster-storage/shared-storage/performance.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/performance.md`](../../../../prd/cluster-storage/shared-storage/performance.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，看清每个节点上的读写吞吐与缓存命中率


**Independent Test**：打开 `/clusters/default/juicefs-storage/performance`，选「最近 1 小时」：六张图各出现曲线（有流量时）或「该时间范围内无读写」文案（无流量时）；读吞吐的单位是 `B/s` 系（不是 `Mbps`）；标题里有当前值与区间合计。

### US2 - 作为集群运维，确认单位与文案没有错


**Independent Test**：在同一页面检查六张图的标题：不出现 `_PL`、`_DESC` 之类未翻译 key；延迟图的单位是 `s` 或 `ms`；命中率是 `%`；错误是「次/秒」。

## 前置与配置

- 已登录，且在 default 集群
- mount pod 的 metrics 已开启且被 Prometheus 抓取

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/performance
2. 选择「最近 1 小时」
3. 读取六张图的标题与单位
4. 检查页面文本里是否有 _PL / _DESC 这类 key

## 期望结果

- 六张图都存在，标题依次为读吞吐 / 写吞吐 / 块缓存命中率 / 缓存读延迟 / FUSE 操作延迟 / 对象存储错误
- 读写的单位是 B/s 系（B/s、KiB/s、MiB/s、GiB/s），不是 Mbps
- 延迟的单位是 s 或 ms；命中率是 %；错误是次/秒
- 标题里有「区间合计」
- 没有未翻译 key

## 失败排查

- 显示 Mbps 说明用了 bandwidth 而不是 throughput
- 出现 _PL 说明 unitType 不被 getSuitableUnit 识别（例如 time）

## 产品改版后如何更新自动化

- 图表标题 key 变化时改 locales
