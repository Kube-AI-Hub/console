# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01 网络隔离 · 规则视图

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `network-rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies`
- **需求**: `prd/kube-frontend/project-settings/network-isolation.md`

## 产品功能

网络隔离页在策略列表下方提供只读的规则视图，把每条 NetworkPolicy 的 spec.ingress/egress 展开为 策略/方向/作用对象/允许来源去向/端口 五行，selector、ipBlock（含 except）与端口（含协议与 endPort）原样可读；没有策略时给空态说明。

### 关联需求

- `prd/kube-frontend/project-settings/network-isolation.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01** — 已知项目里有一条含入站规则（`namespaceSelector`、`ipBlock`、TCP/80、UDP/53）和一条出站规则（`podSelector`、TCP/5432 endPort 5433）的网络策略，当打开网络隔离页的规则视图，则每条规则一行，逐行显示策略名、方向、作用对象（`app=web`）、允许来源/去向（对应的 selector / ipBlock 及其 except）与端口（`TCP/80`、`UDP/53`、`TCP/5432-5433`）；已知项目里没有网络策略，则规则视图显示「这个项目还没有网络策略。」的空态说明。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/network-isolation.md`](../../../../design/kube-frontend/project-settings/network-isolation.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 看懂一条策略到底放行了什么 (Priority: P1)

作为 **项目管理员**，我希望 **在策略列表下方直接看到每条策略展开后的规则（作用于哪些容器组、允许哪些对端、哪些端口）**，以便 **不必打开 YAML 就能判断「这条流量为什么通」**。

**Independent Test**：在项目里创建一条含 namespaceSelector、ipBlock、端口与 endPort 的策略，打开网络隔离页，规则视图逐条列出这些内容；没有策略时显示空态说明。

## 前置与配置

- 已登录，且在 host 集群的 system-workspace 下有一个当前没有网络策略的项目（用例优先选 default，否则选 spaces）
- 用例通过 kube API 临时创建一条含 namespaceSelector、ipBlock、端口与 endPort 的 tc-e2e- 网络策略，用例结束无条件删除

## 测试步骤

1. 用 API 确认候选项目里没有网络策略，打开该项目网络隔离页并等待主区就绪
2. 断言规则视图的空态说明
3. 用 API 创建策略：podSelector app=web；入站 from namespaceSelector + ipBlock(10.0.0.0/8 except 10.0.1.0/24)、ports TCP/80 与 UDP/53；出站 to podSelector role=db、ports TCP/5432 endPort 5433
4. 重新打开页面，等待规则视图就绪
5. 读取该策略的两条规则行，核对作用对象、方向、对端与端口
6. 删除策略后重新打开页面，核对规则视图回到空态

## 期望结果

- 无策略时 [data-ai-id="settings-network:rules:empty"] 可见且说明文案为「这个项目还没有网络策略。」
- 表头为 策略、限制方向、作用对象、允许来源/去向、端口
- 该策略恰好两行，行 id 为 settings-network:rule:<策略名>/0 与 /1
- 第 0 行为入站流量：作用对象 app=web；对端含 namespaceSelector 的 <项目> 标签与 ipBlock 10.0.0.0/8 except 10.0.1.0/24；端口 TCP/80, UDP/53
- {'第 1 行为出站流量：对端 podSelector': 'role=db；端口 TCP/5432-5433'}
- 删除后空态说明重新出现

## 失败排查

- 规则视图不出现：检查 NetworkIsolationPage 是否挂载 NetworkRulesPanel，以及页面 ai surface 是否先进入 error
- 行数为 0 但策略存在：详情接口返回的是摘要（无 spec），规则视图必须读 /apis/networking.k8s.io/v1 的原生对象集合
- 对端或端口显示成 *：规则里确实没有 from/to 或 ports；检查创建策略的 body

## 产品改版后如何更新自动化

- 规则行 id 变化时改 NetworkRulesPanel 的 data-ai-id 拼装
- 方向/端口文案变化时改 locale 的 settings.network.* 键
