# 镜像构建器 · 技术方案（L3）

[需求](../../../prd/kube-frontend/app-workloads/s2ibuilder.md)

## 概述

项目级镜像构建器页族的完整技术方案：列表（服务端分页/搜索）、两步创建向导（S2I/B2I）、详情（属性 + 运行/编辑/删除）、运行/重新构建、五个详情页签（构建记录、资源状态、镜像制品、环境变量、事件）。

数据面：devops 组 **v1alpha1** 的 s2ibuilders / s2iruns / s2ibinaries（命名空间级），s2ibuildertemplates（集群级）。列表读 kapis 资源代理（唯一带服务端分页/搜索/totalItems 的端点），其余读写原生 CRD 端点。

本环境的两个既有限制决定了不少设计：s2ioperator 的 service account 没有 cluster-scope list/watch 权限（不会产生 Job/status/logURL），minio 服务缺失（B2I 上传 500）。页面与测试都按“请求链路真实、控制器产物如实降级”处理，见 GOT。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-11
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12

## 设计目标与非目标

目标：一条完整用户任务（列表 → 创建 → 运行 → 记录/制品 → 编辑/删除）；数据语义与旧 console 一致；无 Job/无日志时诚实降级；共享组件优先。

非目标：修复 s2ioperator RBAC、补 minio 服务、把构建成功验证写进本批（阻塞项见交付记录）；不复制旧前端按钮级权限表；不实现批量编辑/批量运行。

## 关键约束

- 读写版本：列表 `GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/s2ibuilders`（page/limit/sortBy/ascending/name、totalItems）；详情/写入 `/apis/devops.kubesphere.io/v1alpha1`（无分页）。
- 创建 webhook 要求：`spec.config.builderPullPolicy` 合法（用 `if-not-present`）且 `spec.config.sourceUrl` 非空；否则 403。
- 运行状态只来自 `status.runState` / `status.lastRunState`，为空表示控制器未汇报，不等同失败或成功。
- 环境变量页签的数据源是 Job 的容器 env，不是 builder.config.environment。
- 查询键必须含 cluster、namespace、对象名与分页/搜索参数（同页可同时打开列表与详情）。

## 关联契约

- **CON-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 列表端点：`GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/s2ibuilders?page&limit&sortBy&ascending&name` → `{items, totalItems}`；items 为完整 CRD 对象。非 host 集群加 `clusters/<id>/` 段。
- **CON-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02** — 写端点：`POST /apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibuilders`（集合，正确）；`PATCH …/s2ibuilders/<name>`（`application/merge-patch+json`）；`PUT` 整对象（YAML 编辑，带 resourceVersion）；`DELETE`。运行：`POST/GET/DELETE …/s2iruns`；状态子资源 `PATCH …/s2iruns/<name>/status`（测试用于模拟控制器汇报）。
- **CON-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03** — 构建器对象契约：标签 `s2i-type.kubesphere.io=s2i|b2i`、`controller-tools.k8s.io=1.0`；注解 `languageType`、`kubesphere.io/repoUrl`、`kubesphere.io/file`（B2I）、`displayName`/`serviceName`（关联工作负载时由创建流程写入）；config 关键字段 builderImage/builderPullPolicy/sourceUrl/revisionId/imageName/tag/contextDir/secretCode/environment[{name,value}]/gitSecretRef.name/pushAuthentication.secretRef.name/isBinaryURL。
- **CON-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04** — 远程触发器 URL：`http://s2ioperator-trigger-service.kubesphere-devops-system.svc/s2itrigger/v1alpha1/general/namespaces/<ns>/s2ibuilders/<name>/`，有 secretCode 时追加 `?secretCode=<code>`（与旧 console 逐字一致）。
- **CON-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05** — B2I 制品端点：`POST …/s2ibinaries` 创建、`PUT /kapis/devops.kubesphere.io/v1alpha2/namespaces/<ns>/s2ibinaries/<name>/file`（multipart，字段名 `s2ibinary`）、读回对象取 `spec.downloadURL`；下载按 downloadURL 的路径经 BFF 带 token 取 Blob。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01 — 读 v1alpha1，而不是 v1alpha3

