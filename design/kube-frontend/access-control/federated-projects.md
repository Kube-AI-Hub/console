# 联邦项目列表与详情骨架（L3）

[子模块需求](../../../prd/kube-frontend/access-control/federated-projects.md)

## 概述

企业空间作用域新增 `federatedprojects` 页（列表 + `$name` 详情）。数据直接读联邦 API（types.kubefed.io/v1beta1）：列表来自 federatednamespaces 集合，详情来自同一集合按名称查找，已联邦资源类型来自该组的 API discovery。详情再按「应用负载 / 配置 / 存储」分组列出项目命名空间内的 Federated 对象；每个对象可下钻到只读详情（模板 YAML + 分发状态）。只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03

## 设计目标与非目标

目标：P0 只读可见性——列表行数/字段与联邦 API 一致；详情能回答「部署在哪些集群、传播是否正常、项目里可联邦哪些类型」；空态/未找到/失败态明确。

非目标：联邦项目的创建/编辑/删除与集群调度调整、22 条老详情路由内的资源页、按类型列已联邦对象。

## 关键约束

- 作用域：workspace（`/kube-frontend/workspaces/<ws>/federatedprojects`），由 registry 的 federated-projects 区域提供侧栏入口。
- 联邦 API 路径：`/apis/types.kubefed.io/v1beta1/federatednamespaces`（cluster-wide 集合可读）、`.../v1beta1`（discovery）。
- FederatedNamespace 是 namespaced 资源：按名称的集群级 GET 返回 404，详情改用集合查找（见本文件关于集合查找的决策）。
- 只读：不提供写操作；写 webhook 在 2026-11-15 前后仍不稳定。
- 页面必须有字面量 data-ai-id；不用裸 button。
- 资源页签按「一类集合一次请求」读取（每个页签 4–7 个集合），每页签独立处理加载/空态/失败。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01 — 直接读联邦 API，不用 tenant 的 federatednamespaces 集合

**为什么**：tenant 代理集合（`/kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/federatednamespaces`）按对象 metadata 上的 workspace 标签过滤，而 FederatedNamespace 的 workspace 标签写在 **template** metadata 上（控制面要传播的就是这份模板）。实测该集合对 system-workspace 返回 0，而联邦 API 的 cluster-wide 集合返回 1 个对象（template 标签 = system-workspace）。用联邦 API + 模板标签过滤，列表才与事实一致。

**被否方案**：用 tenant 集合并在前端再拼一次过滤。集合已经返回空，前端无从补救。

**何时重新考虑**：tenant 集合改为按 template 标签过滤时，可回到 kapis 以复用它的分页/搜索。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02 — 本轮只读，且详情是骨架

**为什么**：联邦的写路径（创建 FederatedNamespace、增删集群）依赖 federation webhook；B200 刚恢复、写类 webhook 可能不稳。先交付只读列表与概览，能在控制面之外核对对象，又不把不稳定写路径暴露给用户。

**被否方案**：一次交付创建/编辑。会把本轮风险集中到写 webhook 上。

**何时重新考虑**：联邦写 webhook 稳定并有 E2E 覆盖时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03 — 「已联邦资源类型」取 discovery 的命名空间级类型

**为什么**：要逐类型列「已联邦对象」需要对 13 类各发一次集合请求，P0 不值得；discovery 一次请求就能回答「项目里可联邦哪些类型」，且是只读事实。页面文案明确写「类型」而不是「已有对象」，避免读者误解。

**被否方案**：固定 13 个请求汇总对象数。成本高、慢，且数出来的是对象数量而不是本页要回答的问题。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04 — 详情用集合查找代替按名称的 namespaced GET

**为什么**：路由只带 `$name`，但 FederatedNamespace 是 namespaced 资源，按名称的集群级 GET（`/federatednamespaces/<name>`）返回 404，而它的 namespace 恰好等于名称这件事不是 API 契约。cluster-wide 集合最多几十条，按名称查找一次请求即可，且与列表同源。

**被否方案**：先猜测 namespace=name 再发 namespaced GET。对命名不规范的对象直接 404。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05 — 空态、未找到、失败三分

