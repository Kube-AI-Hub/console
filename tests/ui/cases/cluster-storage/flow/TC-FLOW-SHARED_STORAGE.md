# TC-FLOW-SHARED_STORAGE 共享存储 · 从发现到扩容的完整旅程

- **用例 ID**: `TC-FLOW-SHARED_STORAGE`
- **级别**: L3  **套件**: `flow`
- **模块**: `cluster-storage` / `flow` `shared-storage`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/overview`
- **需求**: `prd/cluster-storage/shared-storage/_index.md`

## 产品功能

按用户故事的 Independent Test 走完「发现快满 → 调大配额 → 确认生效」。

### 关联需求

- `prd/cluster-storage/shared-storage/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/_index.md`](../../../../prd/cluster-storage/shared-storage/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-CLUSTER_STORAGE-SHARED_STORAGE-01** — Given 已登录，When 在三个页签之间切换，Then 每页的主区都出现：概览有卡片与使用率条，卷页有八列表格，性能页有六张图或指标未开启提示。
- **AC-FULL-CLUSTER_STORAGE-SHARED_STORAGE-02** — Given 已登录且集群有共享卷，When 从卷页把某个卷的配额改大，Then 表格配额更新、PV 的 `spec.capacity` 更新、JuiceFS 目录 quota 同步更新。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/_index.md`](../../../../design/cluster-storage/shared-storage/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/_index.md`](../../../../prd/cluster-storage/shared-storage/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为集群运维，发现某个共享卷快满了，从卷页把配额调大并确认生效


**Independent Test**：在卷页点某行的「调整配额」，输入一个更大的容量并确定；表格里的配额随之变化，且 `kubectl get pv <name> -o jsonpath='{.spec.capacity.storage}'` 与 `juicefs quota get` 都等于新值。

## 前置与配置

- 已登录，且在 default 集群
- 集群至少有一个共享卷，且当前使用率低于 90%

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/overview，记下最高使用率的卷
2. 切到「卷与配额」，找到该卷
3. 点「调整配额」，把容量调大 1TiB 并确定
4. 核对表格配额更新
5. 切回概览，核对总配额随之增加

## 期望结果

- 整个旅程不超过 5 次交互
- 配额改动在概览与卷页同时可见
- 页面上没有未翻译 key

## 失败排查

- 概览没更新时确认写操作后是否重新拉取了 summary

## 产品改版后如何更新自动化

- 旅程步骤变化时改 tests/cluster-storage/shared-storage/test_shared_storage.py