**为什么**：devops 组把 S2I 资源留在 v1alpha1，v1alpha3 只有流水线/工程；对 v1alpha3 请求 s2ibuilders 的 404 很容易被误判成「功能不存在」。探测确认 v1alpha1 的资源清单含 s2ibuilders，CRD 也是 v1alpha1（与旧 console `S2IBuilderStore.apiVersion` 一致）。

**被否方案**：用 API 组发现结果猜版本。两个版本同时存在，猜中概率一半，且猜错的表现与「未安装」无法区分。

**何时重新考虑**：平台把 S2I 资源迁到 v1alpha3 时（届时两个版本可能要同时支持）。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02 — 列表读 kapis 资源代理，详情/写入读原生 CRD

**为什么**：只有 kapis 资源代理提供 `page/limit/name/sortBy/ascending/totalItems`；原始 CRD 列表一次性返回全部且无总数，前端分页会把「服务端全局排序/总数」变成假分页。旧 console 的列表也走这个端点（`stores/base.js` 的 `getResourceUrl`）。详情与写入没有聚合层，直接读 CRD 才是同一对象。

**被否方案 A**：全部走原始 CRD，前端分页/搜索——总数只能算当前页，搜索只能搜当页，违反 AC-01。
**被否方案 B**：全部走 kapis——详情的信封与写方法不统一，且 old console 详情本来就读 CRD。

**何时重新考虑**：CRD 列表支持服务端分页（aggregated API）或 kapis 提供统一的写端点。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03 — 状态按 runState/lastRunState 派生，未知值如实显示

**为什么**：构建器与运行的状态只由 controller 写 `status.lastRunState` / `status.runState`（Running/Successful/Failed）。本环境控制器不写状态，若把空值映射成「成功/失败」会造假；映射为「尚未构建」（构建器）与「状态未知」（运行）并把原始字符串留作诊断。

**被否方案**：用 Job 的 phase 推导运行状态。Job 不存在（本环境）时同样无信息，且旧 console 的列表/记录不读 Job status，替换会改变语义。

**何时重新考虑**：controller 提供更细状态时补映射；或在 Job 存在时用 Job 状态补强（不得反向覆盖 runState）。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04 — 运行/重新构建 = 配置 PATCH + 触发新 S2iRun

**为什么**：旧 console 的「运行」打开预填配置表单，保存时先更新 builder 再创建 s2irun；只创建 run 会让新的标签/分支设置无法生效，只 PATCH 不创建 run 等于保存了却没构建。实现按旧语义：merge-patch config + annotations，然后 POST s2irun。

**被否方案**：把「运行」做成无表单的一键重跑。会丢掉旧版“重新构建可改标签/分支”的能力，且用户改完配置没有入口触发。

**何时重新考虑**：产品要求单独的“保存配置”和“立即构建”两个动作时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05 — 构建器/运行列表的排序与分页位置

**为什么**：构建器列表按创建时间倒序、服务端分页（旧 console 默认 `createTime`）；运行记录按创建时间倒序、**客户端分页**，因为运行只能通过原始 CRD 列表读取，而该列表不支持分页。运行与构建器的关联以 `spec.builderName` 为准（权威字段），不依赖 controller 可能未写上的 label。

**被否方案**：沿用旧 console 的 `labels.devops.kubesphere.io/builder-name` + kapis v1alpha2 分页。实测该 label 条件返回 0（标签由 controller 写，本环境 controller 不工作；自建运行必须立即可见），用它会让运行记录永远为空。

**何时重新考虑**：controller 恢复写 label 后，可把运行列表切回服务端分页以支持大量历史；届时保留 spec.builderName 作为兜底过滤。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06 — 制品下载改为带 token 的 Blob，不再走 /b2i_download 代理

**为什么**：旧 console 由自己的 Node server 提供 `/b2i_download` 反代（因为 `spec.downloadURL` 是集群内地址，浏览器不可达）。新 BFF 只代理 `/api`、`/kapis`、`/apis`，没有该路由。downloadURL 的 pathname 本身以 `/kapis/` 开头，所以带 Bearer 取回 Blob 再触发下载是等价且更少一层代理的实现。

**被否方案 A**：新增 BFF `/b2i_download` 路由——改共享 server，超出本单元排他路径且会与并行单元冲突。
**被否方案 B**：直接放 downloadURL 链接——集群内域名浏览器不可达，点了必然失败。

**何时重新考虑**：BFF 增加统一的制品下载代理时；或 downloadURL 改为外部可达地址。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07 — 构建日志直接读 status.logURL

