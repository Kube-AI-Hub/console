# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02 DevOps 工程详情 · 流水线 / 持续部署 / 代码仓库页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-projects`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

DevOps 工程详情的流水线 / 持续部署 / 代码仓库三个集合页签：命名空间取工程的 status.adminNamespace（对象不存在时回退工程名），每个页签独立显示表格/空态/失败原因+重试；流水线页签使用 kapis 服务端分页列表；工程不存在时基本信息显示 not-found，页签区不渲染。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 已知打开一个 DevOps 工程详情（工程存在或使用不存在工程名），当页签区出现流水线 / 持续部署 / 代码仓库，则三个页签都可切换且各自独立显示表格、空态或失败原因+重试之一；读取的三类资源都使用工程的命名空间（`status.adminNamespace`，对象不存在/未写入时回退为工程名，并在基本信息里显示实际取值）；工程不存在时基本信息显示 `:not-found`，页签区不渲染。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 在工程详情里看到流水线、持续部署与代码仓库 (Priority: P2)

作为 **DevOps 使用者**，我希望 **打开工程详情就能看到该工程的流水线、持续部署（CD）和代码仓库（GitRepository）**，以便 **不切换到旧控制台或多个 CLI 就能确认工程里有什么、部署状态如何**。

**Independent Test**：打开一个工程（或不存在工程名）的详情，依次切到流水线 / 持续部署 / 代码仓库页签，核对命名空间取值为 `status.adminNamespace`（对象不存在时为工程名）、每个页签三态之一可见，且三个读取互不拖垮。

## 前置与配置

- 已登录，且 devopsprojects、kapis pipelines、gitrepositories、gitops applications 可读
- 错误态通过拦截 kapis 流水线列表请求构造；只读用例，不创建对象

## 测试步骤

1. 用 API 读 devopsprojects 得到工程数 N；N>0 用第一个工程名与它的 status.adminNamespace，N=0 用 tc-e2e-missing-devops 工程名
2. 拦截 kapis /devops/<project>/pipelines 列表返回 422，打开详情
3. 切到流水线页签，读取失败原因与重试按钮
4. 解除拦截并点击重试，读取流水线页签的「共 N 条」/表格/空态
5. 依次切到持续部署、代码仓库页签
6. N>0 时读取基本信息里的工程命名空间

## 期望结果

- 三个页签（devops-detail:tab:pipelines|cd|code-repo）可见且可切换，点击后 aria-selected=true、对应面板可见
- 流水线页签先显示 devops-detail:pipelines-error 与 pipelines-retry；解除拦截并重试后显示 pipelines-empty 或 pipelines-table，不再显示 error
- 持续部署与代码仓库各显示 cd-table/-empty 与 code-repo-table/-empty 之一，不出现空表冒充空态
- 命名空间取值正确：N>0 时 devops-detail:namespace 等于工程的 status.adminNamespace（缺失则工程名）；N=0 时 devops-detail:not-found 可见，集合页签不渲染（该分支跳过集合断言）

## 失败排查

- 流水线请求 404：应使用 /kapis/devops.kubesphere.io/v1alpha3/devops/<project>/pipelines（服务端分页），不是 /apis/namespaces/<ns>/pipelines
- 代码仓库 404：资源名是 gitrepositories，不是 coderepositories
- 持续部署 404：读 /apis/gitops.kubesphere.io/v1alpha1/namespaces/<adminNamespace>/applications，devops 组没有 cd
- 命名空间读错：DevOpsProject 的工程命名空间在 status.adminNamespace，不是 metadata.name
- 拦截不生效：kapis 列表 URL 带 ?page=&limit=，正则必须允许 query

## 产品改版后如何更新自动化

- 选择器：devops-detail:surface/not-found/namespace/tab:pipelines|cd|code-repo 与各面板 -panel/-table/-empty/-error/-retry
