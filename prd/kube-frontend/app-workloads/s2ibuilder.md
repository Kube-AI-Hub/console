# 镜像构建器（L3）

[子模块需求](./_index.md)

## 概述

项目级的镜像构建器页族（旧 console 的 `/:namespace/s2ibuilders` 列表、`/:namespace/s2ibuilders/:name` 详情及其五个页签、创建向导、运行/重新构建、编辑信息、编辑 YAML、删除）：每个构建器把一个 Git 仓库或一个制品构建成容器镜像，页面负责看构建结果并维护构建配置。

构建器是 devops API 组的命名空间级 CRD（`devops.kubesphere.io/v1alpha1` 的 s2ibuilders / s2iruns / s2ibinaries，模板 s2ibuildertemplates 为集群级）。同组的 v1alpha3 只服务流水线/工程等资源，向它请求 s2ibuilders 会得到 404——这是版本拆分，不是功能缺失。

实测（2026-11-15，B200，经本地 BFF）：
- `/apis/devops.kubesphere.io/v1alpha1` 同时提供 v1alpha1 与 v1alpha3；v1alpha1 的资源清单含 s2ibuilders、s2ibuilders/status、s2ibuildertemplates、s2iruns、s2ibinaries。
- CRD schema：s2ibuilder 的 `spec.config` 有 builderImage / builderPullPolicy / sourceUrl / revisionId / imageName / tag / contextDir / secretCode / environment[{name,value}] / gitSecretRef / pushAuthentication / isBinaryURL 等；status 有 lastRunName / lastRunState / lastRunStartTime / runCount。s2irun 的 status 有 runState / kubernetesJobName / logURL / s2iBuildSource / s2iBuildResult。
- 列表：`GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/s2ibuilders?page=&limit=&sortBy=createTime&ascending=false&name=` 返回 `items` 与 `totalItems`（服务端分页/名称搜索）；原始 CRD 列表不提供分页与总数。
- 写入：`POST /apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibuilders` 201；admission webhook 要求 `builderPullPolicy` 合法且 `sourceUrl` 非空，否则 403；`PATCH`（merge-patch）与 `DELETE` 200。
- 模板：`GET /apis/devops.kubesphere.io/v1alpha1/s2ibuildertemplates` 200，5 个模板（binary/java/nodejs/python/tomcat），含 codeFramework / containerInfo / defaultBaseImage / environment。
- 运行：`POST /apis/.../namespaces/<ns>/s2iruns` 201；创建后 s2ioperator 本应创建 Job 并写 status。
- **阻塞证据（2026-11-15）**：`s2ioperator-0` 以 `system:serviceaccount:kubesphere-devops-system:default` 运行，日志显示
  `Failed to watch *v1alpha1.S2iBuilder: s2ibuilders.devops.kubesphere.io is forbidden: User "system:serviceaccount:kubesphere-devops-system:default" cannot list resource "s2ibuilders"... at the cluster scope`，s2iruns、jobs.batch、namespaces、configmaps 同样 forbidden。因此运行对象创建后永不产生 `kubernetesJobName`/`runState`/`logURL`，构建成功状态、Job、日志正文在本环境不可验收。
- **阻塞证据（B2I 上传）**：`PUT /kapis/devops.kubesphere.io/v1alpha2/namespaces/<ns>/s2ibinaries/<name>/file` 的真实响应为
  `500 RequestError: send request failed caused by: Put "http://minio.kubesphere-system.svc:9000/s2i-binaries/..." dial tcp: lookup minio.kubesphere-system.svc: no such host`，S2iBinary 进入 `UploadFailed`；制品上传/下载正文不可验收，请求链路可验收。
- 仓库可读性检查 `POST /kapis/resources.kubesphere.io/v1alpha2/git/verify` 在本环境返回 500 `authentication required`，表单把它作为非阻塞提示。

## 用户故事

### US1 - 看到项目里有哪些镜像构建器，并维护别名/删除 (Priority: P1)

作为 **项目运维**，我希望 **在项目里看到已有的镜像构建器、它们最近一次构建的状态与所属服务，并能改别名或删除不再需要的构建器**，以便 **快速判断某个服务的镜像最近是否构建成功，并清理过期的构建配置**。

**Independent Test**：打开项目的镜像构建器页：列表按创建时间倒序、服务端分页并支持名称搜索与刷新；行内显示名称（别名/显示名）、类型、所属服务、构建器镜像、状态、最近构建时间与创建时间；行菜单可编辑信息与删除，删除需输入对象名并回读 404；没有构建器时显示空态并给出创建入口。