**为什么**：controller 写的 `status.logURL` 已是日志端点，直接 GET（text）即可得到正文；旧 console 把 URL 拆成 namespaces/pods 再用 tenant log-search 分页（from/size/tailLines），多一层解析且依赖日志模块。新实现展示尾部、构建中每 4 秒刷新、可暂停/手动刷新；无 logURL 时明确说控制器未创建构建任务。

**被否方案**：照搬 tenant log-search 分页。它在没有 Job/pod 时同样无内容，还多一个未验证的接口依赖。

**何时重新考虑**：日志量巨大需要分页/检索时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08 — 权限按服务端结果呈现，不复制旧前端权限表

**为什么**：旧 console 用 `globals.app.getActions` 决定按钮可见性；那套表与新 API 的 RBAC/SSAR 不是一一对应，复制会造出与真实授权不一致的假禁用。新 UI 保留动作，服务端 403 时页面显示无权限原因且不提供重试。

**被否方案**：为 s2ibuilder 补一套 SSAR 预检——本环境没有可验证的 s2i 专用 verb 映射，猜一个权限名会在某些角色下把可用功能隐藏。

**何时重新考虑**：平台提供 S2I 资源的 SSAR 规范与角色样例时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09 — 创建后立即触发一次 S2iRun

**为什么**：旧 `S2IBuilderStore.create` 创建成功后调用 `createS2IRun`；创建向导的提示也说明“创建后立即构建”。不触发则用户还要去详情点运行，且列表状态永远「尚未构建」。

**被否方案**：只创建构建器，让用户手动运行。多一步且与旧行为不一致。

**何时重新考虑**：产品要求创建与构建分离（例如先审核配置）时。

## 不变量

1. **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 列表请求必须是 kapis 资源代理并带 `page`、`limit`；总数取 `totalItems`。
2. **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02** — 页面状态与数据一致：0 → empty、>0 → ready、请求失败 → error + 重试（403 不重试）；未知状态不显示为成功/失败。
3. **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03** — 写操作使用 kube 语义：创建 POST 集合、更新 PATCH 对象（带 merge-patch content type）、YAML 编辑 PUT 整对象；更新不得整体替换 annotations（未展示的注解必须保留）。
4. **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04** — 无 Job 时不渲染 Job 依赖的空表，必须显示原因；无 logURL 时不发日志请求。
5. **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05** — 查询键包含 cluster、namespace、对象名与分页/搜索参数；列表最后一条被删且页码越界时回退一页。
6. **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06** — 创建/编辑/运行的输入在失败时保留；破坏性操作（删除/停止类）必须输入对象名确认。
7. **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07** — 环境变量名含 password/secret 的值显示 `******`；密码/token/kubeconfig 不写入日志或截图。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — v1alpha3 的 404 是版本拆分。同组两个版本并存，S2I 只在 v1alpha1；按错版本找不到资源不等于模块未安装。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02** — 创建 webhook 403 不是权限问题。缺 `builderPullPolicy` 或 `sourceUrl` 为空时 admission webhook 返回 403 `Invalid value specified for "builderPullPolicy"`；UI 必须始终写 pull policy 并校验仓库地址，否则看起来像无权限。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03** — 越界页返回 500。kapis 资源代理对 `page` 超过最后一页的请求返回 500（不是空列表）；删除/搜索后必须重置或回退页码。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04** — s2ioperator 无 cluster-scope list/watch 权限。日志原文（2026-11-15）：
  `Failed to watch *v1alpha1.S2iBuilder: s2ibuilders.devops.kubesphere.io is forbidden: User "system:serviceaccount:kubesphere-devops-system:default" cannot list resource "s2ibuilders" in API group "devops.kubesphere.io" at the cluster scope`；
  `s2iruns`、`jobs.batch`、`namespaces`、`configmaps` 同样 forbidden。后果：S2iRun 创建后不产生 Job/status/logURL。UI 因此必须把“无 Job”当作可解释状态；测试中的成功状态只能通过 /status 子资源模拟，不能冒充构建成功。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05** — 没有 containerd 运行时信息来源。旧创建向导在 runtime=containerd 时显示“不支持”提示；新 console 无此信息源，且该提示不阻止操作，故明确不做（不是能力删减）。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06** — B2I 上传 500 来自 minio 缺失，不是表单问题。真实响应：
  `500 RequestError: send request failed caused by: Put "http://minio.kubesphere-system.svc:9000/s2i-binaries/<ns>-<name>": dial tcp: lookup minio.kubesphere-system.svc on 169.254.25.10:53: no such host`；S2iBinary 进入 UploadFailed。失败路径必须删除半成品，否则下次同名冲突。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07** — `git/verify` 在本环境恒 500 `authentication required`。它是非阻塞的提示性检查，不能作为必填校验，也不能据此隐藏仓库密钥字段。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08** — 运行与构建器的关联字段是 `spec.builderName`，不是 label。label 由 controller 写，在 controller 不工作或尚未 reconcile 时不存在；用 label 过滤会漏掉刚创建/自建的运行。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09** — 旧 mapper 把 `revisionId` 读自 `status.s2iBuildResult.revisionId`（CRD 无此字段，永为空）；新实现读 `status.s2iBuildSource.revisionId`，并在缺失时回退构建器配置的 revisionId。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10** — `imageSize` 可能是数字（字节）或已格式化字符串；`formatSize` 对数字按 1024 换算，对字符串原样返回，避免把 "47B" 再解析成错误单位。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12** — 构建器 status 子资源的 PATCH 必须带 `status.runCount`。CRD 的 status schema 把 runCount 标为必填，只写 lastRunState/lastRunStartTime 会得到 422 `status.runCount: Required value`；测试/本地造数若要模拟运行状态，必须同时写 runCount（s2irun 的 status 没有这个约束）。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-11** — 多集群：BFF 只代理单一上游，非 host 集群的写请求（`/apis`/`/api/v1`）没有 `clusters/<id>` 支持（与仓库既有 R-12 限制同类）；读路径已带 cluster 段，查询键含 cluster，未在 member 集群验收。

