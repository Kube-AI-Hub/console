# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02 网关详情元数据（标签/注解/ResourceVersion）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gateway-detail`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways/{name}`
- **需求**: `prd/kube-frontend/cluster-management/gateway-detail.md`

## 产品功能

网关详情新增「元数据」区块：展示 Gateway 的 labels、annotations 与 resourceVersion；空值显示明确说明；只读。

### 关联需求

- `prd/kube-frontend/cluster-management/gateway-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02** — 已知打开集群网关详情，当滚动到「元数据」区块，则显示 Gateway 对象的 labels、annotations 与 resourceVersion；空 labels/annotations 显示「暂无元数据」；两列取值直接来自 metadata，不经过 Service/Nginx 派生；区块只读。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gateway-detail.md`](../../../../design/kube-frontend/cluster-management/gateway-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gateway-detail.md`](../../../../prd/kube-frontend/cluster-management/gateway-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认集群网关对外地址与承载的路由 (Priority: P1)

作为 **集群管理员**，我希望 **在网关详情里看到它对外暴露的地址/端口，以及哪些应用路由由它承载**，以便 **判断某个域名该解析到哪里、某个路由为什么没有生效**。

**Independent Test**：从集群网关列表点击网关名称进入详情，属性能读到访问地址、端口与 IngressClass；Ingress 列表行数等于 `ingressClassName` 等于该网关 IngressClass 的应用路由数；没有路由时显示空态。

## 前置与配置

- 已登录 admin；host 集群存在集群网关（安装器创建）
- 只读用例，不修改对象

## 测试步骤

1. 打开集群网关详情，等待 surface 就绪
2. 滚动到「元数据」区块
3. 断言标签/注解两列存在；注解包含 kubesphere.io/creator（或显示空态说明）
4. 断言 resourceVersion 显示非空

## 期望结果

- 元数据取自 Gateway.metadata，不经过 Service/Nginx 派生
- 空 labels/annotations 显示「暂无元数据」
- 区块只读

## 失败排查

- 元数据空：确认 gateway 对象 metadata.labels/annotations 真实为空
- 与列表不一致：列表与详情读同一 Gateway 对象

## 产品改版后如何更新自动化

- 句柄：gateway-detail:metadata/labels/annotations
