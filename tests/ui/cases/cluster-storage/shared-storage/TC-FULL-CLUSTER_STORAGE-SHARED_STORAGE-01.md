# TC-FULL-CLUSTER-STORAGE-SHARED_STORAGE-01 共享存储 · 三个页签

- **用例 ID**: `TC-FULL-CLUSTER-STORAGE-SHARED_STORAGE-01`
- **级别**: L2  **套件**: `full`
- **模块**: `cluster-storage` / `shared-storage` ``
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/overview`
- **需求**: `prd/cluster-storage/shared-storage/_index.md`

## 产品功能

在三个页签之间切换，核对每页主区；改一次配额并确认表格与 PV 同步。

### 关联需求

- `prd/cluster-storage/shared-storage/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/_index.md`](../../../../prd/cluster-storage/shared-storage/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-CLUSTER-STORAGE-SHARED_STORAGE-01** — Given 已登录，When 在三个页签之间切换，Then 每页的主区都出现：概览有卡片与使用率条，卷页有八列表格，性能页有六张图或指标未开启提示。
- **AC-FULL-CLUSTER-STORAGE-SHARED_STORAGE-02** — Given 已登录且集群有共享卷，When 从卷页把某个卷的配额改大，Then 表格配额更新、PV 的 `spec.capacity` 更新、JuiceFS 目录 quota 同步更新。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/_index.md`](../../../../design/cluster-storage/shared-storage/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/_index.md`](../../../../prd/cluster-storage/shared-storage/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，打开共享存储，在三个页签之间切换并看到各自的数据


**Independent Test**：打开 `/clusters/default/juicefs-storage/overview`，依次点「卷与配额」「性能」：卷页出现表格且每行有「调整配额」；性能页出现六张图（或明确的指标未开启提示）；三页的文字在深色卡片上均清晰可读。

### US2 - 作为集群运维，发现某个共享卷快满了，从卷页把配额调大并确认生效


**Independent Test**：在卷页点某行的「调整配额」，输入一个更大的容量并确定；表格里的配额随之变化，且 `kubectl get pv <name> -o jsonpath='{.spec.capacity.storage}'` 与 `juicefs quota get` 都等于新值。

## 前置与配置

- 已登录，且在 default 集群
- 集群至少有一个共享卷

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/overview，核对卡片与使用率条
2. 点「卷与配额」，核对八列表格与行内「调整配额」
3. 点「性能」，核对六张图或指标未开启提示
4. 在卷页把某个卷的配额从当前值改为 +1TiB 并确定，核对表格配额更新
5. 用 kubectl 核对 PV 的 spec.capacity 与 juicefs quota 等于新值

## 期望结果

- 三页都有主区内容，没有未翻译 key
- 配额改动后表格、PV、JuiceFS quota 三者一致

## 失败排查

- 配额没变时先看一次性 Job 的状态与日志
- 指标未开启时看驱动 ConfigMap 的 mountPodPatch.mountOptions

## 产品改版后如何更新自动化

- 页签名称变化时改 pages/juicefs_storage.py
