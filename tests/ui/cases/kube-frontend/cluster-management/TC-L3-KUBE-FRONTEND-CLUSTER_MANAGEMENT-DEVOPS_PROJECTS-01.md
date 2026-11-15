# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01 DevOps 工程 · 列表与详情三态骨架

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-projects`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

集群作用域的 DevOps 区域：列表（devopsprojects CRD，名称/描述/企业空间/创建时间，空态明确，右上提供创建入口）与详情（默认基本信息；成员/角色/凭证页签各集合独立显示表格/空态/失败原因+重试；工程不存在时 not-found，页签仍可切换）。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 已知集群的 `devopsprojects` 列表有 N 个工程（N 可能为 0），当打开集群 DevOps 列表，则列出 N 行（名称/描述/所属企业空间/创建时间），名称为进入详情的链接；N 为 0 时显示明确空态。打开详情 `/devops/<name>` 时，显示基本信息（名称/企业空间/创建者/创建时间/描述）；成员 / 角色 / 凭证三个页签可切换，各自独立读取：能读则显示表格，集合为空显示空态，读取失败显示失败原因与重试（不显示空表冒充「没有」）；工程不存在时显示 `:not-found`。列表提供创建入口，详情提供编辑信息与删除入口。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群管理员进入 DevOps 工程 (Priority: P1)

作为 **集群管理员**，我希望 **在集群控制台里看到全部 DevOps 工程并能打开其中一个**，以便 **不切换旧控制台就能确认工程是否存在、归属哪个企业空间、有哪些成员/角色/凭证**。

**Independent Test**：打开 `/clusters/<cluster>/devops`，核对行数与 `devopsprojects` CRD 列表一致（当前为 0 时显示空态）；打开任一存在的工程，核对基本信息区与三个属性页签可切换，且每个页签显示表格、空态或失败原因之一；工程不存在时只显示 not-found。

## 前置与配置

- 已登录，且 devopsprojects CRD 与 iam/devops kapis 集合可读（B200 有 1 个迁移探针工程，0 工程时空态分支保留）
- 只读用例，不创建对象

## 测试步骤

1. 用 API 读 /apis/devops.kubesphere.io/v1alpha3/devopsprojects 得到工程数 N
2. 打开集群 DevOps 列表，等待 devops:surface 离开 loading
3. N 为 0 时核对空态文案与 0 行；N>0 时核对行数与 N、并确认名称链接存在
4. 打开详情：有工程用第一个工程名，否则用 tc-e2e-missing-devops
5. 等待 devops-detail:surface；不存在时核对 :not-found，存在时核对默认页签 base-info aria-selected=true 与基本信息可见
6. 依次点击 成员 / 角色 / 凭证 页签，核对 aria-selected 与面板可见，且面板内出现表格/空态/失败原因之一

## 期望结果

- 列表 surface 可见且 data-ai-state 为 empty（N=0）或 ready；列表存在 devops:create 创建入口
- 空态显示「暂无 DevOps 工程」；有数据时行数为 N，每行 data-ai-row 与接口对象名一致
- 详情默认 tab:base-info aria-selected=true；存在工程时基本信息卡可见
- 每个属性页签点击后 aria-selected=true，面板 devops-detail:<tab>-panel 可见
- 每个面板恰好显示 devops-detail:<tab>-table / :<tab>-empty / :<tab>-error 之一，不出现空表冒充空态
- 工程不存在时 devops-detail:not-found 可见；页签区不渲染（不向不存在的工程发起集合请求）

## 失败排查

- 列表整页错误：误用了 /kapis/devops.kubesphere.io/v1alpha3/devopsprojects（该路径 404），应读 /apis/... CRD
- 页签面板空白：只渲染了表格，未处理 pending/empty/error 三态
- 详情 404 处理错：CRD 404 的 Status 应映射为 ApiError.isNotFound，不要把 404 当普通错误重试
- 整页 Something went wrong：先看浏览器 pageerror（历史上是 Select 空字符串 value）

## 产品改版后如何更新自动化

- 选择器：devops:surface/devops:create/devops:link:<name>/devops:retry；devops-detail:surface/title/basic/not-found/tab:base-info|members|roles|credentials 与各面板 -panel/-table/-empty/-error/-retry
