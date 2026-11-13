# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01 负载详情 · 六项属性与容器镜像

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

点击列表名称进入详情，属性块展示集群、项目、应用、副本、创建时间、创建者，并列出容器镜像。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01** — 已知列表里有一个部署，当点击名称，则进入 `…/deployments/<name>` 并显示属性与容器镜像。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 由用例的 fixture 创建一个带固定镜像的 tc-e2e- 部署，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开部署列表并点击目标部署的名称
2. 等待详情主区就绪
3. 读取属性标签、集群/项目/副本的值与容器镜像

## 期望结果

- URL 以 /deployments/<name> 结尾
- 属性标签依次为 集群、项目、应用、副本、创建时间、创建者
- 集群为 host，项目为 default，副本为 0/1
- 容器镜像块出现且包含创建时指定的镜像

## 失败排查

- 详情显示成列表时先看路由文件夹的 route.tsx 是否渲染 Outlet
- 属性缺失时看 WorkloadDetailPage 的 Row 是否仍在渲染

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 属性顺序变化时改 pages/app_workloads.py