### US2 - 从代码或制品创建镜像构建器并开始构建 (Priority: P1)

作为 **项目开发者**，我希望 **用两步向导创建一个源码构建（S2I）或制品构建（B2I）的构建器，选择构建模板、填写仓库/制品与目标镜像服务，并在创建后立即触发一次构建**，以便 **把代码或制品变成可部署的镜像**。

**Independent Test**：创建向导第一步选构建模式与语言，第二步填写构建设置并提交：生成的对象带正确标签/注解与 `spec.config`（含 pull policy、仓库、分支、镜像名、标签、目标镜像服务、环境变量），同时出现一条 `spec.builderName` 指向它的 S2iRun；制品构建先创建 S2iBinary 并上传文件，上传失败时如实报错且不留下半成品。

### US3 - 查看构建器详情与全部属性 (Priority: P2)

作为 **项目运维**，我希望 **打开一个构建器，看到它的构建器镜像、输出镜像名、拉取策略、代码仓库、远程触发器与创建信息，并能运行/编辑/删除**，以便 **确认配置并复制 Webhook 触发器**。

**Independent Test**：打开详情页，属性区按旧版字段与顺序展示；远程触发器包含 s2itrigger 地址并可复制；操作顺序为 运行 / 编辑信息 / 编辑 YAML / 删除；五个页签可切换；不存在的对象显示「资源不存在」并可返回列表。

### US4 - 查看构建记录、重新构建并核对产出镜像 (Priority: P1)

作为 **项目运维**，我希望 **在详情页重新构建并查看最后构建环境、运行记录与日志、资源状态、镜像制品、环境变量与事件**，以便 **确认构建是否成功、拿到镜像地址，并在失败时定位原因**。

**Independent Test**：运行表单预填当前配置，保存后配置更新且出现新的 S2iRun；「更新工作负载」开关在有关联服务时出现，开/关分别移除/写入 donotautoscale 注解；构建记录页签显示最后构建环境与运行记录（未知状态如实显示），无日志地址时说明原因；镜像制品只列成功运行的镜像名/大小/拉取命令/发布时间；资源状态、环境变量、事件页签在没有 Job 时给出控制器未创建 Job 的如实提示。

### US5 - 状态、权限与语言/主题不退化 (Priority: P2)

作为 **不同权限与语言的读者**，我希望 **加载、空、失败、无权限是分开的画面，英文界面完整，三档宽度下可读**，以便 **在任何环境下都能判断页面是否正常**。

