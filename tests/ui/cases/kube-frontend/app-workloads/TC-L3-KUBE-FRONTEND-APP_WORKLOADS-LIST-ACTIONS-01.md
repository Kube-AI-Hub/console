# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-ACTIONS-01 工作负载列表 · 扩缩容与重新部署

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-ACTIONS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list-actions`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

部署列表的行操作包含扩缩容与重新部署；扩缩容改 spec.replicas；重新部署写入模板注解。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_ACTIONS-01** — 已知一个部署，当打开其行操作菜单，则含「扩缩容」与「重新部署」；当扩缩容改为 3，则 `spec.replicas` 为 3；当重新部署并确认，则模板注解 `kubectl.kubernetes.io/restartedAt` 存在。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 由夹具创建一个 1 副本的 tc-e2e- 部署，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开部署列表，打开该行的操作菜单并读取菜单项
2. 点「扩缩容」改为 3 并确认
3. 用 API 读取 spec.replicas
4. 点「重新部署」并确认，用 API 读取模板注解

## 期望结果

- 菜单含 扩缩容 与 重新部署
- spec.replicas 为 3
- 模板注解 kubectl.kubernetes.io/restartedAt 存在且为本次时间

## 失败排查

- 菜单缺少两项说明 allowScale/allowRedeploy 未接到行操作
- 重新部署无效说明注解没写到 template.metadata

## 产品改版后如何更新自动化

- 行操作变化时改 pages/app_workloads.py 的菜单断言
