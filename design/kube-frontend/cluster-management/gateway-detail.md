# 集群网关详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/gateway-detail.md)

## 概述

集群网关详情页：join Gateway CR、Nginx CR、release 创建的 Service 与集群级 Ingress，展示地址/端口/TLS/IngressClass/副本/镜像/条件，并按 `ingressClassName` 过滤出应用路由。页面只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01

## 设计目标与非目标

目标：一次回答「网关在哪、是什么、由谁承载、跑得怎么样」；路由按 IngressClass 过滤，空态明确。
非目标：安装/升级/删除网关与 release、网关监控曲线、日志、编辑 Ingress。

## 关键约束

- 读 `/apis/gateway.kubesphere.io/v1alpha1/namespaces/kubesphere-controls-system/{gateways,nginxes}`；成员集群在版本后加 `clusters/<id>/` 段（与该组现有 `clusterGatewaysApi` 一致）。
- Service/节点/Ingress 走 `/kapis/resources.kubesphere.io/v1alpha3/...`，成员集群在组后加 `clusters/<id>/` 段。
- 辅助读失败只降级对应字段，不让整页失败。
- 只读：不渲染任何写入口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01 — Gateway + Nginx + Service 三读 join，地址不取自 CR

**为什么**：Gateway CR 只有安装意图（`spec.service.type`），Nginx CR 只有 release 配置；真正对外暴露的地址与端口在 release 创建的 Service 上（B200：NodePort http 31193 / https 32066）。地址若从 CR 猜，会得到一个永远为空或与事实不符的值。
**被否方案**：只显示 Gateway CR 的 `spec.service.type`，不显示地址。读者来详情的第一件事就是找地址。
**何时重新考虑**：operator 把地址写回 Gateway/Nginx status 时，可省掉 Service 读。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02 — 应用路由按 ingressClassName 过滤，而不是按网关名称

**为什么**：Ingress 不直接引用网关名，它引用 IngressClass；`ingressClassName` 等于 Nginx CR 的 `spec.controller.ingressClass` 才是「由该网关承载」的判据。B200 上该值为 `nginx`，当前 Ingress 集合为空，因此交付必须包含空态。
**被否方案**：按 Ingress 的注解或名称前缀猜归属。注解是控制器实现细节，名称前缀不是规范。
**何时重新考虑**：KubeSphere 引入 Gateway API 的 GatewayClass 语义时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03 — 详情路由与 `/gateways/{cluster,project}` 视图共用一个动态段

**为什么**：集群网关列表用 `/gateways/cluster` 与 `/gateways/project` 两个视图 URL（既有行为，自动化依赖），详情要落在 `/gateways/<name>`。同一层级只能有一个动态段，因此把 `cluster`/`project` 作为保留值，其余值按网关详情处理。这样既不改既有 URL，也不新增层级。
**被否方案**：新增 `/gateways/$component/$name` 两级路由。既有列表 URL 不变但详情 URL 多一层，与老 console 的 `/gateways/:type/:name` 也不一致。
**何时重新考虑**：视图切换改为列表内 Tab（无 URL）时，动态段可完全让给详情。

## 系统现状

老 console 在 `clusters/containers/Gateway`：集群网关卡片 + 项目网关列表，详情页有 monitors/config/logs/resource-status/metadata 五个页签。R-10 原先因「集群网关控制器缺 Helm chart」登记为受限；现在 nginxes 返回 1 个 Nginx（`kubesphere-router-kubesphere-system-ingress`，`kubesphere-controls-system`），Phase 4 起可迁移。本功能点只做只读详情（属性 + 路由列表），监控/日志/资源状态引用既有页面能力，另立。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/GatewayDetailPage.tsx`
- 数据层：`apps/console-next/src/pages/cluster/gatewayDetailQueries.ts`
- 路由：`routes/kube-frontend.clusters.$cluster/gateways/$name.tsx`（保留 `cluster`/`project` 视图语义）
- 列表：`apps/console-next/src/pages/cluster/ClusterGatewaysPage.tsx`（名称链接）
- 分类：`packages/api-client/src/gateways.ts` 的 `toClusterGateway`（集群网关所在命名空间更新为 `kubesphere-controls-system`）
- 用例：`tests/ui/specs|tests/kube-frontend/cluster-management/`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| Gateway CR | /apis/gateway.kubesphere.io/v1alpha1/namespaces/kubesphere-controls-system/gateways/&lt;name&gt; |
| Nginx CR | /apis/gateway.kubesphere.io/v1alpha1/namespaces/kubesphere-controls-system/nginxes |
| Service | /kapis/resources.kubesphere.io/v1alpha3/namespaces/kubesphere-controls-system/services/&lt;service&gt; |
| 节点（NodePort 地址） | /kapis/resources.kubesphere.io/v1alpha3/nodes?limit=1 |
| 应用路由 | /kapis/resources.kubesphere.io/v1alpha3/ingresses?limit=-1 |

`ingresses` 每项用到的字段：`metadata.{name,namespace,creationTimestamp}`、`spec.ingressClassName`、`spec.rules[].host`、`spec.tls[]`。

## 不变量

1. 应用路由集合 = `spec.ingressClassName` 等于该网关 IngressClass 的 Ingress。
2. 访问地址优先取 Service 的 loadBalancer 入口，否则 NodePort + 节点 InternalIP；两者都没有时显示「暂无访问地址」。
3. 只读：页面不渲染写入口。
4. 列表面板里只有集群作用域的网关名可点进详情。

## 已知坑

- **集群网关命名空间变了**：旧 operator 在 `kubesphere-system`，当前在 `kubesphere-controls-system`；`toClusterGateway` 若只认旧命名空间，列表会把它归到项目视图，详情链接也出不来。
- **地址不在 CR 上**：见上文「Gateway + Nginx + Service 三读 join」决策；不要从 `spec.service.type` 推出地址。
- **NodePort 地址需要节点**：读不到节点时留空，不要编造 IP。
- **Ingress 为 0 是现状**：B200 目前没有任何 Ingress，空态才是实际被点开看到的内容。
- **动态段保留值**：`cluster`/`project` 是视图名，不是网关名；新增路由或导航时不要占用这两个值。
- **辅助读降级**：Service/Nginx/Ingress 失败只影响对应区块。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01.yaml`
- 可观测点：`gateway-detail:surface`、`:attributes`、`:config`、`:ingresses`、`:ingresses-empty`、`:ingress:<namespace>/<name>`、`:back`、`:retry`；列表侧 `cluster-gateways:name:<name>` 是进入详情的入口。

## 后续改进

- 网关监控曲线与日志页签（引用既有监控/日志查询能力）。
- 项目网关详情（项目作用域的 Gateway，与集群网关不同的 CR 实例）。
- 从 Ingress 列表直接跳到该路由详情。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01`

## 创建者与链路追踪（2026-11-16）

老 console 的网关卡片上还有两个字段，详情页此前没有：

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| 创建者 | metadata.annotations 的 kubesphere.io/creator | 与其它资源同一套注解；缺失时显示 - |
| 链路追踪 | spec.deployment.annotations 的 servicemesh.kubesphere.io/enabled | 值只认字符串 'true'，其它一律视为未开启——注解写成 True 或 1 时把「不知道」当成「已开启」会让读者误判 |

两者都来自详情页已经在读的那个 Gateway CR，不需要额外请求。
