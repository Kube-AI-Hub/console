# 共享存储（JuiceFS）（L2）

## 概述

一页三签：**概览**看总量与使用率，**卷与配额**看每个共享卷并调整配额，**性能**看客户端吞吐、缓存与对象存储。三个页签共享同一份卷列表，切换不重新登录、不改变集群上下文。

## 用户故事

### US1 - 作为集群运维，打开共享存储，在三个页签之间切换并看到各自的数据

**Independent Test**：打开 `/clusters/default/juicefs-storage/overview`，依次点「卷与配额」「性能」：卷页出现表格且每行有「调整配额」；性能页出现六张图（或明确的指标未开启提示）；三页的文字在深色卡片上均清晰可读。

### US2 - 作为集群运维，发现某个共享卷快满了，从卷页把配额调大并确认生效

**Independent Test**：在卷页点某行的「调整配额」，输入一个更大的容量并确定；表格里的配额随之变化，且 `kubectl get pv <name> -o jsonpath='{.spec.capacity.storage}'` 与 `juicefs quota get` 都等于新值。

## 验收场景

- **AC-FULL-CLUSTER-STORAGE-SHARED_STORAGE-01** — Given 已登录，When 在三个页签之间切换，Then 每页的主区都出现：概览有卡片与使用率条，卷页有八列表格，性能页有六张图或指标未开启提示。
- **AC-FULL-CLUSTER-STORAGE-SHARED_STORAGE-02** — Given 已登录且集群有共享卷，When 从卷页把某个卷的配额改大，Then 表格配额更新、PV 的 `spec.capacity` 更新、JuiceFS 目录 quota 同步更新。

## 设计目标

- 三个页签用**同一份数据**：卷列表只取一次，概览的汇总与卷页的表格不可能对不上。
- 所有可见文字都要在深色主题下可读：正文对比度 ≥ 4.5:1，次要文字 ≥ 3:1。这是硬验收，不是审美偏好。
- 空态与异常态要说清原因：没有卷、指标未开启、配额待刷新，各自有文案，而不是空白或零线。

## 约束与边界

- 页面只在集群上下文内工作；跨集群要切集群，不做聚合。
- 配额改动是集群级写操作，需要 `volumes:manage`。
- 卷列表以 PV 为单位；`Released` 的卷（claim 已删除）不展示，避免给出无法生效的操作。

## UI 交互设计

- 页签：概览 / 卷与配额 / 性能，默认概览，地址分别为 `.../overview`、`.../volumes`、`.../performance`。
- 三个页签共享页面标题「共享存储」与一行说明。
- 卷页的「调整配额」是唯一写操作，弹窗内完成，取消不改变任何状态。

## 页面结构

```text
Banner: 共享存储 + 说明
Tabs:   概览 | 卷与配额 | 性能
概览:   4 卡片 → 提示条 → 各卷使用率
卷页:   提示 + 刷新 → 8 列表格 → 行内「调整配额」
性能:   时间范围选择 → 6 张图（2 列，窄屏 1 列）
```

## 异常态

| 状态 | 表现 |
| --- | --- |
| 没有共享卷 | 卡片为 0，卷页显示「没有可管理的共享卷」 |
| 客户端指标未开启 | 性能页显示配置提示与开启步骤 |
| 指标已开启但区间内无流量 | 每张图显示「该时间范围内无读写」，不画零线 |
| 配额刚改过、statfs 未刷新 | 卷页配额列标「待刷新」，以配额列为准 |

## 功能需求

- **FR-FULL-CLUSTER_STORAGE-SHARED_STORAGE-01** — 系统 MUST 让三个页签共享同一份卷列表，并在任一页签的写操作后刷新三页的数据。
- **FR-FULL-CLUSTER_STORAGE-SHARED_STORAGE-02** — 系统 MUST 在卷页提供配额调整入口，并保证改完之后 PV 与 JuiceFS quota 一致。

## 成功标准

- **SC-FULL-CLUSTER_STORAGE-SHARED_STORAGE-01** — 三个页签首次渲染均在 3 秒内出现主区内容（不含图表数据加载）。
- **SC-FULL-CLUSTER_STORAGE-SHARED_STORAGE-02** — 配额改动从提交到表格更新不超过 10 秒（含一次 Job 执行）。

## 明确不做

- 不做卷的创建/删除/迁移。
- 不做跨集群汇总。
- 不在页面上暴露 JuiceFS 客户端的原始指标名。

## 假设

- 共享卷使用 `juicefs-shared` StorageClass，PV 名形如 `kubeaihub-*`。
- Prometheus 已抓取 kubelet 的卷统计。

## 功能点

- `overview.md` — 概览
- `quota.md` — 卷与配额
- `performance.md` — 性能

## 验收用例

- `TC-FULL-CLUSTER-STORAGE-SHARED_STORAGE-01`
- `TC-FLOW-SHARED_STORAGE`
