# DevOps 工程（L3）

[子模块需求](./_index.md)

## 概述

集群控制台的 **DevOps 工程** 区域：列表页 `/kube-frontend/clusters/<cluster>/devops`（名称 / 描述 / 创建时间 / 所属企业空间）与详情页 `/kube-frontend/clusters/<cluster>/devops/<name>`（基本信息 + 流水线 / 持续部署 / 代码仓库 / 成员 / 角色 / 凭证七个页签，默认基本信息；可编辑工程信息与删除工程）。列表提供工程创建入口。

流水线、持续部署、代码仓库三个页签读取工程命名空间（`status.adminNamespace`）下的三类资源；三者都是 namespaced，各自独立成败。工程存在但控制器尚未写入 `status.adminNamespace` 时用工程名回退并在基本信息显示实际取值；工程不存在时详情只显示 `:not-found`，不渲染页签，也不向不存在的工程发起集合请求。

流水线行可点进流水线详情页 `/kube-frontend/clusters/<cluster>/devops/<name>/pipelines/<pipeline>`：基本信息（名称/类型/状态/创建时间/工程命名空间）+ 运行记录（PipelineRun 列表：编号/状态/开始时间/耗时），运行记录同样有加载/空态/失败+重试。

DevOps 组件在 2026-11-15 随「所有组件已开启」进入迁移范围；本集群 `devopsprojects` 长期为 0～1 个（迁移探针对象），空态与 not-found 仍是必测路径，详情页不伪造数据。

2026-11-15 同批补齐写能力：工程创建 / 编辑信息 / 删除，流水线列表与创建 / 编辑 / 复制 / 删除，流水线详情与 Jenkinsfile 保存，运行触发与运行记录，凭证四类型 CRUD，成员邀请 / 改角色 / 移除，角色查看，代码仓库导入 / 删除，持续部署白名单编辑。运行成功与日志内容受 Jenkins 通道阻塞（见「阻塞」）：页面只承诺「运行请求已提交」，并如实展示 PipelineRun 对象自身状态、控制器消息与日志错误，不把创建成功说成运行成功。

## 用户故事

### US1 - 集群管理员进入 DevOps 工程 (Priority: P1)

作为 **集群管理员**，我希望 **在集群控制台里看到全部 DevOps 工程并能打开其中一个**，以便 **不切换旧控制台就能确认工程是否存在、归属哪个企业空间、有哪些成员/角色/凭证**。

**Independent Test**：打开 `/clusters/<cluster>/devops`，核对行数与 `devopsprojects` CRD 列表一致（当前为 0 时显示空态）；打开任一存在的工程，核对基本信息区与三个属性页签可切换，且每个页签显示表格、空态或失败原因之一；工程不存在时只显示 not-found。

### US2 - 在工程详情里看到流水线、持续部署与代码仓库 (Priority: P2)

作为 **DevOps 使用者**，我希望 **打开工程详情就能看到该工程的流水线、持续部署（CD）和代码仓库（GitRepository）**，以便 **不切换到旧控制台或多个 CLI 就能确认工程里有什么、部署状态如何**。

**Independent Test**：打开一个工程（或不存在工程名）的详情，依次切到流水线 / 持续部署 / 代码仓库页签，核对命名空间取值为 `status.adminNamespace`（对象不存在时为工程名）、每个页签三态之一可见，且三个读取互不拖垮。

### US3 - 下钻一条流水线看运行记录 (Priority: P2)

作为 **DevOps 使用者**，我希望 **从工程详情的流水线行点进流水线详情，看到它的运行记录（编号/状态/开始时间/耗时）**，以便 **判断最近一次构建是否成功、耗时多久，不必切换旧控制台**。

**Independent Test**：点击工程详情流水线页签的行名称，进入流水线详情 URL；或在 0 流水线环境下直接打开一条不存在流水线的 URL，核对 not-found 与运行记录空态/失败态可辨。

### US4 - 管理 DevOps 工程的生命周期 (Priority: P1)

作为 **集群管理员**，我希望 **在集群 DevOps 列表创建工程、修改工程别名与描述、删除不再使用的工程，并且每个动作都能回读**，以便 **不切换旧控制台就完成工程治理，并确认接口真的生效**。

**Independent Test**：在列表点「创建 DevOps 工程」，填唯一名称、企业空间、别名与描述并提交；页面跳到接口返回的生成名详情，列表出现该行；在详情用「编辑工程信息」改别名与描述并确认，标题、描述与基本信息回显新值；点删除、按提示输入工程名确认，回到列表且该行消失。

### US5 - 在工程详情完成日常管理 (Priority: P1)

作为 **DevOps 使用者**，我希望 **工程详情有基本信息、流水线、持续部署、代码仓库、成员、角色、凭证七个页签，默认打开基本信息，每个页签独立加载、独立失败**，以便 **在一个页面上看到并管理工程的全部内容**。

**Independent Test**：打开任一工程详情，默认选中基本信息并显示名称 / 别名 / 企业空间 / 创建者 / 创建时间 / 描述 / 工程命名空间 / 同步状态 / 部署集群 / 成员数 / 角色数；依次点击其余六个页签，每个页签出现表格、空态或失败原因 + 重试之一；切换页签不出现整页错误。

### US6 - 浏览与筛选流水线 (Priority: P1)

作为 **DevOps 使用者**，我希望 **在流水线页签按名称搜索、按类型筛选、按页查看服务端分页的流水线，并看到健康、类型、分支数、合并请求数**，以便 **快速定位要操作的流水线**。

**Independent Test**：打开流水线页签，「共 N 条」与接口 totalItems 一致；切换每页条数 10 / 20 / 50、翻页、输入名称、选择类型筛选时，请求的 page / limit / name / type 随之变化，行数与页码正确；清空搜索与筛选回到全量；每行显示健康徽章、类型、分支数、合并请求数（缺值显示 -）与运行 / 编辑 / 复制 / 删除入口。

