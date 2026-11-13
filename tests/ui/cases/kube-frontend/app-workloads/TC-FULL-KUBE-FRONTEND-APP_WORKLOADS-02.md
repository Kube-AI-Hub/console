# TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-02 应用负载 · 停止与启动的状态化操作

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-02`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `app-workloads` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

运行中的控制器提供「停止」，已停止的提供「启动」；定时任务可暂停与恢复。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-03** — 已知一个已停止的部署（`replicas=0`），当其行操作被打开，则只提供「启动」而不提供「停止」；点「启动」后 `spec.replicas` 变为 1。
- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-04** — 已知一个定时任务，当点「暂停/启动」，则其 `spec.suspend` 被取反，列表状态随之变化。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 由夹具创建 tc-e2e- 前缀的部署（replicas=2）与定时任务，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开部署列表并定位运行中的部署，读取其行操作
2. 点「停止」并确认，用 API 核对 replicas
3. 重新加载并定位同一部署，读取其行操作
4. 点「启动」并确认，用 API 核对 replicas
5. 打开定时任务列表，对该任务点「暂停/启动」，用 API 核对 spec.suspend

## 期望结果

- 运行中的部署行操作含「停止」且不含「启动」
- 停止后 replicas 为 0
- 已停止的部署行操作只含「启动」
- 启动后 replicas 为 1
- 定时任务 suspend 被取反

## 失败排查

- 两个操作都在列表出现时说明 visible 谓词失效
- replicas 未变化时确认写的是 merge patch 的 spec.replicas

## 产品改版后如何更新自动化

- 行操作变化时改 pages/app_workloads.py
