# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01 DevOps 凭证 · 四类型创建、编辑与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-credentials`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

凭证页签四类型（用户名密码/SSH/密钥文本/kubeconfig）创建与字段切换、列表类型/用户名/同步状态展示、编辑时名称与类型只读且敏感值不回显、删除需输入名称确认；对象唯一前缀并在 finally 清理。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01** — Given 打开凭证页签，Then 表格列为 名称 / 类型 / 用户名 / 同步状态 / 描述 / 操作；创建对话框可在用户名密码、SSH 密钥、密钥文本、kubeconfig 四种类型间切换并显示各自字段，提交 POST `/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials`；列表读取 `/api/v1/namespaces/<ns>/secrets` 且只展示四种 `credential.devops.kubesphere.io/*` 类型的 Secret；创建后行出现，类型列显示对应文案，用户名密码 / SSH 回显用户名，同步状态取注解；名称为空或非法时提示；失败保留输入并显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-02** — Given 凭证列表有行，When 点编辑改描述与敏感字段并保存，Then 名称与类型只读；保存 PUT `/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials/<credential>?content=1` 且 data 重新 base64；成功后列表描述更新、密码与私钥不回显；删除需在对话框输入凭证名确认，成功后行消失；取消不写；失败显示服务端消息。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US10 - 管理四类凭证 (Priority: P1)

作为 **DevOps 使用者**，我希望 **创建用户名密码、SSH 密钥、密钥文本、kubeconfig 四种凭证，查看列表中的名称 / 类型 / 用户名 / 同步状态 / 描述，编辑已有凭证的敏感数据与描述（名称与类型不可改），并删除不需要的凭证**，以便 **让流水线可以复用统一的仓库与集群凭据**。

**Independent Test**：在凭证页签点创建，切换四种类型分别填写对应字段并提交；列表出现四条，类型与同步状态列正确；编辑一条改描述并保存，列表描述更新且密码 / 私钥不回显；删除一条并输入名称确认，行消失且其余三条保留。

## 前置与配置

- 已登录且存在含命名空间的 DevOps 工程；不存在时 skip
- 用例创建 4 条凭证（pwspec-cred- 前缀），finally 删除全部自建凭证
- 不展示、不记录密码/私钥正文

## 测试步骤

1. 打开凭证页签，核对表头与空态
2. 创建用户名密码凭证：填名称/用户名/密码提交，核对行与接口 Secret
3. 依次创建 SSH、密钥文本、kubeconfig 凭证并核对类型列
4. 用接口读 Secret 核对四种 credential.devops.kubesphere.io/* 类型与 data 存在
5. 编辑用户名密码凭证：核对名称与类型 disabled，改描述与密码保存，核对列表描述与接口 data
6. 删除其中一条：输入名称确认，核对行消失与接口 404

## 期望结果

- 表头为 名称/类型/用户名/同步状态/描述/更多操作
- 四种类型创建后行的类型列分别为 用户名和密码/SSH 密钥/密钥文本/kubeconfig；用户名密码与 SSH 回显用户名
- 同步状态列显示接口注解值（如 pending），缺省显示 -
- 编辑对话框名称输入框与类型下拉 disabled；密码/私钥不回显；保存后列表描述更新
- 删除需输入完整名称才可确认；删除后行消失且接口 GET 404

## 失败排查

- 列表一直为空：读的是 /api/v1/namespaces/<ns>/secrets 并按 type 过滤，不是 kapis credentials 列表
- 创建 200 但列表没有：确认 Secret type 为 credential.devops.kubesphere.io/*
- 同步状态空白：注解 credential.devops.kubesphere.io/syncstatus 可能延迟

## 产品改版后如何更新自动化

- 选择器：devops-detail:tab:credentials、credentials-create、devops:credential-form-name/-kind/-username/-password/-private-key/-passphrase/-secret/-kubeconfig/-description/-submit、credential-edit/delete:<name>、delete-input/delete-confirm
- 类型字段变化时同步 pages/devops_page.py 的 create_credential
