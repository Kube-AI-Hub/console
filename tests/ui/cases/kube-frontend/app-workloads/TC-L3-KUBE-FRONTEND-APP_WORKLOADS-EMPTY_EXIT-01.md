# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01 列表空态出口 · 清空搜索与筛选、刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `empty-exit`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/empty-state-exit.md`

## 产品功能

列表因搜索/筛选变空时，空态给出「清空搜索与筛选」与「刷新」两个动作：清空同时清搜索与筛选并恢复列表，刷新重新发起一次列表请求；能力缺失时按钮不出现。

### 关联需求

- `prd/kube-frontend/app-workloads/empty-state-exit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/empty-state-exit.md`](../../../../prd/kube-frontend/app-workloads/empty-state-exit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01** — 已知打开容器组列表，当输入不存在的关键字使列表变空，则空态显示 data-ai-id=empty-state:clear 的「清空搜索与筛选」与 data-ai-id=empty-state:refresh 的「刷新」；当点「清空搜索与筛选」，则搜索框清空且列表恢复为有数据的就绪状态；已知再次输入关键字使列表变空，当点「刷新」，则触发一次列表请求（网络层可观测）；已知列表没有搜索/筛选能力或页面没有传回调，则空态只显示原有标题与说明，不出现无法工作的按钮。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/empty-state-exit.md`](../../../../design/kube-frontend/app-workloads/empty-state-exit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/empty-state-exit.md`](../../../../prd/kube-frontend/app-workloads/empty-state-exit.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 空列表时能一键回到有数据的状态 (Priority: P1)

作为 **项目运维**，我希望 **列表因为搜索或筛选变空时，空态上直接有「清空搜索与筛选」和「刷新」两个动作**，以便 **不用自己猜是搜索词的问题、也不用反复点导航重进页面**。

**Independent Test**：在容器列表输入不存在的关键字，空态出现两个按钮；点「清空搜索与筛选」后搜索框清空、列表恢复；再次搜索为空后点「刷新」，触发一次列表请求。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间（容器组列表可达）
- 列表至少有一条数据（空态由搜索触发，而不是项目本来为空）

## 测试步骤

1. 打开容器组列表并等待就绪
2. 在搜索框输入不存在的关键字，等待空态
3. 读取空态里的两个动作按钮并断言句柄
4. 点「清空搜索与筛选」，读取搜索框与列表状态
5. 再次输入不存在的关键字，等待空态；点「刷新」并捕获列表请求

## 期望结果

- 空态出现 data-ai-id=empty-state:clear 与 empty-state:refresh
- 清空后搜索框为空且列表回到 ready（有数据）
- 刷新触发一次 GET 列表请求（网络层可捕获，状态 200）

## 失败排查

- 空态没有按钮：页面没传 onRefresh/onSearchChange/onFiltersChange，或 ResourceList 版本不是最新 dist
- 点清空没反应：页面只传了一个回调且另一个状态仍生效（例如项目筛选）
- 刷新没发请求：页面 onRefresh 未接线

## 产品改版后如何更新自动化

- 句柄固定为 empty-state:clear / empty-state:refresh，不随页面变化
- 按钮文案变化时改页面 labels 与 locale
