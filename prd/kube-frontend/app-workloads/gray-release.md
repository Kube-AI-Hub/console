# 灰度发布列表与详情（L3）

[子模块需求](./_index.md)

## 概述

项目控制台的「灰度发布」页把 servicemesh `Strategy` 自定义资源作为一条完整的用户任务来交付：列表 → 创建（含初始流量）→ 详情（版本与权重、匹配规则、状态条件）→ 调整流量 / 暂停 / 恢复 → 删除。

老 console 在同一作用域提供两个子页（发布模式分类页、发布任务卡片列表）和一个全屏详情弹窗：卡片显示新/旧版本的副本数与请求量、成功率、延迟图表，弹窗里能拖动流量比例、查看按请求内容匹配的规则、接管/恢复版本、编辑新版本容器并删除。本轮把其中**发布对象本身**的能力闭环：列表、创建、详情（版本、权重、匹配规则、条件）、流量编辑、暂停/恢复、删除；监控曲线与新版本工作负载的容器编辑按「明确不做 / 等价承接」逐项登记。

对象没有 `phase`，控制器把结果写入 `status.conditions`（`Complete` / `Failed`）。本安装未部署 servicemesh 策略控制器，因此真实对象的状态长期停在「未知」；派生规则本身用测试写入的条件做正分支验收，控制器缺失登记为阻塞，不写成「不做」。

## 用户故事

### US1 - 看到项目里有哪些灰度发布、各自分流到哪些版本 (Priority: P1)

作为 **项目运维**，我希望 **在项目内一页看到所有灰度发布策略的名称、类型、目标服务、版本与分流状态**，以便 **不进入命令行就能判断某个发布是否存在、在哪些版本之间分流、控制器是否完成**。

**Independent Test**：项目内存在一个 Canary 策略（v1/v2 两个版本、带权重）时，打开灰度发布页，列表出现该行且列头为名称/类型/目标服务/版本/状态/创建时间；类型显示为「金丝雀发布」、版本列显示两个版本与权重；项目内没有策略时页面显示明确空态。

### US2 - 不用写 YAML 就能起一个灰度发布并指定初始流量 (Priority: P1)

作为 **项目运维**，我希望 **在列表上填写名称、选一个 Deployment、选择发布类型并给出初始流量比例，确认后创建 Strategy**，以便 **创建出的策略一开始就按我指定的比例分流，而不是先创建再改一次**。

**Independent Test**：点「创建灰度发布」，填名称、选项目内 Deployment、类型 Canary、初始流量 25，下一步确认后创建；API 回读到两版本权重 75/25、`spec.governor` 为空，列表刷新出现该行。

### US3 - 看清一个发布的两个版本、权重、匹配规则与控制器条件 (Priority: P1)

作为 **项目运维**，我希望 **打开一个灰度发布的详情，看到基本信息、每个版本的角色/权重/副本数与对应工作负载、请求内容匹配规则，以及控制器写入的条件**，以便 **判断流量现在怎么分、某个版本是否在线、请求是按权重还是按内容路由、控制器为什么还没完成**。

**Independent Test**：打开一个按流量分流的 Canary 详情，版本区块显示 v2（新版本，20%）与 v1（参考版本，80%），对应工作负载的副本数为真实值（0 显示 0，缺失显示「未找到对应工作负载」）；匹配规则区块说明没有内容匹配规则；条件区块在控制器未写入时显示「控制器尚未写入条件」及原因。

### US4 - 调整流量比例，并能暂停/恢复一次发布 (Priority: P1)

作为 **项目运维**，我希望 **在详情里把新版本流量调到指定比例、把某个版本接管为 100%，并在需要时暂停发布（流量全部回到参考版本）后再恢复原来的比例**，以便 **按发布节奏逐步放量、出问题时立刻回退且不丢失原配置**。

**Independent Test**：在流量 20% 的 Canary 详情里调整到 35，保存后 API 回读权重为 65/35 且 `spec.governor` 为空；点「暂停发布」后回读 `spec.governor` 等于参考版本且权重不变；点「恢复发布」后 `spec.governor` 为空、权重仍是 65/35。

### US5 - 删除不再需要的灰度发布 (Priority: P1)

作为 **项目运维**，我希望 **在详情里删除一个灰度发布，并且删除前必须输入策略名确认**，以便 **不会因为一次误点丢掉正在分流中的策略**。

**Independent Test**：在详情点「删除」，输入策略名后确认；API 回读 404，页面回到列表且该行消失；取消时对象不变；删除失败时确认框内显示原因且不关闭。

