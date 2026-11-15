# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03 流水线详情 · 基本信息、运行记录与配置入口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-projects`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

DevOps 工程详情的流水线行可进入流水线详情：基本信息（名称/类型/同步状态/健康/校验/创建者/创建时间/工程命名空间/描述）+ 运行记录区（状态/编号/提交/最近消息/耗时/开始时间），运行记录独立显示表格/空态/失败+重试；流水线不存在时显示 not-found，运行记录区随详情不渲染；页面提供运行与重跑（不提供停止）。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03** — 已知工程详情的流水线页签有行数据，当点击行名称，则进入流水线详情 URL（`…/devops/<name>/pipelines/<pipeline>`）；流水线详情显示基本信息（名称/类型/状态/创建时间）与运行记录区，运行记录区显示表格、空态或失败原因+重试之一（列头为编号/状态/开始时间/耗时）；流水线不存在时显示 `:not-found`（运行记录区随详情一起不渲染）；页面提供运行 / 重跑入口（不提供停止），运行请求与结果见运行记录。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 下钻一条流水线看运行记录 (Priority: P2)

作为 **DevOps 使用者**，我希望 **从工程详情的流水线行点进流水线详情，看到它的运行记录（编号/状态/开始时间/耗时）**，以便 **判断最近一次构建是否成功、耗时多久，不必切换旧控制台**。

**Independent Test**：点击工程详情流水线页签的行名称，进入流水线详情 URL；或在 0 流水线环境下直接打开一条不存在流水线的 URL，核对 not-found 与运行记录空态/失败态可辨。

## 前置与配置

- 已登录，且 devopsprojects/kapis pipelines/pipelineruns 可读（当前集群存在探针工程与流水线）
- 错误态通过拦截 pipelineruns 请求构造；只读（本用例不点运行）

## 测试步骤

1. 用 API 读 devopsprojects 与目标命名空间下的 pipelines，确定要打开的工程与流水线（不存在时用 tc-e2e-missing 名称）
2. 拦截 pipelineruns 列表返回 422，打开流水线详情 URL
3. 读取页面状态：存在流水线时核对基本信息，不存在时核对 :not-found
4. 读取运行记录区：失败原因 + 重试按钮
5. 解除拦截并点击重试，读取运行记录的空态或表格
6. 工程与流水线都存在时，从工程详情流水线页签点击行链接进入详情

## 期望结果

- 页面外壳 pipeline-detail:surface 可达，data-ai-state 离开 loading
- 流水线存在时 pipeline-detail:basic 显示名称/类型/同步状态/健康/校验/创建者/创建时间/命名空间/描述；不存在时 pipeline-detail:not-found 可见且运行记录区不渲染
- 运行记录区先显示 pipeline-detail:runs-error 与 runs-retry（含拦截消息）；解除拦截重试后显示 runs-empty 或 runs-table 之一，错误消失
- 表格存在时表头包含 状态/编号/提交/耗时/开始时间；空态文案为「该流水线还没有运行记录。」
- 流水线行链接的 href 指向 …/devops/<工程>/pipelines/<流水线>；详情存在 pipeline-detail:run 与重放入口，不存在停止入口

## 失败排查

- 运行记录 404：不要用 pipelines/<name>/pipelineruns（原生 API 不存在该子资源），读 namespaces/<ns>/pipelineruns
- 运行记录状态空白：状态在注解 devops.kubesphere.io/jenkins-pipelinerun-status（JSON），不在 status；无注解应为「未运行」
- 命名空间读错：命名空间来自工程 status.adminNamespace，缺失时回退工程名
- 页签/详情 404：路由需要 devops/$name/{route,index}.tsx 布局渲染 Outlet

## 产品改版后如何更新自动化

- 选择器：pipeline-detail:surface/not-found/basic/name/type/sync-status/health/validate/created-at/namespace/description、runs/runs-table/runs-empty/runs-error/runs-retry、run、行 data-ai-row、工程详情链接 devops-detail:pipeline:<name>
