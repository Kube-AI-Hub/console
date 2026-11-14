# 灰度发布列表（L3）

[子模块需求](./_index.md)

## 概述

项目控制台的「灰度发布」页按行列出本项目内的 servicemesh `Strategy` 自定义资源：名称、类型、目标服务与控制器给出的状态。servicemesh 在本集群已启用（`strategies` 接口 200，当前 0 个对象），老 console 也有这一页；新 UI 此前只登记为 planned。

列表之上提供**最小创建向导**：名称 + 目标工作负载（项目内 Deployment）+ 类型（金丝雀/蓝绿/流量镜像），确认后生成一个可被控制器接受的最小 Strategy（type + selector + Istio host + v1/v2 路由）。流量比例、匹配规则与版本选择仍留给后续的发布详情能力，因此向导不声称能完成完整发布配置；编辑/删除/详情仍不做。

## 用户故事

### US1 - 看到项目里有哪些灰度发布及其实施状态 (Priority: P1)

作为 **项目运维**，我希望 **在项目内一页看到所有灰度发布策略的名称、类型、目标服务与状态**，以便 **不进入命令行就能判断某个发布是否完成、失败或仍在进行**。

**Independent Test**：项目内存在一个 Canary 策略时，打开灰度发布页，列表出现该行且列头为名称/类型/目标服务/状态；项目内没有策略时，页面显示明确的空态。

### US2 - 不用写 YAML 就能起一个最小灰度发布 (Priority: P1)

作为 **项目运维**，我希望 **在列表上填写名称、选一个 Deployment 与发布类型，确认后创建 Strategy**，以便 **先让控制器接管这次发布，再在后续能力里补流量比例与匹配规则，而不是从零写 manifest**。

**Independent Test**：点「创建灰度发布」，填名称、选项目内 Deployment 与类型，下一步确认后创建；API 回读到 Strategy（spec.type/selector/template 符合选择），列表刷新出现该行，状态为进行中/未知之一。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01** — 已知项目内没有灰度发布策略，当打开灰度发布页，则页面进入空态并说明创建后会列在这里；已知项目内存在一个 `type=Canary` 的策略，当打开同一页面，则出现列头「名称 / 类型 / 目标服务 / 状态」，该行带稳定句柄且类型显示为「金丝雀发布」、目标服务取自策略的 Istio host、状态是已完成/进行中/失败/未知之一；读取失败时页面给出重试入口。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02** — 已知项目内有至少一个 Deployment，当在灰度发布页点「创建灰度发布」，填写合法名称、选择该 Deployment 与 Canary（或 Bluegreen/Mirror）并点「下一步」，则在点「确认创建」之前不产生任何写请求；确认后项目命名空间下出现对应 `Strategy` 对象，其 `spec.type` 等于所选类型、`spec.selector.matchLabels.app` 与 `spec.template.spec.hosts[0]` 来自所选 Deployment 的 app 标签，列表刷新后出现该行（状态为进行中/未知之一）；创建失败（名称冲突/权限/非法字段）时确认弹窗内显示服务端原因且不关闭；用例 finally 删除该对象，结束后 strategies 计数回到创建前。

## 设计目标

1. **状态可读**：CRD 没有 `phase`，状态从 `status.conditions` 的 `Complete`/`Failed` 派生，未知状态单独成档而不是伪装成健康。
2. **目标服务可读**：从 Istio host 派生，回退到选择器 app 标签与模板名，避免「有目标却显示 -」。
3. **空态与失败态分明**：0 条是正常空态，读取失败是可重试的错误面板。
4. **创建受控**：向导只生成控制器接受的最小 Strategy；确认前不写集群，失败原因就地显示，成功后列表可见。

## 约束与边界

- 作用域：项目级，路由 `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/grayrelease`。
- 数据源：`/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies`（原生 CRD 端点；kapis 代理同样 200，但原生返回完整对象与 status）。多集群路径未在本环境验证。
- 列：名称（别名优先）、类型、目标服务、状态；支持按名称/创建时间排序、按名称或目标服务搜索（客户端过滤，策略数量少）。
- 写：只有一个创建入口（POST 命名空间 strategies 集合）；没有编辑/删除/详情，也没有流量比例/匹配规则/版本选择。
- 创建的最小 manifest：`spec.type` + `spec.selector.matchLabels.app` + `spec.template.spec.hosts[0]`（取自所选 Deployment 的 app 标签，缺省用 Deployment 名）+ `principal/governor` v1/v2 + `strategyPolicy: WaitForWorkloadReady` + 两条 v1/v2 目的路由；实测三种类型都能被 API 接受（dryRun 201），真实创建 Canary 201、列表可见、DELETE 200。
- 名称须是 DNS-1123 label；同名对象由服务端 409 拒绝，错误显示在确认弹窗内。
- 状态映射：`Complete=True` → 已完成；`Failed=True` → 失败；有其它 condition 或 `completionTime` 缺失 → 进行中/已完成；无 condition → 未知。

## UI 交互设计

