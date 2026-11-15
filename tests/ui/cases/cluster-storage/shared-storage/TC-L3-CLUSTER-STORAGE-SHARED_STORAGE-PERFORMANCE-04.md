# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04 性能 · 无指标时页面停住

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `performance`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/performance`
- **需求**: `prd/cluster-storage/shared-storage/performance.md`

## 产品功能

没有共享卷或客户端指标未开启时，性能页给出配置提示并停止刷新，而不是整页转圈。

### 关联需求

- `prd/cluster-storage/shared-storage/performance.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/performance.md`](../../../../prd/cluster-storage/shared-storage/performance.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04** — Given 客户端指标未开启或该集群没有共享卷，When 打开性能页，Then 显示配置提示与开启步骤，而不是六张空图；首次 `volumes` 返回后页面停止整页刷新，不再周期性请求 `volumes` / `bench`。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/performance.md`](../../../../design/cluster-storage/shared-storage/performance.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/performance.md`](../../../../prd/cluster-storage/shared-storage/performance.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 作为集群运维，打开没有共享卷或没有客户端指标的性能页时，页面停住而不是转圈


**Independent Test**：打开 `/clusters/xc/juicefs-storage/performance`（或任意没有 JuiceFS PV 的集群）：2 秒内出现「JuiceFS 客户端指标未开启」提示；之后 3 秒内 `volumes` / `bench` 接口不再周期性发出；页面不再整页 Loading。

## 前置与配置

- 已登录
- 用 page.route 让 volumes 返回空列表，不依赖某个集群恰好没有 JuiceFS PV

## 测试步骤

1. 拦截 GET /kapis/juicefs.kubesphere.io/v1alpha1/volumes，返回空列表
2. 打开 /clusters/default/juicefs-storage/performance
3. 等待「JuiceFS 客户端指标未开启」提示
4. 再等 3 秒，统计 volumes 与 bench 的 GET 次数

## 期望结果

- 提示出现，且没有六张空图
- volumes 请求不超过 2 次（页面与 BenchPanel 首轮），之后不再增加
- 没有卷时不请求 bench
- 页面不再整页 Loading

## 失败排查

- 请求还在涨说明 Loading 仍在卸 BenchPanel；看 Performance 是否用 volumesFetched 而不是 volumesLoading && !volumes.length

## 产品改版后如何更新自动化

- 提示选择器变化时改 pages/juicefs_storage.py
