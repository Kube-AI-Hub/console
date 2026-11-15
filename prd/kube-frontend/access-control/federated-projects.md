# 联邦项目页族：列表、写入与详情深化（L3）

[子模块需求](./_index.md)

## 概述

联邦项目是多集群作用域的「项目」：一个 FederatedNamespace 对象同时定义命名空间与它要部署到的集群。老 console 在 `/:workspace/federatedprojects` 提供列表（名称/状态/集群/创建时间）、创建联邦项目、编辑信息、添加集群、单条与批量删除，并在 `/:workspace/federatedprojects/:namespace` 提供 22 条详情路由（概览/应用负载/配置/存储/网关等）。

新 UI 已交付只读的列表与详情骨架（名称/命名空间/部署集群/创建时间、基本信息、可联邦类型、已联邦资源页签、资源详情模板与分发）。本功能点把该页族补成完整用户任务：列表支持搜索/排序/分页/刷新、创建联邦项目、编辑信息、调整部署集群、单条与批量删除；详情补传播条件、元数据与事件；联邦资源详情补完整对象 YAML 与事件；写操作按 SSAR 权限门控；中英文齐全。

## 用户故事

### US1 - 查看企业空间里的联邦项目与其部署范围 (Priority: P1)

作为 **企业空间管理员**，我希望 **在企业空间里看到联邦项目列表，并点进任一项目确认它部署在哪些集群、传播是否正常、项目内已联邦了哪些对象**，以便 **在联邦控制面之外有一个可核对的入口，而不是只能靠 kubectl**。

**Independent Test**：打开企业空间的联邦项目页，核对列表行数与联邦 API 一致；点进一行，核对基本信息、资源类型列表与三个资源页签；再点开一个联邦资源，核对模板、完整对象与分发信息。

### US2 - 创建、编辑与删除联邦项目 (Priority: P1)

作为 **企业空间管理员**，我希望 **在列表页直接创建联邦项目（名称/别名/描述/放置集群）、编辑别名与描述、调整部署集群、删除单个或批量删除**，以便 **不必切到联邦控制面命令行就能完成多集群项目的日常维护**。

**Independent Test**：用唯一名称创建联邦项目，确认列表出现该行且详情显示所选集群与传播状态；编辑别名后回读生效；调整部署集群后回读新集合；分别在列表行与批量选择中删除，确认确认框、行消失与命名空间清理。

### US3 - 深入一个联邦项目的对象状态 (Priority: P2)

作为 **企业空间管理员**，当联邦项目没有按预期传播时，我希望 **看到控制面回报的传播条件、对象的标签与注解、以及与该对象相关的事件，并能下钻到每个联邦资源的完整对象 YAML 与事件**，以便 **判断是放置没生效、控制面拒绝还是同步失败**。

