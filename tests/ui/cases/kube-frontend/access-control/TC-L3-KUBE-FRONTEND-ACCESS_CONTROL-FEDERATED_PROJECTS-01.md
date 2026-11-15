# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01 联邦项目列表与详情骨架

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `federated-projects`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/federatedprojects`
- **需求**: `prd/kube-frontend/access-control/federated-projects.md`

## 产品功能

企业空间作用域的联邦项目列表（名称/命名空间/部署集群/创建时间）与详情概览骨架（基本信息 + 已联邦资源类型只读列表）；数据直接读联邦 API；空态、未找到与读取失败都有明确说明。

### 关联需求

- `prd/kube-frontend/access-control/federated-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 已知企业空间内存在至少一个 FederatedNamespace，当打开 `/kube-frontend/workspaces/<ws>/federatedprojects`，则列表显示这些项目（名称、命名空间、部署集群、创建时间），行数与该企业空间的 FederatedNamespace 数一致；当点击名称，则进入详情骨架，显示名称、命名空间、企业空间、部署集群、传播状态、创建时间、创建者，以及一份「已联邦资源类型」只读列表（来自联邦 API discovery 的命名空间级 Federated 类型）；已知企业空间没有联邦项目，则列表显示「暂无联邦项目」空态说明；已知对象不存在或读取失败，则详情页分别显示明确的未找到/失败说明，而不是空白页。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/federated-projects.md`](../../../../design/kube-frontend/access-control/federated-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 查看企业空间里的联邦项目与其部署范围 (Priority: P1)

作为 **企业空间管理员**，我希望 **在企业空间里看到联邦项目列表，并点进任一项目确认它部署在哪些集群、传播是否正常、项目内已联邦了哪些对象**，以便 **在联邦控制面之外有一个可核对的入口，而不是只能靠 kubectl**。

**Independent Test**：打开企业空间的联邦项目页，核对列表行数与联邦 API 一致；点进一行，核对基本信息、资源类型列表与三个资源页签；再点开一个联邦资源，核对模板、完整对象与分发信息。

## 前置与配置

- 已登录，且能看到至少一个企业空间
- 联邦 API（/apis/types.kubefed.io/v1beta1）可读，且至少有一个 FederatedNamespace

## 测试步骤

1. 读联邦 API 的 federatednamespaces，按 template 的 kubesphere.io/workspace 标签分组，选一个有联邦项目的企业空间与其期望行数
2. 读联邦 API discovery，统计命名空间级 Federated 资源类型数
3. 打开 /kube-frontend/workspaces/<ws>/federatedprojects，等待就绪
4. 核对表头、行数与行名称集合
5. 点击一个名称进入详情，核对基本信息与资源类型列表行数
6. 若存在没有联邦项目的企业空间，打开其列表页核对空态文案

## 期望结果

- 表头为 名称/命名空间/部署集群/创建时间
- 行数等于该企业空间的 FederatedNamespace 数，行句柄与名称一致
- 详情显示名称、命名空间、企业空间、部署集群、传播状态、创建时间、创建者
- 详情「已联邦资源类型」行数等于 discovery 中 namespaced 的资源类型数，表头 类型/资源
- 没有联邦项目的企业空间显示「暂无联邦项目」空态说明

## 失败排查

- 列表为空但联邦 API 有对象：workspace 过滤读了对象 metadata 标签而不是 spec.template 标签
- 详情 404：用了按名称的集群级 GET；FederatedNamespace 是 namespaced 资源，应走集合查找
- 类型列表为空：discovery 没读到或把 cluster-scoped 类型也算了进来

## 产品改版后如何更新自动化

- 选择器：federated-projects:surface / federated-projects:open:<name> / federated-project:surface / :basic / :types
- 数据源或过滤规则变化时同步改 pages/federated/queries.ts 与用例的探测
