# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08 企业空间概览 · 集群信息页签（卡片、就绪链接、空态）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{KA_WORKSPACE}/overview`
- **需求**: `prd/kube-frontend/access-control/workspace-console.md`

## 产品功能

企业空间概览有两个页签：资源用量与排行（默认，保持既有区块）与集群信息；集群信息按聚合接口为每个可见集群渲染一张卡，显示别名/名称、就绪、供应商、Kubernetes 版本、节点数、可见性，就绪卡链接到集群概览，未就绪卡说明不可进入。

### 关联需求

- `prd/kube-frontend/access-control/workspace-console.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-console.md`](../../../../prd/kube-frontend/access-control/workspace-console.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08** — 已知企业空间 `<ws>` 可见若干集群（可能为 0/1/多个），当打开空间控制台概览页并切到「集群信息」页签，则卡片数等于 `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/clusters?limit=-1` 的条数；每张卡显示名称（有别名时主显示别名、次显示名称）、就绪状态徽标、供应商、Kubernetes 版本、节点数与可见性，以及 CPU/内存/容器组/磁盘四项使用率（百分比 + 明细：CPU/内存为「已用/已分配/总量」，容器组/磁盘为「已用/总量」；任一侧缺失显示 `-` 而不是 0%；单项指标不可读只影响该卡该项，不影响身份与链接），缺失字段显示 `-` 而不是 0；Ready 条件为 `True` 的卡提供进入 `/kube-frontend/clusters/<cluster>/overview` 的链接，未就绪的卡不提供链接并说明原因；集群集合为空显示「尚未授权任何集群」空态；聚合接口失败显示错误与重试，而不是空卡片；「资源用量」页签仍显示原有的资源用量与项目排行区块。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-console.md`](../../../../design/kube-frontend/access-control/workspace-console.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-console.md`](../../../../prd/kube-frontend/access-control/workspace-console.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 从空间概览看它在哪些集群上 (Priority: P2)

作为 **企业空间管理员**，我希望 **在概览里看到这个空间可见（被授权/被放置）的每个集群及其就绪状态、供应商、Kubernetes 版本与节点数**，以便 **判断项目能落在哪些集群、哪个集群当前不可用，而不必去平台访问控制里逐项查**。

**Independent Test**：打开 `/workspaces/<ws>/overview` 的「集群信息」页签，卡片数等于 `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/clusters` 的条数；每张卡显示名称/别名、就绪状态、供应商、Kubernetes 版本、节点数与可见性；就绪的卡有进入该集群概览的链接。

## 前置与配置

- 已登录，且在 host 集群；企业空间 system-workspace 存在
- 探测结论（2026-11-17，mlu370）：GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/system-workspace/clusters?limit=-1 返回 200 与完整 Cluster 对象（host、4paradigm）；workspace 对象没有 spec.placement.clusters

## 测试步骤

1. 打开企业空间 system-workspace 概览页，确认默认「资源用量与排行」页签显示原有的资源用量区块
2. 切到「集群信息」页签，等待区块离开 loading
3. 从 API 读取 workspaces/system-workspace/clusters，核对卡片数与接口条数一致
4. 逐卡核对别名/名称、就绪徽标、供应商、Kubernetes 版本、节点数与可见性；缺失字段应为「-」
5. 逐卡核对 CPU/内存/容器组/磁盘四项使用率：从 /kapis/monitoring.kubesphere.io/v1alpha3/cluster 取同一集群的 used/total，按取整百分比核对；缺失分母或指标应显示「-」而不是 0%
6. 对 Ready 条件为 True 的卡，核对存在进入链接且 href 指向 /kube-frontend/clusters/<name>/overview；未就绪卡无链接且有不可进入说明
7. 切回「资源用量与排行」页签，确认资源区块与排行仍在

## 期望结果

- 卡片数 = 聚合接口条数；缺失字段显示「-」而不是 0
- 四项使用率与监控接口的同次 used/total 取整一致；分母缺失显示「-」，监控失败只影响该卡比率
- Ready 条件为 True → 已就绪 + 进入链接；否则未就绪 + 不可进入说明
- 聚合为空时显示「该企业空间尚未授权任何集群」空态；聚合失败时显示错误与重试（本用例在实时环境任一分支成立即断言对应分支）
- 默认资源页签保持既有区块，切页签不重复请求已缓存的查询

## 失败排查

- 页签不可见：确认概览 state=ready；集群信息页签在两个页签组件内
- 卡片数为 0 但接口非空：确认 WorkspaceOverviewPage 使用 workspaceDetailApi.clusters（tenant 聚合）而不是 workspace.spec.placement
- 就绪判断相反：只认 conditions 中 type=Ready 且 status=True；缺条件不算就绪
- 进入链接 404：href 必须是 /kube-frontend/clusters/<name>/overview（应用前缀 + 集群作用域）

## 产品改版后如何更新自动化

- 卡片/字段 data-ai-id 变化时同步本用例与 pages/ 选择器
