# 网关设置（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/gateway.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03

## 概述

项目网关的两态页面（空态/信息态）、编辑设置弹窗，以及集群侧的项目网关列表（含行编辑/删除）。

## 设计目标与非目标

目标：无网关时给出可执行动作；有网关时以控制器结论为准，并可在不删除重建的前提下调整访问方式/副本数/追踪/注解/NodePort。非目标：集群网关（宿主网关）的安装与写操作、日志与监控。

## 关键约束

- 网关是 `gateway.kubesphere.io/v1alpha1` 的 Gateway，位于项目命名空间。
- 创建默认 NodePort；编辑可切换到 LoadBalancer。
- 编辑写 Gateway CR 的 `spec.service.type` / `spec.deployment.replicas` / `spec.deployment.annotations` / `spec.service.annotations` / `spec.controller.config`；NodePort 写项目 Service（CRD 无该字段）。地址与 NodePort 都从 Service 读，不读 Gateway status。
- 权限门控用 `SelfSubjectAccessReview`（gateways，gateway.kubesphere.io，update/delete，按项目命名空间），fail-open。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-01 — 状态读 `Deployed` 条件，不读 spec

**为什么**：实测发现控制器会把 `spec` 重写为空（`{"spec":{}}`），真正的结果写在 `status.conditions` 的 `Deployed` 里（`status: True` 表示 Helm release 安装成功）。读 spec 会得到「什么都没配置」的假象。

**被否方案**：用 `spec.type` 填充「访问方式」。字段会被控制器清空，显示为空才是事实。

**何时重新考虑**：控制器改为保留 spec 时。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-02 — 未就绪时轮询而不是让用户刷新

**为什么**：部署需要几十秒到几分钟。让用户手动刷新等于把等待转嫁给他们。

**被否方案**：只在挂载时请求一次。页面会一直停在「部署中」直到用户自己刷新。

**何时重新考虑**：WebSocket 推送可用时。

## 系统现状

老 console 的网关页展示集群网关与项目网关的对应关系与访问方式，并用同一个 GatewaySetting 弹窗创建/编辑（访问方式、追踪、LoadBalancer 注解、controller.config），集群侧 GatewayCard/ProjectGatewayList 提供宿主网关菜单与项目网关列表（列：名称/访问方式/IP/NodePort/副本数/追踪，行操作编辑/升级/删除）。新 UI 此前只有项目页的创建/状态/删除；本单元补编辑设置与集群侧项目网关列表及行编辑/删除。

## 仓库落点

- `apps/console-next/src/pages/settings/GatewayPage.tsx`
- `apps/console-next/src/pages/settings/GatewayEditDialog.tsx`（共享编辑弹窗）
- `apps/console-next/src/pages/cluster/ClusterGatewaysPage.tsx`（项目页签列表 + 行操作）
- `packages/api-client/src/gateways.ts`（`projectGatewaysApi`：list/get/create/update/remove/setNodePorts；`GatewayDetail` 映射）
- `src/routes/.../gateways/{index,$name}.tsx`（两视图已存在，项目页签复用，不新建路由）
- 注：`storage.ts` 的旧 `projectGatewayApi` 保留未动（不在本单元写作用域），页面改用 `gateways.ts` 的新 API。

## 对外契约

读/写 `/apis/gateway.kubesphere.io/v1alpha1/namespaces/<ns>/gateways`（列表为 `/apis/gateway.kubesphere.io/v1alpha1/gateways`；成员集群在两处路径前加 `clusters/<cluster>/`）。
写：`POST` 创建（spec 用 CRD 真字段：`controller.scope/replicas`、`deployment.replicas`、`service.type`）、`PUT` 保存（带 `resourceVersion`，409 重读后重试一次）、`DELETE` 删除。
读项目 Service：`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/services/kubesphere-router-<ns>`；固定 NodePort：`PATCH`（`application/merge-patch+json`）该 Service 的 `spec.ports`（必须带完整端口对象）。

## 不变量

1. 状态等于 `Deployed` 条件。
2. 无网关时一定给出创建入口。
3. 编辑保存后接口回读与所填一致：`spec.service.type`、`spec.deployment.replicas`、追踪注解、`spec.service.annotations`；NodePort 写 Service 后回读端口值一致。
4. 非法值（空访问方式、负数/非整数副本数、NodePort 超范围或重复）在本地阻止，不产生写请求。
5. 地址与 NodePort 只来自网关 Service；Gateway status 只用于就绪与消息。
6. 无 update/delete 权限时对应入口隐藏并说明；无权限、空结果、读取失败三种画面不互相顶替。