### US7 - 创建、编辑、复制、删除流水线 (Priority: P1)

作为 **DevOps 使用者**，我希望 **创建单分支（直接写 Jenkinsfile）或多分支（SCM 发现配置）流水线，编辑别名 / 描述 / Jenkinsfile，复制已有流水线，并删除不需要的流水线**，以便 **在流水线页签完成从创建到清理的全部维护**。

**Independent Test**：在流水线页签点创建，单分支填唯一名称与 Jenkinsfile，多分支填代码源 / 仓库地址 / 属主 / 脚本路径并提交，列表按名称搜索可见新行；编辑别名与描述保存后回显；复制时名称留空而类型与 Jenkinsfile 沿用源，提交后出现第二条；删除时在对话框输入流水线名确认，行消失。

### US8 - 查看流水线详情与 Jenkinsfile 配置 (Priority: P2)

作为 **DevOps 使用者**，我希望 **打开流水线详情看到名称 / 类型 / 同步状态 / 健康 / 脚本校验 / 创建者 / 创建时间 / 工程命名空间 / 描述，并在配置页签查看与保存 Jenkinsfile（多分支只读脚本路径说明）**，以便 **判断流水线是否与 Jenkins 同步，并修正单分支脚本**。

**Independent Test**：从流水线列表点名称进入详情；基本信息各项与接口一致，无 Jenkins 元数据时健康显示「无状态」、同步状态与脚本校验显示 -；配置页签单分支显示 Jenkinsfile，修改后保存，重新加载页面回读内容等于提交内容；多分支显示脚本来自代码仓库的只读说明。

### US9 - 触发运行并如实查看运行记录 (Priority: P1)

作为 **DevOps 使用者**，我希望 **在流水线列表行或详情页触发一次运行，并在运行记录里看到新建的 PipelineRun 及其编号 / 状态 / 开始时间 / 耗时 / 提交 / 分支 / 消息，以及失败原因与日志错误**，以便 **确认请求链路真的创建了运行对象，而不是被一句「已运行成功」误导**。

**Independent Test**：在流水线行点运行（或详情页运行，多分支先选分支、带参数先填参数），页面提示「已提交运行请求」并刷新运行记录；用接口核对新 PipelineRun 的 label 与 pipelineRef 指向该流水线；运行记录出现该对象，无 Jenkins 状态注解时状态为「未运行」；点编号打开运行详情，显示状态 / 控制器阶段 / 开始时间 / 耗时 / 提交与状态消息；日志接口不可用时显示失败原因与重试。

### US10 - 管理四类凭证 (Priority: P1)

作为 **DevOps 使用者**，我希望 **创建用户名密码、SSH 密钥、密钥文本、kubeconfig 四种凭证，查看列表中的名称 / 类型 / 用户名 / 同步状态 / 描述，编辑已有凭证的敏感数据与描述（名称与类型不可改），并删除不需要的凭证**，以便 **让流水线可以复用统一的仓库与集群凭据**。

**Independent Test**：在凭证页签点创建，切换四种类型分别填写对应字段并提交；列表出现四条，类型与同步状态列正确；编辑一条改描述并保存，列表描述更新且密码 / 私钥不回显；删除一条并输入名称确认，行消失且其余三条保留。

### US11 - 管理工程成员 (Priority: P1)

作为 **DevOps 使用者**，我希望 **在成员页签看到用户名 / 角色 / 状态 / 最近登录，邀请平台用户加入工程并指定预置角色，修改成员角色，移除成员**，以便 **在不切旧控制台的情况下维护工程协作者**。

**Independent Test**：打开成员页签，无成员时显示空态；点邀请，用户名为空时提交被校验拦下；填平台已有用户名并选择 viewer 提交，行出现且角色为 viewer；点修改角色改为 operator，行角色更新；点移除并确认，行消失并回到空态。

### US12 - 查看工程角色 (Priority: P2)

作为 **DevOps 使用者**，我希望 **在角色页签看到该工程的预置角色与权限模板，并区分预置角色 / 权限模板 / 自定义角色**，以便 **确认邀请成员时可分配哪些角色**。

**Independent Test**：打开角色页签，表格显示名称 / 别名 / 权限模块 / 角色类型 / 创建时间；预置角色 viewer / operator / admin 显示「预置角色」，role-template-* 显示「权限模板」；页签徽标数量等于接口 roles 条数。

### US13 - 导入与管理代码仓库 (Priority: P2)

作为 **DevOps 使用者**，我希望 **在代码仓库页签导入 GitRepository（名称 / 提供方 / 仓库地址 / 访问凭证 / 描述），在列表中看到提供方、地址、访问凭证，并删除不再使用的仓库**，以便 **为流水线提供可复用的代码源登记**。

**Independent Test**：打开代码仓库页签点导入，名称非法时提示；填唯一名称、github、仓库地址提交，行出现且提供方 / 地址 / 访问凭证正确；点删除并输入名称确认，行消失回到空态。

### US14 - 查看持续部署并维护 CD 白名单 (Priority: P2)

作为 **DevOps 使用者**，我希望 **在持续部署页签查看应用的同步 / 健康 / 目标命名空间，并在基本信息维护持续部署白名单（可部署的代码仓库与部署位置）**，以便 **控制从哪些仓库能部署到哪里**。

