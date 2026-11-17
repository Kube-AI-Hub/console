# 集群网关详情（L3）

[子模块需求](./_index.md)

## 概述

集群网关（ingress-nginx）的详情页：`/kube-frontend/clusters/<cluster>/gateways/<name>`。展示网关的访问方式、IngressClass、访问地址、端口、TLS 能力、副本数、镜像、控制器条件，以及由它承载的应用路由（Ingress）列表。

当前 operator（KubeSphere 4 网关控制器）把集群网关安装为 `kubesphere-controls-system` 里的一个 Helm release：一个 Gateway CR（安装意图）与一个 Nginx CR（ingress-nginx release）。地址与端口不在两个 CR 上，而在 release 创建的 Service 上，因此详情页需要把这三者（外加 Ingress 列表）join 起来。R-10 原先因「缺 Helm chart」登记为受限，现在 nginxes 返回 1 个对象，详情可以真正落地。

## 用户故事

### US1 - 确认集群网关对外地址与承载的路由 (Priority: P1)

作为 **集群管理员**，我希望 **在网关详情里看到它对外暴露的地址/端口，以及哪些应用路由由它承载**，以便 **判断某个域名该解析到哪里、某个路由为什么没有生效**。

**Independent Test**：从集群网关列表点击网关名称进入详情，属性能读到访问地址、端口与 IngressClass；Ingress 列表行数等于 `ingressClassName` 等于该网关 IngressClass 的应用路由数；没有路由时显示空态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01** — 已知集群安装了集群网关（Nginx CR 存在），当从集群网关列表点击名称进入详情，则显示名称、状态、访问方式、IngressClass、访问地址、端口、集群 IP、TLS、副本数、镜像、创建时间、创建者、链路追踪开关与控制器条件；创建者取 metadata.annotations 里的 kubesphere.io/creator，链路追踪取 spec.deployment.annotations 里的 servicemesh.kubesphere.io/enabled（只认字符串 true），两者都是老 console 网关卡片上的字段；并列出 `ingressClassName` 等于该网关 IngressClass 的应用路由（名称/命名空间/主机/TLS/创建时间），没有时显示「该网关还没有关联的应用路由」空态；详情只读，不提供安装、编辑或删除网关的入口。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-05** — 已知打开集群网关详情，当滚动到「监控」区块，则通过 Prometheus instant 查询控制器 controller 容器的 CPU/内存并显示；若 Prometheus 有 nginx_ingress_controller_requests 则追加请求速率与 5xx 速率，否则明确显示「未上报 ingress 指标」而不是空图；Prometheus 不可达显示不可用 + 原因；区块只读。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-04** — 已知打开集群网关详情，当滚动到「日志」区块，则读取首个控制器 Pod 的 controller 容器最近 200 行日志并显示 Pod/容器/文本；多容器必须显式指定 container（否则 API 400）；读取失败显示「暂时无法读取」+ 原因；日志为空与不可用分开；区块只读、不轮询。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03** — 已知打开集群网关详情，当滚动到「资源状态」区块，则显示控制器 Deployment 的 ready/desired 副本与 Pods 列表（名称、阶段、就绪、重启次数、创建时间）；Pod 按 label app.kubernetes.io/instance=<name>-ingress 读取，就绪以全部 containerStatuses.ready 为准，重启次数求和；无 Pod 显示明确空态；区块只读。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02** — 已知打开集群网关详情，当滚动到「元数据」区块，则显示 Gateway 对象的 labels、annotations 与 resourceVersion；空 labels/annotations 显示「暂无元数据」；两列取值直接来自 metadata，不经过 Service/Nginx 派生；区块只读。

## 设计目标

1. 一次回答「网关在哪、是什么、由谁承载、跑得怎么样」。
2. 路由列表按 IngressClass 过滤——这是应用路由实际路由到该网关的判据。
3. 只读：安装/升级/删除网关属于集群管理员的安装流程。

## 约束与边界

