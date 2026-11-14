# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03 联邦资源详情 · 模板与分发

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `federated-projects`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/federatedprojects`
- **需求**: `prd/kube-frontend/access-control/federated-projects.md`

## 产品功能

联邦项目资源页签的行名称链接到只读的联邦资源详情：名称/命名空间/类型徽标、spec.template 的只读 YAML、status.clusters 与 status.conditions 的分发信息；未找到、未知类型、无分发状态分别有明确说明。

### 关联需求

- `prd/kube-frontend/access-control/federated-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03** — 已知联邦项目的资源页签里存在至少一个已联邦对象（或直接访问该对象的详情 URL），当点击资源行名称，则进入该对象的只读详情：显示对象名称、命名空间与类型徽标，「模板」区块以 YAML 展示 `spec.template`，「分发」区块以集群徽标与条件表展示 `status.clusters` / `status.conditions`；已知对象不存在（404），则显示明确的未找到说明；已知对象还没有分发状态，则「分发」区块显示明确说明而不是空表；已知资源类型段未知，则显示未知类型说明。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/federated-projects.md`](../../../../design/kube-frontend/access-control/federated-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 查看企业空间里的联邦项目与其部署范围 (Priority: P1)

作为 **企业空间管理员**，我希望 **在企业空间里看到联邦项目列表，并点进任一项目确认它部署在哪些集群、传播是否正常**，以便 **在联邦控制面之外有一个只读的核对入口，而不是只能靠 kubectl**。

**Independent Test**：打开企业空间的联邦项目页，核对列表行数与联邦 API 一致；点进一行，核对基本信息与资源类型列表。

## 前置与配置

- 已登录，且联邦 API（/apis/types.kubefed.io/v1beta1）可读写，至少有一个带 workspace 标签的 FederatedNamespace
- 该联邦项目的命名空间存在，联邦控制器正在工作（用于写入临时 FederatedConfigMap）

## 测试步骤

1. 读 federatednamespaces，选一个联邦项目（名称/命名空间/所属企业空间）
2. 创建一个唯一名称的 FederatedConfigMap（spec.template 含一个探针键），轮询到 status.clusters 回报
3. 打开该项目详情，切到「配置」页签，找到该对象行链接并核对 href
4. 点击行名称进入资源详情，核对标题、类型徽标、模板 YAML、分发集群与条件表
5. 点击返回链接回到项目详情
6. 打开 deployments 与 services 下不存在的对象，核对未找到说明；打开未知类型段，核对未知类型说明
7. finally 删除 FederatedConfigMap，并防御性删除已分发的本地 ConfigMap

## 期望结果

- 配置页签出现对象行，名称是链接，href 为 /federatedprojects/<项目>/configmaps/<对象>
- 资源详情标题为对象名，类型徽标为 FederatedConfigMap
- 模板区块的 YAML 含探针键与值
- 分发区块显示 host 集群徽标与至少一条 Propagation 条件（或控制面未回报时显示明确的无状态说明）
- deployments/services 的不存在对象显示「该联邦资源不存在或已被删除」
- 未知类型段显示「未知的联邦资源类型」
- 用例结束后临时 FederatedConfigMap 与分发的本地 ConfigMap 都不存在

## 失败排查

- 行不可点：FederatedResourceTable 的 segment 映射缺失，href 落到重复 plural
- 详情一直加载：详情 GET 用了集群级路径（FederatedConfigMap 是 namespaced 资源，要带 namespace）
- 模板为空：读的是 spec 而不是 spec.template
- 分发为空但对象已分发：status 回报有延迟，等几秒再断言
- 清理失败：删除联邦对象会级联删除本地副本；若级联未发生，finally 里按名称补删本地 ConfigMap

## 产品改版后如何更新自动化

- 选择器：federated-project:resource:configmaps/<name> / federated-resource:surface / :title / :kind / :template / :distribution / :not-found
- 分组或 URL 段映射变化时同步改 queries.ts 的 FEDERATED_RESOURCE_SEGMENTS 与本用例
