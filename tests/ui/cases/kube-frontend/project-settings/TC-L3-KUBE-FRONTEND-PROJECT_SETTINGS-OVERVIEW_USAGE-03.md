# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-03 项目概览 · 资源使用排行（Top 5）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `overview-usage`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/overview`
- **需求**: `prd/kube-frontend/project-settings/overview-usage.md`

## 产品功能

项目概览提供「资源使用排行（Top 5）」，CPU 与内存两个页签分别列出用量最高的 5 个工作负载；数值来自监控聚合的排序结果，空与失败都有独立呈现。

### 关联需求

- `prd/kube-frontend/project-settings/overview-usage.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/overview-usage.md`](../../../../prd/kube-frontend/project-settings/overview-usage.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-03** — 已知项目 `<ns>` 的工作负载上报了用量指标，当打开项目概览，则「资源使用排行（Top 5）」区块按 CPU 与内存两个页签分别列出该项目用量最高的 5 个工作负载（序号、名称、类型、数值），CPU 以核、内存以 GiB/MiB 呈现；数值取自监控 `namespaces/<ns>/workloads` 的排序结果，名称与类型来自样本的 `metric.workload`（`Kind:name`）；Deployment/StatefulSet/DaemonSet 三类的名称链接到对应的项目列表页；排序结果为空时显示空态说明；请求失败时显示可重试的说明，不显示假 0。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/overview-usage.md`](../../../../design/kube-frontend/project-settings/overview-usage.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/overview-usage.md`](../../../../prd/kube-frontend/project-settings/overview-usage.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 项目管理员看用量是否接近配额 (Priority: P1)

作为 **项目管理员**，我希望 **在概览页直接看到本项目的 CPU/内存/存储/容器组用量与配额上限**，以便 **判断是否需要调整配额或清理资源**。

**Independent Test**：打开项目概览，核对 CPU/内存/容器组数字与监控接口最新采样一致；监控不可用时看到可重试的说明，而不是 0。

## 前置与配置

- 已登录；项目 default 有工作负载且监控已上报用量

## 测试步骤

1. 通过 API 读 `namespaces/default/workloads?sort_metric=workload_cpu_usage` 拿到期望的前几名
2. 打开项目概览，核对排行区块存在且默认 CPU 页签列出 ≤5 行
3. 核对每行序号连续、名称与 API 的 metric.workload 名称部分一致、数值为正
4. 切到内存页签，核对同样 ≤5 行且数值带单位

## 期望结果

- 区块 project-overview:ranking 存在；页签句柄 :ranking:tab:cpu / :ranking:tab:memory
- CPU 页签行数与 API 返回的样本数一致（≤5），名称来自 metric.workload
- 内存页签行数 ≤5，数值格式为 GiB/MiB
- 两页签都不显示假 0：无样本的工作负载不出现在排行里

## 失败排查

- 整页报错 `TabsContent must be used within Tabs`：面板没作为 Tabs 的子节点
- 排行按 pod 名而不是工作负载名：读错了接口（应为 namespaces/<ns>/workloads 聚合）

## 产品改版后如何更新自动化

- 句柄：project-overview:ranking / :ranking:tab:cpu / :ranking:tab:memory / :ranking:list / :ranking:empty / :ranking:error / :ranking:retry
