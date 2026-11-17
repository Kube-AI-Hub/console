# 企业空间控制台（L3）

[子模块需求](./_index.md)

## 概述

企业空间自己的控制台：`/kube-frontend/workspaces/<ws>/…` 下的**概览、项目、企业空间成员**三页。

老 console 里 `/workspaces/:ws/*` 是独立作用域（18 条路由）：在企业空间之上是平台，之下是项目。新 UI 此前只有平台侧 `访问控制 › 企业空间 › 详情` 的只读副本——那回答的是「这个企业空间是什么」，而不是「里面有什么」。

## 用户故事

### US1 - 企业空间管理员看自己的空间 (Priority: P1)

作为 **企业空间管理员**，我希望 **在一个地方看到这个空间的概览、项目和成员**，以便 **不必绕到平台访问控制里逐项查**。

**Independent Test**：打开 `/workspaces/<ws>/overview`，核对标题是空间别名或名称、项目数与成员数与接口一致；侧栏出现「概览 / 项目 / 企业空间成员」三项。

### US2 - 从空间概览看它在哪些集群上 (Priority: P2)

作为 **企业空间管理员**，我希望 **在概览里看到这个空间可见（被授权/被放置）的每个集群及其就绪状态、供应商、Kubernetes 版本与节点数**，以便 **判断项目能落在哪些集群、哪个集群当前不可用，而不必去平台访问控制里逐项查**。

**Independent Test**：打开 `/workspaces/<ws>/overview` 的「集群信息」页签，卡片数等于 `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/clusters` 的条数；每张卡显示名称/别名、就绪状态、供应商、Kubernetes 版本、节点数与可见性；就绪的卡有进入该集群概览的链接。

### US3 - 从企业空间进入自己的 DevOps 工程 (Priority: P2)

作为 **企业空间管理员**，我希望 **在空间侧栏直接看到这个空间的 DevOps 工程（名称/别名、所在集群、同步状态、创建时间）并打开其中一个**，以便 **不必先切到集群作用域再找「我的空间有哪些工程」**。

**Independent Test**：从空间概览点侧栏「DevOps 工程」进入 `/workspaces/<ws>/devops`，行集合等于各已启用 DevOps 集群的 kapis workspace 聚合（`/kapis/devops.../workspaces/<ws>/devops`）的并集；每行链接到 `/kube-frontend/clusters/<cluster>/devops/<name>`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07** — 已知企业空间 `<ws>` 的监控上报了空间级指标，当打开空间控制台概览页，则「资源用量」区块显示 CPU、内存、容器组数量与网络收发（收/发分别以字节单位呈现），缺失的指标显示 `-` 而不是 0；监控不可用时显示说明而不是数字；「项目用量排行（Top 5）」区块按 CPU 与内存两个页签列出该空间内用量最高的 5 个项目（序号、名称、数值），名称链接到该项目的控制台概览页，排行只包含 `workspace` 标签等于本空间的样本；排行无数据时显示空态说明。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01** — 已知企业空间有 N 个项目与 M 个成员，当打开该空间控制台概览页，则显示基本信息（名称/别名/管理员/创建者/创建时间/部署集群）与项目数 N、成员数 M；侧栏有「概览 / 项目 / 企业空间成员」；项目页列出 N 行且名称链到该项目控制台（URL 含 workspace、cluster、project 段）；成员页列出 M 行，含成员名与角色。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08** — 已知企业空间 `<ws>` 可见若干集群（可能为 0/1/多个），当打开空间控制台概览页并切到「集群信息」页签，则卡片数等于 `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/clusters?limit=-1` 的条数；每张卡显示名称（有别名时主显示别名、次显示名称）、就绪状态徽标、供应商、Kubernetes 版本、节点数与可见性，以及 CPU/内存/容器组/磁盘四项使用率（百分比 + 明细：CPU/内存为「已用/已分配/总量」，容器组/磁盘为「已用/总量」；任一侧缺失显示 `-` 而不是 0%；单项指标不可读只影响该卡该项，不影响身份与链接），缺失字段显示 `-` 而不是 0；Ready 条件为 `True` 的卡提供进入 `/kube-frontend/clusters/<cluster>/overview` 的链接，未就绪的卡不提供链接并说明原因；集群集合为空显示「尚未授权任何集群」空态；聚合接口失败显示错误与重试，而不是空卡片；「资源用量」页签仍显示原有的资源用量与项目排行区块。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09** — 已知企业空间 `<ws>` 的若干集群中，部分/全部启用了 DevOps（`status.configz.devops`），当打开空间侧栏「DevOps 工程」页 `/workspaces/<ws>/devops`，则行集合等于各「就绪且启用 DevOps」集群的 `GET /kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops?limit=-1`（成员集群加 `/kapis/clusters/<c>` 前缀）返回工程的并集：每行显示名称（有别名时主显示别名、次显示名称）、描述、所在集群、同步状态（successful/pending/failed → 已同步/同步中/同步失败，其它/缺失显示 `-`）与创建时间；行名称链接到 `/kube-frontend/clusters/<cluster>/devops/<name>`；搜索按名称/别名/描述/集群过滤；没有任何工程时显示「还没有 DevOps 工程」空态，所在集群都未启用 DevOps 时显示未启用说明（并非空表），某集群读取失败保留其他集群行并显示部分失败提示，全部集群读取失败显示错误与重试。

