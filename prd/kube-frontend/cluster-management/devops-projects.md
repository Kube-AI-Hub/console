# DevOps 工程（L3）

[子模块需求](./_index.md)

## 概述

集群控制台的 **DevOps 工程** 区域：列表页 `/kube-frontend/clusters/<cluster>/devops`（名称 / 描述 / 创建时间 / 所属企业空间）与详情页 `/kube-frontend/clusters/<cluster>/devops/<name>`（基本信息 + 成员 / 角色 / 凭证 / 流水线 / 持续部署 / 代码仓库六个页签）。只读。

流水线、持续部署、代码仓库三个页签读取工程命名空间（`status.adminNamespace`）下的三类资源；三者都是 namespaced，各自独立成败。工程不存在时页签仍可切换，用工程名作为命名空间回退并显示空态；这既是「不伪造」也是当前 0 个工程环境下唯一可验证的路径。

流水线行可点进流水线详情页 `/kube-frontend/clusters/<cluster>/devops/<name>/pipelines/<pipeline>`：基本信息（名称/类型/状态/创建时间/工程命名空间）+ 运行记录（PipelineRun 列表：编号/状态/开始时间/耗时），运行记录同样有加载/空态/失败+重试。

DevOps 组件在 2026-11-15 随「所有组件已开启」进入迁移范围；本集群 `devopsprojects` 当前为 0 个，因此空态是主路径，详情页以「骨架 + 诚实的失败/空态」交付，不伪造数据。

## 用户故事

### US1 - 集群管理员进入 DevOps 工程 (Priority: P1)

作为 **集群管理员**，我希望 **在集群控制台里看到全部 DevOps 工程并能打开其中一个**，以便 **不切换旧控制台就能确认工程是否存在、归属哪个企业空间、有哪些成员/角色/凭证**。

**Independent Test**：打开 `/clusters/<cluster>/devops`，核对行数与 `devopsprojects` CRD 列表一致（当前为 0 时显示空态）；打开任一工程（或一个不存在的工程名），核对基本信息区与三个属性页签可切换，且每个页签显示表格、空态或失败原因之一。

### US2 - 在工程详情里看到流水线、持续部署与代码仓库 (Priority: P2)

作为 **DevOps 使用者**，我希望 **打开工程详情就能看到该工程的流水线、持续部署（CD）和代码仓库（GitRepository）**，以便 **不切换到旧控制台或多个 CLI 就能确认工程里有什么、部署状态如何**。

**Independent Test**：打开一个工程（或不存在工程名）的详情，依次切到流水线 / 持续部署 / 代码仓库页签，核对命名空间取值为 `status.adminNamespace`（对象不存在时为工程名）、每个页签三态之一可见，且三个读取互不拖垮。

### US3 - 下钻一条流水线看运行记录 (Priority: P2)

作为 **DevOps 使用者**，我希望 **从工程详情的流水线行点进流水线详情，看到它的运行记录（编号/状态/开始时间/耗时）**，以便 **判断最近一次构建是否成功、耗时多久，不必切换旧控制台**。

**Independent Test**：点击工程详情流水线页签的行名称，进入流水线详情 URL；或在 0 流水线环境下直接打开一条不存在流水线的 URL，核对 not-found 与运行记录空态/失败态可辨。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 已知集群的 `devopsprojects` 列表有 N 个工程（N 可能为 0），当打开集群 DevOps 列表，则列出 N 行（名称/描述/所属企业空间/创建时间），名称为进入详情的链接；N 为 0 时显示明确空态。打开详情 `/devops/<name>` 时，显示基本信息（名称/企业空间/创建者/创建时间/描述）；成员 / 角色 / 凭证三个页签可切换，各自独立读取：能读则显示表格，集合为空显示空态，读取失败显示失败原因与重试（不显示空表冒充「没有」）；工程不存在时显示 `:not-found`。列表与详情均只读。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 已知打开一个 DevOps 工程详情（工程存在或使用不存在工程名），当页签区出现流水线 / 持续部署 / 代码仓库，则三个页签都可切换且各自独立显示表格、空态或失败原因+重试之一；读取的三类资源都使用工程的命名空间（`status.adminNamespace`，对象不存在/未写入时回退为工程名，并在基本信息里显示实际取值）；工程不存在时基本信息显示 `:not-found` 而页签仍可切换、空态可达，不出现写入口。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 已知工程详情的流水线页签有行数据，当点击行名称，则进入流水线详情 URL（`…/devops/<name>/pipelines/<pipeline>`）；流水线详情显示基本信息（名称/类型/状态/创建时间）与运行记录区，运行记录区显示表格、空态或失败原因+重试之一（列头为编号/状态/开始时间/耗时）；流水线不存在时显示 `:not-found`，而运行记录区仍可读（空态或失败态）；页面只读，不提供运行/重跑/停止入口。

## 设计目标

1. 让 DevOps 区域在集群菜单里可达，空集群也给出可信的空态而不是空白页。
2. 详情页的每个集合独立成败：一个接口失败不拖垮其他页签。
3. 不伪造：没有工程就没有行；读不到就显示原因与重试。