**Independent Test**：打开一个联邦项目详情，核对传播条件表与元数据页签；打开事件页签核对事件列；进入一个联邦资源详情，核对完整对象 YAML 与事件页签；对被删除的对象核对未找到说明。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 已知企业空间内存在至少一个 FederatedNamespace，当打开 `/kube-frontend/workspaces/<ws>/federatedprojects`，则列表显示这些项目（名称、命名空间、部署集群、创建时间），行数与该企业空间的 FederatedNamespace 数一致；当点击名称，则进入详情骨架，显示名称、命名空间、企业空间、部署集群、传播状态、创建时间、创建者，以及一份「已联邦资源类型」只读列表（来自联邦 API discovery 的命名空间级 Federated 类型）；已知企业空间没有联邦项目，则列表显示「暂无联邦项目」空态说明；已知对象不存在或读取失败，则详情页分别显示明确的未找到/失败说明，而不是空白页。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03** — 已知联邦项目的资源页签里存在至少一个已联邦对象（或直接访问该对象的详情 URL），当点击资源行名称，则进入该对象的只读详情：显示对象名称、命名空间与类型徽标，「模板」区块以 YAML 展示 `spec.template`，「分发」区块以集群徽标与条件表展示 `status.clusters` / `status.conditions`；已知对象不存在（404），则显示明确的未找到说明；已知对象还没有分发状态，则「分发」区块显示明确说明而不是空表；已知资源类型段未知，则显示未知类型说明。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02** — 已知联邦项目详情可用，当打开它，则页签为「概览 / 应用负载 / 配置 / 存储」且默认在概览（保留基本信息与资源类型列表）；当分别打开「应用负载 / 配置 / 存储」，则每个页签列出该项目命名空间下对应 Federated 类型对象（名称、类型、创建时间），行数等于这些集合的 API 条数之和；已知某页签对应的集合都没有对象，则该页签显示明确的空态说明；已知某集合读取失败，则该页签显示失败说明与重试，不显示空表。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04** — 已知当前账号被允许创建联邦项目，当打开列表页，则「创建联邦项目」可用；当提交空名称、大写/非法名称、超过 63 字符的名称或未选任何集群，则在对话框内显示对应的校验说明且不发出创建请求；当名称与企业空间中已存在的命名空间同名，则提示名称已存在且不创建；当填写合法名称、别名、描述并选择集群后提交，则先创建带 `kubesphere.io/workspace` 与 `kubefed.io/managed=true` 标签的命名空间，再在该命名空间创建 FederatedNamespace（`spec.placement.clusters` 为所选集群、模板只带标签、别名/描述通过 `spec.overrides` 传播），成功后对话框关闭、列表刷新并出现新行，详情显示该行；已知第二步写入失败，则删除刚创建的命名空间并保留对话框内的输入与失败说明；已知当前账号被明确拒绝创建，则「创建联邦项目」禁用并在旁显示原因。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05** — 已知存在一个联邦项目，当在行操作中打开「编辑信息」并修改别名与描述后保存，则对象 `metadata.annotations` 的 `kubesphere.io/alias-name` / `kubesphere.io/description` 被更新，且各放置集群的 `/metadata/annotations` override 同步更新，详情与列表回读为新值，其它注解与 `spec.placement` 不变；当打开「调整部署集群」并增删集群后保存，则 `spec.placement.clusters` 与 override 列表替换为新集合，详情回读一致；已知移除某个集群，则在确认前显示「移除会删除该集群上的命名空间」的警告；已知当前账号被明确拒绝修改，则对应入口提示无权限且不打开对话框。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06** — 已知存在至少一个联邦项目，当在行操作中删除并输入项目名称确认，则发出命名空间删除请求，成功后列表刷新且该行消失（命名空间 finalizer 完成前可显示为删除中），其它行不受影响；当勾选多行后执行批量删除，则确认框要求输入数量，成功删除所选全部项目，失败时对话框保持打开并显示失败原因，已成功删除的对象不回滚、列表刷新为实际剩余集合；已知当前账号被明确拒绝删除，则操作在打开确认框前提示无权限。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07** — 已知一个联邦项目详情可用，当打开「概览」，则显示名称、别名、描述、命名空间、企业空间、部署集群、传播状态、创建时间、创建者，以及控制面回报的传播条件表（条件/状态/原因/消息/最近变更，无回报时显示明确说明）；当打开「元数据」页签，则分别列出对象标签、对象注解与模板标签（无条目的分组显示明确说明）；当打开「事件」页签，则列出该项目对象的事件（级别/原因/消息/次数/最近发生/来源），无事件与读取失败分别显示对应说明并可重试；已知详情头部，则「编辑信息 / 调整部署集群 / 删除」三个入口存在且各自打开对应确认或表单。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08** — 已知存在一个已联邦对象，当打开其详情，则「模板与分发」页签显示 `spec.template` 的 YAML、完整对象 YAML、分发集群与条件表；当打开「事件」页签，则列出以该 Federated 对象为 involved object 的事件（列与项目事件一致），无事件与读取失败分别显示对应说明并可重试；已知对象不存在或资源类型段未知，则分别显示未找到与未知类型说明，且不显示 YAML 或事件表。

