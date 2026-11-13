# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-MOBILE-01 移动端 · 新功能区页面可横向容纳且触摸目标达标

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-MOBILE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `mobile`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/spaces/deployments`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

375px 宽度下，后续迁移的各功能区页面不出现横向滚动，且可见的按钮与链接不小于 24×24。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-MOBILE-01** — 已知在 375×812 视口下，当依次打开全部 20 个已迁移页面（配置、应用负载、存储、监控、项目设置、集群管理、访问控制、平台设置），则每页的文档宽度不超过视口（无横向滚动），且所有可见的按钮与带 `data-ai-id` 的链接均不小于 24×24。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 已登录
- 各页面在 375×812 视口下访问

## 测试步骤

1. 依次打开部署、存储卷、项目基本信息、集群系统组件、平台用户页
2. 读取 document 宽度与窗口宽度
3. 遍历可见的 button 与带 data-ai-id 的链接，读取其宽高

## 期望结果

- 所有页面 document 宽度不超过窗口宽度（无横向滚动）
- 没有小于 24×24 的可见交互目标

## 失败排查

- 出现横向滚动时检查表格容器是否 overflow-x-auto
- 触摸目标过小：页签应为 h-11 sm:h-9、排序按钮应 min-h-11 sm:min-h-0

## 产品改版后如何更新自动化

- 新增功能区时把页面加入 checks 列表
