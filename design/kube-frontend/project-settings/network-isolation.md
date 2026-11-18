# 网络隔离（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/network-isolation.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-03
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-04

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-02
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01

## 概述

项目级隔离开关与 NetworkPolicy 列表同屏，列表下方是只读的规则视图（每条 ingress/egress 规则一行）。规则视图由独立组件 `NetworkRulesPanel` 渲染，页面只负责挂载。

## 设计目标与非目标

目标：意图与执行放在一起看。非目标：策略编辑。

## 关键约束

- 开关读 resources 代理、写核心组 merge patch。
- 策略读 `networking.k8s.io/v1`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK-ISOLATION-01 — 开关只改一个注解

**为什么**：命名空间上还有标签与别的注解（企业空间归属就在标签里）。用 PUT 会整体替换，可能丢掉它们；merge patch 只动 `kubesphere.io/network-isolate`。

**被否方案**：PUT 整个命名空间。一次开关操作就可能把项目从企业空间里摘出来。

**何时重新考虑**：平台提供专门的项目隔离接口时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK-ISOLATION-02 — 开关与策略列表同屏

**为什么**：管理员的问题是「这条流量为什么不通」。只看策略看不到项目级意图，只看开关看不到具体范围，两者放一页才能回答。

**被否方案**：拆成两个页面。会让同一问题需要跳转两次。

**何时重新考虑**：策略数量增长到需要独立的创建/编辑流程时。

## 系统现状

老 console 的网络隔离页也是开关 + 策略列表；本模块列一致（名称、类型、规则数、创建时间）。

## 仓库落点

- `apps/console-next/src/pages/settings/NetworkIsolationPage.tsx`（挂载规则视图）
- `apps/console-next/src/pages/settings/NetworkRulesPanel.tsx`（规则展开与只读表格）
- `packages/api-client/src/iam.ts` 的 `networkIsolationApi` / `networkPoliciesApi`
- `src/routes/.../networkpolicies/`

## 对外契约

读 `resources.kubesphere.io/v1alpha3/namespaces/<ns>` 与 `networking.k8s.io/v1`；写 `PATCH /api/v1/namespaces/<ns>`。

规则视图的句柄与读取：

- 容器 `data-ai-id="settings-network:rules"`；规则行 `data-ai-id="settings-network:rule:<policy>/<index>"`（`index` 为该策略内 ingress 在前、egress 在后的 0 起序号）；空态 `data-ai-id="settings-network:rules:empty"`。
- 读取 `GET /apis/networking.k8s.io/v1/namespaces/<ns>/networkpolicies`（一次取全量对象，含 `spec`）。

## 不变量

1. 开关只改一个注解。
2. 注解缺失等同于关闭。
3. 规则视图只读且无损：一行 = 一条策略的一条 ingress/egress 规则，策略名 + 序号可追溯；不合并不同策略的规则。
4. 规则视图覆盖全量策略，不受列表页当前页/搜索影响。

## 已知坑

- 命名空间的注解与标签同处 `metadata`，写错层级会 422。
- 策略的 `policyTypes` 为空数组时按 `-` 显示，不猜测。
- 规则里没有 `from`/`to` 表示允许全部对端、没有 `ports` 表示允许全部端口，都要显示 `*`；显示 0 会被读成"拒绝全部"。
- `ipBlock.except` 与 `endPort` 容易被漏掉：漏掉 except 会把"允许 10.0.0.0/8"显示得比实际更宽，漏掉 endPort 会把端口区间显示成单端口。
- 规则视图不能复用列表接口：`networkPoliciesApi.list` 返回的是摘要（无 `spec`），要规则必须读一次原生对象集合。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`；规则视图为 `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01`。用例临时创建一条含 namespaceSelector/ipBlock/端口区间的策略，断言规则行内容与对象 `spec` 一致，并在空态下断言说明文案。

## 后续改进

策略创建与编辑。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01`

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-NETWORK-ISOLATION-03 — peer 必须包一层 `podSelector`

**为什么**：Kubernetes 的 peer 是**包裹选择器的对象**：`from: [{ podSelector: { matchLabels: … } }]`。把选择器直接放进 `from` 会被拒绝——实测 422 `spec.ingress[0].from[0]: Required value: must specify a peer`。这个错误信息没有说清楚"要包一层"，所以记录下来。

**被否方案**：`from: [{ matchLabels: … }]`。看起来更短，实际不合法。