## 设计目标

- 功能等价：列表列、行操作顺序（编辑信息 / 调整部署集群 / 删除）、创建流程（名称+别名+描述+集群）、单条与批量删除、详情下钻与联邦资源详情都对应老 console 的能力；「添加集群」升级为「调整部署集群」，并写进决策与被否方案。
- 数据以联邦 API（types.kubefed.io/v1beta1）为准，不依赖 tenant 代理的联邦项目集合（实测该集合返回 0，原因见 design）。
- 写路径可回读、失败可恢复：创建是命名空间 + FederatedNamespace 两步且失败回滚；编辑只改需要改的字段；删除以命名空间为准并说明 finalizer 期间的状态。
- 空态、未找到、失败、无权限、删除中五种结果分开；未知值显示 `-`，不填 0。
- 视觉与数据同批：使用 ai-kit 现有表格/弹窗/表单/徽标组件与语义 token，1024/1280/1600 三档与中英文纳入验收。

## 约束与边界

- 作用域：企业空间（`/kube-frontend/workspaces/<ws>/federatedprojects`），不是普通项目作用域。
- 列表按 FederatedNamespace 的 template 标签 `kubesphere.io/workspace` 过滤到当前企业空间；对象自身标签优先回退，二者都无则不属于任何企业空间、不显示。
- 联邦 API 的 federatednamespaces 集合是普通 Kubernetes 列表，没有 KubeSphere 的 page/sort/total 契约；列表分页、排序与搜索在前端对完整集合执行，总数取过滤后的行数（见 design 决策）。
- 详情只展示命名空间级 Federated 资源类型（discovery 中 namespaced=true，共 13 类）；资源页签按老 console 的三组切分。
- 创建：名称同时作为命名空间名；命名空间经 tenant 写路径创建并带 `kubefed.io/managed=true`（否则控制面无法接管、传播恒为 False，见 design 证据）；别名/描述只写对象注解与 overrides，不写模板注解（控制面拒绝 FederatedNamespace 的模板注解）。
- 删除：删除项目的命名空间，由级联删除 FederatedNamespace 并触发 finalizer 清理各集群副本；只删 FederatedNamespace 会遗留不受控的命名空间。
- 权限：页面不假设自己知道角色；写入口用 SelfSubjectAccessReview 对相同 verb/resource/namespace 询问，仅在明确拒绝时禁用（探测失败不阻塞，由服务端错误兜底）。
- 与普通项目页的边界：联邦项目的宿主命名空间是普通命名空间对象；本页不承担普通项目页的列表/配额/成员管理。

## UI 交互设计

页面地图：企业空间 › 联邦项目（列表）→ 联邦项目详情（六页签）→ 联邦资源详情（两页签）。

列表：标题/说明；工具行从左到右为搜索框（名称/别名/描述）、刷新、批量删除（选中后可用）、创建联邦项目（主操作，无权限时禁用并显示原因）。五列：名称（链接，别名作为副行）、命名空间、部署集群（徽标）、传播状态（已传播/未就绪/未回报）、创建时间（窄屏按断点隐藏）。行操作下拉：编辑信息、调整部署集群、删除（删除中对象不提供删除）。空态分两种：没有项目（「暂无联邦项目」+ 说明）与搜索无匹配（「没有匹配的联邦项目」+ 清空搜索出口）。失败态为错误面板 + 重试；403 不提供重试。

创建对话框：名称（必填、DNS 标签规则、≤63）、别名、描述、企业空间（当前企业空间，只读）、部署集群（多选，默认主集群，未就绪集群不可新增）。校验在提交时进行，错误显示在字段下方；服务端错误显示在对话框底部且保留输入。

详情：返回链接 + 标题（别名优先）+ 三个写入口；页签为「概览 / 应用负载 / 配置 / 存储 / 元数据 / 事件」。概览为基本信息、传播条件、已联邦资源类型三块；元数据为对象标签/对象注解/模板标签三块；事件为事件表；资源页签沿用独立加载/空态/失败+重试。