## 已知坑

- **Gateway CRD 会剪枝未知字段**：旧创建体里的 `spec.type` / `spec.ports` 不是 CRD 字段，会被剪成空 spec，控制器于是按 Helm 默认渲染成 LoadBalancer，而页面承诺 NodePort。创建体必须用 `spec.controller/deployment/service`（本项目实测）。
- **地址与 NodePort 不在 CR 上**：Gateway `status` 只有 `conditions` 与 `deployedRelease`，项目 Service 才持有 `spec.ports[].nodePort` 与 `status.loadBalancer`；Nginx CR 由 operator/Helm 拥有（并发 PUT 409），不能写。
- **全局网关模式下 kapis 写被后端守卫**：`CreateGateway` 在全局网关存在时返回错误，`UpdateGateway` 在非默认命名空间返回 `namespace doesn't match with origin namespace`（实测 500）；现有页面用原生 `/apis` 写，保持该路径。
- **删除的最终器**：Gateway 带 `finalizers: uninstall-helm-release`，删除后可能短暂 terminating；测试清理需在兜底时清空 finalizers，且只清自己创建的对象。
- **控制器会并发刷新对象**：编辑采用「先 GET 最新对象再 PUT」，409 时重读重试一次；不要用打开弹窗时的旧 resourceVersion 直接 PUT。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`：`TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01`（创建/删除）、`-02`（编辑设置与校验）、`-03`（集群侧项目网关列表与行操作/权限）。
可观测点：`gateway:surface`、`gateway:info`、`gateway:empty`、`gateway:create`、`gateway:edit`、`gateway:delete`、`gateway:type`、`gateway:node-ports`、`gateway:replicas`、`gateway:tracing`、`gateway:edit-denied`；弹窗 `gateway:edit:*`（type/replicas/tracing/node-port:<name>/annotation:*/config:*/save/cancel/error）；集群侧 `cluster-gateways:surface`、`:tab:project`、行 `[data-ai-row]`、`cluster-gateways:project-name:<ns>/<name>`、`cluster-gateways:edit|delete`、`cluster-gateways:project-edit-denied`。

## 后续改进

网关日志与监控；集群网关（宿主网关）的写操作；批量删除；旧版网关升级入口。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03`

## 编辑设置与集群侧项目网关列表（2026-11-16 追加）

### 探测证据（B200 host，admin，2026-11-15/16）

- `GET /apis/gateway.kubesphere.io/v1alpha1/gateways` → 200，当前只有 1 个对象：`kubesphere-controls-system/kubesphere-router-kubesphere-system`，`spec={controller:{replicas,config,scope},deployment:{replicas,annotations},service:{type,annotations}}`；`status` 只有 `conditions` 与 `deployedRelease`，没有 `service`/`loadBalancer`。
- `GET .../namespaces/<ns>/gateways` 在项目级返回对象数组；`GET /apis/gateway.kubesphere.io/v1alpha1` 的 resources 同时有 `gateways` 与 `nginxes`。项目网关由 Gateway 的 Helm release 在项目命名空间生成 Nginx CR `kubesphere-router-<ns>-ingress`（ownerReferences 指向 Gateway，带 `meta.helm.sh/release-*` 注解）。
- 创建体使用旧字段（`spec.type/replicas/ports`）时，对象创建成功但 `spec` 被 CRD 剪枝成 `{}`，控制器按 Helm 默认渲染 `LoadBalancer`；改用 `spec.controller.scope={enabled:true,namespace}`、`spec.deployment.replicas=1`、`spec.service.type=NodePort` 后，Nginx CR 的 `spec.controller.service.type` 与 Service 类型均为 NodePort，Service 分配 `nodePort`（实测 http 30739+/https 30934，均为 30000–32767）。
- 原生 `PUT` 改 `spec.deployment.replicas=2` / `spec.service.type=LoadBalancer` / `spec.deployment.annotations['servicemesh.kubesphere.io/enabled']='false'` / `spec.service.annotations={'probe/key':'v'}` → 200，随后 GET 回读四组字段一致，项目 Deployment 副本数变为 2（控制器采纳）。
- Nginx CR 直接 `PUT` → 409（对象被 operator 修改）；`PATCH` Service 只带 `{name,nodePort}` → 422；带完整端口对象的 merge patch → 200，nodePort 回读为新值，网关 reconcile 后仍保持；`nodePort=1234` → 422（服务端范围校验）。
- `PUT /kapis/gateway.kubesphere.io/v1alpha1/namespaces/<ns>/gateways/` → 500 `namespace doesn't match with origin namespace`（全局网关模式下 `options.Namespace` 非空，后端 `UpdateGateway` 要求对象命名空间等于安装命名空间）。
- 全局网关存在时 kapis `CreateGateway` 被后端守卫拒绝；现有页面的原生 `POST` 仍可创建并成功安装 release（本部署实测），因此本次保持原生写路径。
- 权限：admin 的 SSAR `update/delete gateways.gateway.kubesphere.io` 返回 allowed=true；门控用同一请求，fail-open。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-03 — 编辑写 Gateway CR（原生 PUT），不写 Nginx CR