### US6 - 没有写权限时不被给出无效入口 (Priority: P2)

作为 **受限项目成员**，我希望 **没有创建/删除灰度发布权限时，创建按钮禁用并说明原因、删除入口不出现**，以便 **不会点开一个必然失败的写操作**。

**Independent Test**：拦截权限检查返回 `allowed=false` 时，列表创建按钮禁用并显示原因、详情删除入口不出现；权限检查失败时保持可用（fail-open），不因为一次检查错误拿走已有权限。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01** — 已知项目内没有灰度发布策略，当打开灰度发布页，则页面进入空态并说明创建后会列在这里；已知项目内存在一个 v1/v2 两版本带权重的 Canary 策略，当打开同一页面，则出现列头「名称 / 类型 / 目标服务 / 版本 / 状态 / 创建时间」，该行显示类型「金丝雀发布」、目标服务取自 `spec.template.spec.hosts[0]`、版本列按新版本在前显示两个版本及其权重、状态属于已完成/进行中/失败/未知之一；名称是指向该发布详情的链接；读取失败时页面给出重试入口。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02** — 已知项目内有至少一个 Deployment，当在灰度发布页点「创建灰度发布」，填写合法名称、选择该 Deployment、类型 Canary 与初始流量 25 并点「下一步」，则在点「确认创建」之前不产生任何写请求；确认后项目命名空间下出现对应 `Strategy`，其 `spec.type`、`spec.selector.matchLabels.app`、`spec.template.spec.hosts[0]` 与所选 Deployment 一致，两条路由权重为 75/25 且 `spec.governor` 为空；类型 Bluegreen 创建出 100/0 权重且 governor 为参考版本，Mirror 创建出参考版本 100% 加 `mirror` 到新版本；列表刷新后出现该行（状态为进行中/未知之一）；创建失败（名称冲突/权限/非法字段）时确认弹窗内显示服务端原因且不关闭；用例 finally 删除该对象。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03** — 已知存在一个 v1（参考版本）/v2（新版本）按权重分流的 Canary 策略，当打开 `…/grayrelease/<name>` 详情，则基本信息区块按固定顺序显示集群、项目、分流方式、目标服务、参考版本、接管版本（未接管时显示「未接管（按规则分配）」）、策略与创建时间；版本与流量区块每个版本一张卡片，显示版本号、角色徽章、权重百分比（对象未设置权重时显示「未设置（Istio 默认均分）」而不是 0%）、接管徽章（仅 `spec.governor` 命中的版本），并按 `<目标服务>-<版本>` 或对象注解找到对应 Deployment 时显示「副本 ready/total」与工作负载链接，找不到时显示「未找到对应工作负载」而不是 0/0；匹配规则区块在没有内容匹配时明确说明按权重分流；区块顺序为基本信息 → 版本与流量 → 匹配规则 → 状态条件，1024/1280/1600 三档不横向溢出。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04** — 已知一个按请求内容分流的 Canary 策略（cookie/URL/请求头/客户端操作系统匹配），当打开详情，则匹配规则表逐条显示规则序号、匹配项与键名、匹配方式（精确/前缀/正则）、匹配值与目标版本；未建模的匹配类型（如 method）也以「其他」行出现而不是被丢弃；已知策略的 `status.conditions` 含 `Complete=True`（或 `Failed=True`）时条件表显示类型/结果/原因/消息/最近变更且列表状态徽标为「已完成」（或「失败」），无条件时条件区块显示「控制器尚未写入条件」及控制器未部署/未上报的说明、状态徽标为「未知」；条件为空不得显示为失败或已完成。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05** — 已知一个按权重分流的 Canary 详情（新版本 20%），当点「调整流量」把新版本比例改为 35 并确认，则 API 回读两条路由权重为 65/35 且 `spec.governor` 为空、页面提示已更新且版本卡片权重变为 35%；改为 100 时回读 `spec.governor` 等于新版本、改为 0 时等于参考版本；按内容分流的 Canary 打开同一入口时提供「保持按匹配规则分流 / 新版本接管 / 参考版本接管」三个选项并写回 `spec.governor`；Bluegreen 打开时提供两版本单选，选新版本后回读权重 0/100 且 governor 为新版本；Mirror 不提供调整流量入口；非 0–100 整数被就地拒绝且不产生写请求；保存失败时弹窗保留输入并显示服务端原因。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06** — 已知一个按权重分流的 Canary 详情（权重 65/35、`spec.governor` 为空），当点「暂停发布」，则回读 `spec.governor` 等于参考版本且两条权重仍为 65/35、按钮变为「恢复发布」并显示已暂停说明；当再点「恢复发布」，则回读 `spec.governor` 为空、权重仍为 65/35 且按钮变回「暂停发布」；按内容分流的 Canary 同样支持暂停/恢复，恢复后匹配规则不变。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07** — 已知一个灰度发布详情，当点「删除」，则出现要求输入策略名的确认框，输入不匹配时确认按钮不可用；输入策略名确认后 API 回读 404、列表不再包含该行、页面回到灰度发布列表；取消后对象仍存在；删除失败（权限/服务端错误）时确认框不关闭并显示服务端原因。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08** — 已知当前身份对 strategies 有 create/delete 权限，则列表创建入口与详情删除入口可见可用，且页面发出对 `servicemesh.kubesphere.io` 组 `strategies` 资源的权限检查（ks-apiserver IAM，以请求用户求值；旧后端回退 `SelfSubjectAccessReview`；create/delete）；当权限检查明确返回 `allowed=false` 时，创建按钮禁用并显示「没有创建灰度发布的权限」、删除入口不渲染；当权限检查失败或未返回时保持可用（fail-open），不因检查失败禁用写入口。