- 读 `/apis/gateway.kubesphere.io/v1alpha1/namespaces/kubesphere-controls-system/{gateways,nginxes}`；成员集群按该组的惯例在版本后加 `clusters/<id>/` 段。
- 地址与端口读 release 创建的 Service（`/kapis/resources.kubesphere.io/v1alpha3/.../namespaces/kubesphere-controls-system/services/<service>`）；NodePort 类型用节点 InternalIP + http NodePort 组成可访问地址。
- 应用路由按集群级 Ingress 集合过滤 `spec.ingressClassName`；B200 当前 Ingress 数为 0，空态是实际交付路径。
- 辅助读（Service/Nginx/Ingress/节点）失败只让对应字段显示 `-` 或空态，不让整页失败。
- 只读。

## UI 交互设计

- 页头：网关名称 + 状态徽标（已就绪 / 部署中）；返回「集群网关」列表。
- 属性区：命名空间、作用域（集群网关）、访问方式、IngressClass、访问地址、端口、集群 IP、TLS、副本数、镜像、创建时间、控制器条件；控制器 config 有值时就地列出。
- 应用路由区：表头 名称/命名空间/主机/TLS/创建时间，名称链到项目内应用路由详情；无路由显示空态（含「按 ingressClassName 匹配」的说明）。
- 加载中骨架；读取失败错误面板 + 重试。

## 文案与校验

- 访问地址为空时显示「暂无访问地址」，不显示空白。
- TLS 显示为「由应用路由的 TLS 配置决定」或「未暴露 HTTPS 端口」，不把网关层的 TLS 说成可有可无的开关。
- 端口按 `名称 端口 / NodePort 节点端口` 展示。
- 状态沿用网关列表用词（已就绪 / 部署中）。

## 边界情况

- Ingress 数为 0：应用路由区显示空态，而不是空表。
- Service/LB 尚未分配地址：访问地址显示「暂无访问地址」，其余字段照常。
- 网关未就绪（Deployed 条件非 True）：状态徽标为部署中，控制器条件原样列出，便于定位失败原因。
- NodePort 且没有可读节点：地址留空显示「暂无访问地址」，不编造 IP。
- 打开的是项目网关名称：本页读的是集群网关（`kubesphere-controls-system`），找不到时报「读取失败」，不伪造项目网关详情。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01** — 集群网关详情属性（地址/端口/TLS/IngressClass/副本/镜像/条件）。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02** — 按 IngressClass 过滤的应用路由列表与明确空态。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03** — 列表页名称链接到详情，详情只读。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01** — 访问地址/端口与该网关 Service 一致；Ingress 行数 = 该 IngressClass 的路由数（0 时为空态）。

## 明确不做

- 安装/升级 ingress-nginx release（属安装流程，写操作）。
- 编辑 Ingress（回项目页）。

## 重纳能力（2026-11-17 产品复核）

原登记「安装/升级/删除集群网关与 ingress-nginx release」「网关监控曲线与日志」。**2026-11-17 产品复核决定重纳**（N-29，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)）：详情补 4 个页签，删除入口随之打开（安装/升级 release 仍不做，那是安装器职责）。

**这是「重纳 + 环境阻塞」，不是「已可验收」**——控制器未就绪时页签可以有代码，但验收等控制器。

待交付：

1. **监控**：网关的请求量 / 延迟 / 错误率曲线，复用既有监控区间查询。
2. **日志**：网关访问日志与错误日志，复用既有日志查询能力（老 console `Gateway/Detail/GatewayLog`）。
3. **资源状态**：该网关 release 的容器组与其状态。
4. **元数据**：网关对象的 labels / annotations 列表。

约束：

- 四个页签按需加载（打开才请求），单个页签失败只降级该页签，不让整页失败。
- 数据源缺失时（控制器未就绪、监控未上报、日志后端未启用）显示「本集群未上报」并说明原因，**不显示空表**——空表会被读成「没有流量」。
- 删除网关需输入名称确认；控制器未就绪时删除仍应可用（对象存在即可删）。

**待补登记**：对应 `US` / `AC` 未编号，与实现同批补齐（新增无覆盖 AC 会让 `check_docs.py --strict` 失败）。

## 假设

- 集群网关的 IngressClass 由 Nginx CR 的 `spec.controller.ingressClass` 声明（B200 上为 `nginx`）。
- 网关的 Service 名等于 Nginx CR 的 `spec.fullnameOverride`（B200 上为 `kubesphere-router-kubesphere-system`）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01`