## 设计目标

1. 企业空间成为**独立作用域**：URL 与侧栏都与项目作用域分开。
2. 三页都直接读同一套 workspace API，不复制平台详情页的数据口径。
3. 概览分两个页签：资源用量与排行（沿用已交付区块）、集群信息（每卡一个可见集群）。集群信息是只读汇总，不提供集群切换器。
4. 空间作用域内有「DevOps 工程」列表：按 workspace 聚合各集群的工程，行链接到集群作用域详情；创建/编辑/删除留在集群作用域（决策 N-07 的范围）。

## 约束与边界

- 本规格覆盖只读概览；成员写入由 [workspace-members.md](./workspace-members.md) 承接，配额及角色另立规格。
- 项目链接需要 cluster 段：取 `spec.placement.clusters[0]`，缺省回落 `host`。
- 集群信息读 `workspaces/<ws>/clusters` 聚合（返回完整 Cluster 对象：provider/kubernetesVersion/nodeCount/conditions/visibility）；不用 workspace 对象的 placement 名单推断状态（该部署实测无 placement 字段）。
- 就绪判定只看 Ready 条件的 `status === 'True'`；条件缺失等同未就绪。
- DevOps 列表只查询就绪且 `status.configz.devops === true` 的集群；未启用 DevOps 的集群不发请求（返回 404 是正常安装状态）。
- 工程读的是 kapis workspace 聚合（服务端按 workspace 过滤），不是 raw `/apis/devopsprojects` 再按标签过滤。

## UI 交互设计

- 侧栏（该作用域）：概览 / 项目 / 企业空间成员。
- 概览：基本信息表格 + 两个页签「资源用量与排行」「集群信息」。资源页签含资源用量区块、项目用量排行（Top 5）与两张计数卡片（项目、成员，各自带进入链接）；集群信息页签为卡片栅格（1/2/3 列随断点），每卡一行标题（别名/名称 + 就绪徽标）、描述、四个字段（供应商/Kubernetes 版本/节点数/可见性）、四项使用率（CPU/内存/容器组/磁盘，百分比 + 明细：CPU/内存为已用/已分配/总量，容器组/磁盘为已用/总量）与进入链接或未就绪说明。
- 页签句柄：`workspace-overview:tab:resources`、`:tab:clusters`；集群区块 `:clusters`（带 `data-ai-state`）、`:clusters:list`、`:clusters:empty`、`:clusters:retry`；卡片 `:clusters:card:<name>` 及 `:status/:provider/:version/:nodes/:visibility/:link/:unavailable`。
- DevOps 页：标题+描述、刷新、搜索、列显示、排序（名称/集群/创建时间）与 10/20/50/100 分页；表格列 名称（别名/对象名/描述，链接）/ 集群 / 同步状态 / 创建时间；行 `workspace-devops:link:<cluster>:<name>`。
- DevOps 空态：无工程「还没有 DevOps 工程」+ 说明；集群都未启用 DevOps 单独说明。
- 项目页：名称（链接）/ 项目名 / 状态 / 创建者 / 创建时间。
- 成员页：成员 / 角色 / 状态 / 最近登录。