**何时重新考虑**：支持 `namespaceSelector` 与 `ipBlock` 时需要扩展 peer 结构。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-NETWORK-ISOLATION-04 — 一次只有一条规则

**为什么**：管理员在此页的实际动作是"隔离这个项目，再放行一个邻居"。单条规则覆盖它；多规则与 CIDR 更适合 YAML。

**被否方案**：完整的规则编辑器（多条 + 端口 + 命名空间选择器）。工作量数倍，而使用频率低。

**何时重新考虑**：出现"策略全靠界面配置"的需求时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-05 — 直接展示 NetworkPolicy 对象，不重建白名单抽象

**为什么**：老实现的聚合视图是**有损映射**——它把多条策略合并成「项目→项目」「IP 段 + 端口」两栏，删掉一条白名单时无法判断会改动哪个对象的哪条规则；直接展示对象则「改一条规则 = 改一个对象」，语义与 kubectl 一致。代价是读起来比两栏视图慢，用规则数 / 方向列缓解。

**被否方案**：两栏视图 + 「查看来源对象」链接。需要维护两套数据模型，且合并后的条目与对象不是一对一，回写仍有歧义。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01 — 规则视图是对象的无损投影，不是白名单抽象

**为什么**：上一节拒绝的是**有损**聚合（多条策略合并成「项目→项目」「IP 段+端口」两栏）；本功能点的规则视图是**无损**投影：每条 ingress/egress 规则一行，保留策略名与序号，selector / ipBlock / 端口 / 协议原样展开。这样读起来仍比 YAML 快，但任何一行都能追回到唯一对象与规则，不会重蹈"删一行不知道改哪个对象"的覆辙。

**被否方案**：只保留列表、让读者点进策略看 YAML。YAML 能回答问题，但"这条流量为什么通"需要在多个对象间来回读；规则视图把同一项目的全部规则放在一屏。

**另一条**：规则视图只读。写路径仍只有创建/删除与编辑 YAML，避免出现第二套可写模型。

**何时重新考虑**：需要按流量方向/对端做筛选或搜索时，给规则视图加过滤；需要编辑规则时，先迁移一个真正的规则编辑器，再让规则视图可写。


### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-04 — 白名单向导按「规则」而不是按「一个对端」建模

**为什么**：老 console 的向导只问方向与一个对端（项目或服务），而 NetworkPolicy 的对象形状是一组规则、每条规则一组对端与端口。按对象形状建模，同一份表单既能表达老 console 的场景（一个命名空间对端），也能表达它做不到的（多规则、端口、地址段），且不需要为「再加一条规则」发明第二套界面。

**被否方案**：保留单对端表单再加一个「继续添加」按钮——两次提交之间对象已生效，中间态可能放通不该放通的流量。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-05 — `policyTypes` 由实际规则推导

**为什么**：声明一个方向却没有对应规则，等于在该方向拒绝全部流量——与「白名单」的意图相反。清单生成器只为非空的规则列表写类型，因此不存在「声明了 Egress 却没有 egress 规则」的对象。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-06 — 对端一律包一层

**为什么**：`from: [{ podSelector: … }]` 是对端的形状，`from: [{ matchLabels: … }]` 会被 apiserver 以「must specify a peer」拒绝（已实测）。清单生成器统一包装三种对端，表单因此不需要知道这个细节。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-02 — 详情页复用同一投影，不新增读请求

**为什么**：策略详情已经拿到了对象本身（`spec.ingress` / `spec.egress`），规则表从同一份对象投影出来，因此「属性里的规则数」与下面的规则行永远一致；再发一次规则请求就会出现两处不同步的可能。投影函数抽到 `pages/settings/networkPolicyRules.ts`，项目规则视图与详情页共用——两处各写一份，同一条规则在两个页面会长得不一样（一处写 `namespaceSelector: env=prod`，一处只写 `env=prod`）。

**空与「允许全部」不是一回事**：某方向没有规则时显示「这个策略没有入站规则。」；而一条规则里 `from: []`（或没有 `ports`）表示允许全部，打印成 `*`。把两者都渲染成空表，读者无法区分「没写规则」和「写了规则但允许一切」。

**被否方案**：在详情页内嵌项目级规则视图并高亮本策略那一行。那会拉一份全项目策略的读，还要读者在一堆行里找自己那条；详情页的上下文已经确定了策略。

**何时重新考虑**：策略规则出现「引用其他策略/服务」这类需要额外解析的字段时，投影函数要读更多对象，届时再评估是否加请求。

