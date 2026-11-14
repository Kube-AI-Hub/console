# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01 集群项目详情 · 基本信息、配额与限额

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `namespace-detail`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/namespaces/default`
- **需求**: `prd/kube-frontend/cluster-management/namespace-detail.md`

## 产品功能

集群项目列表行下钻的只读项目详情：基本信息（名称/状态/创建时间/标签）+ ResourceQuota used/hard + LimitRange 默认 request/limit；缺失项目有 :not-found 说明。

### 关联需求

- `prd/kube-frontend/cluster-management/namespace-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/namespace-detail.md`](../../../../prd/kube-frontend/cluster-management/namespace-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01** — 已知集群存在项目 `<name>`（命名空间对象可读），当从集群项目列表点击该项目名，则打开项目详情页并显示基本信息（名称/状态/创建时间/标签）；配额区块按 ResourceQuota 的 used/hard 逐资源显示，无配额时显示明确空态；限额范围区块显示 LimitRange 的默认 request/limit，无 LimitRange 时显示明确空态；读取命名空间失败时显示错误面板 + 重试；**项目不存在时显示 `namespace-detail:not-found` 说明**（resources 代理对缺失命名空间返回 500 且消息为 `namespace "<name>" not found`，不能当普通错误重试）；页面只读。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/namespace-detail.md`](../../../../design/kube-frontend/cluster-management/namespace-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/namespace-detail.md`](../../../../prd/kube-frontend/cluster-management/namespace-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群管理员从项目列表下钻一个项目 (Priority: P1)

作为 **集群管理员**，我希望 **在集群的项目列表里点开一个项目，看到它的状态、标签、配额与限额**，以便 **不切换控制台就能判断这个项目是否异常、配额是否接近上限**。

**Independent Test**：从集群项目列表点击一个项目名进入详情，核对名称/状态/创建时间/标签与命名空间对象一致；配额区块显示空态或 used/hard 表；限额区块显示空态或默认 request/limit 表；点返回回到列表。

## 前置与配置

- 已登录，且集群里至少有一个可读项目（带 kubesphere.io/workspace 标签的命名空间）
- 集群级 projects/namespaces 列表与详情接口可读（只读，不依赖 webhook）

## 测试步骤

1. 用 API 读集群命名空间列表，选一个项目（优先 default）
2. 用 API 读该项目 ResourceQuota（期望配额行数 = 各对象 spec.hard 键数之和）与 LimitRange（期望行数 = 条目按 type/resource 展开数）
3. 打开 /kube-frontend/clusters/<cluster>/namespaces 列表，点击项目名链接
4. 核对基本信息、配额区块（表格或空态）、限额区块（表格或空态）
5. 点击返回，确认回到列表
6. 再打开一个不存在的项目名，核对 not-found 句柄

## 期望结果

- 详情 surface 可见且 data-ai-state 为 ready
- 名称等于项目名；状态、标签、创建时间句柄可见
- 有配额时配额表行数等于 hard 键数，否则显示「该项目没有设置资源配额。」
- 有 LimitRange 时限额表行数等于展开数，否则显示「该项目没有限额范围。」
- 返回链接回到 /namespaces 列表
- 不存在的项目显示 namespace-detail:not-found（resources 代理对缺失命名空间返回 500，页面按消息识别），不显示重试

## 失败排查

- 详情整页错误：命名空间路径写错（应为 /kube-frontend/clusters/<c>/namespaces/<name>）
- 缺失项目显示错误面板而非 not-found：只判断了 ApiError.isNotFound，未匹配 500 + not found 消息
- 列表点击无跳转：ClusterListPage namespaces 名称列没有 Link 到 namespace-detail 路由
- 配额/限额空态缺失：B200 两集合都为空，空态是主路径

## 产品改版后如何更新自动化

- 选择器：projects:link:<name>、namespace-detail:surface/name/status/labels/quota/quota-empty/quota-table/limits/limits-empty/limits-table/not-found/back