**为什么**：三种结果处置不同：空态是「这里还没有联邦项目」，未找到是链接失效/对象被删，失败是联邦 API 不可读。页面分别给空态文案（schema.empty）、:not-found 说明块、ResourceErrorPanel + 重试。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06 — 资源页签按老 console 的三组切分，集合按 discovery 子集读取

**为什么**：老 console 的联邦项目详情按「应用负载 / 配置 / 存储」分组；这三个分组正好覆盖 API 的 12 个命名空间级 Federated 类型（13 个去掉 federatednamespaces 自身）。每个页签对组内每个类型发一次集合请求（应用负载 7 个、配置 4 个、存储 1 个），并行读取；一次 union 查询在联邦 API 上不存在。

**被否方案**：一个「全部已联邦资源」页签 + 类型筛选。页签数量少一个，但读者要在 12 类混排里找东西，且失败时整块不可用。

**何时重新考虑**：联邦 API 提供跨类型聚合查询时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07 — 每个资源页签独立：加载 / 空态 / 失败+重试

**为什么**：一个页签的 4–7 个集合里任意一个慢或失败，不应该让概览或其它页签不可用。页签自己汇总本组状态：任一 pending 显示骨架、任一 error 显示失败说明与重试、全部成功且无对象才显示空态。空表只在「确实没有对象」时出现——失败态渲染空表会把「读不到」误报成「没有」。

**被否方案**：页面级统一 loading/error。一个类型抖动会让整个详情白屏。

**何时重新考虑**：需要逐类型展示错误细节时，在页签内按类型分组。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08 — 资源详情沿用老 console 的 URL 段名，集合名双向映射

**为什么**：老 console 的联邦对象详情是 `…/federatedprojects/:namespace/deployments/:name` 这种按资源类型分的路径。新路由因此是 `federatedprojects/$name/$resource/$object`，其中 `$resource` 是 deployments/services/configmaps 这类段名；联邦 API 需要 `federateddeployments` 这类集合名。两张名字由一张常量表 `FEDERATED_RESOURCE_SEGMENTS` 双向解析：页面拼链接和详情反解都用它，避免两份映射漂移。

**被否方案**：统一用集合名当 URL 段（`federateddeployments`）。与老 console 的路径不兼容，书签与直觉都更差。

**何时重新考虑**：老 console 的联邦对象详情路径不再需要兼容时，可简化为集合名。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-09 — 模板与分发只读投影，404 与失败、无状态分开

**为什么**：详情要回答「分发的是什么」与「分发到哪了」。前者是 `spec.template`，以只读 YAML 原样展示（不做表单，避免暗示可编辑）；后者是 `status.clusters` 与 `status.conditions`。联邦控制面回报有延迟（实测创建后约 4 秒），所以 status 为空是正常的中间态，页面显示「对象还没有分发状态」而不是空表或错误。对象 404 是第三种情况（路由可能比对象长寿），显示「不存在或已被删除」；其余读取错误才走失败面板+重试。hook 把 404 转成 null，让三者各走各的文案。

**被否方案**：把 status 为空也当失败，或把 404 也当失败面板。前者误报，后者让删除后的书签变成一次「故障」。

**何时重新考虑**：控制面提供更明确的 progress 条件时，可把中间态换成进度说明。

## 系统现状

老 console 有 `/:workspace/federatedprojects` 列表与 `/:workspace/federatedprojects/:namespace` 的 22 条详情路由（概览/应用负载/配置/存储/网关等）。新 UI 此前没有联邦作用域；2026-11-15 组件开启后 registry 登记了 federated-projects 区域（status 由 planned 改 ready），tree 登记 TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01。本轮落列表 + 详情骨架。

## 仓库落点

- pages/federated/FederatedProjectsPage.tsx、FederatedProjectDetailPage.tsx、FederatedResourceTable.tsx、FederatedResourceDetailPage.tsx、queries.ts
- routes/kube-frontend.workspaces.$workspace/federatedprojects/{route,index}.tsx、$name/{route,index}.tsx、$name/$resource/$object.tsx
- registry：federated-projects 区域 federatedprojects 页 status 改 ready
- 文案：packages/locales/src/index.ts 的 fedprojects.*

