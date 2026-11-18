# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04 容器组详情 · 调度信息的状态信息与四项条件

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail-tabs`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/detail-tabs.md`

## 产品功能

「状态信息」区块显示当前状态，以及 PodScheduled / Initialized / ContainersReady / Ready 四项条件各自的满足与否与明细（状态值、原因、消息、更新时间）；对象里没有的条件不显示。

### 关联需求

- `prd/kube-frontend/app-workloads/detail-tabs.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04** — 已知容器组带 status.conditions，当打开「调度信息」页签，则「状态信息」区块显示当前状态，以及 PodScheduled / Initialized / ContainersReady / Ready 四项条件各自的满足与否与明细（状态值、原因、消息、更新时间）；对象里没有的条件不显示。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail-tabs.md`](../../../../design/kube-frontend/app-workloads/detail-tabs.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 按页签查看详情且切换不重新加载 (Priority: P1)

作为 **项目运维**，我希望 **详情页把概览、关联容器组、修订版本、事件和元数据分到页签里，并默认停在概览**，以便 **不必在一条长页里滚动，切换页签时也不用等数据重新请求**。

**Independent Test**：打开一个部署详情，核对五个页签并逐个切换；再打开一个容器组详情，核对四个页签并从「容器」进入容器详情。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建一个未调度的容器组（至少带 PodScheduled=False 与 reason=Unschedulable）与一个已调度的容器组；用例结束后无条件删除

## 测试步骤

1. 打开已调度容器组详情 → 调度信息，读 pods-detail:current-status 与四个 pods-detail:condition:<type>
2. 与 API 的 status.conditions 逐条核对满足与否、原因、消息、更新时间
3. 打开未调度容器组详情 → 调度信息，读同样内容
4. 核对对象里没有的条件类型在页面上没有对应行

## 期望结果

- 状态信息区块显示当前状态（与对象派生状态一致）
- 四项条件各占一行，满足显示「已满足」、不满足显示「未满足」；行内有原因/消息/更新时间时显示对应明细
- 未调度容器组的 PodScheduled 行显示「未满足」且含 reason（Unschedulable）
- 对象里没有的条件不产生行（行集合等于对象里的四项交集）

## 失败排查

- 条件行缺失：只渲染了对象里存在的条件，但页面集合写错（例如用了小写 type）
- 全部显示已满足：没读 condition.status，按「存在即满足」判断
- 更新时间不显示：条件里 lastTransitionTime 为空时不应显示「更新时间：-」，直接不显示该行

## 产品改版后如何更新自动化

- 句柄 pods-detail:schedule-status / :current-status / :condition:<type>；条件集合见 WorkloadDetailPage 的 CONDITION_TYPES
