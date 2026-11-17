# 自制 CRD 应用（L3）

[子模块需求](../../../prd/kube-frontend/app-store/crd-apps.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-04
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10
- AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-11

## 概述

项目 › 自制应用列表：读 Application（app.k8s.io/v1beta1）集合，按 spec.selector.matchLabels 匹配同 namespace 的 Deployment/StatefulSet/Service/Ingress，展示健康、组件数、版本、创建时间。独立于 Helm 已安装应用。只读。

## 设计目标与非目标

目标：健康/组件可读且口径明确；与 release 页面分离。非目标：创建（多对象事务）、详情页签、编辑/删除。

## 关键约束

- Application 集合来自 /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/applications。
- 服务端不提供组件 join；deployments/statefulsets/services/ingresses 各读一次（limit=-1）在页面侧按 selector 匹配。
- 健康由匹配工作负载的 readyReplicas/replicas 聚合；无工作负载或 desired=0 为未知。
- 路由 /applications/composing 与旧 console 对齐；入口在项目应用列表右上。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01 — 组件与健康在页面侧聚合，不新增服务端接口

**为什么**：Application 只声明 selector，组件是同一 namespace 的普通对象；服务端没有 join 接口。一次并行读四类集合（项目量级）比引入新聚合接口简单，且与工作负载页数据同源。健康用 readyReplicas/replicas 而不是读取 events/conditions，避免多一次昂贵查询且口径可解释。

**被否方案**：逐个 Application 查询带 labelSelector 的组件（请求数随应用数放大）；读取 servicemesh 健康（依赖模块，且老页面列表也不要求）。

**何时重新考虑**：Application 数量增长到一次读取不可接受，或平台提供聚合接口时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02 — 独立页面，不并入 Helm 已安装应用

**为什么**：release（openpitrix）与 Application（app.k8s.io）对象不同，动作不同（安装/卸载 vs 工作负载聚合）；并入一个表会让两套状态语义混在一起。旧 console 用 banner 页签切换，新 UI 用独立路由 + 应用页入口。

**被否方案**：在应用列表加类型筛选。列语义、动作、空态都不同，筛选后仍要两套渲染。

**何时重新考虑**：产品希望统一「应用」心智模型并提供跨类型搜索时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03 — 详情复用列表的匹配函数，不用单独接口

**为什么**：详情需要组件对象（工作负载就绪、Service 类型/ClusterIP、Ingress hosts），而列表已经实现了 selector 匹配；抽成同一个 fetchComponents/matchAll/toSummary 后，列表与详情不会出现「行上有、点进去没有」的口径分叉。

**被否方案**：详情页调用单独的组件聚合接口。服务端没有这个接口；即便新增，也要保证与列表同一匹配语义，维护两份实现。

**何时重新考虑**：平台提供 Application 的资源图接口时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05 — 创建先 dry-run 全量校验，真实失败回滚已建对象

**为什么**：一个自制应用是三个对象（Application/Deployment/Service），旧实现用 withDryRun 先全量 dry-run 再写；用户在表单里最容易犯的错误（名称、镜像、端口、selector）都能在 dry-run 阶段被 apiserver 拒绝，不会留下半个应用。真实写入中途失败时，旧实现没有回滚；这里补上「删除已创建对象」，否则列表会出现永远无法聚合的 Application。

**被否方案**：直接并发写三个对象。部分成功没有清理路径；串行写但不回滚同样留下脏对象。

**何时重新考虑**：平台提供 composed-app 聚合创建接口时（一次事务由服务端保证）。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06 — 删除只删 Application，级联交给 ownerReference

**为什么**：旧 console 的删除走通用 resource.delete，即删 Application 对象；组件是否消失由 ownerReference（Application spec.addOwnerRef 与 app.k8s.io 控制器）决定。客户端逐个删组件会在控制器已级联时产生 404、在控制器缺失时又删错共享组件（selector 可能匹配到别处创建的对象）；以 Application 为唯一删除目标，语义最小且可回读。

**被否方案**：客户端先删组件再删 Application。顺序失败会留下无组件的 Application；且无法判断组件是否属于该应用还是恰好同标签。

**何时重新考虑**：平台提供 composed-app 事务删除接口时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07 — 编辑信息只改注解，复用共享 EditInfoDialog

**为什么**：别名/描述在 Application 上是 annotations；模板与旧 console 的资源编辑语义一致。复用 EditInfoDialog 的 merge-patch（清空键 null）避免再写一套表单，也避免把 selector/组件一起覆盖。

**被否方案**：整对象 PUT。会连 selector 与 labels 一起写回，表单没有这两个字段，容易被旧读覆盖新状态。

**何时重新考虑**：平台把别名/描述提升为 spec 字段时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08 — 事件读命名空间集合后按对象名过滤

**为什么**：事件没有按多个对象名批量查询的接口，kapis 代理又忽略 fieldSelector；一次读命名空间事件（上限 500）后在页面按 involvedObject.name 过滤，数据与工作负载页同源。除组件对象本身，还包含名称以 <组件名>- 开头的 Pod 事件——Pod 事件是排障最常用的那一类，而 Pod 名带随机后缀，无法精确枚举。

**被否方案**：对每个组件分别查询事件（请求数放大）；只按 Application 名过滤（几乎没有事件，Application 是声明式对象）。

**何时重新考虑**：代理支持 fieldSelector 或平台提供按 selector 的事件聚合时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09 — 路由作为独立 Ingress 写入，后端只能选应用内 Service

**为什么**：路由在对象层就是 networking.k8s.io/v1 Ingress；把它并入创建事务会让"先建应用、后加路由"（旧 console 的 add route）无法复用。详情弹窗把后端限制为该应用当前匹配出的 Service，避免路由指向应用外对象；Ingress 带 app=<name> 标签，因此下一次读取详情时会自动出现在路由区块。

**被否方案**：创建对话框一次收域名；会让"只创建应用"多一个可跳过但复杂的步骤，且失败回滚范围扩大。

**何时重新考虑**：产品要求在创建向导里一次配置路由时，可复用同一 addRoute 请求。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10 — 流量读命名空间 graph 后在页面侧取应用子图

**为什么**：servicemesh graph 的接口是命名空间级，返回节点带 app/workload/service 与 isOutside；应用详情需要的只是命中该应用（或其组件）的节点及其间的边。一次读 300s graph 在页面过滤，比按节点逐个查询简单，且与老 console 的 servicemesh 数据源一致。没有 sidecar 的工作负载本来就不上报（语义正确），不能把「没有节点」显示成模块不可用。

**被否方案**：用 health API 按服务逐个查询（请求放大，且 health 端点在本部署 404）。

**何时重新考虑**：平台提供按 app 的 graph 查询参数时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-11 — 链路按 Service 查询，页面只展示样本摘要

**为什么**：tracing 接口是 `/namespaces/<ns>/services/<svc>/traces`，没有按 app 的批量入口；应用 Service 数通常很少，逐个查询后按 traceID 去重即可。列表接口不返回顶层耗时，耗时由 span 的 `startTime+duration` 窗口推导；没有 trace 与模块不可用必须分开显示。

**被否方案（部分修正）**：原先只交付摘要、不做瀑布图；现在在摘要行内展开一个简化的 span 瀑布（startOffset/duration 相对条形），不重建调用树、不做检索。完整 tracing 检索仍需要独立设计。

**何时重新考虑**：平台提供按 app 的 traces 聚合接口，或需要瀑布图/检索时。

### DEC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-12 — 灰度读 Strategy 集合，按 selector/hosts 取应用策略

**为什么**：灰度在对象层是 servicemesh Strategy（selector + template hosts/http）；没有按 app 的查询参数，一次读命名空间集合（上限 500）后按 selector.app 或 hosts 命中应用 Service 过滤，数据与旧 console 的灰度页签同源。类型由 http 首条规则推断（mirror/match/route），因为 CR 没有 type 字段。

**写操作归宿**：详情只读；创建/编辑/删除 Strategy 走项目级「灰度发布」向导（已迁移），详情提供「管理灰度发布」链接，避免在应用详情重复一套写表单。

**被否方案**：只按 hosts 过滤。selector 与 hosts 可能不同步，漏掉按 selector 命中的应用策略；两者取并集更符合"命中该应用"。

**何时重新考虑**：平台提供按 app 的 Strategy 查询时。

## 系统现状

老 console projects/containers/Applications/CRDApps.jsx：列表列 名称/状态/版本/创建时间 + 创建；详情有资源/事件/流量/链路页签。新 UI 此前 applications 只渲染 openpitrix release；本批补列表。

## 仓库落点

- apps/console-next/src/pages/appstore/ComposedAppsPage.tsx
- apps/console-next/src/routes/.../applications/composing/{route,index}.tsx
- apps/console-next/src/pages/appstore/InstalledAppsPage.tsx（入口链接）
- packages/api-client/src/apps.ts（composedAppsApi）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| Application 集合 | GET /kapis/resources…/namespaces/<ns>/applications?limit=-1 | metadata.name/namespace/labels/creationTimestamp、spec.selector.matchLabels |
| 组件集合 | GET 同前缀 /{deployments,statefulsets,services,ingresses}?limit=-1 | metadata.labels、spec.replicas、status.readyReplicas |
| 创建 Application | POST /apis/app.k8s.io/v1beta1/namespaces/<ns>/applications（dry-run 再真实） | selector.matchLabels={app:<name>}、version 标签、description 注解 |
| 创建 Deployment | POST /apis/apps/v1/namespaces/<ns>/deployments | 同名标签、镜像、副本、containerPort |
| 创建 Service | POST /api/v1/namespaces/<ns>/services | selector={app:<name>}、port/targetPort |
| 编辑信息 | PATCH /apis/app.k8s.io/v1beta1/namespaces/<ns>/applications/<name>（merge-patch） | 只发 metadata.annotations；清空键 null |
| 添加路由 | POST /apis/networking.k8s.io/v1/namespaces/<ns>/ingresses（dry-run 再真实） | 标签 app=<name>、rules.host/path、backend service name/number |
| 删除应用 | DELETE /apis/app.k8s.io/v1beta1/namespaces/<ns>/applications/<name>（成员 /apis/clusters/<c>/…） | 只删 Application；组件由 ownerReference/控制器级联 |

## 不变量

1. 行集合 = Application items。
2. 组件计数 = selector 匹配的对应对象数。
3. 健康：无工作负载/desired=0 → unknown；ready>=desired → healthy；ready=0 → degraded；否则 progressing；detail 为 ready/desired。
4. 页面提供创建（host 集群）：Application + 每个组件一个 Deployment/Service 先全部 dry-run 成功，再真实写入；真实阶段失败时删除已创建对象。
5. 组件名在应用内唯一；所有组件对象使用同一 app=<name> 标签，Application selector 只声明该标签。

## 已知坑

- selector 为空时 every 为真，匹配所有组件——这是 Application 语义，不额外修正。
- desired=0 不能算「健康」，否则空应用会被误报为正常。
- ingress/service 匹配不计入健康，只计数组件。
- 四类集合任一失败应整页错误（数据互相依赖），不要用空数组掩盖。

## 测试与可观测

E2E：TC-…-CRD_APPS-01（列表/详情/入口）与 TC-…-CRD_APPS-02（创建），均在 B200 通过。单测：packages/api-client/test/composed-apps.test.ts（匹配/健康/未知/异常/创建 dry-run、三对象 body、回滚）。
可观测点：composed-apps:surface/table/name:<name>/back/retry；composed-app-detail:surface/workloads/service:<name>/ingress:<name>/back/retry；installed-apps:composed-link。

## 后续改进

创建（Application + 工作负载/服务/路由事务）、详情（资源/事件/流量/链路）、删除级联、按健康筛选。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-04
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10
