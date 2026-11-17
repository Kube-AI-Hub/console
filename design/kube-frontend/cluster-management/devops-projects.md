# DevOps 工程 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/devops-projects.md)

## 概述

集群作用域的 DevOps 区域：`/kube-frontend/clusters/<cluster>/devops`（列表 + 创建工程）、`…/devops/<name>`（详情：基本信息 + 流水线/持续部署/代码仓库/成员/角色/凭证六个集合页签，默认基本信息；编辑信息、删除工程、编辑 CD 白名单）与 `…/devops/<name>/pipelines/<pipeline>`（流水线详情：基本信息 + 运行记录 + 流水线配置）。读来自 devops CRD、devops/iam kapis 集合、devops 组的 pipelineruns/gitrepositories 与 gitops 组的 applications；写走 kapis 的工程/流水线/凭证/成员接口与原生 `/apis` 的工程 PUT/DELETE、gitrepositories、pipelineruns。运行成功与日志内容受 Jenkins 通道阻塞（见已知坑 GOT-…-DEVOPS_RUNS-03），页面只承诺请求链路并如实展示运行对象状态。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-06`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-07`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-04`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-05`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-02`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-02`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-02`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_ROLES-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-02`

## 设计目标与非目标

目标：区域可达、空态可信、详情每个集合独立成败且不伪造；工程创建/编辑信息/删除写后回读；流水线列表用服务端分页与筛选，创建/编辑/复制/删除闭环；流水线详情可查看并保存 Jenkinsfile（专用 PUT 路由，保存后回读）；运行触发走原生 PipelineRun 并如实展示状态与日志错误；凭证四类型 CRUD、成员邀请/改角色/移除、角色只读、代码仓库导入/删除、CD 白名单编辑都走真实接口。
非目标：可视化流水线编辑器、停止/终止运行、CD 创建/同步/回滚与明细页、代码仓库编辑/YAML、角色 CRUD、凭证详情活动页、成员批量操作、列表定时轮询、workspace 作用域授权。

## 关键约束

