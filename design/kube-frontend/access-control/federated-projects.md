# 联邦项目页族：列表、写入与详情深化（L3）

[子模块需求](../../../prd/kube-frontend/access-control/federated-projects.md)

## 概述

企业空间作用域 `federatedprojects` 页族包含列表、`$name` 详情、`$name/$resource/$object` 联邦资源详情三层。数据直接读联邦 API（types.kubefed.io/v1beta1）：列表来自 federatednamespaces 集合，详情来自同一集合按名称查找，已联邦资源按项目命名空间逐类型读取，事件来自核心 events 集合。写能力：创建（宿主命名空间 + FederatedNamespace 两步）、编辑信息、调整部署集群、单条/批量删除（删除命名空间）。

## 关联需求

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08`

## 设计目标与非目标

目标：列表与详情字段/行数/状态与联邦 API 一致；创建/编辑/放置/删除可回读、失败可恢复；空/未找到/失败/无权限/删除中分开；中英文与三档布局同批交付。

非目标：联邦资源自身的写操作；逐集群 overrides 编辑器；22 条老详情路由中的网关/日志收集/配额/成员页签；跨企业空间列表。

## 关键约束

- 作用域：workspace（`/kube-frontend/workspaces/<ws>/federatedprojects`），由 registry 的 federated-projects 区域提供侧栏入口。
- 读取：`GET /apis/types.kubefed.io/v1beta1/federatednamespaces`（cluster-wide 集合）、`GET .../v1beta1`（discovery）、`GET .../namespaces/<ns>/<plural>[/<name>]`、`GET /api/v1/namespaces/<ns>/events`（fieldSelector involvedObject）。
- 写入：`POST /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/namespaces`（宿主命名空间）、`POST|PUT /apis/types.kubefed.io/v1beta1/namespaces/<ns>/federatednamespaces[/<name>]`、`DELETE /api/v1/namespaces/<name>`。
- 权限：ks-apiserver IAM `POST /selfsubjectaccessreviews`（以请求用户求值；旧后端 404 回退 `/apis/authorization.k8s.io/v1/selfsubjectaccessreviews`），verb/resource/namespace 与实际请求一致。
- 只读的部分：联邦资源详情不提供编辑/删除；资源页签不做搜索/分页。
- 页面必须有字面量 data-ai-id；用共享 Modal/表格/空态/错误面板/确认框，不新建同类控件。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-10 — 创建是两步写入，宿主命名空间必须带 kubefed.io/managed=true

**为什么**：FederatedNamespace 是 namespaced 对象，且 KubeFed 要求它创建在它所联邦的命名空间里，因此必须先有宿主命名空间。2026-11-15 在本环境实测两条路径：

1. 旧 console 写法（命名空间标签 `kubesphere.io/kubefed-host-namespace=true`、`kubefed.io/managed=false`）创建后，FederatedNamespace 的 `status.conditions` 恒为 `Propagation=False, reason=CheckClusters`，命名空间事件给出 `UpdateInClusterFailed: Unable to manage the object which has label kubefed.io/managed: false`，`CreateInClusterFailed: An update will be attempted instead of a creation due to an existing resource`。
2. 同一创建改为命名空间标签 `kubefed.io/managed=true` 后，0.3 秒内 `Propagation=True`，事件为 `UpdateInCluster`，宿主命名空间被控制面接管（标签被重写为模板标签 + `kubefed.io/managed=true`）。

因此新实现写 `managed=true`，并在第二步失败时删除刚创建的命名空间，避免留下读不到也删不掉的半成品。

**被否方案**：照搬旧 console 的 `managed=false`。会让每个新建项目的传播状态长期显示未就绪，用户看到的是创建成功但系统报错，等于把旧缺陷固化。

**何时重新考虑**：KubeFed 提供「预创建命名空间不算失败」的放置选项，或旧 console 的 `kubefed-host-namespace` 标记被控制面保留时。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-11 — 别名/描述写对象注解 + overrides，不写模板注解

**为什么**：实测向 FederatedNamespace 的 `spec.template.metadata.annotations` 写注解，控制面事件直接报 `AnnotationsNotSupported`（"metadata.annotations cannot be set via template to avoid conflicts"），传播失败。老 console 的 federated 模板正是在对象 `metadata.annotations` 与 `spec.overrides[].clusterOverrides[/metadata/annotations]` 上放别名/描述。新实现沿用：编辑信息时同时更新对象注解与每个放置集群的 override，模板只保留 workspace 标签。

**被否方案**：只写对象注解。宿主命名空间与成员副本上的别名/描述会缺失；老 console 的 override 行为有实际用途。

**何时重新考虑**：控制面开始接受模板注解，或 KubeSphere 改为用单独的配置对象保存显示名。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-12 — 列表在前端分页/排序/搜索，不用 kapis resources 代理的服务端分页

**为什么**：`/apis/types.kubefed.io/v1beta1/federatednamespaces` 是普通 Kubernetes 列表，没有 KubeSphere 的 `page/sortBy/totalItems` 契约。`/kapis/resources.kubesphere.io/v1alpha3/federatednamespaces` 有这些参数，但它按对象自己的 workspace 标签过滤（或需要 labelSelector），而本环境的既有对象 workspace 标签只在 template 上（实测 1 个对象、tenant 集合 0 条），服务端过滤会把它漏掉。正确性优先：读取完整集合，按 template 标签过滤到企业空间，再在浏览器内分页/排序/搜索；总数取过滤后的行数。

**被否方案**：用 kapis 代理并接受对象缺失；或同时读两个来源做合并（两套事实、分页错位）。

**何时重新考虑**：控制面把 workspace 标签写到对象自身，且历史对象完成回填；届时改用 kapis 服务端分页与 `name` 搜索。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-13 — 「添加集群」升级为「调整部署集群」，移除有显式警告

**为什么**：老 console 只提供「添加集群」，移除某个集群上的项目只能去联邦控制面。放置是集合语义，读者应能一次看到当前集合并增删；但移除会让控制面删除该集群上的命名空间，属于破坏性操作，所以在确认前显示「移除 {集群} 会删除这些集群上的命名空间，请确认」。

**被否方案**：只做添加（功能缺失，读者无法减少放置范围）；或移除时静默（危险，且不可恢复）。

**何时重新考虑**：放置改为 KubeFed 的 clusterSelector 语义时，对话框需要同时显示选择器与显式集合。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-14 — 删除以命名空间为准，finalizer 期间显示删除中

**为什么**：项目就是宿主命名空间；删除命名空间会级联删除 FederatedNamespace 并由其 finalizer 清理各集群副本（实测：删除命名空间 200，FederatedNamespace 约 4 秒后 404，命名空间约 6 秒后 404）。只删 FederatedNamespace 对 `managed=false` 的历史对象会留下孤儿命名空间。列表读取 `metadata.deletionTimestamp` 标记删除中并禁止再次删除/勾选，避免重复提交。

**被否方案**：只删 FederatedNamespace（历史对象留孤儿）；等待删除完成才关闭确认框（finalizer 时间不可控，阻塞用户）。

**何时重新考虑**：控制面提供「删除项目」聚合接口并返回可轮询的进度。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-15 — 写入口用 SSAR 门控，失败放行

**为什么**：页面无法从路由或菜单推断联邦项目的角色；按实际请求的 verb/resource/namespace 询问 SelfSubjectAccessReview 才能让控件状态与服务端一致。探测本身失败（网络/鉴权异常）时放行，由写请求的 403 兜底并显示原因——探测故障不应剥夺合法写入。创建需要两半权限（namespaces 与 federatednamespaces），任一明确拒绝即禁用创建并显示原因；行操作在打开对话框前询问，拒绝时不打开。

**被否方案**：按工作空间角色列表推断权限（与联邦 CRD 的 RBAC 不一致）；只靠 403 兜底（读者填完表单才被告知没有权限）。

**何时重新考虑**：KubeSphere 提供联邦项目级的权限聚合接口。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-16 — 详情六页签：概览/三类资源/元数据/事件；事件按 involvedObject 过滤

**为什么**：老 console 的联邦项目详情有 22 条路由，其中概览（基本信息+配额+用量）、应用负载、配置、存储与项目概览同构；本页只做与联邦语义直接相关的部分。传播失败的原因分散在 `status.conditions`（放置/检查）与事件（控制面拒绝/同步失败）两处，二者都要露出，因此概览加传播条件表、新增事件页签；对象标签/注解与模板标签是排查放置与传播的事实，新增元数据页签。事件读核心 events 并用 `involvedObject.name=<对象>,involvedObject.kind=Federated*` 过滤，是唯一按对象取事件的接口。

**被否方案**：只做条件表（看不到控制面拒绝原因，如 `AnnotationsNotSupported`）；只做事件（事件会过期，条件才是当前状态）。

**何时重新考虑**：控制面把失败原因稳定写进 conditions.message 后，事件页签可以降级为辅助。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-17 — 联邦资源详情补「完整对象」YAML，不只模板

**为什么**：模板只包含被传播的字段；`spec.placement`、`spec.overrides`、`status` 不在模板里，排查「为什么这个对象没分发」需要看完整对象。完整对象 YAML 与模板 YAML 分两块展示，并新增事件页签（与项目事件同一组件），保留原有的未找到/未知类型/无分发状态三种说明。

**被否方案**：用完整对象替换模板（读者要看的是「分发的是什么」，模板才是这一事实）；只加事件不加 YAML（放置信息仍不可见）。

**何时重新考虑**：提供逐字段差异视图（模板 vs 各集群实际对象）时，可把完整 YAML 降级为入口。

## 系统现状

老 console 有 `/:workspace/federatedprojects` 列表（创建/编辑信息/添加集群/删除/批量删除）与 `/:workspace/federatedprojects/:namespace` 的 22 条详情路由。新 UI 此前已交付只读列表与详情骨架（2026-11-15 首批）；本功能点补齐写能力与详情深化。联邦 API 在本环境可读可写：13 个命名空间级 Federated 类型、1 个既有 FederatedNamespace（template 标签 = system-workspace）、集群仅 `host`（`/kapis/cluster.kubesphere.io/v1alpha1/clusters` 返回 1 个 Ready host）。

## 仓库落点

- 页面：`console/kube-frontend/apps/console-next/src/pages/federated/{FederatedProjectsPage,FederatedProjectDetailPage,FederatedResourceDetailPage,FederatedResourceTable,FederatedProjectDialogs,FederatedEventsPanel,queries}.tsx|ts`
- 路由：`routes/kube-frontend.workspaces.$workspace/federatedprojects/{route,index}.tsx`、`$name/{route,index}.tsx`、`$name/$resource/$object.tsx`
- 接口：`console/kube-frontend/packages/api-client/src/federated.ts`（新），并在 `src/index.ts` 导出
- 文案：`console/kube-frontend/packages/locales/src/index.ts` 的 `fedprojects.*`
- 用例：`tests/ui/specs/kube-frontend/access-control/` 下的 FEDERATED_PROJECTS 系列（01..08）与镜像 Python 测试；页面对象 `tests/ui/pages/federated_page.py`

## 对外契约

- 读取：`GET /apis/types.kubefed.io/v1beta1/federatednamespaces`；`GET /apis/types.kubefed.io/v1beta1`；`GET /apis/types.kubefed.io/v1beta1/namespaces/<ns>/<plural>[/<name>]`；`GET /api/v1/namespaces/<ns>/events?fieldSelector=involvedObject.name=...,involvedObject.kind=...`。
- 写入：
  - 创建命名空间：`POST /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/namespaces`，body `{apiVersion:v1, kind:Namespace, metadata:{name, labels:{'kubesphere.io/workspace':ws, 'kubefed.io/managed':'true'}}}`。
  - 创建联邦对象：`POST /apis/types.kubefed.io/v1beta1/namespaces/<name>/federatednamespaces`，body `{apiVersion, kind:FederatedNamespace, metadata:{name, namespace:name, labels:{workspace}, annotations:{creator/alias/description}}, spec:{placement:{clusters:[{name}]}, template:{metadata:{labels:{workspace}}}, overrides:[{clusterName, clusterOverrides:[{path:'/metadata/annotations', value: annotations}]}]}}`。
  - 编辑：`PUT /apis/types.kubefed.io/v1beta1/namespaces/<name>/federatednamespaces/<name>`，携带读取到的完整对象（保留 resourceVersion、placement、其它 overrides）。
  - 删除：`DELETE /api/v1/namespaces/<name>`。
- 句柄：列表 `federated-projects:surface|:create|:search|:refresh|:bulk-delete|:edit|:placement|:delete|:delete-confirm|:permission-denied`；创建 `:create-name/-alias/-description/-workspace/-clusters/-create-submit/-create-error`；放置 `:placement-clusters/-placement-submit/-placement-removal/-placement-error`；详情 `:surface|:basic|:conditions|:conditions:empty|:types|:types:empty|:types:error|:not-found|:back|:edit-info|:edit-placement|:delete|:permission-denied|:tab:{...}[:trigger]|:metadata:{labels|annotations|template-labels}|:events[:empty|:error|:retry]`；资源详情 `:surface|:title|:kind|:template|:template:empty|:object:yaml|:distribution|:distribution:empty|:not-found|:back|:retry|:tab:{definition|events}|:events[:empty|:error|:retry]`。
- URL：`/kube-frontend/workspaces/<ws>/federatedprojects[/<name>[/<segment>/<object>]]`，segment 用老 console 段名（deployments/services/configmaps…）。

## 不变量

- 列表只显示 template workspace 标签（或对象标签回退）匹配当前企业空间的对象。
- 列表行数等于该企业空间 FederatedNamespace 数；分页总数等于过滤后的行数，不把未过滤集合当总数。
- 创建成功后组件的对象：命名空间标签 `kubefed.io/managed=true`；FederatedNamespace 模板只带标签；别名/描述同时存在于对象注解与每个放置集群的 override。
- 编辑信息只改别名/描述注解与对应 overrides，不改 placement、resourceVersion 或其它注解。
- 调整放置后 `spec.placement.clusters` 去重且与 overrides 的 clusterName 集合一致。
- 删除以命名空间为单位；deletionTimestamp 非空的对象不可勾选、不可再次删除。
- 写入口的权限探测失败不阻塞；仅明确 allowed=false 时禁用/提示。
- 资源页签只列项目命名空间内的对象，`federatednamespaces` 自身不列入任何页签。
- 每个资源页签的加载/空态/失败互不影响，也不阻塞概览。
- 资源详情 URL 段与 API 集合名由一张映射表双向解析，不出现第二份映射。
- 未知值显示 `-`；未回报（undefined）与明确为空（[]）分开处理。

## 已知坑

- tenant 的 federatednamespaces 集合返回 0（workspace 标签在 template 上），不要据此判断「没有联邦项目」。
- 按名称的集群级 GET（`/federatednamespaces/<name>`）404；必须用集合查找或带 namespace。
- 旧 console 的 `kubefed.io/managed: false` + 预创建命名空间会让 Propagation 恒为 False（事件：Unable to manage the object which has label kubefed.io/managed: false）。创建时不要复制该标签。
- 模板注解会被控制面拒绝（AnnotationsNotSupported），别名/描述只能走对象注解 + overrides。
- 删除命名空间后对象不会立刻消失：list 仍可能返回 deletionTimestamp 非空的行，勿把「删除中」当失败。
- DELETE 返回 200 只代表已受理；回读要接受「先 200 后 404」的过渡。
- `/apis` 路径批量写入受 BFF 透明代理，DELETE/POST 正常；但 tenant 的 namespaces 集合会忽略 `dryRun`（实测 dryRun 也创建了命名空间），验证写入不要用 dryRun 代替回读，自建对象必须清理。
- 事件集合无 per-object 端点，必须用 fieldSelector；事件时间字段可能是 lastTimestamp / eventTime / firstTimestamp，取其一并允许为空。
- 单集群环境（只有 host）无法验证成员集群副本的创建/清理；放置多选在 UI 上可用但成员集群分支未验收。

## 测试与可观测

- 单测：`packages/api-client/test/federated.test.ts`（映射三态、名称校验、创建两步与回滚、编辑保留字段、放置 override 同步、批量删除失败报告）。
- 契约：`config/*.test.ts` 的全量 1426 条（含 ai-surface、locale 键一致、列表能力接线、无裸 button、无手写确认框）。
- E2E：TC-01 列表/详情、TC-02 资源页签、TC-03 资源详情（既有）；TC-04 创建（唯一前缀、回读、清理）、TC-05 编辑信息与放置（回读 diff、恢复原状）、TC-06 单条与批量删除（自建对象、清理）、TC-07 详情条件/元数据/事件、TC-08 资源详情完整 YAML 与事件。写用例统一唯一前缀 `pw`、finally 清理宿主命名空间，并防御性清理残留。
- 观测：失败时看 `artifacts/<test>/` 截图、事件页签与服务端错误文案；403 与 404 分开记录。

## 后续改进

- 逐集群 overrides 编辑器（副本数/镜像/资源等），对齐老 console 的集群差异设置。
- 资源页签搜索/过滤/分页与联邦资源写操作（联邦控制面承担，需接口与权限先稳定）。
- 列表在控制面回填对象 workspace 标签后改用 kapis 服务端分页/搜索。
- 多集群环境验证成员副本的创建/清理、按集群回读与 403 分支。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-01
- TC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-02
- TC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-03
- TC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-04
- TC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-05
- TC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-06
- TC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-07
- TC-L3-KUBE-FRONTEND-ACCESS-CONTROL-FEDERATED_PROJECTS-08
