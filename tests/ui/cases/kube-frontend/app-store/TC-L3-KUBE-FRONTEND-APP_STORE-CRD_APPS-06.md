# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06 自制应用详情事件

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

自制应用详情展示与该应用及其组件相关的事件（按 involvedObject.name 过滤命名空间事件，含 pod 前缀事件），按时间倒序；无事件时明确空态。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07** — Given 打开自制应用详情，When 页面加载组件，Then 展示与该 Application、其 Deployment/StatefulSet/Service/Ingress 以及这些工作负载的 Pod（名称前缀）相关的事件（类型/对象/原因/消息/次数/时间），按最后时间倒序；无事件时显示明确空态；事件读取失败显示错误与重试；事件区块只读。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 删除不再使用的自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在自制应用详情里删除应用**，以便 **清理不再使用的工作负载聚合；删除以应用对象为准，组件由 ownerReference/控制器处理**。

**Independent Test**：进入应用详情点删除，输入对象名确认后 Application 404、回到列表且行消失；未输入正确名称时按钮不可用。

## 前置与配置

- 已登录 admin；项目 default 可用；用例自建 Application+Deployment，finally 清理

## 测试步骤

1. API 创建临时 Application 与 Deployment（触发 ScalingReplicaSet 事件）
2. 打开详情，滚动到「事件」区块
3. 断言事件表出现且包含该 Deployment 的事件；无事件时显示空态（正常情况下不应发生）
4. finally 删除 Deployment/Application

## 期望结果

- 事件只包含该应用/组件/pod 前缀相关对象，按最后时间倒序
- 事件读取失败显示错误与重试；无事件显示空态
- 事件是只读区块

## 失败排查

- 表为空：确认命名空间 events 有该 deployment 的 involvedObject，且名称在组件列表/前缀内
- 显示无关事件：检查过滤条件是否只按 involvedObject.name

## 产品改版后如何更新自动化

- 句柄：composed-app-detail:events/events-table/event:<i>/events-empty/events-retry
