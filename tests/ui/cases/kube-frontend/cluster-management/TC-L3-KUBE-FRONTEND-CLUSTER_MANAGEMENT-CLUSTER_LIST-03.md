# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-03 集群列表 · 移除成员集群

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-list`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/cluster-list.md`

## 产品功能

非主集群可从行操作「移除集群」，需输入集群名确认；移除后 Cluster 对象不存在，列表不再包含它；主集群行没有该操作。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-list.md`](../../../../prd/kube-frontend/cluster-management/cluster-list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-03** — 已知列表里有一个非主集群，当通过行操作「移除集群」并输入集群名确认，则该 `Cluster` 对象被删除（回读 404），列表不再包含它；主集群行没有「移除集群」；未输入正确名称时确认按钮不可用。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-list.md`](../../../../design/kube-frontend/cluster-management/cluster-list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-list.md`](../../../../prd/kube-frontend/cluster-management/cluster-list.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 移除一个不再管理的集群 (Priority: P1)

作为 **平台管理员**，我希望 **把成员集群从平台移除**，以便 **不再管理的集群不会继续出现在项目与工作负载视图里**。

**Independent Test**：接入一个临时集群，从行操作移除并回读对象，确认 404；成员集群本身不被改动。

## 前置与配置

- 已登录平台管理
- 用例先创建一个临时 proxy 集群对象（tc-e2e- 前缀），finally 中确保删除

## 测试步骤

1. 用 API 创建一个临时 proxy 集群
2. 打开集群列表，定位该集群行
3. 打开行操作菜单，点「移除集群」
4. 核对确认按钮在输入名称前不可用
5. 输入集群名并确认
6. 用 API 回读该集群对象
7. 核对主集群行没有「移除集群」

## 期望结果

- 确认按钮只有在输入名称后才可用
- 移除后回读该对象为 404，列表不再包含它
- 主集群行没有「移除集群」入口

## 失败排查

- 移除后仍能读到：确认删的是集群对象而不是其它资源
- 出现「移除集群」在主集群上：角色判定应来自 cluster-role.kubesphere.io/host 标签
- 对话框无法确认：输入必须与对象名完全一致

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_fleet.py 与 MultiClusterListPage.tsx
