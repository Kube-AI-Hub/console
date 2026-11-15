# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01 集群网关详情 · 地址、端口与承载的应用路由

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gateway-detail`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways/cluster`
- **需求**: `prd/kube-frontend/cluster-management/gateway-detail.md`

## 产品功能

从集群网关列表点名称进入详情：属性含访问方式、IngressClass、访问地址、端口、集群 IP、TLS、副本数、镜像与控制器条件；应用路由按 ingressClassName 过滤，无路由时空态明确。

### 关联需求

- `prd/kube-frontend/cluster-management/gateway-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01** — 已知集群安装了集群网关（Nginx CR 存在），当从集群网关列表点击名称进入详情，则显示名称、状态、访问方式、IngressClass、访问地址、端口、集群 IP、TLS、副本数、镜像、创建时间、创建者、链路追踪开关与控制器条件；创建者取 metadata.annotations 里的 kubesphere.io/creator，链路追踪取 spec.deployment.annotations 里的 servicemesh.kubesphere.io/enabled（只认字符串 true），两者都是老 console 网关卡片上的字段；并列出 `ingressClassName` 等于该网关 IngressClass 的应用路由（名称/命名空间/主机/TLS/创建时间），没有时显示「该网关还没有关联的应用路由」空态；详情只读，不提供安装、编辑或删除网关的入口。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gateway-detail.md`](../../../../design/kube-frontend/cluster-management/gateway-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认集群网关对外地址与承载的路由 (Priority: P1)

作为 **集群管理员**，我希望 **在网关详情里看到它对外暴露的地址/端口，以及哪些应用路由由它承载**，以便 **判断某个域名该解析到哪里、某个路由为什么没有生效**。

**Independent Test**：从集群网关列表点击网关名称进入详情，属性能读到访问地址、端口与 IngressClass；Ingress 列表行数等于 `ingressClassName` 等于该网关 IngressClass 的应用路由数；没有路由时显示空态。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群安装了集群网关（kubesphere-controls-system 下有 Nginx CR）；Ingress 数可以为 0

## 测试步骤

1. 用 API 读 gateways 与 nginxes，定位集群网关与它的 IngressClass
2. 用 API 读集群级 ingresses，按 ingressClassName 过滤出该网关承载的路由
3. 打开集群网关列表，点击该网关名称
4. 核对 URL 与详情属性
5. 核对应用路由行数（或空态）与只读

## 期望结果

- URL 以 /gateways/<name> 结尾
- 属性区含 访问地址、端口、IngressClass、TLS、副本数、镜像
- 应用路由行数 = 该 IngressClass 的 Ingress 数；为 0 时显示「该网关还没有关联的应用路由」空态
- 有路由时名称链接含 /projects/<namespace>/ingresses/<name>
- 详情只读：没有安装/编辑/删除按钮

## 失败排查

- 列表看不到网关：集群网关所在命名空间变了（kubesphere-controls-system），分类规则需要认
- 地址为空：Service 没有 loadBalancer 入口且节点不可读时按设计显示「暂无访问地址」
- 路由行数不一致：没有按 ingressClassName 过滤，或读了别处的 Ingress
- 详情 404：路由动态段与 cluster/project 视图名冲突

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 @/pages/cluster/GatewayDetailPage.tsx；列表入口是 cluster-gateways:name:<name>
