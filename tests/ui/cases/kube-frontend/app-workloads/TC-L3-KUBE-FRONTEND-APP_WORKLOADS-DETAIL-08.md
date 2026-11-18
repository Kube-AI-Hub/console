# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-08 定时任务详情 · 运行记录（默认页签、结果与耗时、空态）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/cronjobs`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

定时任务详情默认停在「运行记录」，列出它创建的任务（名称链到任务详情、结果徽标与成功/失败/运行中计数、资源请求/限制、开始/结束时间、耗时）；没有记录显示说明而不是空表。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-08** — 已知一个定时任务已触发过至少一次，当打开其详情，则默认停在「运行记录」页签，并列出该定时任务创建的每个任务：任务名称（链接到该任务的详情）、结果（已完成 / 失败 / 运行中）与成功/失败/运行中计数、资源请求、资源限制、开始时间、结束时间、耗时；没有运行记录时显示「这个定时任务还没有运行记录。」而不是空表；读取失败时显示「运行记录不可用。」并可重试。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 已登录，host 集群 default 项目，admin
- 用例创建一个每分钟触发的定时任务（镜像 nginx:1.27），等它创建出第一个任务；结束后删除定时任务与它创建的任务

## 测试步骤

1. 用 API 创建 CronJob（schedule "* * * * *"、restartPolicy Never、jobTemplate 带唯一标签）
2. 轮询 kapis 的 jobs 集合（labelSelector=模板标签），直到出现该定时任务创建的任务（最长 150s）
3. 打开 /kube-frontend/system-workspace/clusters/host/projects/default/cronjobs/<name>
4. 核对默认选中「运行记录」页签（workload-detail:tab-trigger:runs 的 aria-selected=true，面板 workload-detail:tab:runs 可见）
5. 核对任务表 cronjobs-detail:runs-table 可见，且包含该任务的名称行；结果列出现「已完成 / 失败 / 运行中」之一
6. 点击任务名链接，核对 href 指向该项目的 /jobs/<任务名>
7. 再建一个同模板的定时任务但不触发（schedule 设为很久以后），核对它的运行记录显示空态文案 cronjobs-detail:runs-empty

## 期望结果

- 默认页签是「运行记录」，不是「概览」
- 任务表列出用例创建的任务，结果与计数来自任务的 status.conditions
- 没有任务时显示「这个定时任务还没有运行记录。」，不显示空表

## 失败排查

- 任务迟迟不出现：CronJob 的 schedule 是否已到分钟边界；镜像是否可拉（用 nginx:1.27）；历史保留策略是否把任务清理掉了
- 默认页签不是运行记录：tabsFor('cronjobs') 或默认 tab 的初始化被改回 overview

## 产品改版后如何更新自动化

- 页签与行的句柄改 WorkloadDetailPage.tsx 的 workload-detail:tab-trigger:runs / cronjobs-detail:run:<任务名>
