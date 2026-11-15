# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01 DevOps 代码仓库 · 导入、列表与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-code-repos`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

代码仓库页签的列与空态、导入对话框名称校验、导入 GitRepository 后行出现、删除需输入名称确认；对象唯一前缀并在 finally 删除。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01** — Given 打开代码仓库页签，Then 表格列为 名称 / 提供方 / 仓库地址 / 访问凭证 / 操作，空集合显示「该工程还没有代码仓库。」；点导入填名称 / 提供方 / 仓库地址 / 访问凭证 / 描述提交 POST `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/gitrepositories`，成功后行出现（提供方显示 `spec.provider` 原值如 `github`，未填访问凭证显示 `-`）；名称为空或非法时提示；删除需输入名称确认，成功后行消失；失败显示服务端消息。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US13 - 导入与管理代码仓库 (Priority: P2)

作为 **DevOps 使用者**，我希望 **在代码仓库页签导入 GitRepository（名称 / 提供方 / 仓库地址 / 访问凭证 / 描述），在列表中看到提供方、地址、访问凭证，并删除不再使用的仓库**，以便 **为流水线提供可复用的代码源登记**。

**Independent Test**：打开代码仓库页签点导入，名称非法时提示；填唯一名称、github、仓库地址提交，行出现且提供方 / 地址 / 访问凭证正确；点删除并输入名称确认，行消失回到空态。

## 前置与配置

- 已登录且存在含命名空间的 DevOps 工程；不存在时 skip
- 用例创建 1 条 GitRepository（pwspec-repo- 前缀），finally 删除
- 不删除非本用例创建的仓库

## 测试步骤

1. 打开代码仓库页签，核对表头与空态
2. 点导入，空名称提交核对校验提示
3. 填唯一名称、提供方 GitHub、仓库地址提交，核对行与接口对象
4. 点删除，输入名称确认，核对行消失与接口 404

## 期望结果

- 表头为 名称/提供方/仓库地址/访问凭证/更多操作；空集合显示「该工程还没有代码仓库。」
- 空名称提交显示「请输入名称。」且不发请求
- 导入后行出现，提供方显示 spec.provider 原值（本环境为 github）、仓库地址等于提交值，未填访问凭证显示 -
- 删除需输入完整名称才可确认；删除后行消失且接口 GET 404

## 失败排查

- 列表为空：读 /apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/gitrepositories，不是 coderepositories
- 创建 404：命名空间必须取工程 status.adminNamespace（缺失回退工程名）
- 删除后行不消失：写后需 invalidate code-repos 查询

## 产品改版后如何更新自动化

- 选择器：devops-detail:tab:code-repo、coderepo-create、devops:coderepo-form-name/-provider/-url/-secret/-description/-submit、coderepo-delete:<name>、delete-input/delete-confirm
- 提供方选项变化时同步 pages/devops_page.py
