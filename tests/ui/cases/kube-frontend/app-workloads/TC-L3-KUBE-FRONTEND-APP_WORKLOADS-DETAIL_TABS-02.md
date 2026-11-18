# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02 容器组详情 · 页签集合与调度结果

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail-tabs`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/detail-tabs.md`

## 产品功能

容器组详情的页签为 概览 / 调度信息 / 监控 / 容器 / 环境变量 / 事件 / 元数据；「调度信息」的调度结果区块：已调度显示「已调度到节点 <node>」与 PodScheduled 条件的时间，未调度显示「调度未成功」。

### 关联需求

- `prd/kube-frontend/app-workloads/detail-tabs.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02** — 已知一个容器组详情，当打开它，则页签为「概览 / 调度信息 / 监控 / 容器 / 环境变量 / 事件 / 元数据」；点「调度信息」显示调度结果区块：已调度时显示「已调度到节点 <node>」与该容器组 PodScheduled 条件的时间，未调度时显示「调度未成功」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail-tabs.md`](../../../../design/kube-frontend/app-workloads/detail-tabs.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 按页签查看详情且切换不重新加载 (Priority: P1)

作为 **项目运维**，我希望 **详情页把概览、关联容器组、修订版本、事件和元数据分到页签里，并默认停在概览**，以便 **不必在一条长页里滚动，切换页签时也不用等数据重新请求**。

**Independent Test**：打开一个部署详情，核对五个页签并逐个切换；再打开一个容器组详情，核对四个页签并从「容器」进入容器详情。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建一个永远调度不出去的容器组（nodeSelector 指向不存在的节点），用例结束后无条件删除
- 集群里至少有一个已调度的容器组（用例按 API 挑，default 优先、否则 kubesphere-system）

## 测试步骤

1. 打开已调度容器组详情，读七个页签触发器
2. 点「调度信息」，读 pods-detail:schedule-result 的文本与 pods-detail:scheduled-at
3. 与 API 里的 spec.nodeName、status.conditions[PodScheduled].lastTransitionTime 逐项核对
4. 打开未调度容器组详情 → 调度信息，读同样两块

## 期望结果

- 页签为 概览、调度信息、监控、容器、环境变量、事件、元数据，默认选中「概览」
- 已调度：调度结果区块含「已调度到节点 <node>」（node 与对象一致），调度时间是 PodScheduled 条件的 lastTransitionTime（格式化后非「-」）
- 未调度：显示「调度未成功」；调度时间取该对象 PodScheduled 条件的时间（未调度的容器组通常带 PodScheduled=False，那个时间就是调度失败的时刻），对象里没有该条件时才显示「-」
- 切换页签不发新的容器组详情请求

## 失败排查

- 页签少了调度信息：tabsFor 的 pods 分支没含 schedule
- 时间显示 -：读了 status.startTime 或事件时间，不是 PodScheduled 条件
- 已调度却显示未成功：只看条件、条件还没写入；判据是 nodeName 与条件两处

## 产品改版后如何更新自动化

- 页签句柄 workload-detail:tab-trigger:<key>；调度信息句柄 pods-detail:schedule-result / :scheduled-node / :scheduled-at