## 约束与边界

- 列表与基本信息读 **cluster-scoped CRD**：`/apis/devops.kubesphere.io/v1alpha3/devopsprojects`（列表）、`/apis/…/devopsprojects/<name>`（详情）。实测 kapis `/kapis/devops.kubesphere.io/v1alpha3/devopsprojects` 返回 404。
- 成员：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members?limit=-1`（实测路由存在，工程不存在时返回 404 `devopsproject… not found`）。
- 角色：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/roles?limit=-1`（同上）。
- 凭证：`/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials?limit=-1`（同上）。
- 流水线：`/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelines`（实测 200，items=[]）。
- 持续部署（CD）：`…/cd` 与 `…/applications` 在 devops 组均为 **404**；实际资源是 gitops 组 `/apis/gitops.kubesphere.io/v1alpha1/namespaces/<ns>/applications`（实测 200，items=[]），对象里 `spec.argoApp` / `status.argoApp` 包着 Argo CD 的定义与状态。
- 代码仓库：`…/coderepositories` 为 **404**；实际资源是 `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/gitrepositories`（实测 200，items=[]，老 console 的 codeRepos 模块即读它）。
- 命名空间：来自 DevOpsProject 对象的 `status.adminNamespace`（CRD 唯一的 status 字段，实测 schema 有、当前 0 个对象所以无实例可核对）；对象不存在或未写入时回退为工程名，并在基本信息里展示实际命名空间。
- 流水线详情：`/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelines/<pipeline>`（不存在返回 404 Status）。
- 运行记录：`/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns`，服务端按 `devops.kubesphere.io/pipeline=<pipeline>` 标签过滤；标签查询为空时再取全量、按标签或 `spec.pipelineRef.name` 兜底匹配（控制器标签键没有真实运行记录可核对，见 design 已知坑）。
- 运行状态在注解 `devops.kubesphere.io/jenkins-pipelinerun-status`（JSON：state/result/id/startTime/durationInMillis），CRD 的 `status` 未使用。
- 只读：创建/编辑工程、流水线编辑器、CD 同步、代码仓库创建/编辑不在本轮。
- 作用域：本区域在 registry 里是 cluster scope，URL 不带 workspace；旧 console 的 `/:workspace/clusters/:cluster/devops` 依赖 workspace 段，新 UI 的集群菜单无法表达它（见 design DEC）。

## UI 交互设计

- 列表：标题+描述；表格列 名称（链接）/ 描述 / 所属企业空间 / 创建时间；空态「暂无 DevOps 工程」。
- 详情：返回链接 + 标题；基本信息卡（含实际使用的工程命名空间）；页签 成员 / 角色 / 凭证 / 流水线 / 持续部署 / 代码仓库。
- 每个页签：加载骨架；表格；空态说明；失败时为错误文案 + 重试按钮。
- 流水线列：名称 / 类型 / 状态（同步注解）/ 创建时间，名称为进入流水线详情的链接；持续部署列：名称 / 同步状态 / 健康状态 / 目标命名空间；代码仓库列：名称 / 提供方 / 仓库地址。
- 流水线详情：返回工程链接 + 标题；基本信息卡（名称/类型/状态/创建时间/工程命名空间）；运行记录区（加载/表格/空态/失败+重试），列头 编号 / 状态 / 开始时间 / 耗时；页面只读，无运行/重跑/停止入口。
- `data-ai-id`：列表 `devops:surface`、`devops:link:<name>`、`devops:retry`；详情 `devops-detail:surface`、`:title`、`:basic`、`:name`、`:workspace`、`:namespace`（实际工程命名空间）、`:creator`、`:description`、`:created-at`、`:tab:members|roles|credentials|pipelines|cd|coderepos`、`:members|roles|credentials|pipelines|cd|coderepos`（面板）、`:…-table`、`:…-empty`、`:…-error`、`:…-retry`、`:not-found`、`:back`、`:pipeline:<name>`（流水线行链接）。
- 流水线详情 `data-ai-id`：`pipeline-detail:surface`、`:title`、`:back`、`:basic`、`:name`、`:type`、`:status`、`:created-at`、`:namespace`、`:description`、`:runs`、`:runs-table`、`:runs-empty`、`:runs-error`、`:runs-retry`、`:not-found`、`:retry`；运行行 `data-ai-row=<runId>`。

## 文案与校验