**Independent Test**：打开持续部署页签，无应用显示空态；基本信息区显示白名单的代码仓库与部署位置（未配置显示「未选择」）；点编辑白名单，按行填写仓库与「集群/项目」保存，基本信息回显新值。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 已知集群的 `devopsprojects` 列表有 N 个工程（N 可能为 0），当打开集群 DevOps 列表，则列出 N 行（名称/描述/所属企业空间/创建时间），名称为进入详情的链接；N 为 0 时显示明确空态。打开详情 `/devops/<name>` 时，显示基本信息（名称/企业空间/创建者/创建时间/描述）；成员 / 角色 / 凭证三个页签可切换，各自独立读取：能读则显示表格，集合为空显示空态，读取失败显示失败原因与重试（不显示空表冒充「没有」）；工程不存在时显示 `:not-found`。列表提供创建入口，详情提供编辑信息与删除入口。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 已知打开一个 DevOps 工程详情（工程存在或使用不存在工程名），当页签区出现流水线 / 持续部署 / 代码仓库，则三个页签都可切换且各自独立显示表格、空态或失败原因+重试之一；读取的三类资源都使用工程的命名空间（`status.adminNamespace`，对象不存在/未写入时回退为工程名，并在基本信息里显示实际取值）；工程不存在时基本信息显示 `:not-found`，页签区不渲染。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 已知工程详情的流水线页签有行数据，当点击行名称，则进入流水线详情 URL（`…/devops/<name>/pipelines/<pipeline>`）；流水线详情显示基本信息（名称/类型/状态/创建时间）与运行记录区，运行记录区显示表格、空态或失败原因+重试之一（列头为编号/状态/开始时间/耗时）；流水线不存在时显示 `:not-found`（运行记录区随详情一起不渲染）；页面提供运行 / 重跑入口（不提供停止），运行请求与结果见运行记录。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04** — Given 已登录且存在可写企业空间，When 在 DevOps 列表点「创建 DevOps 工程」并填合法唯一名称、企业空间、别名与描述后提交，Then 发出 POST `/kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops`，body 的 `metadata.generateName` 等于输入名并带 `kubesphere.io/workspace` 标签与两个注解；成功后跳转到响应返回的生成名详情且列表出现该行；名称为空或含非法字符时提交被拦下并显示对应提示；取消不发请求；服务端失败时对话框保持打开、保留输入并显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05** — Given 打开一个存在的工程详情，When 点「编辑工程信息」修改别名与描述并确认，Then 名称只读不可改；保存发出整对象 PUT `/apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>` 且保留 `spec.argo` 与 workspace 标签；成功后标题、描述与基本信息回显新值；取消不改变对象；清空别名的保存会移除 `kubesphere.io/alias-name` 注解。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-06** — Given 打开一个存在的工程详情，When 点删除、按提示输入完整工程名并确认，Then 发出 DELETE `/apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>`；成功后回到 DevOps 列表且该行消失；输入不匹配时删除按钮禁用；失败时确认框保留并显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-07** — Given 打开一个存在的工程详情，Then 页签顺序为 基本信息 / 流水线 / 持续部署 / 代码仓库 / 成员 / 角色 / 凭证，默认选中基本信息且 `aria-selected=true`；基本信息显示名称 / 别名 / 企业空间 / 创建者 / 创建时间 / 描述 / 工程命名空间（`status.adminNamespace`，缺失时回退工程名） / 同步状态 / 部署集群 / 成员数 / 角色数（读不到时显示 `-`）；逐个点击其余页签，其 `aria-selected=true` 且出现该页签的表格、空态或失败原因之一，不出现整页错误；工程不存在时 `:not-found` 可见，页签区不渲染。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01** — Given 打开工程详情的流水线页签，When 列表加载完成，Then 表格列为 名称 / 健康状态 / 类型 / 分支数 / 合并请求数 / 操作，名称为进入流水线详情的链接，行操作依次为 运行 / 编辑 / 复制 / 删除；「共 N 条」等于接口 `totalItems`；每页条数可选 10 / 20 / 50（默认 10），上一页 / 下一页按页码禁用；名称搜索与类型筛选（全部 / 单分支 / 多分支）发出 `page/limit/name/type` 参数并把页码重置为 1，类型选「全部」时请求不带 type；无匹配显示「没有匹配的流水线。」，集合为空显示「该工程还没有流水线。」；读取失败显示失败原因与重试。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02** — Given 流水线列表有行，Then 健康列按 Jenkins weatherScore 分档：大于 80 显示「健康」、30 到 80 显示「亚健康」、小于等于 30 显示「异常」、缺值或非数字显示「无状态」，不得把缺值当成 100 显示「健康」；类型列单分支显示「单分支流水线」、多分支显示「多分支流水线」；分支数与合并请求数缺失或单分支分支数为 0 时显示 `-`；同步状态取注解 `pipeline.devops.kubesphere.io/syncstatus`，缺失显示 `-`。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03** — Given 打开流水线页签，When 点创建并填名称、类型、别名、描述后提交，Then 单分支提交 `spec.type=pipeline` 且 `spec.pipeline.jenkinsfile` 为编辑器内容（默认预填 starter Jenkinsfile），多分支提交 `spec.type=multi-branch-pipeline` 且 `spec.multi_branch_pipeline` 含 source_type、仓库地址、属主、凭证与脚本路径（默认 Jenkinsfile，未选凭证时 `credential_id` 为空串）；名称为空或非法时提示且不提交；成功后按名称搜索可见新行；失败时对话框保持打开、保留输入并显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-04** — Given 流水线列表有行，When 点编辑 / 复制 / 删除，Then 编辑对话框的名称与类型只读、别名 / 描述 / Jenkinsfile 可改，保存走整对象 PUT 且保留 spec 其他字段；复制对话框名称留空、类型与 Jenkinsfile 沿用源；删除需在对话框输入流水线名确认，成功后行消失；取消不写；失败时显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-05** — Given 从列表进入流水线详情，Then 基本信息显示名称 / 类型 / 同步状态 / 健康状态 / 脚本校验 / 创建者 / 创建时间 / 工程命名空间 / 描述，健康缺失显示「无状态」、同步状态与脚本校验缺失显示 `-`；配置页签单分支显示可编辑 Jenkinsfile，保存按钮在未修改时禁用、修改后可用，取消恢复服务端值，保存后重新读取 `spec.pipeline.jenkinsfile` 等于提交内容（走 `PUT …/pipelines/<p>/jenkinsfile?mode=raw`，见 design GOT）；多分支显示脚本来自代码仓库的只读说明；保存失败显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01** — Given 流水线列表有行或已打开流水线详情，When 点运行（多分支先选分支、带参数先填参数）提交，Then 发出 POST `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns`，body 含 `metadata.generateName=<pipeline>-`、label `devops.kubesphere.io/pipeline=<pipeline>`、`spec.pipelineRef.name=<pipeline>`，有分支时含 `spec.scm.refName`；成功后显示「已提交运行请求：<name>」并刷新运行记录；失败显示服务端消息；页面不承诺运行成功。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-02** — Given 打开流水线详情的运行记录，Then 表格列为 状态 / 编号 / 提交 / 分支（仅多分支）/ 最近消息 / 耗时 / 开始时间 / 操作，按开始时间（缺失时创建时间）倒序；状态按注解 `devops.kubesphere.io/jenkins-pipelinerun-status` 的 state / result 映射为 排队中 / 运行中 / 成功 / 失败 / 已中止 / 已暂停 / 不稳定 / 未运行；无注解的运行仍出现在表格（编号回退对象名、状态「未运行」、开始时间回退创建时间、耗时按对象缺省显示 `0s`），不得消失；空集合显示「该流水线还没有运行记录。」；点编号打开运行详情，显示编号 / 状态 / 控制器阶段 / 开始时间 / 耗时 / 提交与状态消息；日志接口失败显示失败原因与重试；重放按钮再次提交同一运行；运行记录读取失败显示失败原因与重试。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01** — Given 打开凭证页签，Then 表格列为 名称 / 类型 / 用户名 / 同步状态 / 描述 / 操作；创建对话框可在用户名密码、SSH 密钥、密钥文本、kubeconfig 四种类型间切换并显示各自字段，提交 POST `/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials`；列表读取 `/api/v1/namespaces/<ns>/secrets` 且只展示四种 `credential.devops.kubesphere.io/*` 类型的 Secret；创建后行出现，类型列显示对应文案，用户名密码 / SSH 回显用户名，同步状态取注解；名称为空或非法时提示；失败保留输入并显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-02** — Given 凭证列表有行，When 点编辑改描述与敏感字段并保存，Then 名称与类型只读；保存 PUT `/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials/<credential>?content=1` 且 data 重新 base64；成功后列表描述更新、密码与私钥不回显；删除需在对话框输入凭证名确认，成功后行消失；取消不写；失败显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01** — Given 打开成员页签，Then 表格列为 用户名 / 角色 / 状态 / 最近登录 / 操作，无成员显示「该工程还没有成员。」，最近登录为空显示「尚未登录」；点邀请打开对话框，用户名为空提交被校验拦下并提示，角色下拉只列预置角色 viewer / operator / admin；成员读取失败显示失败原因与重试。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-02** — Given 邀请对话框，When 填平台已有用户名并选 viewer 提交，Then 发出 POST `/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members`（数组 body），成功后行出现且角色为 viewer；点修改角色选 operator 保存，发出 PUT `…/members/<username>` 且行角色更新；点移除并在确认框确认，发出 DELETE `…/members/<username>` 且行消失；失败显示服务端消息。 成员列表对**当前登录账号自己**这一行不渲染「修改角色 / 移除」，改显示「不能修改自己的角色或移除自己」（旧 console 的 showAction 保护；服务端也会拒绝对自己改角色或移除）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_ROLES-01** — Given 打开角色页签，Then 表格列为 名称 / 别名 / 权限模块 / 角色类型 / 创建时间；viewer / operator / admin 显示「预置角色」，带标签 `iam.kubesphere.io/role-template=true` 的角色显示「权限模板」，其他显示「自定义角色」；页签徽标数量等于接口 roles 条数；读取失败显示失败原因与重试。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01** — Given 打开代码仓库页签，Then 表格列为 名称 / 提供方 / 仓库地址 / 访问凭证 / 操作，空集合显示「该工程还没有代码仓库。」；点导入填名称 / 提供方 / 仓库地址 / 访问凭证 / 描述提交 POST `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/gitrepositories`，成功后行出现（提供方显示 `spec.provider` 原值如 `github`，未填访问凭证显示 `-`）；名称为空或非法时提示；删除需输入名称确认，成功后行消失；失败显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01** — Given 打开持续部署页签，Then 表格列为 名称 / 健康状态 / 同步状态 / 目标命名空间；同步与健康状态取 `status.argoApp` 的 `sync.status` / `health.status`，目标命名空间取 `spec.argoApp.spec.destination.namespace`，缺失显示 `-` 且行不消失；空集合显示「该工程还没有持续部署。」；读取失败显示失败原因与重试。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-02** — Given 工程详情基本信息，Then 持续部署白名单区显示代码仓库（`spec.argo.sourceRepos`）与部署位置（`spec.argo.destinations` 的名称 / 命名空间），未配置显示「未选择」；点编辑白名单，按行编辑仓库（每行一个，`*` 表示全部）与部署位置（每行 `集群/项目`）后保存，发出整对象 PUT 且保留对象其他 spec 与 annotations，成功后基本信息回显新值；取消不写；失败显示服务端消息。

