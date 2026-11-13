# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-BULK-01 工作负载列表 · 批量停止与批量删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-BULK-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `bulk`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

可扩缩容的工作负载在选中行后提供「批量停止」与「批量删除」；不能扩缩容的类型只有「批量删除」；批量停止把选中对象缩到 0 副本。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-BULK-01** — 已知选中两个部署，则批量操作含「批量停止」与「批量删除」，点批量停止并确认后两者的 `spec.replicas` 都为 0（对象仍在）；已知选中一个任务，则批量操作只有「批量删除」；已知批量删除 n 个对象，则确认框要求输入数量 `n`。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 由夹具创建两个 tc-e2e- 部署，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开部署列表，选中两个部署
2. 读取批量操作项
3. 点「批量停止」并确认
4. 用 API 读取两者的 spec.replicas
5. 对任务列表做同样的选择并读取批量操作项

## 期望结果

- 部署页批量项含「批量停止」与「批量删除」
- 两个部署的 spec.replicas 都变为 0
- 任务页批量项只有「批量删除」

## 失败排查

- 没有批量项说明 selection 未生效或 onSelectionChange 未传
- 只停了一个说明批量执行被中断

## 产品改版后如何更新自动化

- 批量项变化时改 pages/app_workloads.py