## 设计目标

1. **一条任务一个 URL**：详情是独立路由，可分享、可刷新、可返回列表；不再用全屏弹窗承载详情。
2. **两个版本的权重是首要事实**：版本卡片把角色、权重、接管状态、副本数放在一处；未设置权重与真实 0 分开表达。
3. **匹配规则按对象原样展开**：cookie/请求头/URL/客户端操作系统逐条显示，未建模的匹配类型也保留，不把「有内容匹配」显示成「没有」。
4. **状态诚实**：条件缺失是「未知」并有解释，不伪装成失败或完成；条件存在时展示全部字段。
5. **写入可回读**：流量、接管、暂停/恢复、删除都通过整对象 PUT/DELETE 写入并重新读取校验；`governor` 与权重的一致性由单一函数保证。

## 约束与边界

- 作用域：项目级，路由 `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/grayrelease`（列表）与 `…/grayrelease/:name`（详情）。
- 数据源：`/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies`；该组只服务 v1alpha2（`/apis/servicemesh.kubesphere.io` 的 versions 只有 v1alpha2，实测 2026-11-15）。原生端点返回完整对象（含 `status`），列表与详情都用它。
- 写：创建走 POST 集合；流量/接管/暂停恢复走 PUT 对象（整对象 + `resourceVersion`）；删除走 DELETE 对象。CRD 没有 status 子资源、嵌套 VirtualService 字段没有 merge key，因此写必须是整对象替换。
- 版本副本数与工作负载链接来自同命名空间的 Deployment 列表（`/apis/apps/v1/namespaces/<ns>/deployments`）；名称优先取 `servicemesh.kubesphere.io/oldWorkloadName` / `newWorkloadName` 注解，否则按 `<host>-<version>` 约定匹配。
- 列：名称（别名优先）、类型、目标服务、版本（新版本在前 + 权重）、状态、创建时间；支持按名称/创建时间排序，按名称/目标服务/版本搜索（客户端过滤，策略数量少）。
- 状态映射：`Failed=True` → 失败；`Complete=True` → 已完成；有其它 condition → 进行中；有 `completionTime` 无 condition → 已完成；无 condition → 未知。
- 权限：create/delete 用 ks-apiserver IAM 权限检查（group `servicemesh.kubesphere.io`，resource `strategies`；旧后端回退 `SelfSubjectAccessReview`）；只有明确 `allowed=false` 才禁用/隐藏，检查失败按可用处理。
- 未验收边界：成员集群路径未验证；受限账号的真实 403 未验收（本环境只有 admin）；servicemesh 控制器未部署。

## UI 交互设计