## 设计目标

1. 让 DevOps 区域在集群菜单里可达，空集群也给出可信的空态而不是空白页。
2. 详情页的每个集合独立成败：一个接口失败不拖垮其他页签。
3. 不伪造：没有工程就没有行；读不到就显示原因与重试；运行没被 Jenkins 接受就不显示成功。
4. 写操作同页闭环：创建 / 编辑 / 删除 / 运行都在本页完成，成功后回读列表或详情，失败保留输入并显示服务端消息。
5. 名称是对象身份：工程、流水线、凭证、代码仓库的名称创建后不可改；编辑对话框名称只读，删除必须输入完整名称确认。
6. 服务端分页与筛选是列表事实：页码、每页条数、总数、搜索与类型筛选都来自 kapis 参数与 `totalItems`，不在浏览器端伪造分页。
7. 状态口径唯一：流水线健康分档、运行状态映射只在 `pages/devops/format.ts` 与 api-client 各实现一次，列表、详情、运行详情共用。

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
- 写路径（2026-11-15 实测）：工程创建 `POST /kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops`（必须带 `metadata.generateName`，否则报 `metadata.generateName: Required value`）；工程编辑/删除走 `/apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>` 的整对象 PUT 与 DELETE；流水线创建/编辑/删除走 `/kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines` 与 `…/pipelines/<name>`；Jenkinsfile 保存走 `PUT …/pipelines/<name>/jenkinsfile?mode=raw`（body `{"data": "<jenkinsfile>"}`），缺 `mode` 返回 400 `invalid edit mode`；凭证写走 `/kapis/devops.kubesphere.io/v1alpha3/devops/<project>/credentials`；成员写走 `/kapis/iam.kubesphere.io/v1alpha2/devops/<project>/members`；代码仓库写走 `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/gitrepositories`；运行触发走 `POST /apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns`。
- 写接口与读取接口不同组：列表/详情读原生 `/apis`（kapis 的 `devopsprojects` 是 404），流水线与凭证的列表/详情读 kapis（原生集合也可读，但分页/搜索/类型筛选用 kapis 的 `totalItems`），成员/角色读 iam kapis，CD 读 gitops 组。页面不发出未列出的写请求。
- 运行触发只保证 PipelineRun 对象创建成功（实测 201，对象可读）；Jenkins 是否执行由控制器与 Jenkins 通道决定，当前探测到 devops-controller 因 Jenkins token 不匹配 CrashLoopBackOff，因此运行状态注解、成功与日志内容不可用（见「阻塞」）。
- 作用域：本区域在 registry 里是 cluster scope，URL 不带 workspace；旧 console 的 `/:workspace/clusters/:cluster/devops` 依赖 workspace 段，新 UI 的集群菜单无法表达它（见 design DEC）。