- 工程读：`/apis/devops.kubesphere.io/v1alpha3/devopsprojects[/<name>]`（实测 200 / 404 NotFound）。kapis `/kapis/devops.kubesphere.io/v1alpha3/devopsprojects` 为 **404**。
- 工程写：创建 `POST /kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops`（必须 `metadata.generateName`，仅 name 报 `metadata.generateName: Required value`）；编辑/删除 `PUT|DELETE /apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>`（整对象，保留 spec.argo 与 annotations）。
- 成员/角色：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members|roles?limit=-1`；成员写为 `POST`（数组 body）、`PUT|DELETE …/members/<username>`；工程不存在时 404 资源 not-found。
- 凭证写：`/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials[/<credential>?content=1]`；凭证读：`/api/v1/namespaces/<ns>/secrets`（kapis 列表实测恒为空）。
- 流水线：kapis `GET /kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines?page=&limit=&name=&type=&ascending=` 返回 `items[]` 与 `totalItems`（实测 200，服务端分页/搜索/类型筛选生效）；创建 `POST …/pipelines`、编辑 `PUT …/pipelines/<name>`（整对象）、删除 `DELETE …/pipelines/<name>`。原生 `/apis/…/namespaces/<ns>/pipelines[/<name>]` 也可读，但无分页参数。
- Jenkinsfile 保存：`PUT /kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines/<pipeline>/jenkinsfile?mode=raw`，body `{"data": "<jenkinsfile>"}`；缺 `mode` 返回 400 `invalid edit mode: `（实测）；`GET` 该路由为 405。
- 运行：`POST /apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns`（实测 201，label 与 pipelineRef 可读）；列表 `GET …/pipelineruns`（支持 `labelSelector=devops.kubesphere.io/pipeline=<pipeline>`，空结果时读全量按标签或 `spec.pipelineRef.name` 兜底）；日志 `GET /kapis/…/pipelines/<p>/runs/<id>/log/` 实测 404 Page Not Found。
- 代码仓库：`/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/gitrepositories`（实测 200/201/DELETE 200）；`…/coderepositories` 为 404；`…/cd`、`…/applications` 在 devops 组为 404，持续部署读 gitops 组 `/apis/gitops.kubesphere.io/v1alpha1/namespaces/<ns>/applications`。
- 命名空间：DevOpsProject CRD 的 `status.adminNamespace`（唯一 status 字段）；2026-11-15 实测 1 个迁移探针工程已写入且等于工程名，新建对象在控制器恢复前为空，缺失时回退工程名。
- 环境阻塞：`devops-controller` CrashLoopBackOff（日志 `Error: the token of the Jenkins needs to update`），`kubesphere-config` 的 `devops.host=` Jenkins service、`devops.username=admin`；因此运行注解与日志不可用（证据与复查条件见 GOT-…-DEVOPS_RUNS-03）。
- 区域在 registry 中为 cluster scope，URL 无 workspace 段。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01 — 列表/基本信息读 cluster-scoped CRD，而不是 kapis 聚合

**为什么**：registry 把 DevOps 区域登记为 cluster scope（集群菜单，URL 无 workspace），而老 console 的 kapis 读取形状（`/kapis/devops.../workspaces/<ws>/devops`、`/kapis/tenant.../workspaces/<ws>/devops`）都需要 workspace 段；本页没有该参数。`devopsprojects` 本身是 cluster-scoped CRD，一次列出全部工程，并带 `kubesphere.io/workspace` 标签用于展示归属。
**被否方案**：把 URL 改成 `/:workspace/clusters/:cluster/devops`。集群菜单的链接由 registry scope 生成（`/kube-frontend/clusters/<id>/devops`），workspace-prefixed 路由在集群菜单里不可达。
**何时重新考虑**：产品决定 DevOps 必须按企业空间过滤/授权时，把区域改成 workspace scope 并改 URL（需同步 registry 与 shell）。

**后续（2026-11-17）**：产品复核决定重纳空间作用域入口，但没有改本区域的 scope——入口以 workspace scope 的独立列表页承接（[workspace-console DEC-16](../access-control/workspace-console.md)），本区域 URL 与写入能力不变；空间列表行链接回本区域的工程详情。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02 — 详情页签以工程名为键，分别读取 IAM/devops 的工程级集合

**为什么**：成员/角色在 IAM 聚合下 `/devops/<name>/...`，凭证在 devops 组 `/devops/<name>/credentials`；三者都以工程名解析，不需要 workspace 段，和 cluster-scope 详情 URL 自洽。每个查询独立，失败只影响本页签。
**被否方案**：一个 Promise.all 拿全部页签。任一集合 403/404 会让基本信息之外的页面全部不可用，且违背「不伪造」时无法区分空与读不到。
**何时重新考虑**：ks-devops 提供一次性工程详情聚合接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03 — 工程不存在时仍渲染页签

**为什么**：当前集群 `devopsprojects` 为 0，详情页只能通过手输名称到达。若 not-found 时隐藏页签，「页签可切换」将无法验收，读者也无法判断是「没有工程」还是「页面缺块」。保留页签并让每个页签显示失败原因+重试，既诚实又可观测。
**被否方案**：404 时整页只有 not-found。骨架的价值在于证明每个集合的真实读取结果。
**2026-11-15 复查**：写能力落地后实现改为 not-found 时不渲染页签（避免对不存在的工程发成员/角色/集合请求），原决策的「页签可切换」不再适用；本段保留历史原因，当前行为见 PRD AC-…-DEVOPS_PROJECTS-07。
**何时重新考虑**：产品要求 not-found 时仍展示页签骨架，或需要在一个不存在工程上诊断集合接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04 — 工程命名空间取 `status.adminNamespace`，缺失时回退工程名

**为什么**：流水线、CD、代码仓库都是 namespaced 资源，命名空间由 devops 控制器写进 DevOpsProject 的 `status.adminNamespace`（CRD 唯一的 status 字段，schema 已核实）。不能假设它等于工程名：工程名只是 CRD 的 `metadata.name`，命名空间由控制器创建。回退到工程名只在对象缺失或控制器尚未写入时使用，且基本信息会把实际命名空间显示出来，让回退值可诊断而不是隐形。
**被否方案**：直接用工程名当命名空间（老 console 的做法）。在控制器为命名空间加前缀或改名时会全部读错，且没有任何提示。
**被否方案**：等 `status.adminNamespace` 存在才发请求。当前集群 0 个工程，详情页将无法验证页签，也会让半创建工程显示空白而非空态。
**何时重新考虑**：ks-devops 提供显式的工程→命名空间解析接口，或 CRD 改字段时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05 — 三个页签各发各的请求，沿用「独立成败」原则

**为什么**：三类资源在三个组（devops pipelines / devops gitrepositories / gitops applications），任何一类未安装或 403 都不应影响另外两类。每个页签一个 `useQuery`，与成员/角色/凭证页签同一模式（见上一条方案决策）；代码集中到 api-client 的 `devops.ts`，页面只负责表格与三态。
**被否方案**：一个聚合并行请求。会让「哪一个集合失败」从页签状态退化为整页错误。
**何时重新考虑**：出现一次返回工程全部集合的聚合接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-06 — 运行记录按标签过滤，标签为空时按 pipelineRef 兜底

**为什么**：PipelineRun 与流水线的关联有两条可用证据：控制器打的标签 `devops.kubesphere.io/pipeline`（服务端 `labelSelector` 可直接过滤）和 `spec.pipelineRef.name`（对象内引用）。本集群 0 条运行记录，无法核对控制器实际标签键，因此先按标签过滤；结果为空时再读一次全量、按标签**或** pipelineRef 匹配。宁可多一次空列表请求，也不要把「标签键变了」显示成「这条流水线从未运行」。
**被否方案**：只按标签过滤（标签键一变全部空白）；或只拉全量客户端过滤（运行记录多时把整表拉进浏览器）。
**被否方案**：走老 console 的 kapis 子资源 `pipelines/<name>/pipelineruns`。那是 ks-devops 聚合接口的旧形状，与首屏读取原生 CRD 的策略不一致，且 404 时无法区分「没有运行」与「路由不存在」。
**何时重新考虑**：有真实运行记录、确认控制器标签后，去掉全量兜底（或改为只在开发模式校验）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-07 — 运行状态从 Jenkins 注解派生，不读 status

**为什么**：PipelineRun CRD 只有 `spec`（pipelineRef/parameters/scm/action），没有可用的 `status`；ks-devops 把 Jenkins 的状态写成注解 `devops.kubesphere.io/jenkins-pipelinerun-status`（JSON：state/result/id/startTime/durationInMillis），老 console 的 mapper 同样读它。页面把 state/result 映射成 8 种徽章状态（排队/运行中/成功/失败/中止/暂停/不稳定/未运行），无注解时归为「未运行」而不是错误。
**被否方案**：显示原始 state/result 字符串。读者要的是「成功/失败」，而且 state 与 result 两个字段的组合（FINISHED+FAILURE）不适合直接展示。
### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-08 — 读原生 `/apis`、写按资源分组选择 kapis 与原生

**为什么**：实测只有一部分路径存在：kapis 的 `devopsprojects` 404，`pipelineruns/branches/scan` 等流水线子路由在 kapis 上 404（`POST …/pipelines/<p>/pipelineruns`、`…/runs`、`…/run`、`…/scan` 均 404；`GET …/pipelines/<p>/pipelineruns` 不存在），而原生 `/apis` 的 `pipelineruns`、`gitrepositories` 可读写；反过来流水线列表的服务端分页/搜索/类型筛选只有 kapis 提供 `totalItems`，凭证的 kapis 列表实测恒为空但写接口能生成 Jenkins 同步注解。于是按资源而非按“统一网关”选择：工程读/写与 gitrepositories、pipelineruns 走原生；流水线列表/详情、凭证写、成员/角色走 kapis；凭证读改读 Secret 集合。

**被否方案**：全部走 kapis。`/kapis/devops.kubesphere.io/v1alpha3/devopsprojects` 404，`pipelineruns` 子路由 404，运行和代码仓库写不了。

**被否方案**：全部走原生 `/apis`。流水线列表没有 `page/limit/name/type/totalItems`，前端要自己分页，与老 console 的服务端分页行为不一致；凭证列表若只读原生 Secret 会读不到 Jenkins 同步注解之外的语义类型（仍需按 secret type 过滤）。

**何时重新考虑**：devops-apiserver 补齐 kapis 的 pipelineruns/branches/scan 与 devopsprojects 路由，或提供统一的分页/聚合接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-09 — 工程创建用 generateName，界面按接口返回名跳转

**为什么**：devops-apiserver 要求 `metadata.generateName`，只给 `metadata.name` 会 400（错误信息含 metadata.generateName: Required value）；它会在名字后追加 5 位随机后缀（老 console 用 `name.slice(0, -5)` 反推输入名）。新 UI 直接使用响应里的真实名字做跳转与列表回显，避免前端猜后缀。名称输入限制 58 字符，为后缀留空间。

**被否方案**：前端自己拼 5 位随机后缀再 POST name。后缀冲突时 409，且与老 console 的行为不一致。

**被否方案**：创建后让用户手动从列表找新工程。多一次导航且容易误点别的工程。

**何时重新考虑**：apiserver 支持用户指定完整名称（不做后缀）时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-10 — 工程编辑/删除：整对象 PUT 与 DELETE，保留未展示字段

**为什么**：devops 的更新是整对象 PUT，只提交表单会丢掉 `spec.argo`（CD 白名单）与 `kubesphere.io/workspace` 标签。编辑信息时先读当前对象，再只替换两个注解；白名单编辑同样先读当前对象再替换 `spec.argo`。删除走原生 DELETE，成功后 invalidate 列表并导航回列表。

**被否方案**：PATCH merge。devops-apiserver 对该组只验证了 PUT 语义，PATCH 未验证；而整对象 PUT 已能保留未知字段。

**被否方案**：编辑信息对话框提交整个 spec。会把表单没展示的 argo 字段清空或写错。

**何时重新考虑**：apiserver 提供字段级 patch 或明确支持 merge patch 时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-11 — 七个页签、默认基本信息、每页签独立查询

**为什么**：老 console 的页签顺序是 management（base-info）→ pipelines → cd → code-repo → members → roles → credentials，index 路由重定向到 base-info。新页签沿用该顺序与默认页，查询按页签 `enabled` 懒加载，成员/角色在基本信息里还要显示数量所以常驻读取；每个集合一个 `useQuery`，失败只影响本页签。

**被否方案**：只保留旧版的“只读三页签”加两个列表。工程治理动作没有落点，等于功能缺失。

**被否方案**：进入详情就并行读取全部集合。任何一类 403 都会让首屏变慢并让无关页签报错，且与“独立成败”冲突。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01 — 流水线列表用 kapis 服务端分页，不在前端切页

**为什么**：kapis 的 `devops/<project>/pipelines` 接收 `page/limit/name/type/ascending` 并返回 `totalItems`（实测 page=1&limit=1 返回 1 行、total=2；`name=tc-probe` 过滤生效；`type=multi-branch-pipeline` 返回 0）。前端按服务端返回渲染「共 N 条」、页码与每页条数，搜索与类型筛选变化时把页码重置为 1，避免一次操作发两次请求或页码与总页数不一致。

**被否方案**：一次拉全量、前端切片。运行记录多时首屏变慢，且无法与接口 `totalItems` 对账。

**被否方案**：沿用旧 console 的 4 秒轮询。新列表以显式刷新与写后 invalidate 为准，轮询会在后台制造大量请求。

**何时重新考虑**：kapis 支持排序字段与游标分页时，补 `ascending` 的 UI。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02 — 健康与运行状态各只有一份实现，缺值不伪造

**为什么**：老 console 把 weatherScore 缺省成 100、计数器缺省成 0，未同步 Jenkins 的流水线会被画成“健康且空”；这次改为缺值 `undefined` → 页面显示「无状态」，分档规则（大于 80 健康、30~80 亚健康、小于等于 30 异常）与运行状态映射（state/result → 8 态）分别集中在 `pages/devops/format.ts` 与 api-client，列表、详情、运行详情共用。

**被否方案**：页面里各自写 if/else。列表与详情会出现不同分档，运行表格与徽章颜色会漂移。

**被否方案**：继续默认 100/0。等于伪造健康与“没有分支”的事实。

**何时重新考虑**：CRD 出现结构化 health/status 字段时，改为读结构化字段并保留缺值语义。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03 — Jenkinsfile 保存走 `PUT …/jenkinsfile?mode=raw`，保存后回读

**为什么**：实测整对象 PUT 修改 `spec.pipeline.jenkinsfile` 不会落库（读回仍是旧值）；专用子路由 `PUT …/pipelines/<p>/jenkinsfile?mode=raw` body 为 `{data: <jenkinsfile>}` 返回 200 且回读等于提交内容，缺 `mode` 返回 400 `invalid edit mode: `。因此 api-client 新增 `saveJenkinsfile` 调该路由并在成功后重读 pipeline；页面只在单分支渲染文本域，多分支显示脚本来自仓库的只读说明。

**被否方案**：整对象 PUT（实测不生效，保存成功提示会说谎）。

**被否方案**：直接调用 Jenkins createItem/updateJob。前端没有 Jenkins 凭据且跨源，必须经 devops-apiserver。

**何时重新考虑**：apiserver 让整对象 PUT 也接受 jenkinsfile 时，可去掉专用路由以简化契约。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-04 — 复制是“预填创建”，名称必须重新输入

**为什么**：名称是对象身份，不能复制；复制对话框用源的 type 与 Jenkinsfile 预填，名称留空并复用创建校验。旧 console 的复制同样要求新名称。

**被否方案**：后端 copy 接口。devops-apiserver 未提供，且创建 body 已足够表达。

**何时重新考虑**：apiserver 提供 clone 接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01 — 触发运行直接创建原生 PipelineRun，页面只承诺请求链路

**为什么**：老 console 的 `POST …/pipelines/<p>/pipelineruns`（及 `runs`、`run`）在 kapis 上 404，所以按该路由最终会创建的对象形状直接 `POST /apis/…/namespaces/<ns>/pipelineruns`：`metadata.generateName=<pipeline>-`、label `devops.kubesphere.io/pipeline=<pipeline>`、`spec.pipelineRef.name=<pipeline>`、可选 `spec.scm.refName` 与参数。实测 201 且对象可读。运行成功与否由 Jenkins 决定，页面在成功后显示「已提交运行请求：<name>。」并刷新运行记录，不显示“运行成功”。

**被否方案**：隐藏运行入口，只保留运行记录。用户无法发起新运行，等于砍能力。

**被否方案**：前端等控制器把状态写回再提示成功。控制器当前 CrashLoop，会一直等不到且误导用户。

**何时重新考虑**：kapis 的 pipelineruns 路由恢复，或控制器提供同步创建并返回 Jenkins 结果的接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01 — 凭证读 Secret 集合、写 kapis

**为什么**：kapis `…/credentials` 列表实测 200 但恒为 `items: []`（连该接口自己刚创建的凭证也不返回），若用它渲染会得到永久空页签；而同一接口的 POST 会生成 `credential.devops.kubesphere.io/syncstatus` 注解，是控制器需要的形状。因此列表读 `/api/v1/namespaces/<ns>/secrets` 并按四种 `credential.devops.kubesphere.io/*` 类型过滤，写（POST/PUT/DELETE）仍走 kapis。

**被否方案**：只读 kapis。页签永远为空，创建后也看不到。

**被否方案**：写也直接写 Secret。会缺同步注解，Jenkins 侧不会收到凭证。

**何时重新考虑**：kapis 的 credentials 列表修复后，改回单一路径并保留 Secret 过滤作为兜底。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01 — 成员/角色走 iam kapis 聚合，不自建 RoleBinding 列表

**为什么**：iam kapis 的 `devops/<name>/members` 一次 join 出用户名、角色注解、状态与最近登录；`roles` 返回预置角色与权限模板（实测 19 条）。写接口分别是 POST 数组、PUT/DELETE 单成员。自建 RoleBinding 列表需要再 join 用户与角色，多个请求且权限判断更复杂。

**被否方案**：读 RoleBinding 再做客户端聚合。状态与最近登录来自 User 对象，页面会多出 N+1 请求。

**何时重新考虑**：iam 聚合接口变更或需要按角色模板过滤时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01 — CD 白名单用多行文本编辑 `spec.argo`，不做空列表 picker

**为什么**：当前集群没有代码仓库可供选择，若沿用老 console 的 picker，空列表会让“编辑白名单”看起来不可用。改为两个文本域：仓库每行一个（`*` 表示全部），部署位置每行 `集群/项目`；保存时解析成 `sourceRepos[]` 与 `destinations[{name, namespace, server}]`，先读当前对象再替换 `spec.argo`，保留其他字段。

**被否方案**：从实时仓库/集群列表选择。空数据时不可用，且多集群来源未验证。

**何时重新考虑**：集群内有稳定的代码仓库与集群列表，并且产品要求结构化 picker 时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-02 — CD 列表读 gitops applications，状态从 `status.argoApp` 字符串解析

**为什么**：devops 组没有 `cd`/`applications`（404）；真实资源是 gitops 组的 applications，对象把 Argo CD 定义与状态包在 `spec.argoApp` / `status.argoApp`。CRD 把 `status.argoApp` 声明为 string，控制器写 JSON；解析失败时把原字符串当同步状态，取值缺失显示 `-`，整行不消失。

**被否方案**：只读 `status.argoApp` 的 JSON 并假设一定合法。字符串格式变化时整列空白。

**何时重新考虑**：gitops CRD 改为结构化 status 时。

**何时重新考虑**：出现一次性返回工程全部集合的聚合接口时。

**何时重新考虑**：CRD 增加结构化 status 时。

## 系统现状

老 console：`/:workspace/clusters/:cluster/devops` 列表（tenant API），详情 `…/devops/:devops` 下流水线/CD/代码仓库/基本信息/成员/角色/凭证七个页签；流水线页签有运行/编辑/复制/删除与批量操作，列表按运行中状态 4 秒轮询；流水线详情有配置（图形化 Jenkinsfile 编辑器）、代码质量、活动（运行记录）、分支、Pull Request，运行详情还有任务状态/构建参数/提交/产物/事件；CD 与代码仓库写操作齐备。
新 UI（2026-11-15 交付）：列表可创建工程；详情七个页签读写 + 编辑工程信息/删除 + CD 白名单编辑；流水线列表服务端分页/搜索/类型筛选 + 创建/编辑/复制/删除/运行；流水线详情基本信息 + 运行记录 + 运行详情/日志错误 + Jenkinsfile 保存；凭证四类型 CRUD；成员邀请/改角色/移除；角色只读；代码仓库导入/删除；CD 只读列表。可视化编辑器、代码质量/扫描/分支/PR/产物/事件、CD 写操作与明细页、批量操作、角色 CRUD、定时轮询仍未迁移，见「后续改进」。

## 仓库落点

- 列表页：`apps/console-next/src/pages/devops/DevopsProjectsPage.tsx`（列表 + 创建对话框 + workspace 下拉）
- 详情页：`apps/console-next/src/pages/devops/DevopsProjectDetailPage.tsx`（七个页签、基本信息、CD 白名单、流水线列表、凭证/成员/角色/代码仓库页签与全部对话框接线）
- 流水线详情：`apps/console-next/src/pages/devops/PipelineDetailPage.tsx`（基本信息、运行记录/运行详情、流水线配置、运行表单）
- 表单与格式化：`apps/console-next/src/pages/devops/components/DevopsDialogs.tsx`（工程/流水线/凭证/成员/角色/代码仓库/白名单对话框）、`apps/console-next/src/pages/devops/format.ts`（健康分档、耗时、运行状态键与 tone、短提交）
- api-client：`packages/api-client/src/devops.ts`（`devopsCollectionsApi` 原生读、`devopsApi` kapis 读写与工程 PUT/DELETE、`saveJenkinsfile`、映射与路径常量）
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/devops/{route,index}.tsx`、`$name/{route,index}.tsx`、`$name/pipelines/$pipeline.tsx`
- 测试：`tests/ui/pages/devops_page.py`、`tests/ui/specs|tests/kube-frontend/cluster-management/` 下 DEVOPS_PROJECTS / PIPELINES / RUNS / CREDENTIALS / MEMBERS / CODE_REPOS 用例；单元 `packages/api-client/test/devops.test.ts`
- registry：`areas/registry.ts` 的 devops 区域页 status 改为 ready（随集成提交）；本批只改规格，不改产品代码

## 对外契约

| 用途 | 路径 | 方法 / 参数 | 关键字段 |
| --- | --- | --- | --- |
| 工程列表 | `/apis/devops.kubesphere.io/v1alpha3/devopsprojects` | GET | `metadata.name/creationTimestamp/labels/annotations`、`status.adminNamespace`、`spec.argo` |
| 工程详情 | `/apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>` | GET / PUT（整对象）/ DELETE | 同上；404 为 NotFound Status |
| 工程创建 | `/kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops` | POST；body `metadata.generateName` + `kubesphere.io/workspace` 标签 + 两个注解 | 响应含生成名 |
| 成员 | `/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members` | GET `?limit=-1`；POST 数组；PUT/DELETE `…/members/<username>` | `items[].metadata.name/annotations`、`spec.roleRef`、`status.state/lastLoginTime` |
| 角色 | `/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/roles` | GET `?limit=-1` | `metadata.name/creationTimestamp/labels/annotations`、`rules[]` |
| 凭证列表（读） | `/api/v1/namespaces/<ns>/secrets` | GET | `metadata.name/creationTimestamp/annotations`、`type`、`data.username`（base64） |
| 凭证（写） | `/kapis/devops.kubesphere.io/v1alpha3/devops/<project>/credentials[/<credential>?content=1]` | POST / PUT / DELETE | Secret body（`type=credential.devops.kubesphere.io/*`、base64 `data`） |
| 流水线列表 | `/kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines` | GET `page/limit/name/type/ascending`；POST 创建 | `items[].metadata/spec`、`totalItems` |
| 流水线详情/编辑/删除 | `/kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines/<pipeline>` | GET / PUT（整对象）/ DELETE | `spec.type`、`spec.pipeline.jenkinsfile`、`spec.multi_branch_pipeline`、注解 `pipeline.devops.kubesphere.io/jenkins-metadata/syncstatus/jenkinsfile.validate` |
| Jenkinsfile 保存 | `/kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines/<pipeline>/jenkinsfile?mode=raw` | PUT；body `{data: <jenkinsfile>}` | 200；缺 mode 为 400 `invalid edit mode`；GET 为 405 |
| 运行触发 | `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns` | POST；body `metadata.generateName/labels/spec.pipelineRef[/scm][/parameters]` | 201，对象可读 |
| 运行记录 | `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns` | GET（可带 `labelSelector=devops.kubesphere.io/pipeline=<pipeline>`；空结果读全量兜底） | `metadata.name/labels/annotations`、`spec.pipelineRef.name/scm.refName/parameters`、`status.phase/message/startTime`、注解 `jenkins-pipelinerun-status`（JSON） |
| 运行日志 | `/kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines/<pipeline>[/branches/<branch>]/runs/<id>/log/` | GET | 当前 404 Page Not Found（阻塞，见 GOT-…-DEVOPS_RUNS-03） |
| 代码仓库 | `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/gitrepositories[/<name>]` | GET / POST / DELETE | `metadata.name/creationTimestamp`、`spec.provider/url/secret.name` |
| 持续部署 | `/apis/gitops.kubesphere.io/v1alpha1/namespaces/<ns>/applications` | GET | `metadata.name`、`spec.argoApp.spec.destination.namespace`、`status.argoApp`（JSON 字符串） |
| CD 白名单 | `/apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>` | GET 后 PUT 整对象，替换 `spec.argo.sourceRepos/destinations` | 保留 annotations 与其他 spec |

契约级说明（每条对应上面表格里的读写路径；C5 要求改字段同时改 CON 与用例）：

- **CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 工程 CRUD。创建 body：`{kind: DevOpsProject, apiVersion: devops.kubesphere.io/v1alpha3, metadata: {generateName, labels: {kubesphere.io/workspace}, annotations?: {kubesphere.io/alias-name, kubesphere.io/description}}, spec: {placement?: {cluster}}}`；响应 `metadata.name` 是生成名（输入名 + 5 位后缀）。编辑/删除用原生对象；PUT 是整对象，未带字段会被删除，调用方必须回传 `spec`、`metadata.labels` 与未改的 annotations。
- **CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01** — 流水线列表/详情/写。列表 query `page`（默认 1）、`limit`（默认 10）、`name`（子串）、`type`（pipeline / multi-branch-pipeline）、`ascending`；响应 `items[]` + `totalItems`。创建单分支 body `spec.type=pipeline`、`spec.pipeline.jenkinsfile`（可带 `parameters[]`）；多分支 body `spec.type=multi-branch-pipeline`、`spec.multi_branch_pipeline`（`name/source_type/script_path/<source>_source{credential_id, repo, owner?}`）。编辑是整对象 PUT，未展示的 spec 与注解必须保留；删除 DELETE 对象。
- **CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02** — Jenkinsfile 保存：`PUT /kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines/<pipeline>/jenkinsfile?mode=raw`，body `{data: <jenkinsfile>}`，成功 200 且回读 `spec.pipeline.jenkinsfile` 等于提交；缺 `mode` 400 `invalid edit mode: `；`GET` 405。旧行为（整对象 PUT 携带 jenkinsfile）不生效，保留该说明用于兼容排查。
- **CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01** — PipelineRun 创建：`POST /apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns`，body `{kind: PipelineRun, apiVersion, metadata: {generateName: <pipeline>-, namespace, labels: {devops.kubesphere.io/pipeline: <pipeline>}}, spec: {pipelineRef: {name, kind: Pipeline, apiVersion}, parameters: [{name, value}], scm?: {refName, refType: branch}}}`；响应 201 含对象名。状态与耗时不在此 body，读对象注解 `devops.kubesphere.io/jenkins-pipelinerun-status`。
- **CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01** — 凭证 Secret：`type` 为 `credential.devops.kubesphere.io/basic-auth|ssh-auth|secret-text|kubeconfig`；data 字段 username/password（basic）、username/private_key/passphrase（ssh）、secret（secret-text）、content（kubeconfig）均 base64；写走 kapis，读走 `/api/v1/namespaces/<ns>/secrets` 并按 type 过滤。`type` 创建后不可改；未知 type 不在 UI 丢弃，显示原文。
- **CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01** — 成员/角色：`GET|POST /kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members`（POST body 为 `[{username, roleRef}]`）、`PUT|DELETE …/members/<username>`（body `{username, roleRef}`）；`GET …/roles?limit=-1` 返回预置角色与模板，`role-template` 分类来自标签。成员角色注解键 `iam.kubesphere.io/role`。
- **CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01** — CD：`GET /apis/gitops.kubesphere.io/v1alpha1/namespaces/<ns>/applications`，同步/健康取 `status.argoApp`（JSON 字符串）的 `sync.status`/`health.status`，目标命名空间取 `spec.argoApp.spec.destination.namespace`；白名单存 `spec.argo.sourceRepos[]` 与 `spec.argo.destinations[{name, namespace, server}]`，由整对象 PUT 保存。

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 列表行数 = CRD items 数，0 时显示空态；详情 404 显示 `:not-found`，基本信息与 CRD 对象一致。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 每个页签独立：表格 / 空态 / 失败原因+重试三选一，读不到不得显示空表。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 工程写后回读：创建后列表与详情可见接口返回名，编辑后标题/描述/基本信息回显新值，删除后回到列表且行消失。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04** — 名称是对象身份：工程、流水线、凭证、代码仓库的名称创建后不可改；删除必须输入完整名称确认。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05** — 整对象 PUT 必须保留未展示字段（`spec.argo`、annotations、workspace 标签）；只替换表单负责的部分。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01** — 流水线列表的 `page/limit/name/type` 请求参数与 `totalItems`/页码一致；搜索或类型变化把页码重置为 1；「全部类型」不发送 type。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02** — Jenkinsfile 保存后回读 `spec.pipeline.jenkinsfile` 等于提交内容；多分支流水线不写 jenkinsfile。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03** — 健康分档与运行状态映射各只有一份实现；缺值显示「无状态」/`-`，不得默认成健康或 0。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01** — 运行请求只承诺 PipelineRun 对象创建与页面刷新，状态与日志以对象注解和接口返回为准，任何情况下不显示伪造的「运行成功」。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-02** — 运行记录 = 与流水线匹配的 PipelineRun（标签或 `spec.pipelineRef.name`）；不匹配的不出现，匹配但无注解的不消失（编号回退对象名、状态「未运行」）。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01** — 凭证列表只展示四种 `credential.devops.kubesphere.io/*` 类型的 Secret；密码与私钥不回显。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01** — CD 同步/健康状态只从 `status.argoApp` 派生，解析不出显示 `-`；白名单保存保留对象其他 spec 与 annotations。

## 已知坑

- **kapis 的 devopsprojects 是 404**：列表必须走 `apis/`；把 `/kapis/devops.../v1alpha3/devopsprojects` 当列表会得到 Page Not Found。
- **工程不存在时错误消息不带 kind 前缀**（IAM 路径返回 `devopsproject.devops.kubesphere.io "x" not found`，devops 路径返回复数），不要按字符串前缀判类型，只按 not-found 状态与消息判断。
- **`rules` 可能缺失**：角色页签的规则数按 `rules?.length ?? 0` 展示。
- **凭证的 type 位置不固定**：优先对象顶层 `type`，其次 `kind`；都没有显示 `-`。
- **空集群主路径**：B200 当前 0 个工程，列表空态与详情 not-found 是必测路径。
- **写操作不可用**：当前 webhook 不稳，本页不提供任何写入口。
- **`coderepositories` 是 404**：代码仓库的真实资源是 `gitrepositories`（GitRepository）；老 console 的 `codeRepos` 模块同样读它。
- **devops 组没有 `cd`**：`…/cd` 与 `…/applications` 均 404；持续部署读 gitops 组的 `applications`（`apiVersion: gitops.kubesphere.io/v1alpha1`），对象用 `spec.argoApp` / `status.argoApp` 包着 Argo CD 的结构。
- **`status.argoApp` 是字符串**：CRD 把 Argo 状态声明为 string，控制器写 JSON。按 JSON 解析取 `sync.status`/`health.status`，解析失败时把原字符串当同步状态，避免整列空白。
- **不存在的命名空间返回 200 空列表**：三个列表接口对不存在的命名空间不报错（已实测 `tc-e2e-missing-devops-probe`）；该行为只在「工程存在但 status.adminNamespace 缺失/尚未同步」时可见，因为工程不存在时页面不渲染页签、不发集合请求。
- **工程命名空间无实例可核对**：B200 当前 0 个工程，`status.adminNamespace` 只从 CRD schema 确认存在；用 `devopsProjectNamespace` 的单元测试固定「有值用值、无值回退工程名」。
- **PipelineRun 的状态不在 status**：CRD 的 `status` 未使用，Jenkins 状态在注解 `devops.kubesphere.io/jenkins-pipelinerun-status`（JSON 字符串），且可能缺失；缺失时按「未运行」展示，不能当错误。
- **运行记录标签键未在真实对象上核对**：当前 0 条运行记录；标签过滤为空时读全量、按标签或 `spec.pipelineRef.name` 匹配，避免把「标签键不一致」显示成空。
- **流水线子资源是老 console 的 kapis 形状**：`pipelines/<name>/pipelineruns` 在原生 API 上是 404（资源不存在）；不要用它做运行记录读取。
- **路由需要一级布局**：把 `devops/$name.tsx` 改成目录 `devops/$name/{route,index}.tsx` 后，父布局必须渲染 `<Outlet/>`，否则 `/pipelines/<pipeline>` 会渲染工程详情。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01** — Radix `Select.Item` 的 `value` 不能是空字符串：把「全部类型」「不使用凭证」直接写成 `value: ''` 会让 React 抛 `A <Select.Item /> must have a value prop that is not an empty string`，详情页整页进入错误边界、多分支表单崩溃。现在用哨兵值（类型筛选 `all`、凭证 `none`），提交时映射回空串/空 type；测试必须按哨兵选择并断言请求不带 type、`credential_id` 为空串。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02** — 整对象 PUT 不会保存 Jenkinsfile（实测读回旧值）；唯一可用写法是 `PUT …/pipelines/<p>/jenkinsfile?mode=raw` body `{data: <jenkinsfile>}`。不传 `mode` 返回 400 `invalid edit mode: `，`GET` 该路由 405。把整对象 PUT 当成 Jenkinsfile 保存会让用户改完再刷新回到旧脚本。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03** — 流水线列表是 kapis 服务端分页：测试拦截请求时正则必须允许 `path` 后的 query（否则 `?page=&limit=` 不匹配，失败注入不生效）；「共 N 条」必须与 `totalItems` 对账，不能用当前页行数代替。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-04** — 健康/分支/PR 来自注解 `pipeline.devops.kubesphere.io/jenkins-metadata`；控制器不可用时这些注解不存在，页面必然显示「无状态」与 `-`。这是环境事实，不是缺值 bug；不能为了「有数据」构造假注解当真实证据。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 新建工程在控制器恢复前没有 `status.adminNamespace`，其 kapis 集合会回退到平台级数据（实测 members 返回平台用户、roles 返回 533 条模板、pipelines 返回其他工程），而页面按回退命名空间渲染，看起来像“这个工程有数据”。工程创建用例只验收创建/编辑/删除与命名空间回退，不把回退数据当该工程内容。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 工程创建必须 `metadata.generateName`（只给 name 报 `metadata.generateName: Required value`），接口追加 5 位后缀；页面用响应名跳转。测试断言「列表出现返回名」而不是「出现输入名」。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 编辑信息清空别名时 API 层会删除 `kubesphere.io/alias-name` 注解（而不是写空字符串）；否则列表与详情会显示空白别名而不是回退名称。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01** — 运行状态在注解 `devops.kubesphere.io/jenkins-pipelinerun-status`（JSON state/result/id/startTime/durationInMillis），CRD 的 `status` 未使用；无注解时按「未运行」展示，编号回退对象名、开始时间回退创建时间，耗时因 mapper 把缺失 durationInMillis 归 0 而显示 `0s`（不是 `-`，见 INV-…-DEVOPS_RUNS-01 的缺值语义）。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-02** — 运行日志只有 kapis 的 `…/pipelines/<p>/runs/<id>/log/` 形状，实测 404；原生 `pipelines/<p>/pipelineruns` 子资源不存在。页面把 404 显示为失败原因+重试，不显示空日志冒充「没有日志」。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-03** — 环境阻塞：`devops-controller` CrashLoopBackOff（日志逐字 `Error: the token of the Jenkins needs to update`，restartCount 27），`kubesphere-config` 中 `devops.host=http://devops-jenkins.kubesphere-devops-system.svc/`、`devops.username=admin`。表现为 PipelineRun 创建 201 后无状态注解、日志 404、health/validate 缺值。复查条件：controller 就绪且不再重启、Jenkins whoami/crumb 200、新运行 60 秒内出现状态注解、日志 200 且非空；四项满足后才把运行成功/日志内容标为通过。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01** — kapis 的 credentials 列表恒为空（连自己创建的都不返回），必须读 Secret 集合再按 `type` 过滤；但写仍走 kapis，因为只有它会写 `credential.devops.kubesphere.io/syncstatus` 注解。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-02** — 未知凭证类型不能在列表里静默消失：`toCredentialRow` 保留 `secretType` 原文，页面在 `kind` 为空时显示它；类型创建后不可改，编辑对话框的 name/type 必须 disabled。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01** — 老 console 用 `showAction: username !== 当前用户` 保护「不能操作自己」；新实现第一版漏了这一条（任何行都显示改角色/移除），现已补齐：当前账号那一行渲染 `devops-detail:member-self` 说明、不渲染两个按钮。服务端同样拒绝改自己的角色或移除自己，所以漏掉时用户点下去只会拿到一个失败弹窗。写入用例仍只用专用测试账号（`ui-test`）并在 finally 移除，避免误操作 admin。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01** — `status.argoApp` 是 string（控制器写 JSON），`spec.argoApp.spec.destination` 可能只有 name 没有 namespace；同步/健康分别取 `sync.status`/`health.status`，缺失显示 `-`，整行不消失。

## 测试与可观测

用例（`tests/ui/specs/kube-frontend/cluster-management/`，一一镜像 `tests/ui/tests/kube-frontend/cluster-management/`，页面对象 `tests/ui/pages/devops_page.py`）：
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01`（列表 + 成员/角色/凭证页签三态）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02`（流水线/持续部署/代码仓库页签：空态、失败+重试、命名空间取值）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03`（流水线详情：not-found、基本信息、运行记录三态/表头）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04`（工程生命周期：创建、编辑信息、删除、CD 白名单编辑；自建工程并在 finally 删除）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05`（七页签、基本信息、角色、CD 列表与白名单展示）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01`（列表列/健康缺值、服务端分页、搜索、类型筛选、行操作入口）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02`（创建单分支/多分支、编辑、复制、删除；测试对象唯一前缀并在 finally 删除）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03`（流水线详情基本信息、同步状态缺值、Jenkinsfile 保存后回读、多分支只读说明）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01`（运行请求链路、运行记录、运行详情、日志错误+重试）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01`（四类型创建/列表、编辑、删除）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01`（成员列表/邀请校验/邀请/改角色/移除，用 ui-test 账号并清理）
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01`（代码仓库导入/列表/删除）
- 单元：`packages/api-client/test/devops.test.ts`（命名空间派生、三类映射、路径、运行状态映射、标签与 pipelineRef 过滤、标签空结果兜底、`saveJenkinsfile`、凭证类型映射）。

可观测点：列表 `devops:surface`、`devops:create`、`devops:link:<name>`、`devops:refresh`；创建对话框 `devops:create-name|-workspace|-alias|-description|-submit`；详情 `devops-detail:surface/title/description/edit/delete/basic/name/alias/workspace/creator/created-at/namespace/sync-status/placement/member-count/role-count/allowlist/allowlist-edit/allowlist-repos/allowlist-destinations/not-found/tab:*`、各页签 `-table/-empty/-error/-retry`、流水线行 `devops-detail:pipeline:<name>` 与行操作 `pipelines-create/pipeline-run|edit|copy|delete:<name>`、搜索 `pipelines-search`、类型 `pipelines-type`、分页 `pipelines-total/page-size/page/prev/next`；凭据/成员/代码仓库/白名单对话框句柄见 PRD「UI 交互设计」；流水线详情 `pipeline-detail:surface/title/back/basic/name/type/sync-status/health/validate/created-at/namespace/description/notice/runs/runs-table/runs-empty/runs-error/runs-retry/tab:runs|config/config/config-editor/config-save/config-reset/config-multibranch/run-detail/run-id/run-status/run-phase/run-start/run-duration/run-commit/run-log/run-log-error/run-log-retry/run-branch/run-submit/not-found/retry`。

## 后续改进

- 可视化流水线编辑器（Jenkinsfile 图形化 steps / template / Sider）、代码质量、SonarQube/scan、分支与 Pull Request 页签、运行的任务状态/构建参数/提交/产物/事件子页。
- 运行停止/终止、批量运行与批量删除、运行日志下载；Jenkins 通道恢复后补运行成功/失败与日志正文的端到端验收（GOT-…-DEVOPS_RUNS-03 的复查条件）。
- CD 创建/编辑信息/编辑 YAML/同步/回滚/删除与 CD 明细页；代码仓库编辑/YAML 与流水线创建表单里的内联新建仓库。
- 工程角色 CRUD、凭证详情活动页、成员批量移除、邀请时搜索用户，以及老 console 的「不能操作自己」保护。
- 列表排序（`ascending`）UI、运行中流水线的自动刷新策略（当前用显式刷新）。
- 若 DevOps 改为按企业空间授权，按 DEC-…-DEVOPS_PROJECTS-01 的「何时重新考虑」调整为 workspace scope。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01
