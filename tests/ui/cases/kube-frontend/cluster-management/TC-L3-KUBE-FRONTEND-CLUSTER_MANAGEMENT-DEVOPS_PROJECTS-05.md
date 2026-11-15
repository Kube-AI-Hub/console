# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05 DevOps 工程详情 · 七个页签、基本信息、角色与 CD

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-projects`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

工程详情七个页签的默认页、顺序、基本信息字段与每个集合页签的三态；角色页签的预置/模板分类与数量；持续部署页签的列与空态；不存在工程时 not-found 且页签仍可切换。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-07** — Given 打开一个存在的工程详情，Then 页签顺序为 基本信息 / 流水线 / 持续部署 / 代码仓库 / 成员 / 角色 / 凭证，默认选中基本信息且 `aria-selected=true`；基本信息显示名称 / 别名 / 企业空间 / 创建者 / 创建时间 / 描述 / 工程命名空间（`status.adminNamespace`，缺失时回退工程名） / 同步状态 / 部署集群 / 成员数 / 角色数（读不到时显示 `-`）；逐个点击其余页签，其 `aria-selected=true` 且出现该页签的表格、空态或失败原因之一，不出现整页错误；工程不存在时 `:not-found` 可见，页签区不渲染。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_ROLES-01** — Given 打开角色页签，Then 表格列为 名称 / 别名 / 权限模块 / 角色类型 / 创建时间；viewer / operator / admin 显示「预置角色」，带标签 `iam.kubesphere.io/role-template=true` 的角色显示「权限模板」，其他显示「自定义角色」；页签徽标数量等于接口 roles 条数；读取失败显示失败原因与重试。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-01** — Given 打开持续部署页签，Then 表格列为 名称 / 健康状态 / 同步状态 / 目标命名空间；同步与健康状态取 `status.argoApp` 的 `sync.status` / `health.status`，目标命名空间取 `spec.argoApp.spec.destination.namespace`，缺失显示 `-` 且行不消失；空集合显示「该工程还没有持续部署。」；读取失败显示失败原因与重试。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 在工程详情完成日常管理 (Priority: P1)

作为 **DevOps 使用者**，我希望 **工程详情有基本信息、流水线、持续部署、代码仓库、成员、角色、凭证七个页签，默认打开基本信息，每个页签独立加载、独立失败**，以便 **在一个页面上看到并管理工程的全部内容**。

**Independent Test**：打开任一工程详情，默认选中基本信息并显示名称 / 别名 / 企业空间 / 创建者 / 创建时间 / 描述 / 工程命名空间 / 同步状态 / 部署集群 / 成员数 / 角色数；依次点击其余六个页签，每个页签出现表格、空态或失败原因 + 重试之一；切换页签不出现整页错误。

### US12 - 查看工程角色 (Priority: P2)

作为 **DevOps 使用者**，我希望 **在角色页签看到该工程的预置角色与权限模板，并区分预置角色 / 权限模板 / 自定义角色**，以便 **确认邀请成员时可分配哪些角色**。

**Independent Test**：打开角色页签，表格显示名称 / 别名 / 权限模块 / 角色类型 / 创建时间；预置角色 viewer / operator / admin 显示「预置角色」，role-template-* 显示「权限模板」；页签徽标数量等于接口 roles 条数。

### US14 - 查看持续部署并维护 CD 白名单 (Priority: P2)

作为 **DevOps 使用者**，我希望 **在持续部署页签查看应用的同步 / 健康 / 目标命名空间，并在基本信息维护持续部署白名单（可部署的代码仓库与部署位置）**，以便 **控制从哪些仓库能部署到哪里**。

**Independent Test**：打开持续部署页签，无应用显示空态；基本信息区显示白名单的代码仓库与部署位置（未配置显示「未选择」）；点编辑白名单，按行填写仓库与「集群/项目」保存，基本信息回显新值。

## 前置与配置

- 已登录且集群内存在至少一个 status.adminNamespace 可用的 DevOps 工程（B200 有迁移探针工程）；不存在时用例 skip 并记录原因
- 只读用例，不创建对象

## 测试步骤

1. 打开一个存在的工程详情，核对默认页签与基本信息字段
2. 读取七个页签标签顺序
3. 依次点击流水线/持续部署/代码仓库/成员/角色/凭证，核对 aria-selected 与面板三态
4. 在角色页签核对表头、预置角色/权限模板文案与页签数量徽标
5. 在持续部署页签核对表头与空态或表格
6. 再打开一个不存在的工程名，核对 not-found 与页签仍可切换

## 期望结果

- 默认选中基本信息（devops-detail:tab:base-info aria-selected=true）
- 页签顺序为 基本信息/流水线/持续部署/代码仓库/成员/角色/凭证
- 基本信息显示名称/别名/企业空间/创建者/创建时间/描述/工程命名空间/同步状态/部署集群/成员数/角色数，字段值来自接口
- 每个集合页签出现 -table/-empty/-error 中恰好一个，无整页错误
- 角色表头为 名称/别名/权限模块/角色类型/创建时间；viewer/operator/admin 行含「预置角色」，role-template-* 行含「权限模板」；页签徽标数字等于 roles 条数
- 持续部署表头为 名称/健康状态/同步状态/目标命名空间；空集合显示「该工程还没有持续部署。」
- 不存在工程时 devops-detail:not-found 可见，七个页签不渲染

## 失败排查

- 整页 Something went wrong：先看浏览器 pageerror（历史上是 Select 空字符串 value）
- 角色页签空白：roles kapis 404 时应显示 -error 而不是空表
- 命名空间取错：应取 status.adminNamespace，缺失回退工程名

## 产品改版后如何更新自动化

- 选择器：devops-detail:surface/tab:base-info|pipelines|cd|code-repo|members|roles|credentials、basic/name/alias/workspace/creator/created-at/namespace/sync-status/placement/member-count/role-count/allowlist*、各面板 -panel/-table/-empty/-error
- 角色分类文案变化时同步断言