## UI 交互设计

- 列表：标题+描述；表格列 名称（链接）/ 描述 / 所属企业空间 / 创建时间；空态「暂无 DevOps 工程」。
- 列表：标题+描述、右上「创建 DevOps 工程」；表格列 名称（链接）/ 描述 / 所属企业空间 / 创建时间；空态「暂无 DevOps 工程」；创建对话框字段 名称（必填，`[a-z0-9-]`、不能以连字符开头/结尾、最多 58 字符）、企业空间（下拉，来自 tenant kapis）、别名、描述；提交时按钮 loading 并禁用，成功后跳到生成名详情，失败在对话框内显示服务端消息并保留输入。
- 详情：返回链接 + 标题（别名优先）+ 描述；右上「编辑工程信息」「删除」；页签顺序 基本信息 / 流水线 / 持续部署 / 代码仓库 / 成员 / 角色 / 凭证，默认基本信息；基本信息卡显示名称 / 别名 / 企业空间 / 创建者 / 创建时间 / 描述 / 工程命名空间（实际取值）/ 同步状态 / 部署集群 / 成员数 / 角色数，下方持续部署白名单区显示代码仓库与部署位置，未配置显示「未选择」，右上「编辑白名单」。
- 每个集合页签：加载骨架；表格；空态说明；失败时为错误文案 + 重试按钮。成员/角色/凭证/流水线/持续部署/代码仓库页签另有各自的新增 / 行操作入口。
- 流水线页签：搜索框（按名称，输入即过滤并把页码重置 1）、类型下拉（全部类型 / 单分支 / 多分支）、创建按钮；表格列 名称（链接）/ 健康状态 / 类型 / 分支数 / 合并请求数 / 操作；行操作 运行 / 编辑 / 复制 / 删除；底部「共 N 条」、每页条数 10/20/50、上一页/页码/下一页。运行后在该页签显示「已提交运行请求：<name>。」提示。
- 持续部署页签列 名称 / 健康状态 / 同步状态 / 目标命名空间；代码仓库页签列 名称 / 提供方 / 仓库地址 / 访问凭证 / 操作，右上「导入代码仓库」；成员页签列 用户名 / 角色 / 状态 / 最近登录 / 操作，右上「邀请成员」；角色页签列 名称 / 别名 / 权限模块 / 角色类型 / 创建时间；凭证页签列 名称 / 类型 / 用户名 / 同步状态 / 描述 / 操作，右上「创建凭证」。
- 流水线详情：返回工程链接 + 标题（别名优先）；右上 运行 / 编辑 / 删除；基本信息卡（名称/类型/同步状态/健康状态/脚本校验/创建者/创建时间/工程命名空间/描述）；页签 运行记录 / 流水线配置。运行记录区列 状态 / 编号 / 提交 / 分支（仅多分支）/ 最近消息 / 耗时 / 开始时间 / 操作，编号为打开运行详情的链接，操作为「重新运行」；运行详情显示编号/状态/控制器阶段/开始时间/耗时/提交/状态消息与日志区。配置页签单分支为可编辑 Jenkinsfile（保存 / 取消），多分支为只读脚本路径说明。
- `data-ai-id`：列表 `devops:surface`、`devops:create`、`devops:link:<name>`、`devops:refresh`；创建对话框 `devops:create-name|-workspace|-alias|-description|-submit`（错误 `devops:create-submit-error`）；详情 `devops-detail:surface`、`:title`、`:description`、`:edit`、`:delete`、`:basic`、`:name`、`:alias`、`:workspace`、`:namespace`、`:creator`、`:description-row`、`:created-at`、`:sync-status`、`:placement`、`:member-count`、`:role-count`、`:allowlist`、`:allowlist-edit`、`:allowlist-repos`、`:allowlist-destinations`、`:tab:base-info|pipelines|cd|code-repo|members|roles|credentials`、各集合面板与 `-table/-empty/-error/-retry`、`:not-found`、`:back`、`:pipeline:<name>`（流水线行链接）；编辑信息 `devops-detail:edit-alias|-edit-description|-edit-info-submit`；删除 `devops-detail:delete-input|-delete-confirm`；白名单 `devops:cd-allowlist-repos|-destinations|-submit`。
- 流水线详情 `data-ai-id`：`pipeline-detail:surface`、`:title`、`:back`、`:basic`、`:name`、`:type`、`:sync-status`、`:health`、`:validate`、`:creator`、`:created-at`、`:namespace`、`:description`、`:notice`、`:runs`、`:runs-table`、`:runs-empty`、`:runs-error`、`:runs-retry`、`:tab:runs|config`、`:config`、`:config-editor`、`:config-save`、`:config-reset`、`:config-multibranch`、`:config-error`、`:run-detail`、`:run-id`、`:run-status`、`:run-phase`、`:run-start`、`:run-duration`、`:run-commit`、`:run-message`、`:run-log`、`:run-log-error`、`:run-log-retry`、`:run-close`、`:run`、`:edit`、`:delete`、`:not-found`、`:retry`；运行行 `data-ai-row=<objectName>`、运行链接 `:run-link:<name>`、状态徽章 `:run-status:<name>`、重放 `:run-replay:<name>`；运行表单 `:run-form`、`:run-branch`、`:run-param:<name>`、`:run-submit`。