联邦资源详情：返回链接 + 名称/类型徽标/命名空间；页签「模板与分发 / 事件」。模板与分发包含模板 YAML、完整对象 YAML、分发集群与条件表；事件页签为事件表。

- 列表句柄：`federated-projects:surface`、`federated-projects:create`、`federated-projects:search`、`federated-projects:refresh`、`federated-projects:bulk-delete`、`federated-projects:edit`、`federated-projects:placement`、`federated-projects:delete`、`federated-projects:delete-confirm`、`federated-projects:permission-denied`、行 `data-ai-row=<名称>`、名称链接 `federated-projects:open:<名称>`。
- 创建/放置对话框句柄：`federated-projects:create-name/-alias/-description/-workspace/-clusters/-create-submit/-create-error`；`federated-projects:placement-clusters/-placement-submit/-placement-removal/-placement-error`。
- 详情句柄：`federated-project:surface`、`:basic`、`:conditions`、`:conditions:empty`、`:types`、`:types:empty`、`:types:error`、`:not-found`、`:back`、`:edit-info`、`:edit-placement`、`:delete`、`:permission-denied`；页签面板 `federated-project:tab:{overview|workloads|config|storage|metadata|events}`（触发器加 `:trigger`）；元数据 `:metadata:{labels|annotations|template-labels}`；事件 `:events`、`:events:empty`、`:events:error`、`:events:retry`。
- 联邦资源详情句柄：`federated-resource:surface`、`:title`、`:kind`、`:template`、`:template:empty`、`:object:yaml`、`:distribution`、`:distribution:empty`、`:not-found`、`:back`、`:retry`；页签 `federated-resource:tab:{definition|events}`；事件 `:events`、`:events:empty`、`:events:error`、`:events:retry`。
- 断点：1024 隐藏创建时间列、显示四列；1280 显示五列；1600 同 1280 但内容区更宽。深色主题使用 ai-kit 语义 token，无十六进制色值。

## 文案与校验

- 列表列：名称、命名空间、部署集群、传播状态、创建时间；空态：暂无联邦项目 / 该企业空间还没有联邦项目（FederatedNamespace）。
- 创建字段与校验：名称（必填；小写字母、数字与内部连字符；≤63；同名命名空间已存在）、别名（可空；中文/字母/数字/内部连字符；≤63）、描述（≤256）、企业空间（只读）、部署集群（≥1）。
- 编辑信息：名称只读；别名与描述规则同创建。
- 调整部署集群：至少一个；移除集群前提示「移除会删除该集群上的命名空间」。
- 删除：单条输入项目名称确认；批量输入数量确认；失败原因保留在对话框内。
- 无权限：创建按钮旁显示「当前账号没有创建联邦项目的权限」；行操作在打开前提示无权限原因。
- 传播状态：已传播 / 未就绪；控制面未回报显示 `-` 与「控制面可能尚未处理」说明。
- 未知值（创建者、别名、描述、集群为空）显示 `-`，不显示 0 或空字符串。

## 边界情况