**Independent Test**：空列表显示空态；500 显示错误与重试；403 显示无权限且不提供重试；英文界面显示英文表头；surface 始终声明 data-ai-state。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 列表：通过 `/kapis/resources.kubesphere.io/v1alpha3/namespaces/<namespace>/s2ibuilders` 读取，请求带 `page`/`limit`（服务端分页）与 `sortBy=createTime&ascending=false`；行数等于当页 items、总数取 `totalItems`；搜索按名称服务端过滤并回到第 1 页；刷新保留搜索值并重新读取；列顺序为名称（displayName/name 与类型/所属服务副行）、状态（lastRunState：Running→构建中、Successful→构建成功、Failed→构建失败、空/未知→尚未构建）、类型、所属服务、构建器镜像、最近构建时间（lastRunStartTime，缺失显示 -）、创建时间；窄屏依次隐藏类型/所属服务与最近构建、创建时间，名称与状态始终可见；空列表显示「暂无镜像构建器」空态并说明来源；读取失败显示错误面板与重试；列表行名称链到详情。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02** — 行操作：行菜单顺序为「编辑信息、删除」；编辑信息只更新 `kubesphere.io/alias-name` 与 `kubesphere.io/description`，其余注解保留；删除必须输入完整对象名，确认后 DELETE 成功、行消失且回读 404；支持勾选多行批量删除（同样输入名称确认），删除后总数与页码刷新，最后一页被删空时回到上一页。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03** — 创建（S2I）：向导两步，第一步必须选择构建模式（源码/制品）与语言（模板支持的 java/nodejs/python 等），第二步填写构建设置；字段：构建环境（模板 builder image）、代码仓库 URL（必填、http(s):// 或 git@）、分支（必填，默认 master）、代码仓库密钥（basic-auth 保密字典，可选）、镜像名称（必填，小写字母/数字/- . / : 且首尾为字母或数字）、镜像标签（必填，默认 latest）、目标镜像服务（dockerconfigjson 保密字典，必填）、高级项（触发令牌仅字母数字、代码相对路径默认 /、模板环境变量名/值）；提交后 POST 创建 S2iBuilder（标签 `s2i-type.kubesphere.io=s2i`、`controller-tools.k8s.io=1.0`，注解 `languageType`、`kubesphere.io/repoUrl`，`spec.config.builderPullPolicy=if-not-present` 等），并把所选镜像服务的仓库地址前缀到镜像名称；随后创建一条 S2iRun（`spec.builderName`=新构建器）；提交中按钮禁用并显示进行中；字段校验失败显示错误且不发请求；服务端错误保留输入。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04** — 创建（B2I）：制品模式先创建 S2iBinary 再 `PUT …/s2ibinaries/<name>/file` 上传；成功后把控制器写入的 `spec.downloadURL` 作为 builder 的 `spec.config.sourceUrl`、设置 `isBinaryURL=true` 并记录 `kubesphere.io/file` 注解（文件名/大小）；上传失败时对话框显示服务端原因、不创建 builder，且删除半成品 S2iBinary；文件扩展名与所选制品类型不符时拒绝上传并提示。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05** — 详情：属性区按旧版字段展示名称、项目、类型、构建器镜像（builderImage）、镜像名称（imageName）、拉取策略（builderPullPolicy）、代码仓库/制品（S2I 显示 sourceUrl + revisionId；B2I 显示制品与下载入口）、远程触发器（`http://s2ioperator-trigger-service.kubesphere-devops-system.svc/s2itrigger/v1alpha1/general/namespaces/<ns>/s2ibuilders/<name>/` + secretCode 查询参数，可复制）、创建时间、创建者；操作顺序为「运行、编辑信息、编辑 YAML、删除」；页签为 构建记录（默认）、资源状态、镜像制品、环境变量、事件；编辑 YAML 打开对话框且取消不写；对象不存在时显示「资源不存在」与返回列表链接；详情读取失败可重试。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06** — 运行/重新构建：详情「运行」打开预填当前 `spec.config` 的表单；保存会 merge-patch 配置（未修改字段保留）并创建一条新的 S2iRun；构建器带 `serviceName` 注解时显示「构建成功后更新工作负载」开关并默认开启（不写 `devops.kubesphere.io/donotautoscale`），关闭时写入该注解；无 `serviceName` 时不显示开关并说明原因；提交失败保留输入并显示错误。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07** — 构建记录：默认页签；「最后构建环境」取自最新一次运行的 `status.s2iBuildSource`（builderImage / sourceUrl / revisionId；B2I 显示 binaryName/binarySize），无运行或控制器未汇报时显示 "-" 与如实说明，不把构建器配置冒充成上次构建结果；运行记录按创建时间倒序分页（每页 10），列含序号、状态（runState 映射）、镜像名称、开始时间、最后消息（镜像：{name}/构建中|成功|失败；未汇报显示“控制器尚未写入运行状态”）、日志；无 `status.logURL` 时不发日志请求并说明控制器未创建构建任务；有 logURL 时读取日志正文，构建中每 4 秒刷新，可暂停/继续/手动刷新；运行列表读取失败可重试。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08** — 资源状态页签：读取最近一次运行的 Job；有 Job 时展示容器端口（名称/协议/端口）与 Job 的 Pod（名称/状态/就绪/重启次数/节点/IP）；控制器未创建 Job 时显示「最近一次运行还没有创建构建任务（Job）」并说明 Job 由 s2ioperator 创建（控制器无权限或未就绪时停留于此），不渲染空表冒充成功。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09** — 镜像制品页签：只列 `runState=Successful` 的运行，列含镜像名称、镜像大小（`imageSize` 字节按 1024 换算）、拉取命令（可复制并提示已复制）、发布时间（imageCreated）；没有成功运行显示空态；非成功运行不出现在制品表。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10** — 环境变量页签：读取最近一次运行 Job 的容器 `env`，按容器分组、首个展开、其余可展开/收起；`valueFrom.secretKeyRef`/`configMapKeyRef` 解析为实际值；变量名含 password/secret 的值以 `******` 显示；无 Job 时不读取并显示如实提示；读取失败可重试。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-11** — 事件页签：按 `involvedObject.kind=Job、name、namespace、uid` 读取 Job 事件，列含类型、原因、最近发生、次数、来源、消息，Warning 类型有区分色；无 Job 或事件为空时显示如实空态；读取失败可重试。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12** — 状态与视觉：加载/真实空/无匹配/失败/无权限五态分开，不互相顶替；403 显示无权限原因且不提供重试，500 提供重试；surface 始终声明 `data-ai-state`（loading/ready/empty/error）且页面动作有稳定 `data-ai-id`；中英文键完整（英文显示 Name/Status/Created 等，不出现原始 key）；1024/1280/1600 三档宽度下表头与行内容不溢出、主题 token 对比度可读。