## 系统现状

旧 console 的项目「镜像构建器」页有列表（创建/编辑/删除、列显隐、批量删除、状态轮询）、两步创建向导（S2I/B2I 含制品上传）、详情（五页签：运行记录、资源状态、镜像制品、环境变量、事件）、运行/重新构建（预填配置 + 更新工作负载开关）、编辑信息/编辑 YAML/删除。本单元把上述能力全部迁移，并对 controller 不工作时的事实做如实降级。

## 仓库落点

- 页面：`apps/console-next/src/pages/app-workloads/ImageBuilderPage.tsx`（列表）、`imagebuilder/ImageBuilderDetailPage.tsx`（详情）、`imagebuilder/ImageBuilderCreateDialog.tsx`（创建向导）、`imagebuilder/ImageBuilderConfigDialog.tsx`（运行/重新构建）、`imagebuilder/ImageBuilderFormFields.tsx`（共享构建设置表单）、`imagebuilder/panels.tsx`（五页签面板）、`imagebuilder/format.ts`（状态/大小/名称/模板派生）、`imagebuilder/queries.ts`（查询、变更、AI manifest）。
- 路由：`routes/…/s2ibuilder/index.tsx`、`routes/…/s2ibuilder/$name.tsx`；区域注册 `areas/registry.ts` 的 devops-project → s2ibuilder（已存在，status ready）。
- 接口：`packages/api-client/src/s2ibuilder.ts`（类型、mapper、imageBuildersApi、B2I 上传/下载、触发链接、状态归一）；barrel `packages/api-client/src/index.ts`。
- 文案：`packages/locales/src/index.ts` 的 `devopsProject.s2ibuilder.*`（中英文键集合一致）。
- 测试：`tests/ui/pages/imagebuilder_page.py`、`tests/ui/specs/…/TC-…-S2IBUILDER-01..12.yaml`、`tests/ui/tests/…/test_TC_…_S2IBUILDER_0N.py`。

## 对外契约