- 列表：页面外壳 `data-ai-id="grayrelease:surface"`，四态 `loading/ready/empty/error`；搜索框 `grayrelease:search`；行 `data-ai-row=<名称>`；名称链接 `grayrelease:open:<名称>` 进入详情；主操作 `grayrelease:create`；创建成功提示 `grayrelease:created`；读取失败面板带 `grayrelease:retry`。
- 详情：外壳 `grayrelease-detail:surface`；返回链接 `grayrelease-detail:back`；头部为名称 + 类型徽章 + 状态徽章（条件消息作为 title）+ 操作区（调整流量 / 暂停|恢复 / 删除）；写操作成功的提示 `grayrelease-detail:notice`。
- 详情区块顺序固定：基本信息（`grayrelease-detail:attributes`）→ 版本与流量（`grayrelease-detail:versions`，每个版本 `data-ai-row=<版本>`，工作负载链接 `grayrelease-detail:workload:<名称>`）→ 匹配规则（`grayrelease-detail:match-rules`，为空时 `grayrelease-detail:match-rules-empty`）→ 状态条件（`grayrelease-detail:conditions`，为空时 `grayrelease-detail:conditions-empty`）。
- 字段栅格：基本信息为 `dt/dd` 两列，窄屏一列；版本卡片单列，≥lg 两列；匹配规则与条件为可横向滚动的表格。
- 调整流量弹窗 `grayrelease-traffic:dialog`：按权重模式为滑块 `grayrelease-traffic:slider` + 数字输入 `grayrelease-traffic:weight` + 摘要 `grayrelease-traffic:summary`；按内容模式为三个选项按钮 `grayrelease-traffic:mode:rules|new:<版本>|old`；蓝绿为两版本选项 `grayrelease-traffic:version:<版本>`；确认 `grayrelease-traffic:submit`、取消 `grayrelease-traffic:cancel`、错误 `grayrelease-traffic:error`。
- 删除复用共享的输入名称确认框（`grayrelease:delete-confirm` 由共享组件生成），确认后回到列表。
- 视觉：只使用 ai-kit 语义 token（`border-ai-line`、`bg-ai-surface-2`、`text-ai-fg-secondary` 等），不写十六进制色值；区块标题层级一致；状态徽章使用统一 tone 映射；1024/1280/1600 三档与中英文均需人工核对。

## 文案与校验

| key | 中文 | 英文 |
| --- | --- | --- |
| `grayRelease.title` | 灰度发布 | Canary Releases |
| `grayRelease.description` | 查看并创建项目内的金丝雀发布、蓝绿部署与流量镜像策略 | Browse and create canary, blue-green and traffic-mirroring strategies |
| `grayRelease.column.name/type/targetService/versions/status/createdAt` | 名称/类型/目标服务/版本/状态/创建时间 | Name/Type/Target service/Versions/Status/Created |
| `grayRelease.detail.*` | 基本信息、版本与流量、匹配规则、状态条件等 | Basic information, versions and traffic, match rules, conditions |
| `grayRelease.action.editTraffic/pause/resume/delete` | 调整流量/暂停发布/恢复发布/删除 | Adjust traffic/Pause release/Resume release/Delete |
| `grayRelease.traffic.*` | 调整流量弹窗文案与校验 | Traffic dialog copy and validation |
| `grayRelease.permission.createDenied/deleteDenied` | 没有创建/删除灰度发布的权限 | You may not create/delete canary releases here |

校验：

- 名称须是 DNS-1123 label（小写字母、数字、点、连字符），空或非法时下一步前就地拒绝。
- 初始流量与调整流量须为 0–100 的整数；非法输入就地提示并且不产生写请求。
- 删除确认框必须输入完整策略名（共享组件的既有规则），输入不匹配时确认按钮不可用。

## 边界情况

- 项目内 0 个策略：空态，不显示表格与列头。
- strategies 接口 404/未启用：错误态 + 重试，不伪装成空态（空态会让人以为没有发布）。
- 策略缺少 `spec.type`：类型列原样显示 `unknown`；缺少 template/hosts：目标服务回退到 selector 的 app 标签与模板名，仍无则显示「-」。
- 策略只有一条无权重路由：版本列显示该版本、权重位置留空；详情权重显示「未设置（Istio 默认均分）」，流量编辑器初始值取 50（与老 console 一致），不把未设置当成 0%。
- 策略的 `status.conditions` 为空：状态「未知」，条件区块给出原因说明；不使用失败色。
- 版本对应 Deployment 不存在（手工创建的策略）：显示「未找到对应工作负载」并给出约定名称，不显示 0/0，不生成死链。
- Deployment 存在但副本为 0：显示 0/0 或 0/N 的真实零值，与「未找到」不同。
- 内容分流策略（两条 http 规则，其中一条带 match）：流量编辑器不提供按权重调整，改为接管/保持规则三选一；只改第一条权重会破坏匹配语义。
- Mirror 策略：不提供调整流量入口（镜像不改变接收流量的版本）。
- 删除时对象已被他人删除（404）：按删除成功处理并回到列表，不报「删除失败」。
- 名称冲突/权限不足/非法字段：创建或保存失败在弹窗内显示服务端原因，弹窗不关闭、输入保留。
- 策略刚创建、控制器还没写 condition：状态「未知」，不是失败。
- 策略数量很多：列表一次读取全部并在客户端搜索排序（控制器每项目写入数量有限）。

