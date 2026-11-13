# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01 重新部署 · 加载对话框与 restartedAt 注解

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `redeploy`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/redeploy.md`

## 产品功能

详情页点「重新部署」立即显示加载对话框，请求完成后 Pod 模板带上 restartedAt 注解。

### 关联需求

- `prd/kube-frontend/app-workloads/redeploy.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/redeploy.md`](../../../../prd/kube-frontend/app-workloads/redeploy.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01** — 已知在一个部署详情，当点「重新部署」，则出现加载对话框，成功后 Pod 模板带 `restartedAt` 注解。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/redeploy.md`](../../../../design/kube-frontend/app-workloads/redeploy.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/redeploy.md`](../../../../prd/kube-frontend/app-workloads/redeploy.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 重启卡住的部署 (Priority: P1)

作为 **项目运维**，我希望 **一键滚动重启**，以便 **不用去命令行打注解**。

**Independent Test**：点「重新部署」后核对 Pod 模板出现 `restartedAt`。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的部署，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该部署的详情
2. 点击「重新部署」，立即读取加载对话框
3. 轮询 Deployment，直到 spec.template.metadata.annotations 出现 restartedAt

## 期望结果

- 请求在途时加载对话框可见，标题为「重新部署」
- 请求结束后对话框关闭
- 注解 kubectl.kubernetes.io/restartedAt 存在且非空

## 失败排查

- 对话框一闪而过时用路由延迟把请求留在途中，再断言可见
- 注解缺失时确认 PATCH 打到 /apis/apps/v1 而不是 /api/v1

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 句柄变化时改 pages/app_workloads.py 与 apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx 的别处引用
