# TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-04 应用负载 · 详情的扩缩容与编辑信息

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-04`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `app-workloads` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

部署详情提供编辑信息与扩缩容；改动落到对象上。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-06** — 已知一个部署的详情页，当用「编辑信息」改别名、用「扩缩容」把副本数改为 3，则 `kubesphere.io/alias-name` 注解被更新且 `spec.replicas` 为 3。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 由夹具创建 tc-e2e- 前缀的部署（replicas=1），用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该部署详情，读取操作按钮
2. 点「编辑信息」填写别名并确认，用 API 核对注解
3. 点「扩缩容」填写 3 并确认，用 API 核对 replicas

## 期望结果

- 详情操作依次含 编辑信息、扩缩容、重新部署、编辑 YAML、删除
- kubesphere.io/alias-name 等于填写内容
- spec.replicas 为 3

## 失败排查

- 扩缩容无效果时确认写的是 merge patch 的 spec.replicas
- 编辑信息 405 时确认 PUT 目标是对象地址而不是集合地址

## 产品改版后如何更新自动化

- 详情页操作变化时改 pages/app_workloads.py
