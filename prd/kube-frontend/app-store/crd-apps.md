# 自制 CRD 应用（L3）

> 模块：应用商店（app-store）· 功能点：crd-apps。作用域：项目（命名空间）。
> 旧 console 路径：/projects/<ns>/applications/composing（列表 + 创建 + 详情）；新 UI 本批交付**独立只读列表**。

## 概述

项目 › 自制应用：一个 app.k8s.io/v1beta1 Application 的 selector 命名的 Deployment/StatefulSet/Service/Ingress 组成一个应用。列表按 Application 展示名称、健康、组件数、版本与创建时间；组件与健康由页面按 selector 聚合（接口只返回 Application 对象）。

与「项目内应用（openpitrix release）」是两个对象、两个页面，不合并：release 是 helm 安装实例，Application 是工作负载聚合。

## 用户故事

### US1 - 看清项目里有哪些自制应用以及是否健康 (Priority: P2)

作为 **项目使用者**，我希望 **在项目控制台看到 Application 聚合出的应用、健康与组件数**，以便 **判断自制应用是否正常，而不是逐个翻工作负载**。

**Independent Test**：项目里创建一个 Application（selector=app:v1）与一个同标签 Deployment，打开 /applications/composing，行出现且组件工作负载数为 1、健康显示就绪比；无 Application 时显示空态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01** — 已知项目 namespace 下有 N 个 Application（N 可能为 0），当打开 /kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/applications/composing，则列出 N 行，每行显示名称、健康徽标（含就绪比，如 1/2）、组件数（工作负载/服务/路由）、版本（Application 的 app.kubernetes.io/version 标签）、创建时间；组件由 Application spec.selector.matchLabels 匹配同 namespace 的 Deployment/StatefulSet/Service/Ingress 计算，健康由匹配工作负载的 readyReplicas/replicas 计算（无工作负载=未知，全部就绪=健康，部分=更新中，0=异常）；N=0 时显示空态标题与说明；接口失败显示错误面板与重试；页面只读，无创建/编辑/删除入口。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-11** — Given 服务网格可用，When 打开自制应用详情，Then「灰度发布」区块展示命中该应用（selector.app=<name> 或 hosts 命中应用 Service）的 Strategy：名称、类型（按流量比例/按内容/流量镜像）、命中服务、选择器；无策略显示空态；策略接口不可用（404/5xx）显示「未上报」而不是空表；区块只读，并提供「管理灰度发布」链接到项目级灰度发布页（写操作在那里承接）。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10** — Given 应用有 Service，When 打开详情，Then「链路追踪」区块逐个 Service 读取 traces（limit=10）：有样本时显示 traceID/服务/span 数/耗时（耗时由 span 窗口计算）；点击行展开调用链，按 span 的 startOffset/duration 画瀑布条（最多 100 个 span，按起点排序），无样本显示空态，tracing 模块不可用（404/5xx）显示「未上报」而不是空表；区块只读。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09** — Given 服务网格可用，When 打开自制应用详情，Then「流量治理」区块展示该应用子图（按 app/工作负载/Service 名称过滤命名空间 graph），有节点时给出节点/边摘要与节点表（类型、应用/工作负载/服务、命名空间、外部节点标注）；应用无节点时显示空态；服务网格不可用（404/5xx）显示「未上报」而不是空表；区块只读。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08** — Given 自制应用已有一个带端口的 Service，When 详情点「添加路由」填域名/路径并选择后端服务/端口提交，Then 创建带 app=<name> 标签、rules.host/path、backend.service 指向该 Service:port 的 Ingress（dry-run 先校验，失败回滚）；成功后详情路由区块出现该 Ingress；无 Service 时不显示入口；域名/路径/服务/端口非法时本地拒绝。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07** — Given 打开自制应用详情，When 页面加载组件，Then 展示与该 Application、其 Deployment/StatefulSet/Service/Ingress 以及这些工作负载的 Pod（名称前缀）相关的事件（类型/对象/原因/消息/次数/时间），按最后时间倒序；无事件时显示明确空态；事件读取失败显示错误与重试；事件区块只读。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06** — Given 创建对话框有多于一个组件（每行组件名/镜像/副本/端口），When 提交，Then 每个组件各创建一个 Deployment 与一个 Service（名称 <app>-<component>），全部带同一 app=<name> 标签并挂在同一 Application selector 下；全部对象先 dry-run 再真实写入，任一失败回滚；组件名为空/重复/非法、镜像为空、副本<1、端口越界时本地拒绝。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05** — Given 打开自制应用详情，When 点「编辑信息」修改别名/描述并保存，Then 只对 Application metadata.annotations 发 merge-patch（清空键 null），不触碰 spec/selector/组件；成功后详情显示别名、接口回读一致；失败保留弹窗与原因。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-04** — Given 打开自制应用详情，When 点删除并输入完整对象名确认，Then 发出 DELETE /apis/app.k8s.io/v1beta1/namespaces/<ns>/applications/<name>；成功后回到列表、该行消失、接口回读 404；取消或名称不匹配时不发请求。组件是否级联删除取决于 ownerReference（addOwnerRef 与 app.k8s.io 控制器），页面不自行级联，也不把组件残留伪装成删除失败。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03** — Given 在 composing 页点「创建自制应用」，When 名称/镜像/副本/端口合法并提交，Then 依次创建 Application（selector.matchLabels={app:<name>}）、Deployment 与 Service（同标签），dry-run 先校验再真实写入；成功后弹窗关闭、列表出现该应用且组件/健康正确、详情可见该工作负载。名称为空/非法、镜像为空、副本<1、端口越界时本地拒绝且不发请求；真实写入中途失败时删除已创建对象并把错误留在弹窗内。成员集群不渲染创建入口。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02** — 已知点击列表中的自制应用名称，当进入 /applications/composing/<name>，则显示该 Application 的基本信息（名称、namespace、健康徽标+就绪比、版本、创建时间）、selector，以及由 selector 匹配出的工作负载（Kind、就绪/期望）、服务（类型、ClusterIP）、路由（hosts）列表；与列表同源匹配规则，组件缺失时给出明确空说明；返回链接回到列表；页面只读。