## 文案与校验

- 区域/标题：`devops.title`、`devops.list.title`、`devops.list.description`；空态 `devops.list.emptyTitle/emptyDescription`。
- 页签：`devops.detail.members/roles/credentials/pipelines/cd/codeRepos`；空态 `devops.detail.membersEmpty/rolesEmpty/credentialsEmpty/pipelinesEmpty/cdEmpty/codeReposEmpty`；列头 `devops.detail.namespace/pipelineType/pipelineStatus/syncStatus/healthStatus/cdDestination/repoProvider/repoURL`。
- 持续部署的同步/健康状态直接显示 Argo CD 的取值（Synced / OutOfSync、Healthy / Degraded / Progressing / Missing / Unknown），空值显示 `-`。
- 流水线详情：`devops.pipeline.subtitle/type/status/runs/runsEmpty/column.runId|status|startTime|duration`，运行状态 `devops.pipeline.state.queued|running|success|failure|aborted|paused|unstable|notRunning`。
- 字段复用：`cluster.column.name/createdAt`、`projectInfo.field.description/workspace`、`workspace.detail.basic/creator`、`workspace.field.member/role`、`platform.column.ruleCount`、`cluster.customResources.kind`、`common.retry`、`error.notFound`。
- 工程与流水线表单：名称校验统一为 `devops.validate.nameRequired` / `devops.validate.namePattern`；工程名称提示 `devops.create.nameHint`，流水线名称提示 `devops.pipeline.nameHint`；类型下拉 `devops.pipeline.kind.pipeline|multiBranch`；多分支字段 `devops.pipeline.sourceType/repoUrl/repoOwner/credential/noCredential/scriptPath`；单分支 Jenkinsfile 与配置 `devops.pipeline.jenkinsfile/jenkinsfileHint/config`。
- 凭证表单：`devops.credential.kind.usernamePassword|ssh|secretText|kubeconfig`、`username/password/privateKey/passphrase/secret/kubeconfig/kubeconfigHint`；类型创建后不可改，密码与私钥不回显；同步状态 `devops.credential.syncStatus`。
- 成员与角色：`devops.member.invite/inviteTitle/inviteDescription/username/usernameHint/usernameRequired/role/changeRole/remove`；角色类型 `devops.role.preset/template/custom`、`devops.role.module`。
- CD 与代码仓库：`devops.cd.allowlistTitle/allowlistDescription/editAllowlist/sourceRepos/destinations/destinationsHint/onePerLine/notSelected`；`devops.codeRepo.createTitle/createDescription/secret/secretHint`；提供方下拉 GitHub / GitLab / Bitbucket / Gitee / SVN。
- 运行：`devops.pipeline.run/replay/runRequested/runTitle/runDetail/runPhase/runLog/runLogEmpty/branchPlaceholder`；状态文案 `devops.pipeline.state.*`；健康文案 `devops.pipeline.health.healthy|subHealthy|warning|unknown`。

## 边界情况

- `devopsprojects` 为 0（当前 B200）：列表空态；详情仅当手动输入名称时可达，显示 not-found，但页签仍可切换并各自展示空态/失败原因（便于验证骨架）。
- 工程存在但成员/角色/凭证/流水线/CD/代码仓库为空：对应页签显示空态。
- 某个集合 403/404：该页签显示失败原因 + 重试，其他页签不受影响。
- 工程刚被删除：基本信息 404 → `:not-found`，页签区不渲染，不再向已删除工程发起集合请求。
- 基本信息读取失败但不是 404：错误面板 + 重试。
- 对象已存在但控制器尚未写 `status.adminNamespace`：回退工程名，基本信息 `:namespace` 显示回退值，避免猜测。
- 持续部署对象没有可用状态：`status.argoApp` 可能是 JSON 字符串、普通字符串或缺失，同步/健康状态分别显示 `-`，不整行消失。
- 流水线不存在：详情显示 `:not-found`，运行记录区随详情一起不渲染，不显示伪造的空表。
- 流水线运行记录没有 Jenkins 注解：编号回退对象名，状态显示「未运行」，开始时间回退创建时间，耗时按对象缺省显示 `0s`（mapper 对缺失 durationInMillis 取 0），整行不消失。
- 运行记录标签键与预期不一致：标签过滤为空时回退全量并同时按 `spec.pipelineRef.name` 匹配，避免把已有运行记录显示成空。
- 新建工程尚未被控制器同步（`status.adminNamespace` 为空）：详情基本信息回退工程名并如实显示；该工程的成员/角色/流水线等 kapis 集合可能返回平台级回退数据或空集合，页面不做二次编造，验收以「接口返回什么就显示什么」核对（见 design GOT）。
- 工程名与 Jinja/k8s 名称限制：创建对话框按 `[a-z0-9-]` 校验并把长度限制在 58（为接口追加 5 位后缀留空间）；服务端报错原样显示。
- 流水线创建多分支时凭证列表为空：下拉仍可用「不使用凭证」选项，提交的 `credential_id` 为空串；类型筛选「全部」不改变请求（不带 type 参数）。
- Jenkinsfile 保存后 Jenkins 同步失败：对象里的 `spec.pipeline.jenkinsfile` 以接口回读为准；`pipeline.devops.kubesphere.io/jenkinsfile.validate` 可能为缺省或 failure，详情脚本校验显示 `-` 或「校验失败」，不显示成功。
- 运行已创建但 Jenkins 未接受：运行记录显示「未运行」与对象名编号；运行详情显示控制器阶段/消息（可能为空）；日志接口 404 时显示失败原因+重试，不显示空日志冒充「没有日志」。
- 成员邀请一个不存在的用户：对话框保留输入并显示服务端消息；重复邀请同一用户：接口返回错误时同样保留对话框。
- 删除工程后其命名空间与流水线由集群策略处理：页面只负责删除 DevOpsProject 并回到列表，不承诺级联删除的最终状态。