- 页面外壳 `data-ai-id="grayrelease:surface"`，四态 `loading/ready/empty/error`。
- 列表复用 `ResourceList`：搜索框句柄 `grayrelease:search`，行句柄 `data-ai-row=<名称>`，排序前缀 `grayrelease`。
- 空态：标题「暂无灰度发布任务」，说明「创建灰度发布任务后，这里会列出策略与状态。」
- 错误态：`ResourceErrorPanel` 带重试（`grayrelease:retry`）。
- 类型与状态用徽章显示；状态徽章带 condition 消息作为 `title`，失败/进行中的原因可在悬停时读到。
- 创建入口：列表主操作「创建灰度发布」（`grayrelease:create`）→ 弹窗；表单为名称、目标工作负载（Deployment 下拉）、发布类型（金丝雀/蓝绿/流量镜像）；点「下一步」进入确认面板（展示将创建的 Strategy 名称/工作负载/类型），点「确认创建」才发 POST；成功后关闭弹窗、列表刷新并在页头显示成功提示。

## 文案与校验

| key | 中文 | 英文 |
| --- | --- | --- |
| `grayRelease.title` | 灰度发布 | Canary Releases |
| `grayRelease.description` | 查看项目内的金丝雀发布、蓝绿部署与流量镜像策略；本页只读。 | Canary, blue-green and traffic-mirroring strategies in this project; read-only. |
| `grayRelease.column.name` | 名称 | Name |
| `grayRelease.column.type` | 类型 | Type |
| `grayRelease.column.targetService` | 目标服务 | Target service |
| `grayRelease.column.status` | 状态 | Status |
| `grayRelease.emptyTitle` | 暂无灰度发布任务 | No canary releases |
| `grayRelease.emptyDescription` | 创建灰度发布任务后，这里会列出策略与状态。 | Strategies you create will be listed here with their status. |

创建向导额外文案：grayRelease.create.{action,title,description,name,nameHint,workload,workloadHint,noDeployments,type,next,back,confirm,confirmDescription,created,error.name,error.workload}。

- 类型未知时原样显示 `spec.type`，不猜测；状态未知显示「未知」。

## 边界情况

- 项目内 0 个策略：空态，不显示表格与列头。
- servicemesh 模块未启用或接口 404：走错误态并提供重试，不伪装成空态（空态会让人以为没有发布）。
- 策略缺少 `spec.type`：类型列显示 `unknown`；缺少 template/hosts：目标服务按选择器与模板名回退，仍无则显示「-」。
- 策略刚创建、控制器尚未写入 condition：状态为「未知」，而不是「失败」。
- 策略数量很多：列表当前一次读取全部（控制器每项目写入数量有限），搜索/排序在客户端完成。
- 项目内没有 Deployment：创建弹窗显示「项目内没有可选的 Deployment」，下一步禁用，不写入。
- 名称非法/为空：下一步前就地校验，不打开确认面板。
- 名称已存在或权限不足：确认面板内显示服务端原因，弹窗不关闭，读者可改名称或取消。
- 刚创建的 Strategy 没有 status.condition：列表按已有派生规则显示「未知」（或控制器很快写入后的「进行中」），不视为失败。
- 创建对象后测试未清理会污染列表：用例在 finally 删除，并在末尾断言计数回到创建前。

## 明确不做

- **完整发布配置**：创建向导只生成最小可运行 Strategy；流量比例、匹配规则（header/cookie/权重）、版本选择与蓝绿切换仍不做，等发布详情能力。
- **编辑 / 删除策略与详情页**：本轮只加创建。
- **创建类型选择页**：老 console 的分类页（蓝绿/金丝雀/镜像卡片）不迁移，类型在向导里选。
- 不提供编辑流量比例、编辑匹配规则、删除策略与查看详情（删除仅由测试的 finally 通过 API 执行）。
- 不展示老 console 卡片上的请求量/成功率/延迟曲线（需要监控指标与图表）。

- 不在集群级作用域提供跨项目灰度发布列表。

## 假设

- 集群已启用 servicemesh，且当前账号对 `strategies` 有读权限。
- 策略由 servicemesh 控制器维护；页面只在确认后的创建流程中写入一次。
- 项目里至少存在一个 Deployment 时才能创建；目标 host 使用该 Deployment 的 app 标签（无标签时用 Deployment 名），后续可在发布详情里换成真实 Service。
- 三种类型都接受同一最小 template；控制器是否把对象推进到完成不在本用例范围。
- 项目内策略数量足够小，客户端搜索与排序可接受。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：系统必须在项目控制台提供灰度发布列表，展示名称、类型、目标服务与派生状态，并在无数据时给出明确空态、读取失败时给出重试入口。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02**：列表必须提供「创建灰度发布」主操作；向导采集名称、目标 Deployment 与类型，下一步确认后才 POST Strategy。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03**：创建成功后关闭弹窗并刷新列表；失败在弹窗内显示服务端原因；页面不提供编辑/删除。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：0 条策略时页面为空态且文案说明原因；存在策略时列头与行内容与对象字段一致；状态徽章与 `status.conditions` 一致。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02**：向导确认前无写请求；确认后 API 回读到与所选工作负载/类型一致的 Strategy，列表出现该行；finally 删除后 strategies 计数回到创建前。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02`
