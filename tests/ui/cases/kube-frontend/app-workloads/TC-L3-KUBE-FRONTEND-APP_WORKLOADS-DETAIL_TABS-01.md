# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01 负载详情 · 页签体系

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail-tabs`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/detail-tabs.md`

## 产品功能

详情页把概览、关联容器组、修订版本、事件与元数据拆成页签；容器组详情把容器单独成一页签并可进入容器详情；切换页签只换面板，不重新拉数据。

### 关联需求

- `prd/kube-frontend/app-workloads/detail-tabs.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01** — 已知一个部署详情，当打开它，则页签为「概览 / 关联容器组 / 修订版本 / 事件 / 元数据」，默认选中「概览」；点「事件」显示该对象的事件区块，点「元数据」显示标签与注解；已知一个容器组详情，则页签包含「概览 / 容器 / 事件 / 元数据」（完整集合见 AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02），点「容器」后容器行可点进容器详情页；切换页签不重新请求数据。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail-tabs.md`](../../../../design/kube-frontend/app-workloads/detail-tabs.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 按页签查看详情且切换不重新加载 (Priority: P1)

作为 **项目运维**，我希望 **详情页把概览、关联容器组、修订版本、事件和元数据分到页签里，并默认停在概览**，以便 **不必在一条长页里滚动，切换页签时也不用等数据重新请求**。

**Independent Test**：打开一个部署详情，核对五个页签并逐个切换；再打开一个容器组详情，核对四个页签并从「容器」进入容器详情。

## 前置与配置

- 由用例的 fixture 创建一个带注解 tc-e2e/owner=tabs 的 tc-e2e- 部署（2 副本、nginx:1.27），用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开部署详情，等待主区就绪
2. 读取页签触发器的 data-ai-id 与「概览」面板
3. 点「事件」页签，读取事件区块
4. 点「元数据」页签，读取标签与注解区块
5. 进入该部署启动的一个容器组详情，读取页签集合并点「容器」页签
6. 点击容器行，进入容器详情

## 期望结果

- 部署详情的页签为 概览、关联容器组、修订版本、事件、元数据，默认选中「概览」
- 切换前事件区块不存在，点「事件」后出现且标题含「事件」
- 点「元数据」后出现标签与注解区块，标签含 app=<部署名>，注解含 tc-e2e/owner=tabs
- 容器组详情的页签为 概览、容器、事件、元数据，没有「关联容器组」与「修订版本」
- 容器组详情的「容器」页签里有容器行，点击后进入 /containers/<容器名> 且容器详情主区就绪

## 失败排查

- 页签不出现时先看 WorkloadDetailPage 的 tabsFor 是否覆盖该 kind
- 数据在切页签后重新请求时检查查询是否被挪进了页签面板而不是页面顶层

## 产品改版后如何更新自动化

- 页签文案变化时改 WorkloadDetailPage 的 TAB_COPY（locale 键补齐后改为 t()）
- 页签 id 变化时同步用例里的 workload-detail:tab:* 与 workload-detail:tab-trigger:*
