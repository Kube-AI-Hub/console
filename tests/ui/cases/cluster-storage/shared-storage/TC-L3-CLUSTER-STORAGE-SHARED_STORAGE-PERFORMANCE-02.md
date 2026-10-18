# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02 性能 · 空闲区间的空态

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `performance`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/performance`
- **需求**: `prd/cluster-storage/shared-storage/performance.md`

## 产品功能

所选区间内没有读写时，读写图给出空态而不是零线。

### 关联需求

- `prd/cluster-storage/shared-storage/performance.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/performance.md`](../../../../prd/cluster-storage/shared-storage/performance.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02** — Given 所选区间内没有读写（全部为 0），When 查看读/写吞吐图，Then 显示「该时间范围内无读写」而不是一条零线；其余图照常显示。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/performance.md`](../../../../design/cluster-storage/shared-storage/performance.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/performance.md`](../../../../prd/cluster-storage/shared-storage/performance.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，看清每个节点上的读写吞吐与缓存命中率


**Independent Test**：打开 `/clusters/default/juicefs-storage/performance`，选「最近 1 小时」：六张图各出现曲线（有流量时）或「该时间范围内无读写」文案（无流量时）；读吞吐的单位是 `B/s` 系（不是 `Mbps`）；标题里有当前值与区间合计。

## 前置与配置

- 已登录，且在 default 集群
- mount pod 的 metrics 已开启

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/performance
2. 选择「最近 10 分钟」
3. 如果读吞吐与写吞吐的曲线全为 0，核对图上是否出现「该时间范围内无读写」

## 期望结果

- 无流量时显示空态文案，不画零线
- 有流量时正常画曲线（此时本用例跳过空态断言）

## 失败排查

- 空态不出现时确认页面是否把「全 0」误判成有数据

## 产品改版后如何更新自动化

- 空态文案变化时改 locales
