# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-05 集群级服务账号 · 行操作（编辑 / 修改角色 / 删除）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-config`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{CLUSTER}/serviceaccounts`
- **需求**: `prd/kube-frontend/cluster-management/cluster-config.md`

## 产品功能

集群级服务账号的普通行提供编辑/编辑 YAML/修改角色/删除，写按行所属项目寻址；联邦托管行无操作。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-config.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-05** — 已知集群级「服务账号」页里有一个普通服务账号与一个联邦托管的服务账号，当打开普通行的更多操作，则提供「编辑 / 编辑 YAML / 修改角色 / 删除」，联邦托管行不渲染任何操作；编辑保存后按该行自己的项目更新注解；修改角色保存后该账号在该项目里的角色随之改变；删除确认后该对象从列表消失。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-config.md`](../../../../design/kube-frontend/cluster-management/cluster-config.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目定位一份配置 (Priority: P1)

作为 **集群管理员**，我希望 **不进入具体项目就按名称检索集群里的保密字典 / 配置字典 / 服务账号**，以便 **先确认对象属于哪个项目，再跳到该项目里处理**。

**Independent Test**：打开集群级保密字典页，核对行数等于 `min(20, total)`、项目列等于对象命名空间、名称链接含 `/projects/<namespace>/secrets/<name>`；对配置字典与服务账号各重复一次。

## 前置与配置

- 已登录，host 集群，admin
- 用例在 default 创建唯一命名的服务账号，结束后删除

## 测试步骤

1. 用 API 创建服务账号 tc-e2e-sa-<stamp>
2. 打开 /kube-frontend/clusters/host/serviceaccounts，搜索到该名称
3. 打开该行更多操作，核对四项（编辑 / 编辑 YAML / 修改角色 / 删除）
4. 点「编辑」，修改描述并确认；用 API 回读 kubesphere.io/description
5. 点「修改角色」，选择一个角色并确认；用 API 读该项目的 RoleBinding 或账号角色字段核对
6. 再打开更多操作点「删除」，输入名称确认；用列表确认对象消失

## 期望结果

- 四项操作齐全且顺序为 编辑 → 编辑 YAML → 修改角色 → 删除
- 编辑按行所属项目更新注解
- 修改角色写在该行所属项目
- 删除后对象从列表与 API 集合中消失

## 失败排查

- 修改角色保存失败：角色写入用了页面命名空间（空）而不是行命名空间
- 删除后还在：DELETE 少了 namespaces 段

## 产品改版后如何更新自动化

- 行 data-ai-row=<namespace>/<name>；菜单项见 serviceaccounts.action.* / resource.action.*