### US2 - 创建自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在项目里直接创建一个自制应用（名称、镜像、副本、端口）**，以便 **不用分别去建 Application、Deployment 与 Service**。

**Independent Test**：打开 composing 页点创建，填名称/镜像/副本/端口提交；列表出现该应用（工作负载 1、服务 1）；API 中 Application selector 与 Deployment/Service 标签一致；详情能下钻到工作负载。

### US3 - 删除不再使用的自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在自制应用详情里删除应用**，以便 **清理不再使用的工作负载聚合；删除以应用对象为准，组件由 ownerReference/控制器处理**。

**Independent Test**：进入应用详情点删除，输入对象名确认后 Application 404、回到列表且行消失；未输入正确名称时按钮不可用。

### US4 - 修改自制应用的别名与描述 (Priority: P3)

作为 **项目使用者**，我希望 **在应用详情编辑别名与描述**，以便 **让列表/详情用业务名称而不是对象名沟通**。

**Independent Test**：详情点编辑信息，填别名/描述保存；详情显示别名，接口 annotations 中 alias/description 与输入一致；清空描述后注解被移除。

## 设计目标

- 健康与组件数一眼可读，且口径明确（selector 匹配、就绪比）。
- 与 Helm 已安装应用明确分开：入口在应用列表页右上「自制应用」，路由独立，互不影响。

## 约束与边界

- 读 /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/applications（Application 集合），再并行读 deployments/statefulsets/services/ingresses（limit=-1）在页面侧匹配；服务端没有 join 聚合。
- 组件匹配：Application selector 的所有键值都等于对象 metadata.labels。
- 健康：所有匹配工作负载 readyReplicas 之和 vs replicas 之和；desired=0 视为未知；无匹配工作负载也未知。
- 只读；创建/详情/删除是后续批次（创建是多对象事务）。

## UI 交互设计

- 列表：名称（含 namespace）、健康徽标、组件数、版本、创建时间；顶部「返回应用列表」。
- 应用列表页右上增加「自制应用」链接（项目作用域）。
- data-ai-id：composed-apps:surface/table/name:<name>/back/retry；entry: installed-apps:composed-link。

## 文案与校验

- 列：名称、健康状态、组件、版本、创建时间。
- 健康：健康 / 更新中 / 异常 / 未知，后接就绪比（如 1/2）。
- 组件：工作负载 N · 服务 N · 路由 N。
- 空态：「还没有自制应用」+ 说明创建流程后续批次交付。

## 边界情况

- Application selector 为空：匹配所有组件（Object.entries 为空时 every 为真）——这是对象本身的语义，页面不特殊改写。
- 匹配工作负载 replicas=0：健康未知（没有可比较的副本）。
- Ingress/Service 缺失：对应计数为 0，不隐藏行。
- 接口失败：错误面板 + 重试，保留行；单接口失败使整页错误（数据互相依赖）。

- 创建范围：多组件各一个 Deployment/Service；路由通过详情「添加路由」单独创建（Ingress）。
- 成员集群创建：写路径使用 host 原生 API；成员集群暂不渲染创建入口。

## 明确不做

- 创建自制应用（多对象事务：Application + Deployment/StatefulSet + Service + Ingress）。
- 自制应用详情（资源/事件/流量治理/链路追踪页签）。
- 编辑/删除。
- 与 openpitrix release 列表合并。

## 假设

- app.k8s.io/v1beta1 Application CRD 已安装（B200 实测存在）；kapis resources 集合可用。
- 项目内 Application 数量在 500 以内。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01** — 项目自制应用列表按 Application 集合展示，组件与健康由 selector 聚合。
- **FR-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02** — 页面独立于 Helm 已安装应用，并提供双向入口。
- **FR-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03** — 提供创建：Application + 单个 Deployment + Service，dry-run 校验、失败回滚。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01** — 行集合 = Application 集合；组件数按 selector 匹配计算；健康按就绪比计算（含未知/异常分支）。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01（列表 + 详情 + 入口）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02（创建）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03（删除）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-04（编辑信息）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05（多组件创建）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06（详情事件）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07（添加路由）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08（流量治理）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09（链路追踪）
- TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10（灰度发布）