**为什么**：项目网关的产品对象是 Gateway CR，`gateway.kubesphere.io` 的后端模型（`pkg/models/gateway`）只服务它；实测原生 PUT 的字段会被控制器采纳并落到 Deployment/Service。Nginx CR 由 operator/Helm 拥有（ownerReference + release 注解），并发 PUT 409，写它等于与控制器抢对象。

**被否方案**：
- 写 Nginx CR（`nginxes`）：operator 拥有、PUT 409；字段（`spec.controller.replicaCount` 等）与 Gateway spec 是两套模型，写后会被下一次 reconcile 覆盖。
- 用 kapis `PUT /namespaces/<ns>/gateways/`：全局网关模式下后端返回 namespace mismatch（实测 500），项目更新不可用。

**何时重新考虑**：集群不再启用全局网关、或后端把 kapis 更新改为与原生等价时；届时优先切回 kapis 契约。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-04 — 编辑字段就是 CRD 字段，不新增中间模型

**为什么**：旧弹窗的字段与 CRD 一一对应：访问方式=`spec.service.type`，追踪=`spec.deployment.annotations['servicemesh.kubesphere.io/enabled']`，LoadBalancer 注解=`spec.service.annotations`，配置选项=`spec.controller.config`；副本数取 `spec.deployment.replicas`（旧卡片 mapper 与详情页扩缩用同一字段）。页面不引入「网关设置」中间对象，保存即回读这些路径。

**被否方案**：把副本数写到 `spec.controller.replicas`（旧模板里两者都在，但实测 Deployment 副本数跟的是 `deployment.replicas`）；把追踪写成布尔值（CRD 是 `map[string]string`，值必须是字符串 `"true"/"false"`）。

**何时重新考虑**：CRD 增加独立 replicas/tracing 字段时。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-05 — NodePort 写项目 Service，范围 30000–32767

**为什么**：Gateway CRD schema 没有 nodePort 字段（`spec.controller/deployment/service` 三层全部核对），而 NodePort 属于 Helm release 创建的 Service；实测完整端口的 merge patch 可写、网关 reconcile 后保持，服务端对其他值返回 422。因此把「固定 NodePort」作为编辑弹窗的一个字段组，直接写 Service；范围按 Kubernetes 默认 30000–32767 本地校验，避免把 422 留给用户。

**被否方案**：假装 Gateway spec 有 nodePort（会被剪枝）；改 Nginx CR（operator 拥有）；把 NodePort 只读展示（任务要求可编辑且范围校验）。

**何时重新考虑**：Gateway CRD 增加 nodePort 字段或后端提供专门接口时。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-06 — 集群侧项目网关放进既有两视图，复用同一弹窗

**为什么**：路由 `/clusters/<c>/gateways/project` 已存在（`$name` 路由把 cluster/project 识别为视图），新建独立路由会多一套入口且与兄弟单元的设计冲突；列表行编辑/删除直接复用 `GatewayEditDialog` 与 `DeleteDialog`，账号权限与交互只有一份实现。

**被否方案**：新建 `/gateways/project/list` 页；在集群视图里就地展开项目网关（信息重复、空态难表达）。

**何时重新考虑**：项目网关数量增长到需要服务端分页/筛选时。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-07 — 负载均衡提供商下拉改为自由键值注解

**为什么**：旧弹窗内置 8 家云厂商的注解键表（每家的键名是硬编码数据）。新 UI 用自由键值编辑器写 `spec.service.annotations`：任意厂商、任意键都能填，能力是旧下拉的超集，且不把云厂商版本的键表固化进前端。