## 文案与校验

- 空态：没有项目 / 没有成员。
- 集群信息空态：「该企业空间尚未授权任何集群」，并说明由平台管理员在集群可见性中授权。
- 空值 `-`；可见性 `private/public` 显示「私有/公开」，未知值原样显示。

## 边界情况

- 空间别名未设置：标题回落为空间名。
- 成员角色缺失：显示 `-`（绑定异常而不是把成员藏起来）。
- 集群未就绪：卡片仍显示（状态徽标为未就绪），不提供进入链接并说明不可进入；不把未就绪的集群从列表里隐藏。
- 某项集群指标缺失或分母为 0：该比率显示 `-`；指标接口失败：四项显示 `-`（或保留已缓存值），身份与链接不受影响，不使用 0% 兜底。
- 集群聚合返回 0 条：显示空态；聚合失败：错误面板 + 重试，二者文案不同。
- workspace 对象没有 `spec.placement.clusters`（本部署实测）：基本信息「部署集群」回落为聚合返回的集群名；两者都读不到才显示 `-`。
- 单集群：仍显示一张卡（不隐藏页签），避免多/单集群两套布局。
- 切换页签到资源用量再切回集群信息：已取回的查询命中缓存，不重复请求。
- DevOps 空间无就绪/启用 DevOps 的集群：显示未启用说明，不显示空表；部分集群失败：保留其余行并列出失败集群名；全部失败：错误+重试。
- 工程创建后控制器尚未同步：同步状态显示 `-`（不编造「已同步」）；工程被删除：刷新后行消失。

## 明确不做

- 邀请/移除成员不属于本只读规格，已由 [workspace-members.md](./workspace-members.md) 使用空间角色列表承接。
- 配额与部门：需配额接口与组织模型，另立。
- 联邦项目与应用商店：已有独立功能点（`federated-projects.md`、`workspace-apps.md`），不在本规格内。

## 假设

- `workspacemembers` 聚合接口是该部署上的成员来源（tenant 路径 404）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01** — 企业空间独立作用域与三页导航。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02** — 项目行链到项目控制台并带三段落。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03** — 概览提供「资源用量与排行」「集群信息」两个页签，资源页签内容与既有 AC 一致。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 集群信息按聚合接口列卡片，展示名称/别名/就绪/供应商/Kubernetes 版本/节点数/可见性；缺失字段显示 `-`。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05** — 就绪集群卡片链到集群概览；未就绪卡不提供链接并说明；空集合与读取失败分别有空态/错误态。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06** — 空间侧栏提供「DevOps 工程」入口，列表按 workspace 聚合各启用 DevOps 的集群，行链接到集群作用域详情。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07** — DevOps 列表支持搜索、排序、列显示、分页与刷新；无工程/未启用 DevOps/部分失败/全部失败各有明确状态。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01** — 计数与接口一致；侧栏三项可达；链接段正确。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08** — 集群卡片数 = 聚合接口条数；Ready 条件为 True 的卡有链接且 href 指向 `/kube-frontend/clusters/<name>/overview`；未就绪卡无链接；字段缺失显示 `-`。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09** — DevOps 行集合 = 各启用集群 workspace 聚合并集；行链接 href 指向对应集群的工程详情；搜索能按别名过滤到目标行；空态/未启用/部分失败状态互不混用。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09`
