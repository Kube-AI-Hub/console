# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-04 集群级保密字典 · 行操作（编辑信息 / 设为默认 / 删除）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-config`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{CLUSTER}/secrets`
- **需求**: `prd/kube-frontend/cluster-management/cluster-config.md`

## 产品功能

集群级保密字典的普通行提供编辑信息/编辑 YAML/删除，镜像仓库类型且非默认的行另提供「设为默认镜像仓库」；写按行所属项目寻址；联邦托管行无操作。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-config.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-04** — 已知集群级「保密字典」页里有一条普通 Secret 与一条联邦托管的 Secret，当打开普通行的更多操作，则提供「编辑信息 / 编辑 YAML / 删除」，镜像仓库类型且非默认的行另提供「设为默认镜像仓库」；联邦托管行不渲染任何操作；编辑信息保存后按**该行自己的项目**更新注解，删除确认后该对象从列表消失。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-config.md`](../../../../design/kube-frontend/cluster-management/cluster-config.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目定位一份配置 (Priority: P1)

作为 **集群管理员**，我希望 **不进入具体项目就按名称检索集群里的保密字典 / 配置字典 / 服务账号**，以便 **先确认对象属于哪个项目，再跳到该项目里处理**。

**Independent Test**：打开集群级保密字典页，核对行数等于 `min(20, total)`、项目列等于对象命名空间、名称链接含 `/projects/<namespace>/secrets/<name>`；对配置字典与服务账号各重复一次。

## 前置与配置

- 已登录，host 集群，admin
- 用例在 default 创建一条唯一命名的 dockerconfigjson Secret，结束后删除

## 测试步骤

1. 用 API 创建 Secret tc-e2e-sec-<stamp>
2. 打开 /kube-frontend/clusters/host/secrets，搜索到该名称
3. 打开该行更多操作，核对四项（设为默认 / 编辑信息 / 编辑 YAML / 删除）
4. 点「编辑信息」，修改描述并确认；用 API 回读 kubesphere.io/description
5. 再打开更多操作点「删除」，在确认弹窗输入名称并确认；用列表确认对象消失

## 期望结果

- 四项操作齐全且顺序为 设为默认 → 编辑信息 → 编辑 YAML → 删除
- 编辑信息按行所属项目更新注解
- 删除后对象从列表与 API 集合中消失

## 失败排查

- 没有「设为默认」：类型不是 dockerconfigjson，或已经是默认
- 编辑保存 404：写到了没有 namespaces 段的路径

## 产品改版后如何更新自动化

- 行 data-ai-row=<namespace>/<name>；菜单项文案见 secrets.action.setDefault / resource.action.*
