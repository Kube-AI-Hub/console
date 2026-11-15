# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08 联邦资源详情 · 完整对象 YAML 与事件

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `federated-projects`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/federatedprojects`
- **需求**: `prd/kube-frontend/access-control/federated-projects.md`

## 产品功能

联邦资源详情显示模板 YAML、完整对象 YAML、分发状态与事件；对象不存在或类型段未知时只显示未找到/未知类型说明，不显示 YAML 或事件表。

### 关联需求

- `prd/kube-frontend/access-control/federated-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08** — 已知存在一个已联邦对象，当打开其详情，则「模板与分发」页签显示 `spec.template` 的 YAML、完整对象 YAML、分发集群与条件表；当打开「事件」页签，则列出以该 Federated 对象为 involved object 的事件（列与项目事件一致），无事件与读取失败分别显示对应说明并可重试；已知对象不存在或资源类型段未知，则分别显示未找到与未知类型说明，且不显示 YAML 或事件表。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/federated-projects.md`](../../../../design/kube-frontend/access-control/federated-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 深入一个联邦项目的对象状态 (Priority: P2)

作为 **企业空间管理员**，当联邦项目没有按预期传播时，我希望 **看到控制面回报的传播条件、对象的标签与注解、以及与该对象相关的事件，并能下钻到每个联邦资源的完整对象 YAML 与事件**，以便 **判断是放置没生效、控制面拒绝还是同步失败**。

**Independent Test**：打开一个联邦项目详情，核对传播条件表与元数据页签；打开事件页签核对事件列；进入一个联邦资源详情，核对完整对象 YAML 与事件页签；对被删除的对象核对未找到说明。

## 前置与配置

- 已登录，联邦 API 可读写，至少一个就绪集群
- 预置一个唯一名称的联邦项目（宿主编 managed=true，放置 host）
- 该项目的命名空间可写 FederatedConfigMap

## 测试步骤

1. 用 API 在项目命名空间创建一个唯一名称的 FederatedConfigMap（模板含探针键），轮询到 status.clusters 回报
2. 打开该项目详情，切到「配置」页签，点击该对象行进入资源详情
3. 核对模板 YAML、完整对象 YAML、分发集群与条件表
4. 打开「事件」页签，核对事件表或空态说明
5. 打开 deployments 下不存在的对象，核对未找到说明且没有 YAML 区块
6. 打开 widgets 未知类型段，核对未知类型说明
7. 清理：删除 FederatedConfigMap、防御性删除已分发的本地 ConfigMap、删除宿主命名空间

## 期望结果

- 资源详情标题为对象名，类型徽标为 FederatedConfigMap
- {'模板 YAML 含探针键与值；完整对象 YAML 含 kind': 'FederatedConfigMap 与 spec'}
- 分发区块显示 host 集群徽标与至少一条条件；控制面未回报时显示明确的无状态说明
- 事件页签有事件时表头为 级别/原因/消息/次数/最近发生/来源，无事件时显示「暂无事件。」并可重试
- 不存在的对象显示「该联邦资源不存在或已被删除。」且模板/分发/事件区块都不出现
- 未知类型段显示「未知的联邦资源类型。」
- 清理后 FederatedConfigMap、本地副本与宿主命名空间都不存在

## 失败排查

- 完整对象 YAML 为空：读的是 spec.template 而不是完整对象
- 事件为空：控制面事件可能延迟；等待后重试，或断言空态说明
- 行链接 404：URL 段与 API 集合名映射错误；检查 FEDERATED_RESOURCE_SEGMENTS

## 产品改版后如何更新自动化

- 选择器：federated-project:resource:configmaps/<name> / federated-resource:surface / :title / :kind / :template / :object:yaml / :distribution / :not-found / :tab:events
- 详情结构变化时同步 FederatedResourceDetailPage