## 设计目标

1. 一条完整用户任务：创建 → 触发运行 → 查看记录/制品 → 编辑配置/重新运行 → 删除。
2. 数据语义与旧 console 一致：状态来自 controller 写入的 runState/lastRunState，未知值不猜成功；时间/大小/镜像名按同一格式化规则。
3. 读路径正确：列表用服务端分页/搜索的总代理端点，详情/写入用原生 CRD 端点（v1alpha1）。
4. 无 Job 时诚实：所有依赖 Job 的页签显示原因而不是空表，不伪造构建成功或日志。
5. 复用 ai-kit/ui 共享控件（ResourceList/Tabs/Modal/DeleteDialog/EditInfoDialog），不新增业务专用公共组件。

## 约束与边界

- 读取使用 `@kube-ai-hub/api-client` 的 `imageBuildersApi`；页面不直接 fetch（B2I 文件上传因 multipart 在 api-client 模块内实现，仍经 BFF 代理与同一 token）。
- 列表端点使用 kapis 资源代理以获得服务端分页/搜索/总数；其余请求使用原生 `/apis/devops.kubesphere.io/v1alpha1`。写入按 kube 语义：创建 POST 集合，更新 PATCH 对象（merge-patch），YAML 编辑 PUT 整对象。
- `cluster` 参与查询键与请求路径（非 host 集群加 `clusters/<id>` 段）；BFF 只代理单一上游的已知限制见交付记录。
- 状态字符串大小写归一后比较；未知值显示「状态未知」/「尚未构建」，未知指标不填 0。
- 环境变量页签的数据源是最近一次运行的 Job 容器，不是构建器配置；两者不可互相冒充。
- 构建成功、Job、日志正文、B2I 上传/下载正文在当前环境阻塞（s2ioperator 权限 / minio 缺失），以如实提示与阻塞登记处理，不缩 AC 通过。
- 三档宽度与中英文截图、主题 token 同批核对。

## UI 交互设计

- 列表：页头标题 + 说明 + 唯一的「创建构建器」主操作；工具栏搜索框与刷新；表格列与行菜单；空态带创建入口；失败态错误面板 + 重试（403 无重试）。
- 创建向导：两步（构建模式/语言 → 构建设置），步进提示；模板/密钥选择用下拉；高级设置可折叠；提交后按钮禁用并显示进行中；失败错误在对话框内保留输入。
- 详情：返回列表链接、标题（显示名/别名）、状态与类型徽章、操作按钮组、属性定义列表、五页签；页签切换只换面板不重新请求。
- 触碰语义：行操作收在「更多操作」菜单；删除与「停止/重新部署」类破坏性动作需输入名称确认；复制动作给出「已复制」反馈。
- 状态句柄：`image-builder:surface`、`image-builder-detail:surface`、行动作与对话框控件均有稳定 `data-ai-id`。
- 三档布局：1600 全列；1280 隐藏创建时间；1024 进一步隐藏类型/所属服务/最近构建（名称/构建器镜像/状态保留）。字段栅格：属性两列，缺失值显示 -，未知不填 0。

## 文案与校验

- 状态：构建中 / 构建成功 / 构建失败 / 尚未构建 / 状态未知。
- 校验：仓库 URL 必填且以 http(s):// 或 git@ 开头；镜像名称按旧 PATTERN_IMAGE_NAME；标签必填；目标镜像服务必填；触发令牌仅字母数字；环境变量名/值必填；分支必填（默认 master）。
- 空态与阻塞：空列表说明从代码或制品创建；无运行/无 Job 说明 s2ioperator 未创建构建任务；无日志地址说明控制器未创建构建任务；B2I 上传失败显示服务端原因。
- 远程触发器 URL 与 s2ioperator 服务地址一致；复制成功提示「已复制」。

## 边界情况