**被否方案**：照搬厂商预置键表——复制旧数据、绑定特定云厂商版本，且无法覆盖未列出的厂商。

**何时重新考虑**：产品要求按厂商提供注解校验/默认值时，再引入按 CRD 元数据驱动的键表。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-08 — 写入口用 SSAR 门控，fail-open

**为什么**：`update/delete` 是按命名空间判定的；用 `SelfSubjectAccessReview` 询问与真正写入相同的 verb/resource/namespace，只有明确 `allowed:false` 才隐藏入口并说明（查询失败不夺走权限）。与项目设置其他页面的门控方式一致。

**被否方案**：不门控（点开弹窗才 403）；前端读角色表判断（平台侧角色绑定才是事实源）。

**何时重新考虑**：批量查看大量项目网关时，逐行 SSAR 成本变高，可改为一次聚合查询。

### CON-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-01 — 编辑字段、存储路径、呈现与校验

| 字段 | Gateway/Service 路径 | 呈现 | 校验 |
| --- | --- | --- | --- |
| 访问方式 | `spec.service.type` | NodePort / LoadBalancer 二选一 | 必选 |
| 副本数 | `spec.deployment.replicas` | 整数 | 不小于 0 的整数 |
| 链路追踪 | `spec.deployment.annotations['servicemesh.kubesphere.io/enabled']`（字符串 `"true"/"false"`） | 开关 + 开/关 | 无 |
| 服务注解 | `spec.service.annotations`（仅 LoadBalancer；NodePort 时清空） | 键值行，可增删 | 空键行忽略 |
| 配置选项 | `spec.controller.config` | 键值行，可增删 | 空键行忽略 |
| NodePort | 项目 Service `spec.ports[].nodePort` | 每端口一个数字输入，留空=保留 | 30000–32767 整数、互不重复 |
| 访问地址（只读） | Service `status.loadBalancer.ingress[0].ip/hostname` | 无则 `-` | — |
| IP / NodePort（列表） | 同上 + `spec.ports[]` | IP 或 `-`；NodePort 形如 `HTTP: 3xxxx/HTTPS: 3xxxx` | — |
| 副本数（列表） | `spec.deployment.replicas` | 整数或 `-` | — |
| 追踪（列表） | 同上注解 | 开 / 关 | — |

### GOT-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-01 — 创建体字段被 CRD 剪枝

旧页面的创建体是 `spec:{type,replicas,ports}`，三个字段都不在 CRD schema 里；API server 剪枝后得到空 spec，控制器按 Helm 默认装了 LoadBalancer，而页面文案说「默认 NodePort」。创建体必须写 `controller.scope/replicas`、`deployment.replicas`、`service.type`，创建后回读确认类型。

### GOT-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-02 — 地址与端口不在 Gateway CR 上

Gateway `status` 只有 `conditions` 与 `deployedRelease`（实测），IP/NodePort 在项目 Service 上；只读 status 会让列表 IP/NodePort 永远为空。列表先用一次集群级 Service 读取做 join，单对象页读 `kubesphere-router-<ns>` Service；Service 读失败时该行显示 `-`，不把整张表判为失败。

### GOT-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-03 — 全局网关模式下 kapis 写不可用

实测 kapis 创建被 `can't create project gateway if global gateway enabled` 拒绝，kapis 更新返回 namespace mismatch（500）；现有页面与本次编辑走原生 `/apis`（成员集群路径加 `clusters/<cluster>/` 前缀）。切到 kapis 前必须先确认后端解除全局网关守卫。

### GOT-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-04 — 控制器会并发刷新，PUT 需最新 resourceVersion

编辑采用 GET 最新对象 → 合并字段 → PUT；409 时重读重试一次。若直接 PUT 打开弹窗时的旧对象，控制器一次 reconcile 就会让保存失败且用户不知道原因。

### GOT-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-05 — 删除可能停留在 terminating

Gateway 带 `finalizers: uninstall-helm-release`，Helm release 未清理完时对象短暂 terminating；E2E 清理先删 Gateway，超时后只清自己对象的 finalizers 再删命名空间，不碰其他网关。

### GOT-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-06 — 追踪开关是否显示取决于服务网格

旧弹窗只在集群启用 servicemesh 模块时显示追踪开关；新弹窗无条件显示并写字符串注解——在未启用服务网格的集群上，打开追踪不会失败但不能保证生效（CRD 只存注解）。列表的追踪列如实显示注解值，不推断「已生效」。

