# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02 网络隔离 · 创建与删除网络策略

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `network-isolation`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies`
- **需求**: `prd/kube-frontend/project-settings/network-isolation.md`

## 产品功能

可创建入站/出站策略并指定各方选择器；创建后 spec 结构正确；可删除。

### 关联需求

- `prd/kube-frontend/project-settings/network-isolation.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-03** — 已知在网络隔离页，当「创建网络策略」填写名称、作用于 `app=web`、方向入站、允许对方 `role=frontend` 并确认，则生成的 NetworkPolicy 之 `spec.podSelector.matchLabels` 为 `{app: web}`、`spec.ingress[0].from[0].podSelector.matchLabels` 为 `{role: frontend}`；当删除，则该对象不存在。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/network-isolation.md`](../../../../design/kube-frontend/project-settings/network-isolation.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认项目流量是否被限制、被什么限制 (Priority: P1)

作为 **项目管理员**，我希望 **在一个页面看到隔离开关和具体策略**，以便 **判断某条流量为什么通或不通**。

**Independent Test**：打开网络隔离页，核对开关状态与命名空间注解一致，策略数与 API 一致。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 用例自行创建的策略在结束时无条件删除

## 测试步骤

1. 打开网络隔离页点「创建网络策略」
2. 填写名称、作用对象 app=web、方向入站、对方 role=frontend，确认
3. 用 API 读取该策略
4. 删除该策略并确认不存在

## 期望结果

- {'spec.podSelector.matchLabels 为 {app': 'web}'}
- {'spec.ingress[0].from[0].podSelector.matchLabels 为 {role': 'frontend}'}
- 删除后 API 返回不存在

## 失败排查

- 422「must specify a peer」说明 from 里直接放了选择器，应包一层 podSelector
- 留空对方选择器表示拒绝全部，不产生 from/to 规则

## 产品改版后如何更新自动化

- 规则编辑器变化时改 api-client 的 networkPoliciesWriteApi
