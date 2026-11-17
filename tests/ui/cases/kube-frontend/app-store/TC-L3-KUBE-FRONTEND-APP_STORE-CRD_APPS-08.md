# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08 自制应用详情流量治理

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

自制应用详情展示服务网格流量子图：可用时有节点/边摘要与节点表（类型/应用/工作负载/服务/命名空间，外部节点标注）；应用无流量节点时明确空态；服务网格不可用时显示未上报而不是空表。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09** — Given 服务网格可用，When 打开自制应用详情，Then「流量治理」区块展示该应用子图（按 app/工作负载/Service 名称过滤命名空间 graph），有节点时给出节点/边摘要与节点表（类型、应用/工作负载/服务、命名空间、外部节点标注）；应用无节点时显示空态；服务网格不可用（404/5xx）显示「未上报」而不是空表；区块只读。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 删除不再使用的自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在自制应用详情里删除应用**，以便 **清理不再使用的工作负载聚合；删除以应用对象为准，组件由 ownerReference/控制器处理**。

**Independent Test**：进入应用详情点删除，输入对象名确认后 Application 404、回到列表且行消失；未输入正确名称时按钮不可用。

## 前置与配置

- 已登录 admin；项目 default 可用；用例自建唯一 Application，finally 删除

## 测试步骤

1. API 创建临时 Application（无工作负载，确保无网格节点）
2. 打开详情，滚动到「流量治理」区块
3. 断言区块可见，且显示「暂无该应用的流量节点」或「未上报服务网格流量」之一

## 期望结果

- 有节点时显示摘要（节点/边）与节点表
- 无节点与模块不可用是两种不同说明
- 流量区块只读

## 失败排查

- 区块一直 loading：确认 graph 请求返回 200 或 4xx/5xx 被归类为 unavailable
- 出现无关节点：过滤条件只保留 app/workload/service 命中项

## 产品改版后如何更新自动化

- 句柄：composed-app-detail:traffic/traffic-empty/traffic-unavailable/traffic-table/traffic-node:<id>/traffic-retry
