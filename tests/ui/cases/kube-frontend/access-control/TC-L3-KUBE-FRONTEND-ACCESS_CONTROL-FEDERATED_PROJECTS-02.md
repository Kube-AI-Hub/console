# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02 联邦项目详情 · 已联邦资源页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `federated-projects`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/federatedprojects`
- **需求**: `prd/kube-frontend/access-control/federated-projects.md`

## 产品功能

联邦项目详情提供 概览 / 应用负载 / 配置 / 存储 四个只读页签，后三者按项目命名空间列出对应 Federated 类型对象（名称/类型/创建时间）；每个页签独立处理加载、空态与失败+重试，概览保留基本信息与资源类型列表。

### 关联需求

- `prd/kube-frontend/access-control/federated-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02** — 已知联邦项目详情可用，当打开它，则页签为「概览 / 应用负载 / 配置 / 存储」且默认在概览（保留基本信息与资源类型列表）；当分别打开「应用负载 / 配置 / 存储」，则每个页签列出该项目命名空间下对应 Federated 类型对象（名称、类型、创建时间），行数等于这些集合的 API 条数之和；已知某页签对应的集合都没有对象，则该页签显示明确的空态说明；已知某集合读取失败，则该页签显示失败说明与重试，不显示空表。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/federated-projects.md`](../../../../design/kube-frontend/access-control/federated-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 查看企业空间里的联邦项目与其部署范围 (Priority: P1)

作为 **企业空间管理员**，我希望 **在企业空间里看到联邦项目列表，并点进任一项目确认它部署在哪些集群、传播是否正常**，以便 **在联邦控制面之外有一个只读的核对入口，而不是只能靠 kubectl**。

**Independent Test**：打开企业空间的联邦项目页，核对列表行数与联邦 API 一致；点进一行，核对基本信息与资源类型列表。

## 前置与配置

- 已登录，且联邦 API（/apis/types.kubefed.io/v1beta1）可读，至少有一个 FederatedNamespace
- 该项目命名空间下的 Federated 集合可读（可以为空）

## 测试步骤

1. 读 federatednamespaces，选一个联邦项目（名称/命名空间/所属企业空间）
2. 分别读该项目命名空间下 应用负载 / 配置 / 存储 三组 Federated 集合，记录每组对象数
3. 打开该项目详情，等待就绪
4. 核对四个页签与默认概览面板（基本信息、资源类型列表）
5. 依次点开 应用负载 / 配置 / 存储 页签，读取该页签的空态或表格行数
6. 切回概览

## 期望结果

- 页签为 概览 / 应用负载 / 配置 / 存储，默认选中概览
- 概览显示基本信息与已联邦资源类型列表
- 每个资源页签：行数等于该组集合 API 条数之和；集合都为空时显示「这个联邦项目下还没有此类已联邦资源。」空态，不显示空表
- 资源页签表头为 名称/类型/创建时间（有对象时）
- 切换回概览后基本信息仍可见

## 失败排查

- 资源页签一直是骨架：组内某个集合请求未返回；检查 discovery 里的 plural 是否与集合名一致
- 页签显示失败：检查该项目命名空间是否存在（联邦项目名 = 命名空间）
- 概览丢内容：父级 detail 查询失败或 tab 默认值被改

## 产品改版后如何更新自动化

- 选择器：federated-project:tab:<tab>[:trigger] / federated-project:resources:<tab>[:empty|:error|:retry]
- 分组集合变化时同步改 FederatedProjectDetailPage 的 *_PLURALS 与用例的探测
