# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-04 项目网关页 · 集群网关卡片（只读 + 链到集群详情）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `gateway`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/gateways`
- **需求**: `prd/kube-frontend/project-settings/gateway.md`

## 产品功能

项目网关页顶部显示集群网关卡片（名称/访问方式/访问地址）与「查看详情」，链接到该集群的网关详情页；集群没有网关时不渲染。

### 关联需求

- `prd/kube-frontend/project-settings/gateway.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/gateway.md`](../../../../prd/kube-frontend/project-settings/gateway.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-04** — 已知集群存在集群网关，当打开任一项目的网关设置页，则页面顶部显示「集群网关」卡片（名称、访问方式、访问地址）与「查看详情」链接，链接指向该集群的网关详情页；集群没有网关时该卡片不渲染。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/gateway.md`](../../../../design/kube-frontend/project-settings/gateway.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/gateway.md`](../../../../prd/kube-frontend/project-settings/gateway.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 让项目的路由有对外入口 (Priority: P1)

作为 **项目管理员**，我希望 **在没有网关时一键创建，并看到它是否部署成功**，以便 **知道应用路由能不能被访问**。

**Independent Test**：打开网关设置页，创建网关后页面切到信息态并能看到状态徽标。

## 前置与配置

- 已登录，host 集群；集群存在网关（旧站对照页可见）

## 测试步骤

1. 用 API 读集群网关列表，记录第一条的名称/访问方式/地址
2. 打开 /kube-frontend/system-workspace/clusters/host/projects/default/gateways
3. 等 gateway:surface 就绪
4. 核对 gateway:cluster-gateway 卡片可见，名称/访问方式/地址与 API 读到的值一致
5. 核对 gateway:cluster-gateway-detail 链接的 href 指向 /kube-frontend/clusters/host/gateways/<名称>

## 期望结果

- 卡片在项目网关区块之上；三项字段来自集群网关对象
- 链接指向集群作用域详情页，且不带项目段

## 失败排查

- 卡片不出现：集群网关列表为空或读取失败（卡片按「有才渲染」处理）
- 地址为空：网关 Service 还没创建，显示 `-` 而不是编造

## 产品改版后如何更新自动化

- 句柄：gateway:cluster-gateway / :cluster-name / :cluster-type / :cluster-address / :cluster-gateway-detail