- 区域/标题：`devops.title`、`devops.list.title`、`devops.list.description`；空态 `devops.list.emptyTitle/emptyDescription`。
- 页签：`devops.detail.members/roles/credentials/pipelines/cd/codeRepos`；空态 `devops.detail.membersEmpty/rolesEmpty/credentialsEmpty/pipelinesEmpty/cdEmpty/codeReposEmpty`；列头 `devops.detail.namespace/pipelineType/pipelineStatus/syncStatus/healthStatus/cdDestination/repoProvider/repoURL`。
- 持续部署的同步/健康状态直接显示 Argo CD 的取值（Synced / OutOfSync、Healthy / Degraded / Progressing / Missing / Unknown），空值显示 `-`。
- 流水线详情：`devops.pipeline.subtitle/type/status/runs/runsEmpty/column.runId|status|startTime|duration`，运行状态 `devops.pipeline.state.queued|running|success|failure|aborted|paused|unstable|notRunning`。
- 字段复用：`cluster.column.name/createdAt`、`projectInfo.field.description/workspace`、`workspace.detail.basic/creator`、`workspace.field.member/role`、`platform.column.ruleCount`、`cluster.customResources.kind`、`common.retry`、`error.notFound`。

## 边界情况

- `devopsprojects` 为 0（当前 B200）：列表空态；详情仅当手动输入名称时可达，显示 not-found，但页签仍可切换并各自展示空态/失败原因（便于验证骨架）。
- 工程存在但成员/角色/凭证/流水线/CD/代码仓库为空：对应页签显示空态。
- 某个集合 403/404：该页签显示失败原因 + 重试，其他页签不受影响。
- 工程刚被删除：基本信息 404 → `:not-found`；三个属性页签各自失败；流水线类页签以工程名回退命名空间，列表接口对不存在的命名空间返回 200 空列表，因此显示空态（实测）。
- 基本信息读取失败但不是 404：错误面板 + 重试。
- 对象已存在但控制器尚未写 `status.adminNamespace`：回退工程名，基本信息 `:namespace` 显示回退值，避免猜测。
- 持续部署对象没有可用状态：`status.argoApp` 可能是 JSON 字符串、普通字符串或缺失，同步/健康状态分别显示 `-`，不整行消失。
- 流水线不存在：详情显示 `:not-found`；运行记录区仍独立读取（命名空间回退为工程名，列表对不存在命名空间返回 200 空列表），显示空态而不是整页只有错误。
- 流水线运行记录没有 Jenkins 注解：编号回退对象名，状态显示「未运行」，开始时间回退创建时间，耗时为 `-`，整行不消失。
- 运行记录标签键与预期不一致：标签过滤为空时回退全量并同时按 `spec.pipelineRef.name` 匹配，避免把已有运行记录显示成空。

## 明确不做

- 创建/编辑/删除 DevOps 工程：需 ks-devops 写接口与 webhook（当前环境写类 webhook 不稳定）。
- 流水线编辑器/运行、CD 同步与回滚、代码仓库创建/编辑：写路径不在本轮。
- 运行记录明细、日志、运行/重跑/停止：本轮只到流水线详情 + 运行记录列表。
- CD 明细页与代码仓库详情：不在本轮。
- 成员增删与角色/凭证编辑：写路径不在本轮。
- 工程用量与流水线统计。

## 假设

- `devops.kubesphere.io/v1alpha3` 的 `devopsprojects` CRD 已注册且可读（实测 200，items=[]）。
- 成员/角色/凭证的 kapis 路径已注册（实测对不存在工程返回资源 not-found，说明路由存在）。
- 流水线、代码仓库（GitRepository）与持续部署（GitOps Application）三类资源可读，且列表接口对不存在的命名空间返回 200 空列表（已用不存在的命名空间实测）。
- DevOpsProject CRD 用 `status.adminNamespace` 记录工程命名空间（schema 已核实）；当前 0 个工程，尚无实例可核对真实取值，页面按该字段读取并在缺失时回退为工程名。
- 工程对象用 `kubesphere.io/workspace` 标签归属企业空间，用 `kubesphere.io/description`/`creator` 注解存元数据。
- PipelineRun 由控制器打上 `devops.kubesphere.io/pipeline` 标签（按 ks-devops 约定）；集群当前 0 条运行记录，无实例可核对，页面另以 `spec.pipelineRef.name` 兜底。
- 运行状态来自 `devops.kubesphere.io/jenkins-pipelinerun-status` 注解（老 console 同样读取它），当前无实例可核对真实 payload。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 集群 DevOps 列表展示工程并提供详情入口，空态明确。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 详情提供基本信息与成员/角色/凭证/流水线/持续部署/代码仓库页签，各集合独立显示表格/空态/失败原因。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 流水线/持续部署/代码仓库从工程对象的 `status.adminNamespace` 取命名空间（缺失时回退工程名），并在基本信息展示实际取值。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04** — 流水线行提供进入详情页的链接；流水线详情展示基本信息与运行记录（编号/状态/开始时间/耗时），运行记录独立显示表格/空态/失败原因；流水线不存在时显示 not-found 且运行记录区仍可读。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 列表行数与 `devopsprojects` 一致；详情页签可切换且三种状态可辨；不伪造数据。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 流水线/持续部署/代码仓库三个页签均可切换，各自显示表格/空态/失败原因之一；读取路径使用工程命名空间（`status.adminNamespace`，缺失时回退工程名）。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 流水线行链接到详情 URL；详情页基本信息与运行记录区可见，运行记录恰好显示表格/空态/失败之一；流水线不存在时 not-found 可见且运行记录区仍有状态。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03`
