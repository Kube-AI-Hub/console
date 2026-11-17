# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03 网关详情资源状态（控制器 Deployment + Pods）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gateway-detail`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways/{name}`
- **需求**: `prd/kube-frontend/cluster-management/gateway-detail.md`

## 产品功能

网关详情新增「资源状态」区块：展示控制器 Deployment 的 ready/desired 副本与 Pod 列表（名称/阶段/就绪/重启次数/创建时间）；无 Pod 或读取失败有明确说明。

### 关联需求

- `prd/kube-frontend/cluster-management/gateway-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03** — 已知打开集群网关详情，当滚动到「资源状态」区块，则显示控制器 Deployment 的 ready/desired 副本与 Pods 列表（名称、阶段、就绪、重启次数、创建时间）；Pod 按 label app.kubernetes.io/instance=<name>-ingress 读取，就绪以全部 containerStatuses.ready 为准，重启次数求和；无 Pod 显示明确空态；区块只读。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gateway-detail.md`](../../../../design/kube-frontend/cluster-management/gateway-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认集群网关对外地址与承载的路由 (Priority: P1)

作为 **集群管理员**，我希望 **在网关详情里看到它对外暴露的地址/端口，以及哪些应用路由由它承载**，以便 **判断某个域名该解析到哪里、某个路由为什么没有生效**。

**Independent Test**：从集群网关列表点击网关名称进入详情，属性能读到访问地址、端口与 IngressClass；Ingress 列表行数等于 `ingressClassName` 等于该网关 IngressClass 的应用路由数；没有路由时显示空态。

## 前置与配置

- 已登录 admin；host 集群存在集群网关且控制器 Pod 运行中
- 只读用例

## 测试步骤

1. 打开集群网关详情
2. 断言「资源状态」区块、Deployment 副本行与 Pods 表出现
3. 断言至少一行 Pod（运行中的控制器 Pod）

## 期望结果

- Pod 按 label app.kubernetes.io/instance=<name>-ingress 过滤
- 就绪以所有 containerStatuses.ready 为准；重启次数求和
- 区块只读

## 失败排查

- Pods 表为空：确认 labelSelector 与控制器实例名一致
- 副本数 0：检查 Deployment 名（Nginx fullnameOverride/网关名）

## 产品改版后如何更新自动化

- 句柄：gateway-detail:resource-status/resource-deployment/pods/pod:<name>/pods-empty
