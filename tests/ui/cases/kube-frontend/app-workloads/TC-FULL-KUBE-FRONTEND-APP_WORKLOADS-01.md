# TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01 应用负载 · 区域页签切换与工作区上下文

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `app-workloads` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

应用负载是一个功能区：八个页签共用工作区栏，页签切换是客户端跳转，不刷新文档。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01** — 已知已登录且有项目权限，当打开任一负载页，则列表出现（或给出空态），页签高亮对应当前页，工作区栏显示当前项目。
- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-02** — 已知在部署列表，当依次切到容器组、服务、部署，则每次都不产生文档请求，且最终回到部署列表。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

### US2 - 在项目内切换负载类型而不离开当前上下文 (Priority: P2)

作为 **项目运维**，我希望 **在同一个功能区的页签之间切换**，以便 **保持对项目和集群的认知，不必重新选择上下文**。

**Independent Test**：从部署切到容器组再切回，核对页签高亮与工作区栏里的项目始终不变，且浏览器没有整页刷新。

### US3 - 重启一个部署 (Priority: P2)

作为 **项目运维**，我希望 **在详情页点一次「重新部署」就滚动重启**，以便 **不必去命令行打注解**。

**Independent Test**：打开任一无状态部署的详情，点「重新部署」，核对 Pod 模板上出现 `kubectl.kubernetes.io/restartedAt` 且 revision 递增。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 部署列表可以没有对象；空态同样算列表已出现

## 测试步骤

1. 打开部署列表，记录页签、工作区栏与页面状态
2. 依次点击容器组、服务、部署页签
3. 每次切换后读取 URL、当前页签的 aria-current 与页签文案
4. 整个切换过程监听 document 类型的请求

## 期望结果

- 部署列表出现（有数据或空态），页签高亮对应当前路由
- URL 依次落到 …/pods、…/services、…/deployments
- 每次切换期间 document 请求数为 0
- 工作区栏始终显示 default 项目
- 最终回到部署列表，页签仍高亮部署

## 失败排查

- 页签切换出现 document 请求时先看 AreaTabs 的点击是否被 preventDefault
- 工作区栏为空时先看项目列表请求是否返回 200

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 句柄变化时改 pages/app_workloads.py