## 明确不做

- 可视化流水线编辑器（Jenkinsfile 转图形化 steps、pipeline template、Sider / StepsEditor / StepModals）、代码质量、SonarQube / scan、分支与 Pull Request 页签、产物 / 提交 / 事件 / 任务状态等运行子页：不在本轮；本轮只提供 Jenkinsfile 文本编辑与运行记录列表、运行详情。
- 运行停止 / 终止、Jenkins 队列操作、批量运行与批量删除：不在本轮；重放已实现。
- CD 创建 / 编辑信息 / 编辑 YAML / 同步 / 回滚 / 删除与 CD 明细页（Flux / Argo 子页）：不在本轮；本轮只读 CD 列表并编辑工程白名单。
- 代码仓库编辑 / 编辑 YAML / 内联新建仓库：本轮只做导入与删除。
- 工程角色 CRUD（新建 / 编辑信息 / 编辑权限 / 删除）与凭证详情活动页：不在本轮；角色只读。
- 成员批量移除、邀请时搜索用户、禁止操作自己的保护（旧 console 的 showAction）：不在本轮；测试只用唯一测试账号并自行清理。
- 工程用量、流水线统计、代码仓库选择器内的内联创建。
- 旧 console 列表的 4 秒自动刷新 / 运行中轮询：不在本轮，改为显式刷新与写后 invalidate；不在页面里做定时重拉。
- 本区域（集群作用域）不做按企业空间过滤 / 授权：空间视角的只读入口由企业空间控制台承接（[workspace-console US3/AC-09](../access-control/workspace-console.md)，2026-11-17 重纳 N-07）；工程创建/编辑/删除仍在本区域，空间列表行链回这里。

## 阻塞

### BLOCK-1 Jenkins 通道不可用：运行成功、运行状态注解与日志内容无法端到端验收

2026-11-15 在 B200（namespace `kubesphere-devops-system`）取证：

- `devops-controller` pod 处于 CrashLoopBackOff（restartCount=27，lastState.terminated.exitCode=1），容器日志逐字为 `Error: the token of the Jenkins needs to update`。
- `kubesphere-config` 的 `devops.host=http://devops-jenkins.kubesphere-devops-system.svc/`、`devops.username=admin`（密码为密文，不记录）。
- `POST /apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns` 返回 201 且对象可读，但数秒后仍无 `devops.kubesphere.io/jenkins-pipelinerun-status` 注解与 `status`；`GET /kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines/<pipeline>/runs/<id>/log/` 返回 404 Page Not Found。
- 影响：AC-L3-…-DEVOPS_RUNS-02 中「运行成功 / 失败的最终状态、耗时、开始时间、日志正文」，AC-L3-…-DEVOPS_PIPELINES-02 的 weatherScore「健康 / 亚健康 / 异常」正分支，AC-L3-…-DEVOPS_PIPELINES-05 的同步状态与脚本校验正分支，当前只能验证「缺值不伪造、失败返回 404 时显示错误」的行为。
- 仍然可验收且必须验收：运行请求链路（PipelineRun 创建、label / pipelineRef、页面提示）、无注解时「未运行」的如实展示、运行详情字段、日志错误 + 重试，以及不出现伪造的成功状态。

复查条件（需全部满足）：

1. `devops-controller` pod 就绪、restartCount 不再增长，启动日志不再出现 `token of the Jenkins needs to update`。
2. 以控制器相同配置访问 Jenkins（如 `/crumbIssuer/api/json` 或 `/whoami`）返回 200，而非 401/403。
3. 新建一次运行后 60 秒内 PipelineRun 出现 `devops.kubesphere.io/jenkins-pipelinerun-status` 注解，日志接口返回 200 且正文非空。
4. 复查后重跑 `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01` 并在交付记录追加新证据，才可把上述条目从阻塞改为通过。

### BLOCK-2 新建工程尚未同步时的集合回退（数据语义限制）

新建 DevOpsProject 后控制器未恢复前 `status.adminNamespace` 为空，其 kapis 集合会回退到平台级数据（实测 `devops/<project>/pipelines` 返回其他工程数据、`members` 返回平台用户、`roles` 返回集群模板）。因此工程创建用例只验收创建 / 编辑 / 删除与详情命名空间回退，不把新工程的集合内容当作该工程的真实数据。复查条件：控制器恢复后新建工程 30 秒内出现 `adminNamespace`，再补该场景用例。

## 假设

