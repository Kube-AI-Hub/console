# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-04 网络隔离：白名单向导（多规则、对端与端口）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `network-isolation`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies`
- **需求**: `prd/kube-frontend/project-settings/network-isolation.md`

## 产品功能

白名单向导支持多条入站/出站规则，对端可为容器组标签、项目（命名空间）或 IP 段，并可指定协议与端口。

### 关联需求

- `prd/kube-frontend/project-settings/network-isolation.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-04** — 已知在网络隔离页，当「创建网络策略」填写名称与描述、作用于 `app=backend`，并添加两条入站规则（一条对端为容器组标签 `tier=frontend` 且端口 TCP/8080，另一条对端为 IP 段 `10.0.0.0/8`）与一条出站规则（对端为项目 `default`）后确认，则生成的 NetworkPolicy 的 `spec.ingress` 含两条规则（前者带 `ports:[{protocol:TCP,port:8080}]`，后者带 `from:[{ipBlock:{cidr:10.0.0.0/8}}]`）、`spec.egress` 含 `to:[{namespaceSelector:{matchLabels:{kubernetes.io/metadata.name:default}}}]`、`spec.policyTypes` 为 `[Ingress,Egress]`、描述写入 `kubesphere.io/description` 注解；只添加入站规则时 `policyTypes` 只含 `Ingress`；没有添加任何规则时确认按钮不可用。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/network-isolation.md`](../../../../design/kube-frontend/project-settings/network-isolation.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认项目流量是否被限制、被什么限制 (Priority: P1)

作为 **项目管理员**，我希望 **在一个页面看到隔离开关和具体策略**，以便 **判断某条流量为什么通或不通**。

**Independent Test**：打开网络隔离页，核对开关状态与命名空间注解一致，策略数与 API 一致。

## 前置与配置

- 已登录且可写项目网络策略

## 测试步骤

1. 打开网络隔离页并点「创建网络策略」
2. 填写名称、描述、作用于 app=backend
3. 添加入站规则：tier=frontend + TCP/8080；再添加一条 IP 段 10.0.0.0/8
4. 添加出站规则：项目 default
5. 确认并回读 spec 与注解

## 期望结果

- 没有规则时确认按钮不可用；对端为空时也不可用

## 失败排查

- 422 must specify a peer：对端没有包一层
- policyTypes 多出一个方向：该方向规则列表非空但被写成了空规则

## 产品改版后如何更新自动化

- 选择器：networkpolicies:create / networkpolicies-create:name / :pod-selector / :ingress-add / :ingress-value:<id> / :ingress-port:<id> / :ingress-kind:<id> / :egress-add / :submit
