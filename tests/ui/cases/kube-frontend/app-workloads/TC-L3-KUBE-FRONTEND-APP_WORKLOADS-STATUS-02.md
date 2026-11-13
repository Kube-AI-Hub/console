# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02 状态派生 · Pending 容器组显示等待中

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `status`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/status.md`

## 产品功能

phase 为 Pending 的容器组，列表状态显示「等待中」。

### 关联需求

- `prd/kube-frontend/app-workloads/status.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/status.md`](../../../../prd/kube-frontend/app-workloads/status.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02** — 已知容器组 `phase=Running` 但有容器 `ready=false`，当查看列表，则状态为「等待中」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/status.md`](../../../../design/kube-frontend/app-workloads/status.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/status.md`](../../../../prd/kube-frontend/app-workloads/status.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 状态与命令行一致 (Priority: P1)

作为 **项目运维**，我希望 **页面状态和 `kubectl` 一致**，以便 **不必怀疑两边哪个对**。

**Independent Test**：对部分就绪的部署，页面应显示「更新中」。

## 前置与配置

- 由用例的 fixture 创建一个带不可满足 nodeSelector 的容器组，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 等待 API 报告容器组 phase=Pending
2. 打开容器组列表
3. 读取目标行的状态徽章

## 期望结果

- 状态徽章显示「等待中」
- 该行在容器组列表里可见

## 失败排查

- 先确认容器组 phase 确实是 Pending；Running 且容器未就绪也映射为等待中
- 徽章为「已终止」时检查 phase 是否为 Succeeded/Failed

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 状态派生变化时改 packages/api-client/src/workloads.ts 与对应单测