| 用途 | 路径 | 方法 | 实测 |
| --- | --- | --- | --- |
| 构建器列表（分页/搜索/排序） | /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/s2ibuilders | GET | 200，items/totalItems，page/limit/name/sortBy/ascending 生效 |
| 构建器详情 | /apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibuilders/<name> | GET | 200 |
| 构建器创建 | /apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibuilders | POST | 201；缺 pullPolicy/sourceUrl → 403 webhook |
| 构建器更新 | …/s2ibuilders/<name> | PATCH(merge)/PUT | 200 |
| 构建器删除 | …/s2ibuilders/<name> | DELETE | 200，回读 404 |
| 构建模板 | /apis/devops.kubesphere.io/v1alpha1/s2ibuildertemplates | GET | 200，5 条 |
| 运行列表/创建/详情 | /apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2iruns[/<name>] | GET/POST | 200/201 |
| 运行状态（测试模拟 controller） | …/s2iruns/<name>/status | PATCH(merge) | 200 |
| 制品对象 | /apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibinaries[/<name>] | POST/GET/DELETE | 201/200 |
| 制品上传 | /kapis/devops.kubesphere.io/v1alpha2/namespaces/<ns>/s2ibinaries/<name>/file | PUT(multipart) | 500（minio 缺失，阻塞） |
| 仓库可读性检查 | /kapis/resources.kubesphere.io/v1alpha2/git/verify | POST | 500 authentication required（非阻塞提示） |
| 错误版本 | /apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/s2ibuilders | GET | 404（v1alpha3 无该资源） |

字段映射：

| 页面字段 | 来源 |
| --- | --- |
| 名称 | metadata.annotations.displayName，缺省 metadata.name；别名（kubesphere.io/alias-name）参与编辑信息 |
| 类型 | metadata.labels["s2i-type.kubesphere.io"]（b2i 否则 s2i） |
| 所属服务 | metadata.annotations.serviceName |
| 构建器镜像 | spec.config.builderImage |
| 输出镜像名 | spec.config.imageName（列表仅详情展示） |
| 拉取策略 | spec.config.builderPullPolicy（原值展示） |
| 代码仓库 / 制品 | spec.config.sourceUrl；S2I 附 spec.config.revisionId |
| 远程触发器 | `CON-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04` 的 URL + spec.config.secretCode |
| 构建器状态 | status.lastRunState（Running/Successful/Failed/空） |
| 最近构建时间 | status.lastRunStartTime（缺失 -） |
| 运行状态 | status.runState（同一映射，空 → 状态未知） |
| 运行镜像/大小/拉取命令/发布时间 | status.s2iBuildResult.imageName/imageSize/commandPull/imageCreated |
| 运行来源 | status.s2iBuildSource.builderImage/sourceUrl/revisionId/binaryName/binarySize |
| 运行 Job / 日志 | status.kubernetesJobName / status.logURL |
| 容器端口/Pod/环境变量/事件 | Job spec.template.spec.containers、Job selector 的 Pods、Pod events（involvedObject.kind=Job） |

## 不变量

见上文 `INV-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01` 至 `…-07`。

## 已知坑

见上文 GOT-01 至 GOT-11。

## 测试与可观测

- 单测/契约：`npx tsc --noEmit`（api-client、console-next）；`npx vitest run --config config/vitest.config.ts`（含 ai-surface 契约：页面必须有 AiSurface + state + data-ai-id/actionProps + 错误重试）。
- E2E：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01..12` 实跑；写用例均用唯一前缀、回读、失败也清理；运行状态通过 /status 子资源模拟 controller 汇报并在 docstring 标注，不冒充构建成功。
- 可观测点：`image-builder:surface`、`image-builder:retry`、`image-builder:create`、`image-builder:refresh`、`image-builder:search`、`image-builder:row-manage`、`image-builder-detail:surface`、`image-builder-detail:tab:<key>`、`image-builder-detail:run-log-toggle:<run>`、`image-builder-detail:no-job`、`image-builder-create:*`、`image-builder-run:*`。
- 失败时先看：列表是否请求了 v1alpha3（404）、创建是否触发 webhook 403（pull policy/sourceUrl）、运行是否只创建了对象而没有 status（controller 权限阻塞）、B2I 上传 500（minio）。

## 后续改进

- s2ioperator 授权后回补：构建成功状态、Job、日志正文、资源状态/环境变量/事件页签的真实数据验收。
- minio 可用后回补：B2I 上传成功与制品下载正文。
- 跨作用域（member 集群）写路径与角色矩阵。
- 旧列表的列过滤高级输入框（实测不可用）若要恢复，需要先给列加 search 标记并定义服务端过滤语义。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01` … `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12`（逐条见 `tests/ui/specs/kube-frontend/app-workloads/`）
