# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03 性能 · 主动触发读写测试

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `performance`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/performance`
- **需求**: `prd/cluster-storage/shared-storage/performance.md`

## 产品功能

在性能页对一个共享卷发起一次大文件读写测试，并读到吞吐结果。

### 关联需求

- `prd/cluster-storage/shared-storage/performance.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/performance.md`](../../../../prd/cluster-storage/shared-storage/performance.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-05** — Given 至少一个共享卷可写，When 选卷并点「开始测试」，Then 后端创建一次性 Job 并返回 Pending/Running；轮询到 Succeeded 后页面显示写吞吐、读吞吐（`MiB/s`）与每文件耗时；测试期间同一卷再次发起返回 409；失败时显示日志尾部。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/performance.md`](../../../../design/cluster-storage/shared-storage/performance.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/performance.md`](../../../../prd/cluster-storage/shared-storage/performance.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为集群运维，主动测一次读写吞吐，判断存储本身快不快


**Independent Test**：在性能页选一个卷、文件大小 256 MiB、1 个线程，点「开始测试」：按钮进入「测试中」，十几秒后出现写吞吐与读吞吐两个数字（单位 `MiB/s`），并有每文件耗时；期间切到别的页签再回来，结果仍在。

## 前置与配置

- 已登录，且在 default 集群
- 至少一个共享卷可写，且余量大于 512 MiB
- 该卷没有正在运行的测试

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/performance
2. 在「主动性能测试」卡片里选第一个卷、文件大小 256 MiB、线程数 1
3. 点「开始测试」
4. 等待按钮从「测试中」恢复，读取写吞吐与读吞吐
5. 切到「卷与配额」再切回「性能」，确认结果仍在

## 期望结果

- 点击后按钮进入「测试中（Ns）」并禁用，其他下拉框同时禁用
- 结果区出现「写吞吐」与「读吞吐」，数值为正，单位是 MiB/s，并各带一个 s/file 耗时
- 结果脚注说明读测试使用本机页缓存
- 切页签回来后结果仍在（由 GET /bench 恢复）
- 全程页面不出现未翻译 key

## 失败排查

- 按钮一直停在「测试中」：检查 Job 是否 Pending（镜像拉取或 PVC 不可挂载），看 pod 事件
- 结果区为空但 Job 成功：看 Job 日志里是否有 ITEM/VALUE/COST 表格，可能是客户端版本改了输出格式
- 返回 409：同一卷已有测试在跑，等它结束或删掉那个 Job

## 产品改版后如何更新自动化

- 卡片选择器的 name 变化时改 pages/juicefs_storage.py
- 结果字段改名时改 BenchPanel 的 data-bench 标记与断言