## 明确不做

- **不迁移发布任务的监控曲线**：老 console 卡片与详情里的请求量（RPS）、成功率（%）、延迟（ms）、TCP 收发（B/s）图表需要 servicemesh 工作负载指标。本环境 `/kapis/servicemesh.kubesphere.io/v1alpha2/.../workloads/<name>/metrics` 返回 `{"error":"unsupported query parameter 'namespaces'"}`、`klusters` 变体 404，且没有 servicemesh 控制器写工作负载状态；把它登记为待补/阻塞（见交付记录），不由本单元实现，也不假装用别的指标替代。
- **不代建新版本工作负载**：老 console 创建时会同时 POST 一个新版本的 Deployment 并在弹窗里编辑容器、副本数。新 UI 的创建向导选择**已存在**的 Deployment 作为发布目标；版本对应的工作负载由工作负载页维护，详情页提供到工作负载详情的链接（等价承接老 console 卡片到工作负载的跳转与副本数展示）。容器编辑归工作负载详情「编辑设置」，不在本页复制第二套。
- **不提供容器组逐 Pod 列表与单 Pod 监控**：老 console 详情里每个版本展开 Pod 列表并显示 CPU/内存/GPU 使用量；新 UI 由工作负载详情的容器组与监控页承接（详情页提供入口），不在灰度页重复实现。
- **不做集群级跨项目灰度发布列表**：作用域是项目控制台。
- **不级联删除版本工作负载**：删除只删 Strategy。理由见设计决策；老 console 在接管/镜像场景会删掉自己创建的版本工作负载，新 UI 无法区分「它创建的」与「用户自己的」，误删用户的 Deployment 风险更高。
- **不做流量比例历史/回滚**：没有历史记录接口。
- **不做实时刷新（watch）**：对象由控制器少量写入，刷新按钮 + 窗口聚焦重取已足够。

## 假设

- 集群已启用 servicemesh，且当前账号对 `strategies` 有读权限；创建/删除权限由 SSAR 如实判断。
- 策略的目标服务与版本通过 `spec.template.spec.hosts`、`principal`、路由 `destination.subset` 表达；控制器按 Istio VirtualService 语义应用权重与 governor。
- 版本对应 Deployment 的命名遵循 `<host>-<version>` 或由控制器写入注解；不满足时不显示副本数而非猜测。
- `status.conditions` 由控制器写入；本安装没有该控制器，因此真实对象状态为「未知」，条件派生用测试写入的对象验收（写入路径与字段见 design 契约）。
- 项目内策略数量足够小，客户端搜索与排序可接受。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：列表必须展示名称、类型、目标服务、版本与权重、派生状态、创建时间，名称链接到详情，并在无数据时给出空态、读取失败时给出重试。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02**：创建向导必须采集名称、目标 Deployment、类型与初始流量，下一步确认后才 POST；按类型生成 Canary（权重可调）、Bluegreen（100/0 + governor）、Mirror（mirror 字段）的合法 Strategy。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03**：详情页必须依次展示基本信息、版本与流量（角色/权重/接管/副本数或未找到）、匹配规则、状态条件，并提供调整流量、暂停/恢复与删除入口。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04**：流量编辑必须按发布模式提供对应控件，写入整对象并保持 `spec.governor` 与权重一致；暂停/恢复只改 `governor` 且保留权重；保存失败保留输入并显示原因。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05**：删除必须经输入名称确认，成功后重新拉取列表并回到列表；失败保留确认框并显示原因。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06**：创建与删除入口由 IAM 权限检查（用户身份；旧后端回退 `SelfSubjectAccessReview`）决定，明确拒绝时禁用/隐藏并说明原因，检查失败时 fail-open。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：0 条策略时为空态；有策略时列头与行内容与对象字段一致；版本列顺序与权重取自对象路由；名称链接可达详情。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02**：确认前无写请求；确认后回读的类型/选择器/host/权重/governor 与向导输入一致；三种类型都能创建；finally 删除后计数回到创建前。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03**：详情的四个区块按顺序渲染且字段与对象一致；未找到工作负载与真实 0 副本可区分；条件为空时显示解释且状态为未知。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04**：每次流量/接管/暂停/恢复写入后 API 回读与页面一致；暂停不改变权重、恢复还原原比例；非法输入不写集群。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05**：删除后回读 404、列表不再包含该行；取消不写；失败不关闭确认框。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08`