## 对外契约

- 读取：GET `/apis/types.kubefed.io/v1beta1/federatednamespaces`（列表/详情查找）、GET `/apis/types.kubefed.io/v1beta1`（discovery 的资源类型）、GET `/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1`（企业空间显示名）。
- 列表句柄：`federated-projects:surface`、行 `data-ai-row=<name>`、名称链接 `federated-projects:open:<name>`。
- 详情句柄：`federated-project:surface/:basic/:types/:types:empty/:types:error/:not-found/:back`；页签面板 `federated-project:tab:<overview|workloads|config|storage>`，触发器加 `:trigger`；资源表 `federated-project:resources:<workloads|config|storage>`（`:empty` / `:error` / `:retry`）。
- 资源读取：`GET /apis/types.kubefed.io/v1beta1/namespaces/<namespace>/<plural>`，plural 取 federatedapplications/deployments/statefulsets/replicasets/jobs/services/ingresses（应用负载）、federatedconfigmaps/secrets/serviceaccounts/limitranges（配置）、federatedpersistentvolumeclaims（存储）。
- 资源详情：`GET /apis/types.kubefed.io/v1beta1/namespaces/<namespace>/<plural>/<名称>`；404 转为「未找到」，其它错误为读取失败。
- 资源行链接 `federated-project:resource:<segment>/<名称>`；资源详情句柄 `federated-resource:surface/:title/:kind/:template/:template:empty/:distribution/:distribution:empty/:not-found/:back/:retry`。
- URL：`/kube-frontend/workspaces/<ws>/federatedprojects[/<name>]`。

## 不变量

- 列表只显示 template workspace 标签匹配当前企业空间的对象。
- 详情与列表读同一个集合，名称解析一致。
- 只读：页面上没有任何写操作。
- 资源类型列表只含 namespaced=true 的类型，按 kind 排序。
- 资源页签只列项目命名空间内的对象，`federatednamespaces` 自身不列入任何页签。
- 每个资源页签的加载/空态/失败互不影响，也不阻塞概览。
- 资源详情的 URL 段用老 console 的段名（deployments/services/configmaps…），API 用 Federated 集合名；两者由 `FEDERATED_RESOURCE_SEGMENTS` 一张表双向映射。
- 资源详情只读：模板 YAML 来自 `spec.template`，分发信息来自 `status.clusters` / `status.conditions`；控制面尚未回报时显示说明，不猜测。

## 已知坑

- tenant 的 federatednamespaces 集合返回 0（workspace 标签在 template 上），不要据此判断「没有联邦项目」。
- 按名称的集群级 GET 404，必须用集合查找或带 namespace。
- FederatedNamespace 的 spec.template 可能没有 workspace 标签（历史对象），当前列表会过滤掉它；需要时在详情用 namespace 推断。
- 列表未分页：联邦项目数量在本环境是 1；数量增长后要像其它企业空间页一样接分页。

## 测试与可观测

E2E：TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01（列表/概览）、-02（资源页签）与 -03（资源详情）。-03 需要真实对象：用例先创建一个 FederatedConfigMap（唯一名称），轮询到 status 回报后验证模板/分发/行链接，并在 finally 删除联邦对象与（防御性）已分发的本地 ConfigMap；未找到分支用 deployments/services 的虚构名称验证，不依赖对象存在。用例先读联邦集合算出某企业空间的期望行数与 discovery 的命名空间级类型数，再打开列表核对行数/表头，点击名称进入详情核对基本信息与类型行数；另找一个没有联邦项目的企业空间核对空态文案。

## 后续改进

- 联邦资源详情的编辑/删除/事件/日志页签与写操作（对齐老 console 22 条路由的剩余部分）。
- 资源页签的搜索/过滤/分页。
- 创建/编辑/删除与部署集群调整（写 webhook 稳定后）。
- 列表分页/搜索。
- 详情列出「已联邦对象」与多集群差异。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03
