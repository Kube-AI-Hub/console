# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03 工作负载列表 · 空态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/ingresses`
- **需求**: `prd/kube-frontend/app-workloads/list.md`

## 产品功能

项目内没有该类型对象时，列表显示空态标题与说明，而不是空白表格。

### 关联需求

- `prd/kube-frontend/app-workloads/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03** — 已知项目内没有任何该类型对象，当打开该页，则显示空态标题与说明。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list.md`](../../../../design/kube-frontend/app-workloads/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 该类型（应用路由）在 default 项目里没有对象；若已有对象，用例会明确跳过而不是伪造空态

## 测试步骤

1. 用 API 确认应用路由总数为 0
2. 打开应用路由列表
3. 读取主区 state、空态标题与说明

## 期望结果

- 主区 data-ai-state 为 empty
- 显示「暂无应用路由」与「创建应用路由后，这里会列出它们。」

## 失败排查

- 先确认该类型确实没有对象；有对象时这个用例应跳过
- 文案缺失时看描述符的 emptyTitleKey / emptyDescriptionKey

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 空态结构变化时改 pages/app_workloads.py
