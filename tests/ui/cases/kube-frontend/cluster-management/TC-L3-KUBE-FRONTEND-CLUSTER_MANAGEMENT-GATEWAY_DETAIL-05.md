# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-05 网关详情控制器监控

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gateway-detail`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways/{name}`
- **需求**: `prd/kube-frontend/cluster-management/gateway-detail.md`

## 产品功能

网关详情新增「监控」区块：通过 Prometheus 查询控制器容器的 CPU/内存；若部署上报 ingress 指标则追加请求速率与 5xx 速率，否则明确说明「未上报 ingress 指标」；查询失败显示不可用。

### 关联需求

- `prd/kube-frontend/cluster-management/gateway-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-05** — 已知打开集群网关详情，当滚动到「监控」区块，则通过 Prometheus instant 查询控制器 controller 容器的 CPU/内存并显示；若 Prometheus 有 nginx_ingress_controller_requests 则追加请求速率与 5xx 速率，否则明确显示「未上报 ingress 指标」而不是空图；Prometheus 不可达显示不可用 + 原因；区块只读。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gateway-detail.md`](../../../../design/kube-frontend/cluster-management/gateway-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认集群网关对外地址与承载的路由 (Priority: P1)

作为 **集群管理员**，我希望 **在网关详情里看到它对外暴露的地址/端口，以及哪些应用路由由它承载**，以便 **判断某个域名该解析到哪里、某个路由为什么没有生效**。

**Independent Test**：从集群网关列表点击网关名称进入详情，属性能读到访问地址、端口与 IngressClass；Ingress 列表行数等于 `ingressClassName` 等于该网关 IngressClass 的应用路由数；没有路由时显示空态。

## 前置与配置

- 已登录 admin；host 集群存在集群网关，Prometheus 可查询控制器容器指标
- 只读用例

## 测试步骤

1. 打开集群网关详情，滚动到「监控」区块
2. 断言 CPU/内存卡片出现且数值可读
3. 断言 ingress 指标缺失时显示明确说明（本部署 controller 未暴露 nginx_ingress_controller_requests）

## 期望结果

- CPU/内存用 PromQL instant 查询（controller 容器），失败降级不可用
- ingress 指标存在时显示请求/5xx 速率；不存在时提示未上报，不画空图
- 区块只读

## 失败排查

- 指标为空：检查 pod 正则与 container=controller 标签
- 区块不可用：检查 BFF 到 prometheus-k8s 代理是否可达

## 产品改版后如何更新自动化

- 句柄：gateway-detail:monitoring/monitor-cpu/monitor-memory/monitor-requests/monitor-errors/monitor-ingress-unavailable/monitor-unavailable