- 项目没有任何构建器：空态 + 创建入口，不显示错误。
- 构建器从未运行：状态「尚未构建」，最近构建时间 -。
- 控制器未汇报运行状态（本环境常态）：运行记录显示「状态未知」；最后构建环境显示 - 与「控制器尚未写入本次构建的来源信息」。
- 无 Job（s2ioperator 无权限）：资源状态/环境变量/事件显示「最近一次运行还没有创建构建任务（Job）」并说明控制器原因。
- 无 logURL：不请求日志，显示「运行尚未产生日志地址」。
- 列表越界页：删除最后一页最后一行时回退一页，避免服务端对越界页返回 500。
- 目标镜像服务缺失：提示先创建 dockerconfigjson 保密字典，表单必填校验阻止提交。
- 仓库可读性检查 500：作为非阻塞提示显示原始原因，可继续创建。
- 权限不足（403）：显示无权限原因，不提供重试；写操作失败保留输入。
- 同名对象已存在（409）：显示错误并保留输入，不静默覆盖。

## 明确不做

- **旧 console 的 `globals.app.getActions` 级细粒度按钮级权限预判**：新 UI 不复制旧前端权限表，写按钮保留、由服务端 RBAC 返回 403 并显示原因；接口级权限仍受控。理由：旧权限表与新 API 授权模型不是一一对应，前端复制会产生假禁用。
- **containerd 运行时警告**：旧创建表单在 runtime=containerd 时提示“容器运行时不支持此功能”；新 console 没有运行时信息来源，且该提示不阻止操作，故不做（不是能力删减，见 design GOT-05）。
- **通过 `/b2i_download` 反向代理下载制品**：旧 console 由自己的 server 提供该代理；新 BFF 只代理 `/api`、`/kapis`、`/apis`。改为解析 `spec.downloadURL` 路径、带 token 经 `/kapis` 取回 Blob 再下载（等价能力，见 design DEC-06）；在当前 minio 缺失环境下下载正文阻塞。
- **构建日志的历史分页（旧 tenant log-search 的 from/size/tailLines 翻页）**：改为直接读取控制器 `status.logURL` 指向的日志端点并展示尾部，构建中轮询；日志正文当前阻塞（无 Job）。
- **旧列表的列过滤高级输入框**：旧列表的 `FilterInput` 只对有 `search: true` 的列生效，而本页所有列都没有该标记，实际不可用（按回车会因没有候选项报错）。新列表改为名称搜索。
- **批量编辑/批量运行**：旧 console 只有批量删除，新实现保持同一范围。

## 假设

- devops 模块已安装且 v1alpha1 的 s2ibuilders/s2iruns/s2ibuilder 模板可读（实测可读）。
- 构建模板决定可用的语言与构建器镜像（实测 5 个模板）。
- 列表读取经 kapis 资源代理，服务端支持 page/limit/name/sortBy/ascending 与 totalItems（实测）。
- 目标镜像服务由项目内 dockerconfigjson 保密字典提供；没有时用户需先在保密字典页创建。
- s2ioperator 在被授权后会创建 Job 并写入 status；页面已按该契约实现并在无 Job 时如实降级。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 列表通过 kapis 资源代理服务端分页/搜索/排序读取 s2ibuilders，列与旧版一致并新增最近构建时间。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02** — 行操作编辑信息（别名/描述）与删除（输入名称确认），支持批量删除。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03** — 两步创建向导（S2I），字段、校验、命名与标签/注解、repoUrl 前缀、创建后触发 S2iRun。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04** — 两步创建向导（B2I），制品上传失败如实报错并清理半成品。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05** — 详情属性、操作、五页签、编辑 YAML、404 回退。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06** — 运行/重新构建表单预填、merge-patch、更新工作负载开关、触发新 S2iRun。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07** — 构建记录：最后构建环境 + 运行记录分页 + 日志/如实提示。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08** — 资源状态：Job 容器端口与 Pod；无 Job 如实提示。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09** — 镜像制品：成功运行的镜像信息与复制拉取命令。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10** — 环境变量：Job 容器 env 解析、分组、敏感值打码。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-11** — 事件：Job 关联事件表格与空态。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12** — 五态分离、403 无重试、稳定句柄、中英文与三档视觉基线。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 列表/创建/编辑信息/删除/运行请求链路真实走通并回读一致，测试对象清理后 0 残留；无 Job/无日志时页面如实说明。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02** — 五页签在无 Job 环境下不伪造数据、不空白，状态/权限/语言/宽度基线通过截图核对。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03** — 规格门禁 `check_docs.py --strict` 对 PRD/design/spec 报 errors=0、warnings=0，TC 与 python 测试一一镜像。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-11`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12`
