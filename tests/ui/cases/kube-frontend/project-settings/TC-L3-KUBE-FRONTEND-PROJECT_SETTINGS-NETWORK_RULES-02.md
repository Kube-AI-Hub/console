# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-02 网络策略详情 · 规则视图（入站/出站分块、允许来源与端口）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `network-rules`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/networkpolicies`
- **需求**: `prd/kube-frontend/project-settings/network-isolation.md`

## 产品功能

策略详情页把该策略的入站与出站规则按方向分块列出：允许来源/去向、端口、作用对象；某个方向没有规则时显示明确说明。

### 关联需求

- `prd/kube-frontend/project-settings/network-isolation.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-02** — 已知一条网络策略含入站规则（`namespaceSelector` + `podSelector`、`ipBlock` 含 `except`、TCP/80 与 UDP/53）与出站规则（`podSelector`、TCP/5432-5433），当打开该策略的详情页，则「规则视图」区块按方向分两块，逐行显示允许来源/去向与端口，并显示作用对象（`app=web`）；某个方向没有规则时显示「这个策略没有入站规则。」而不是空表。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/network-isolation.md`](../../../../design/kube-frontend/project-settings/network-isolation.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认项目流量是否被限制、被什么限制 (Priority: P1)

作为 **项目管理员**，我希望 **在一个页面看到隔离开关和具体策略**，以便 **判断某条流量为什么通或不通**。

**Independent Test**：打开网络隔离页，核对开关状态与命名空间注解一致，策略数与 API 一致。

## 前置与配置

- 已登录，host 集群 default 项目
- 用例用 API 创建一条含入站（namespaceSelector + podSelector、ipBlock 含 except、TCP/80 与 UDP/53）与出站（podSelector、TCP/5432-5433）规则的 NetworkPolicy，结束后删除

## 测试步骤

1. 打开 /kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies/<name>
2. 等 networkpolicy-detail:surface 就绪
3. 核对「规则视图」区块可见，作用对象显示 app=web
4. 核对入站块有两行，分别含 namespaceSelector/podSelector 与 ipBlock（含 except），端口列含 TCP/80 与 UDP/53
5. {'核对出站块一行，含 podSelector': 'app=db 与 TCP/5432-5433'}
6. 另建一条只有入站规则的策略，核对出站块显示「这个策略没有出站规则。」

## 期望结果

- 规则按方向分块（networkpolicy-detail:rules:ingress / :egress），每行保留策略规则顺序
- 允许来源/去向与端口来自对象 spec，与属性区的规则数一致
- 空方向显示说明文案而不是空表

## 失败排查

- 区块空白：投影函数没读 spec.ingress/egress，或详情对象没带 raw
- 端口显示成 0：`port` 缺失时应显示协议名（TCP），不是 0

## 产品改版后如何更新自动化

- 句柄：networkpolicy-detail:rules / :rules:ingress / :rules:egress；行 data-ai-row=<策略名>/<序号>
