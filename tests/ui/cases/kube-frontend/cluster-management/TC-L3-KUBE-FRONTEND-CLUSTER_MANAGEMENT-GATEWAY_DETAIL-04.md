# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-04 网关详情控制器日志

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gateway-detail`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways/{name}`
- **需求**: `prd/kube-frontend/cluster-management/gateway-detail.md`

## 产品功能

网关详情新增「日志」区块：读取首个控制器 Pod 的 controller 容器最近 200 行日志（多容器必须显式指定 container）；读取失败显示明确说明；区块只读。

### 关联需求

- `prd/kube-frontend/cluster-management/gateway-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-04** — 已知打开集群网关详情，当滚动到「日志」区块，则读取首个控制器 Pod 的 controller 容器最近 200 行日志并显示 Pod/容器/文本；多容器必须显式指定 container（否则 API 400）；读取失败显示「暂时无法读取」+ 原因；日志为空与不可用分开；区块只读、不轮询。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gateway-detail.md`](../../../../design/kube-frontend/cluster-management/gateway-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认集群网关对外地址与承载的路由 (Priority: P1)

作为 **集群管理员**，我希望 **在网关详情里看到它对外暴露的地址/端口，以及哪些应用路由由它承载**，以便 **判断某个域名该解析到哪里、某个路由为什么没有生效**。

**Independent Test**：从集群网关列表点击网关名称进入详情，属性能读到访问地址、端口与 IngressClass；Ingress 列表行数等于 `ingressClassName` 等于该网关 IngressClass 的应用路由数；没有路由时显示空态。

## 前置与配置

- 已登录 admin；host 集群存在集群网关且控制器 Pod 运行中
- 只读用例，不触发日志下载/写入

## 测试步骤

1. 打开集群网关详情，滚动到「日志」区块
2. 断言区块可见；有日志时显示 Pod/容器/最近 200 行与 pre 文本；读取失败显示不可用说明
3. 断言文本非空（运行中的 controller 至少输出启动行）

## 期望结果

- 多容器 Pod 必须带 container=controller（否则 API 返回 400）
- 日志只读、截断到 200 行，不排队/不轮询
- 日志为空与不可用是不同状态

## 失败排查

- 400 a container name must be specified：检查 container 参数
- 一直不可用：确认 /api/v1/namespaces/<ns>/pods/<pod>/log 经 BFF 可达

## 产品改版后如何更新自动化

- 句柄：gateway-detail:logs-section/logs-meta/logs/logs-unavailable