- 企业空间没有联邦项目：列表空态，不显示空表。
- 搜索无匹配：独立空态与「清空搜索与筛选」出口。
- 联邦 API 不可读：列表/详情错误面板 + 重试；403 只说明原因不提供重试。
- 名称在路由里但对象已被删除：详情显示「该联邦项目不存在或已被删除」。
- 对象没有 Propagation 条件：传播状态显示 `-`，概览传播条件表显示「控制面还没有回报传播条件」。
- `status.clusters` 缺失：回退 `spec.placement.clusters`；明确回报为空时显示 `-`，不用放置猜测。
- 对象正在删除（deletionTimestamp 非空）：行不可勾选、不提供删除；列表保留直到对象消失。
- 创建第二步失败：回滚命名空间，保留对话框输入与服务端错误。
- 批量删除部分失败：成功的对象删除、失败原因显示在对话框；列表刷新为实际剩余集合。
- 企业空间别名读取失败：企业空间字段回退为标签里的原始名称。
- 事件集合为空与读取失败分开；空事件不显示空表。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 企业空间级联邦项目列表：五列、按企业空间过滤、搜索、排序、分页、刷新、空态明确。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02** — 详情概览：基本信息 + 已联邦资源类型只读列表。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03** — 空态、未找到、读取失败三类结果都有明确说明。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04** — 详情提供 概览 / 应用负载 / 配置 / 存储 四个页签；后三者只读列出项目命名空间下对应 Federated 类型对象（名称/类型/创建时间）。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05** — 每个资源页签独立处理加载、空态与失败+重试。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06** — 资源行名称链接到只读的联邦资源详情（名称/命名空间/类型徽标 + 模板 YAML + 分发状态）。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07** — 联邦资源详情明确区分 未找到（404）、未知类型、无分发状态与读取失败。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08** — 列表提供创建联邦项目：名称/别名/描述/企业空间/部署集群，提交前校验，两步写入，失败回滚与输入保留。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-09** — 行操作提供编辑信息与调整部署集群：注解与 override、placement 与 override 同步更新，成功回读。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-10** — 单条与批量删除：名称/数量确认、失败原因保留、删除后列表刷新。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-11** — 写入口按 SSAR 门控：创建禁用并说明原因，行操作在打开前提示无权限；探测失败不阻塞。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-12** — 详情补传播条件表、元数据页签（对象标签/注解/模板标签）与项目事件页签。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-13** — 联邦资源详情补完整对象 YAML 与事件页签，列与空/失败态明确。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-14** — 中英文文案键集合一致，所有新增句柄使用 `data-ai-id`。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 列表行数与联邦 API 的 FederatedNamespace 数一致，首屏 2 秒内就绪；搜索与分页在前端对完整集合执行且总数与过滤结果一致。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02** — 从列表到详情一次点击可达，基本信息与对象一致。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04** — 创建成功后 500ms 内列表出现新行，详情放置集群与选择一致，传播状态在控制面回报后变为已传播或明确显示未就绪。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05** — 编辑/放置保存后回读值与提交值一致，未修改的字段与注解保持原值。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06** — 删除请求发出后行在 2 分钟内消失（受 finalizer 影响），失败的批量删除在对话框内给出可读原因。

## 明确不做

- 不做联邦对象的编辑/创建/删除（联邦资源详情仍只读；对齐老 console 只在联邦控制面维护）：本功能点只深化只读信息与事件。
- 不做资源页签内的搜索、过滤、分页（保持按类型集合读取）。
- 不做企业空间切换器之外的跨空间联邦项目列表；列表只显示当前路由企业空间。
- 不做联邦集群注册/成员集群管理（集群页族承接）。
- 不做「添加集群」的逐集群覆盖（overrides）编辑界面；调整部署集群只改放置集合，overrides 仅同步注解。
- 不做容器组/控制面等 22 条老详情路由中的网关、日志收集、配额、成员等页签（各自页族承接；本页只做项目概览、三类资源、元数据与事件）。
- 不做批量删除的单个失败重试按钮：失败原因保留在确认框，列表刷新后由读者再次选择。

## 假设

- FederatedNamespace 的 workspace 归属写在 `spec.template.metadata.labels['kubesphere.io/workspace']`；本页创建的对象同时在对象标签写一份，以便租户集合未来改用对象标签。
- 联邦 API discovery 的 namespaced 资源就是项目内可联邦的资源类型。
- 控制面拒绝模板注解（AnnotationsNotSupported）、只有 `kubefed.io/managed=true` 的宿主命名空间才能被接管（Propagation=True）——两项均由本环境实测，见 design 证据。
- 删除项目的命名空间会级联删除 FederatedNamespace，并由 finalizer 清理各集群副本；单集群环境只能验证 host 上的副本清理。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08