- `devops.kubesphere.io/v1alpha3` 的 `devopsprojects` CRD 已注册且可读（实测 200，items=[]）。
- 成员/角色/凭证的 kapis 路径已注册（实测对不存在工程返回资源 not-found，说明路由存在）。
- 流水线、代码仓库（GitRepository）与持续部署（GitOps Application）三类资源可读，且列表接口对不存在的命名空间返回 200 空列表（已用不存在的命名空间实测）。
- DevOpsProject CRD 用 `status.adminNamespace` 记录工程命名空间（schema 已核实）；2026-11-15 实测 1 个迁移探针工程，该字段已写入且等于工程名；新建对象在控制器恢复前可能为空，页面回退为工程名。
- 工程对象用 `kubesphere.io/workspace` 标签归属企业空间，用 `kubesphere.io/alias-name` / `kubesphere.io/description` 注解存别名与描述；创建时必须带 workspace 标签，否则 devops apiserver 拒绝。
- 工程创建用 `metadata.generateName`，新对象名是输入名 + 5 位随机后缀；页面跳转与列表都以接口返回名为准。
- PipelineRun 由本页手动创建时已带 `devops.kubesphere.io/pipeline` 标签（实测）；控制器在 Jenkins 通道可用时也会维护该标签与 `spec.pipelineRef.name`，页面两条都认。
- 运行状态来自 `devops.kubesphere.io/jenkins-pipelinerun-status` 注解（老 console 同样读取它）；当前无成功样本，按 state/result 的既有映射实现。
- 凭证以 Secret 保存：类型 `credential.devops.kubesphere.io/basic-auth|ssh-auth|secret-text|kubeconfig`，字段 username/password/private_key/passphrase/secret/content 在提交前 base64；kapis 的 credentials 列表实测恒为空，列表改读 Secret 集合。
- 成员角色来自 iam 聚合的 `iam.kubesphere.io/role` 注解；角色模板用标签 `iam.kubesphere.io/role-template=true` 标记；预置角色为 viewer / operator / admin。
- 持续部署白名单存于 DevOpsProject 的 `spec.argo.sourceRepos` 与 `spec.argo.destinations`（元素含 name / namespace / server），整对象 PUT 保存。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 集群 DevOps 列表展示工程并提供详情入口，空态明确。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 详情提供基本信息与成员/角色/凭证/流水线/持续部署/代码仓库页签，各集合独立显示表格/空态/失败原因。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 流水线/持续部署/代码仓库从工程对象的 `status.adminNamespace` 取命名空间（缺失时回退工程名），并在基本信息展示实际取值。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04** — 流水线行提供进入详情页的链接；流水线详情展示基本信息与运行记录（编号/状态/开始时间/耗时），运行记录独立显示表格/空态/失败原因；流水线不存在时显示 not-found，运行记录区不渲染。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05** — 列表可创建工程（名称/企业空间/别名/描述，名称校验），详情可编辑别名与描述、可删除工程，成功后回读列表或详情。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-06** — 详情提供基本信息与六个集合页签共七个页签，默认基本信息，各集合独立显示表格/空态/失败原因。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01** — 流水线列表使用服务端分页（page/limit/totalItems）、名称搜索与类型筛选，展示健康/类型/分支数/合并请求数与运行/编辑/复制/删除入口。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02** — 流水线可创建（单分支 Jenkinsfile / 多分支 SCM）、编辑、复制、删除，名称与类型创建后不可改。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03** — 流水线详情展示基本信息、同步状态、健康与脚本校验，并允许查看/保存单分支 Jenkinsfile（多分支只读脚本路径说明）。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01** — 运行请求创建 PipelineRun 对象并如实刷新运行记录；运行状态和日志以对象注解与接口返回为准，不伪造成功。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01** — 四种凭证可创建、查看、编辑敏感数据与描述、删除，名称与类型不可改。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01** — 成员可邀请（指定预置角色）、改角色、移除，列表展示用户名/角色/状态/最近登录。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_ROLES-01** — 角色页签只读展示预置角色、权限模板与自定义角色及数量。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01** — 代码仓库可导入与删除，列表展示提供方、地址与访问凭证。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01** — 持续部署页签只读展示同步/健康/目标命名空间；基本信息展示并编辑 CD 白名单。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 列表行数与 `devopsprojects` 一致；详情页签可切换且三种状态可辨；不伪造数据。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 流水线/持续部署/代码仓库三个页签均可切换，各自显示表格/空态/失败原因之一；读取路径使用工程命名空间（`status.adminNamespace`，缺失时回退工程名）。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 流水线行链接到详情 URL；详情页基本信息与运行记录区可见，运行记录恰好显示表格/空态/失败之一；流水线不存在时 not-found 可见且运行记录区仍有状态。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04** — 工程创建/编辑/删除三步都能通过接口回读：创建后列表出现、编辑后标题与描述更新、删除后列表消失且回到列表页；操作失败有可见错误。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05** — 七个页签全部可切换、默认基本信息，每个集合页签恰好显示表格/空态/失败之一；无整页错误。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01** — 列表总数、页码、每页条数、搜索与类型筛选均与接口参数一致；健康缺值显示「无状态」而不是「健康」。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02** — 创建/编辑/复制/删除各回读成功；名称与类型只读；失败保留输入。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03** — 基本信息字段与接口一致；Jenkinsfile 保存后回读等于提交内容；保存按钮 dirty 才可用。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01** — 触发运行后能查到新建 PipelineRun 的 label/pipelineRef；页面提示「已提交运行请求」；无注解运行显示「未运行」，日志失败显示错误+重试。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01** — 四种凭证均能创建并在列表显示正确类型；编辑后描述更新；删除后行消失。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01** — 邀请/改角色/移除各回读成功，成员列表角色与接口一致。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_ROLES-01** — 角色数量与接口一致，预置/模板/自定义分类正确。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01** — 导入后列表出现且字段正确，删除后行消失。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01** — CD 列表空态/表格可辨；白名单展示与保存回读一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01`
