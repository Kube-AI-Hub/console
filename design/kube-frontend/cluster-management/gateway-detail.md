# 集群网关详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/gateway-detail.md)

## 概述

集群网关详情页：join Gateway CR、Nginx CR、release 创建的 Service 与集群级 Ingress，展示地址/端口/TLS/IngressClass/副本/镜像/条件，并按 `ingressClassName` 过滤出应用路由。页面只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-05

## 设计目标与非目标

目标：一次回答「网关在哪、是什么、由谁承载、跑得怎么样」；路由按 IngressClass 过滤，空态明确。
监控/日志/资源状态/元数据 4 页签与删除入口已由 2026-11-17 重纳（见 DEC-…-GATEWAY_DETAIL-04），验收等控制器就绪。非目标：安装/升级 ingress-nginx release、编辑 Ingress。

## 关键约束

- 读 `/apis/gateway.kubesphere.io/v1alpha1/namespaces/kubesphere-controls-system/{gateways,nginxes}`；成员集群在版本后加 `clusters/<id>/` 段（与该组现有 `clusterGatewaysApi` 一致）。
- Service/节点/Ingress 走 `/kapis/resources.kubesphere.io/v1alpha3/...`，成员集群在组后加 `clusters/<id>/` 段。
- 辅助读失败只降级对应字段，不让整页失败。
- 写入口只有「删除网关」一项（重纳，见 DEC-…-GATEWAY_DETAIL-04）；安装/升级 release 仍不提供。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-08 — 监控用 PromQL 直查；ingress 指标缺失是部署事实

**为什么**：老监控页签是 ingress 请求量/4xx/5xx/时延图表，数据来自 KubeSphere 监控的 named metrics；本部署未抓取 nginx_ingress_controller_requests（实测查询为空），但控制器 CPU/内存可用。用 PromQL instant 查询 controller 容器（明确标签）得到真实资源用量，ingress 指标有则追加、无则明确说明，避免画一张永远空白的 ingress 图。

**被否方案**：把老监控 store 的 named metrics 全部搬来。它们的命名与抓取配置绑定本部署无数据，页面会出现大量空图。

**何时重新考虑**：部署开始抓取 ingress-nginx 指标后，可把请求/错误/时延曲线加回同一区块。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-07 — 日志取首个控制器 Pod 的 controller 容器，只读 200 行

**为什么**：控制器 Pod 有两个容器（controller 与 istio-proxy），日志 API 在多容器时强制 container 参数——不传会 400。选择 controller 容器（回退首个容器），tailLines=200，不做轮询/下载，页面加载时读一次；日志为空与读取失败分开，避免把权限/网络问题显示成"没有日志"。

**被否方案**：在详情页做日志流式 follow。会持续占用连接且页面离开难以清理；老 console 也是加载快照。

**何时重新考虑**：需要按关键字检索/下载日志时，接日志检索页而不是在详情内做。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-06 — 资源状态按控制器实例标签取 Pods

**为什么**：网关本身是声明对象，真实的控制器是一份 Deployment + Pods；旧 console 的资源状态页签也展示它们。Pods 用 `app.kubernetes.io/instance=<name>-ingress` 过滤（Nginx CR 的实例名固定加 `-ingress` 后缀，实测与 Pod 标签一致），Deployment 用 `serviceName`（Nginx fullnameOverride，缺省为网关名）；两者都是尽力读取，失败降级为空态而不是整页失败。

**被否方案**：从 Gateway.status 推断控制器状态。status 只有 Deployed 条件，看不到副本就绪与重启次数。

**何时重新考虑**：控制器 operator 在 Gateway.status 暴露 workload 视图时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-05 — 元数据直接取 Gateway.metadata

**为什么**：老详情的「元数据」页签只列 annotations；本页补 labels 与 resourceVersion，全部来自同一个 Gateway 对象。derived 字段（Service 的地址/端口、Nginx 的镜像/副本）已经在前面的属性区块，元数据区块不再重复解释它们，避免读者把派生值当成对象注解。

**被否方案**：合并 Service/Nginx 的注解一起展示。来源不同（三个对象），合在一张表里读者无法判断注解属于谁。

**何时重新考虑**：需要按来源分组的注解浏览器时。



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

- 项目网关详情（项目作用域的 Gateway，与集群网关不同的 CR 实例）。
- 从 Ingress 列表直接跳到该路由详情。
- 4 个页签（监控/日志/资源状态/元数据）已重纳，见 DEC-…-GATEWAY_DETAIL-04；控制器就绪后验收。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-04 — 详情 4 页签与删除重纳（2026-11-17）

**新决定**：详情补 监控 / 日志 / 资源状态 / 元数据 四个页签，并开放删除网关。**2026-11-17 产品复核决定重纳**（N-29，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)），登记口径为**重纳 + 环境阻塞**：页签可以有代码，验收等控制器就绪。

**原判断（保留，不删除）**：PRD 曾登记「安装/升级/删除集群网关与 ingress-nginx release」「网关监控曲线与日志」为不做；本文件非目标曾写「安装/升级/删除网关与 release、网关监控曲线、日志」，且关键约束曾写「只读：不渲染任何写入口」。

**为什么当时判断错了**：同 `cluster-gateways.md` DEC-…-CLUSTER_GATEWAYS-03——把「控制器未就绪，验不了」写成了「不做」。老 console 的 5 个页签里，监控与日志回答的是「这个网关为什么 502」，恰好是控制器没装好时最需要看的东西；把它登记为不做，等于在故障场景里把唯一的排障入口关掉。

**落地约定**：
1. 四个页签**按需加载**：只在打开时请求，切走不重取；单页签失败只降级该页签（复用本文件既有的「辅助读失败只降级对应字段」）。
2. 数据源缺失时显示「本集群未上报」+ 原因，**不显示空表**——空表会被读成「没有流量 / 没有错误」。
3. 删除需输入名称确认；控制器未就绪也可删（对象存在即可删），删除后回到列表并失效列表缓存。
4. 页签的数据口径沿用既有能力：监控走监控区间查询、日志走日志查询、资源状态走该 release 的容器组集合、元数据直接取已读到的 Gateway CR——不新增聚合接口。

**何时重新考虑**：控制器就绪并有一次真实流量后，用真实采样替换「未上报」分支的验收；若监控/日志页签与既有监控/日志页的重复度高于复用收益，可改为深链接而不是内嵌页签。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-04`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-05`

## 创建者与链路追踪（2026-11-16）

老 console 的网关卡片上还有两个字段，详情页此前没有：

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| 创建者 | metadata.annotations 的 kubesphere.io/creator | 与其它资源同一套注解；缺失时显示 - |
| 链路追踪 | spec.deployment.annotations 的 servicemesh.kubesphere.io/enabled | 值只认字符串 'true'，其它一律视为未开启——注解写成 True 或 1 时把「不知道」当成「已开启」会让读者误判 |

两者都来自详情页已经在读的那个 Gateway CR，不需要额外请求。
