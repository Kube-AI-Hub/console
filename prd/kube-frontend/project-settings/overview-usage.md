# 项目概览资源用量（L3）

[子模块需求](./_index.md)

## 概述

项目概览页新增的 **资源用量** 卡：CPU / 内存 / 存储 / 容器组四项，各显示已用量；项目配置了 ResourceQuota 时同时显示上限。数据来自监控接口的项目命名空间用量，上限来自项目配额接口。

老 console 的项目概览有 ResourceUsage 区块（物理资源与应用资源两组，含曲线与刷新）；新 UI 的概览此前把用量整块登记为「需要监控区间查询」而未做。本轮补上「当前用量 vs 配额」这一个读，曲线与排行仍不做。

## 用户故事

### US1 - 项目管理员看用量是否接近配额 (Priority: P1)

作为 **项目管理员**，我希望 **在概览页直接看到本项目的 CPU/内存/存储/容器组用量与配额上限**，以便 **判断是否需要调整配额或清理资源**。

**Independent Test**：打开项目概览，核对 CPU/内存/容器组数字与监控接口最新采样一致；监控不可用时看到可重试的说明，而不是 0。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01** — 已知项目 `<ns>` 的监控接口有/无用量采样、项目有/无 ResourceQuota，当打开项目概览，则始终出现「资源用量」卡：监控可用且有采样时显示 CPU/内存/容器组（以及监控提供的存储）用量，有配额时同时显示上限；监控返回成功但没有任何采样时显示 `:empty` 说明；监控请求失败时显示 `:unavailable` 说明与重试按钮；任何情况下缺失的数值显示 `-`，不显示假 0。

## 设计目标

1. 「用量 vs 上限」一眼可读：每项一行，已用为主、上限作次级。
2. 三种状态可区分：有数据 / 无采样 / 监控不可用；后两者不显示 0。
3. 用量与配额是两个数据源，互不拖累。

## 约束与边界

- 一次读四种用量：`GET /kapis/monitoring.kubesphere.io/v1alpha3/namespaces/<ns>?metrics_filter=…&start=&end=&step=60s&cluster=<c>`，取每个指标最新采样。
- 上限来自项目配额（ResourceQuota `spec.hard`），经 `projectInfoApi` 已有的读取。
- 存储用量：本部署监控后端不提供命名空间存储序列（探测为 absent），回落到 ResourceQuota 的 `status.used["requests.storage"]`；两者都没有时为 `-`。
- 只读；不做曲线、趋势、用量排期与自动刷新。

## UI 交互设计

- 卡片标题「资源用量」，位于基本信息之后、配额之前。
- 四项网格（CPU 使用量 / 内存使用量 / 存储使用量 / 容器组数量），每项：已用数字 + `/ 上限`（有上限时）。
- `data-ai-id`：`project-overview:usage`（卡）、`project-overview:usage:cpu|memory|storage|pods`（每项数值）、`project-overview:usage:empty`、`project-overview:usage:unavailable`、`project-overview:usage:retry`。
- 重试按钮复用 `AiButton`，失败不隐藏额度区块。

## 文案与校验

- 标题与四项：`project.overview.usage.title/cpu/memory/storage/pods`。
- 空态：`project.overview.usage.empty`；不可用：`project.overview.usage.unavailable` + `common.retry`。
- CPU 用量按核显示（小于 1 核保留两位小数，避免 0.03 变成 0.0）；内存/存储按 GiB/TiB；容器组为整数；缺失值 `-`。

## 边界情况

- 监控返回 200 但所有指标都没有序列：`:empty`，不显示 0。
- 监控请求 4xx/5xx/网络失败：`:unavailable` + 重试；配额区块仍正常显示。
- 存储无监控序列且无配额：存储项显示 `-`（其余项正常）。
- 限额未配置：只显示已用，不显示 `/ -`。
- 指标值不是数字（NaN）：按缺失处理。

## 明确不做

- 用量曲线与时间范围切换（老 console 的 TinyArea/物理资源曲线）。
- 应用资源计数（Pods/Deployments/StatefulSets 等对象计数）：对象列表页已能回答，概览不再重复。
- 用量排行（UsageRanking）。
- 自动刷新：每次进入页面读一次；需要实时看用量请进集群监控。
- 接口探测证据：`GET /kapis/monitoring.kubesphere.io/v1alpha3/namespace?...` → 404（无该作用域路径）；正确路径是 `/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/<ns>` → 200；`namespace_cpu_usage` / `namespace_memory_usage_wo_cache` / `namespace_pod_count` 有序列，`namespace_pvc_usage` / `namespace_storage_usage` 无序列；`/api/v1/namespaces/<ns>/resourcequotas` 本部署为空（无配额对象）。

## 假设

- 监控后端已安装且项目命名空间有采样；未安装时走 `:unavailable`。
- 项目配额对象若存在，其 `status.used` 与监控用量口径不同（配额按 ResourceQuota 计量，监控按 cgroup），页面只把配额用于上限与存储回落，不混用 CPU/内存口径。

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01** — 概览展示四项用量与可选上限。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-02** — 区分有数据 / 无采样 / 监控不可用，缺失值不为 0。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01** — 用量数值与监控最新采样一致；`:empty` 与 `:unavailable` 按接口结果出现；无假 0。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01`
