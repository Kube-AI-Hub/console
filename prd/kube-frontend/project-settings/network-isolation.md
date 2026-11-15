# 网络隔离（L3）

[子模块需求](./_index.md)

## 概述

项目级开关 + 网络策略列表：开关写在命名空间注解上，列表是真正生效的 NetworkPolicy 对象。下方的「规则视图」把每条策略的 `spec.ingress` / `spec.egress` 展开成可读规则行——作用对象、允许的来源/去向、端口与协议——让人不必逐条读 YAML。

## 用户故事

### US1 - 确认项目流量是否被限制、被什么限制 (Priority: P1)

作为 **项目管理员**，我希望 **在一个页面看到隔离开关和具体策略**，以便 **判断某条流量为什么通或不通**。

**Independent Test**：打开网络隔离页，核对开关状态与命名空间注解一致，策略数与 API 一致。

### US2 - 看懂一条策略到底放行了什么 (Priority: P1)

作为 **项目管理员**，我希望 **在策略列表下方直接看到每条策略展开后的规则（作用于哪些容器组、允许哪些对端、哪些端口）**，以便 **不必打开 YAML 就能判断「这条流量为什么通」**。

**Independent Test**：在项目里创建一条含 namespaceSelector、ipBlock、端口与 endPort 的策略，打开网络隔离页，规则视图逐条列出这些内容；没有策略时显示空态说明。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01** — 已知项目内有多条网络策略，当打开网络隔离页，则显示名称（副行为 Pod 选择器）、策略类型、规则数、创建时间四列，且行数与 API 返回一致。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-03** — 已知在网络隔离页，当「创建网络策略」填写名称、作用于 `app=web`、方向入站、允许对方 `role=frontend` 并确认，则生成的 NetworkPolicy 之 `spec.podSelector.matchLabels` 为 `{app: web}`、`spec.ingress[0].from[0].podSelector.matchLabels` 为 `{role: frontend}`；当删除，则该对象不存在。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02** — 已知开关处于关闭状态，当打开开关，则命名空间的 `kubesphere.io/network-isolate` 注解变为 `true`；当再次关闭，则变回 `false`。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-04** — 已知在网络隔离页，当「创建网络策略」填写名称与描述、作用于 `app=backend`，并添加两条入站规则（一条对端为容器组标签 `tier=frontend` 且端口 TCP/8080，另一条对端为 IP 段 `10.0.0.0/8`）与一条出站规则（对端为项目 `default`）后确认，则生成的 NetworkPolicy 的 `spec.ingress` 含两条规则（前者带 `ports:[{protocol:TCP,port:8080}]`，后者带 `from:[{ipBlock:{cidr:10.0.0.0/8}}]`）、`spec.egress` 含 `to:[{namespaceSelector:{matchLabels:{kubernetes.io/metadata.name:default}}}]`、`spec.policyTypes` 为 `[Ingress,Egress]`、描述写入 `kubesphere.io/description` 注解；只添加入站规则时 `policyTypes` 只含 `Ingress`；没有添加任何规则时确认按钮不可用。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01** — 已知项目里有一条含入站规则（`namespaceSelector`、`ipBlock`、TCP/80、UDP/53）和一条出站规则（`podSelector`、TCP/5432 endPort 5433）的网络策略，当打开网络隔离页的规则视图，则每条规则一行，逐行显示策略名、方向、作用对象（`app=web`）、允许来源/去向（对应的 selector / ipBlock 及其 except）与端口（`TCP/80`、`UDP/53`、`TCP/5432-5433`）；已知项目里没有网络策略，则规则视图显示「这个项目还没有网络策略。」的空态说明。

## 设计目标

1. 开关与策略同屏，因为管理员判断的是同一件事。
2. 开关只改一个注解，不覆盖命名空间的其他字段。
3. 规则视图是对象的**无损投影**：一行对应一条策略里的一条 ingress/egress 规则，保留策略名与序号，不做合并。

## 约束与边界

- 开关读命名空间（resources 代理），写命名空间（核心组 merge patch）。
- 策略读 `networking.k8s.io/v1` 的 `networkpolicies`。
- 规则视图只读：不提供行内编辑、不写回对象；改规则仍走策略详情的编辑 YAML。
- 规则视图读取项目的**全部**策略（不限当前列表页），否则第 2 页之后的策略规则会被藏掉。

## UI 交互设计

顶部一行：说明文字 + 开关；下方是策略列表（四列）。列表下方是「规则视图」：五列（策略、限制方向、作用对象、允许来源/去向、端口），每条 ingress/egress 规则一行；无策略时显示空态说明，策略存在但没有规则时显示「暂无数据」。规则行的策略名链到该策略的详情页。

## 文案与校验

- 列：名称、策略类型、规则数、创建时间。
- 规则数显示为「入 n / 出 m」。
- 开关标签：开启项目网络隔离。
- 规则视图列：策略、限制方向、作用对象、允许来源/去向、端口；方向沿用「入站流量 / 出站流量」。
- 选择器写成 `k=v`（多个用逗号分隔），空选择器与「全部」写成 `*`；`ipBlock` 显示 CIDR 与 except；端口写成 `协议/端口`（区间为 `起始-结束`）。

## 边界情况

- 没有策略时显示空态且不渲染表头。
- 开关注解缺失等同于关闭。
- 规则视图：没有策略时显示「这个项目还没有网络策略。」；有策略但都没有 ingress/egress 规则时显示「暂无数据」，不显示空表。
- 规则视图读取失败时显示错误面板并给重试，不把错误显示成「没有规则」。
- 规则里没有 `from`/`to`（允许全部对端）或没有 `ports`（允许全部端口）时显示 `*`，不显示 0。
- `ipBlock.except`、`endPort`、命名端口都原样展示，不丢弃。

## 明确不做

- 策略的**编辑**（创建与删除已迁移；修改仍用 YAML）。
- 策略的**编辑**（含多规则与 `ipBlock` 的写入）：规则视图只读展示这些规则，编辑仍用 YAML。
- 策略的启用/停用（NetworkPolicy 没有这个字段）。
- 老的「内部白名单 / 外部白名单」聚合视图：老实现把 `NetworkPolicy` 重新抽象成「项目→项目」「IP 段 + 端口」两栏，读的时候反而看不到对象本身；本控制台直接展示 `NetworkPolicy` 对象与其规则，语义与 kubectl 一致。按项目间白名单的**新建向导**另立功能点（见缺口分析 R-21）。

## 假设

- KubeSphere 用命名空间注解表示项目级隔离意图。

## 验收用例

- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01`
- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01** — 列表展示四列，策略类型以徽标呈现。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02** — 开关写入命名空间注解。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01** — 规则视图把每条策略的 ingress/egress 规则展开为 策略/方向/作用对象/对端/端口 五列，只读。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-02** — 规则视图覆盖 selector、ipBlock（含 except）、端口与协议（含 endPort）；无策略时给空态说明。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01** — 策略名称集合与 `kubectl get networkpolicy -n <ns>` 一致。
- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01** — 规则视图的行数与「所有策略的 ingress+egress 规则总数」一致，且每行能追溯到策略名与序号。
