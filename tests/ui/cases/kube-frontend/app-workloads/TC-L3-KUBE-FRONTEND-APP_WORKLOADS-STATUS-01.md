# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01 状态派生 · 部分就绪的部署显示更新中

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `status`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/status.md`

## 产品功能

spec.replicas=3 而 status.readyReplicas 为 0 的部署，列表状态显示「更新中」。

### 关联需求

- `prd/kube-frontend/app-workloads/status.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/status.md`](../../../../prd/kube-frontend/app-workloads/status.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01** — 已知部署 `spec.replicas=3`、`status.readyReplicas=1`，当查看列表，则状态为「更新中」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/status.md`](../../../../design/kube-frontend/app-workloads/status.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/status.md`](../../../../prd/kube-frontend/app-workloads/status.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 状态与命令行一致 (Priority: P1)

作为 **项目运维**，我希望 **页面状态和 `kubectl` 一致**，以便 **不必怀疑两边哪个对**。

**Independent Test**：对部分就绪的部署，页面应显示「更新中」。

## 前置与配置

- 由用例的 fixture 创建一个 spec.replicas 为 3、镜像无法拉取的部署，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 创建部署后立即打开部署列表，不等待 Pod 就绪
2. 读取目标行的状态徽章与就绪计数
3. 用 API 核对 status.readyReplicas 为 0（或缺失）

## 期望结果

- 状态徽章显示「更新中」，不显示「运行中」
- 就绪列为 0/3

## 失败排查

- 状态为「运行中」时先看是否真的已有 3 个就绪副本
- 徽章文案缺失时看 WORKLOAD_STATUS_KEYS 映射

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 状态派生变化时改 packages/api-client/src/workloads.ts 与对应单测
